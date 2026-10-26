const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const crypto = require('crypto');
const { asyncHandler, HttpError } = require('../middleware/errors');
const { authorizeRoles } = require('../middleware/auth');
const { uuid } = require('../lib/validation');

function isInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

async function hasPdfSignature(filePath) {
  const handle = await fsp.open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(5);
    const { bytesRead } = await handle.read(buffer, 0, 5, 0);
    return bytesRead === 5 && buffer.toString('ascii') === '%PDF-';
  } finally {
    await handle.close();
  }
}

function createDocumentsRouter({ config, supabase, authenticate, aiEngine }) {
  const router = express.Router();
  fs.mkdirSync(config.uploadDir, { recursive: true });

  const upload = multer({
    storage: multer.diskStorage({
      destination: config.uploadDir,
      filename(req, file, callback) {
        callback(null, `${Date.now()}-${crypto.randomUUID()}.pdf`);
      }
    }),
    fileFilter(req, file, callback) {
      const accepted = file.mimetype === 'application/pdf' && path.extname(file.originalname).toLowerCase() === '.pdf';
      callback(accepted ? null : new HttpError(400, 'Only PDF files are supported.'), accepted);
    },
    limits: { fileSize: 50 * 1024 * 1024, files: 1 }
  });

  router.post(
    '/upload',
    authenticate,
    authorizeRoles('admin', 'manager', 'editor'),
    upload.single('file'),
    asyncHandler(async (req, res) => {
      if (!req.file) throw new HttpError(400, 'Select a PDF to upload.');

      const filePath = path.resolve(req.file.path);
      try {
        if (!isInside(config.uploadDir, filePath) || !await hasPdfSignature(filePath)) {
          throw new HttpError(400, 'The uploaded file is not a valid PDF.');
        }

        const title = path.basename(req.file.originalname).slice(0, 255);
        const { data: document, error } = await supabase
          .from('documents')
          .insert({ title, file_path: filePath, status: 'processing', uploaded_by: req.user.id })
          .select('id, title, status, uploaded_by, created_at')
          .single();

        if (error) throw error;
        res.status(202).json({ message: 'Document accepted for indexing.', document });
      } catch (error) {
        await fsp.unlink(filePath).catch(() => {});
        throw error;
      }
    })
  );

  router.get('/', authenticate, asyncHandler(async (req, res) => {
    let query = supabase
      .from('documents')
      .select('id, title, status, uploaded_by, created_at, updated_at, processing_error, attempts');
    if (!['admin', 'manager'].includes(req.user.role)) {
      query = query.eq('uploaded_by', req.user.id);
    }
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  }));

  router.post('/:id/retry', authenticate, authorizeRoles('admin', 'manager', 'editor'), asyncHandler(async (req, res) => {
    const documentId = uuid(req.params.id, 'Document identifier');
    let query = supabase.from('documents').update({
      status: 'processing', attempts: 0, processing_error: null,
      lease_owner: null, lease_expires_at: null, next_attempt_at: new Date().toISOString()
    }).eq('id', documentId).eq('status', 'failed');
    if (req.user.role === 'editor') query = query.eq('uploaded_by', req.user.id);
    const { data, error } = await query.select('id, title, status').maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(409, 'Only failed documents you can access may be retried.');
    return res.status(202).json({ document: data });
  }));

  router.delete('/:id', authenticate, authorizeRoles('admin', 'manager', 'editor'), asyncHandler(async (req, res) => {
    const documentId = uuid(req.params.id, 'Document identifier');
    const { data: document, error: lookupError } = await supabase
      .from('documents')
      .select('id, file_path, uploaded_by, status')
      .eq('id', documentId)
      .maybeSingle();

    if (lookupError) throw lookupError;
    if (!document) throw new HttpError(404, 'Document not found.');
    if (req.user.role === 'editor' && document.uploaded_by !== req.user.id) {
      throw new HttpError(403, 'You can only delete documents you uploaded.');
    }

    if (document.status === 'processing') throw new HttpError(409, 'Wait for document processing before deleting.');
    try {
      await aiEngine.deleteDocument(documentId);
    } catch {
      throw new HttpError(502, 'The index could not be removed. Please retry when the AI service is available.');
    }

    const { error: deleteError } = await supabase.from('documents').delete().eq('id', documentId);
    if (deleteError) throw deleteError;

    const storedPath = path.resolve(document.file_path);
    if (isInside(config.uploadDir, storedPath)) await fsp.unlink(storedPath).catch(() => {});
    res.status(204).end();
  }));

  return router;
}

module.exports = { createDocumentsRouter, hasPdfSignature, isInside };
