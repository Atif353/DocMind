const express = require('express');
const { StringDecoder } = require('string_decoder');
const { asyncHandler, HttpError } = require('../middleware/errors');
const { cleanString, uuid } = require('../lib/validation');
const { parseSseData, writeSse } = require('../lib/sse');

function createChatRouter({ supabase, authenticate, aiEngine }) {
  const router = express.Router();

  async function accessibleDocuments(user) {
    let query = supabase.from('documents').select('id, title').eq('status', 'ready');
    if (!['admin', 'manager'].includes(user.role)) query = query.eq('uploaded_by', user.id);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  router.get('/', authenticate, asyncHandler(async (req, res) => {
    const { data, error } = await supabase
      .from('chats')
      .select('id, title, created_at, updated_at')
      .eq('user_id', req.user.id)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  }));

  router.get('/:chatId/messages', authenticate, asyncHandler(async (req, res) => {
    const chatId = uuid(req.params.chatId, 'Chat identifier');
    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .select('id, user_id')
      .eq('id', chatId)
      .maybeSingle();

    if (chatError) throw chatError;
    if (!chat) throw new HttpError(404, 'Chat not found.');
    if (chat.user_id !== req.user.id) throw new HttpError(403, 'You do not have access to this chat.');

    const { data, error } = await supabase
      .from('chat_messages')
      .select('id, role, content, citations, created_at')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    res.json(data || []);
  }));

  router.post('/stream', authenticate, asyncHandler(async (req, res) => {
    const query = cleanString(req.body.query, { name: 'Query', min: 1, max: 4000 });
    const requestedDocumentId = req.body.doc_id ? uuid(req.body.doc_id, 'Document identifier') : null;
    const documents = await accessibleDocuments(req.user);
    const allowedDocumentIds = documents.map(document => document.id);

    if (!allowedDocumentIds.length) {
      throw new HttpError(409, 'No indexed documents are available for your account.');
    }
    if (requestedDocumentId && !allowedDocumentIds.includes(requestedDocumentId)) {
      throw new HttpError(403, 'You do not have access to the selected document.');
    }

    let chatId = req.body.chat_id ? uuid(req.body.chat_id, 'Chat identifier') : null;
    if (chatId) {
      const { data: chat, error } = await supabase
        .from('chats')
        .select('id, user_id')
        .eq('id', chatId)
        .maybeSingle();
      if (error) throw error;
      if (!chat) throw new HttpError(404, 'Chat not found.');
      if (chat.user_id !== req.user.id) throw new HttpError(403, 'You do not have access to this chat.');
    } else {
      const title = `${query.slice(0, 60)}${query.length > 60 ? '…' : ''}`;
      const { data: chat, error } = await supabase
        .from('chats')
        .insert({ title, user_id: req.user.id })
        .select('id')
        .single();
      if (error) throw error;
      chatId = chat.id;
    }

    const { error: messageError } = await supabase
      .from('chat_messages')
      .insert({ chat_id: chatId, role: 'user', content: query });
    if (messageError) throw messageError;

    const controller = new AbortController();
    const deadline = setTimeout(() => controller.abort(), 180000);
    deadline.unref();
    res.once('finish', () => clearTimeout(deadline));
    res.once('close', () => controller.abort());

    let upstream;
    try {
      upstream = await aiEngine.streamAnswer({
        query,
        doc_id: requestedDocumentId,
        doc_title: requestedDocumentId
          ? documents.find(document => document.id === requestedDocumentId)?.title
          : 'All Documents',
        allowed_doc_ids: requestedDocumentId ? [requestedDocumentId] : allowedDocumentIds
      }, controller.signal);
    } catch (error) {
      clearTimeout(deadline);
      throw new HttpError(502, 'The AI service is unavailable. Please try again shortly.');
    }

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    writeSse(res, chatId, 'chat');

    let buffer = '';
    let answer = '';
    let citations = [];
    let upstreamFailed = false;
    let receivedMetadata = false;
    const decoder = new StringDecoder('utf8');
    const heartbeat = setInterval(() => {
      if (!res.destroyed) res.write(': keepalive\n\n');
    }, 15000);

    function consume(message) {
      const event = message
        .replace(/\r\n/g, '\n')
        .split('\n')
        .find(line => line.startsWith('event:'))
        ?.slice(6)
        .trim();
      if (event === 'error') {
        upstreamFailed = true;
        return;
      }
      const data = parseSseData(message);
      if (data.startsWith('[METADATA]')) {
        try {
          citations = JSON.parse(data.slice(10).trim()).citations || [];
          receivedMetadata = true;
        } catch (error) {
          console.warn(JSON.stringify({ level: 'warn', chatId, message: error.message }));
        }
      } else if (data && data !== 'close') {
        answer += data;
      }
    }

    try {
      for await (const chunk of upstream.data) {
        if (res.destroyed) break;
        const text = decoder.write(chunk);
        res.write(text);
        buffer = (buffer + text).replace(/\r\n/g, '\n');
        let boundary = buffer.indexOf('\n\n');
        while (boundary !== -1) {
          consume(buffer.slice(0, boundary));
          buffer = buffer.slice(boundary + 2);
          boundary = buffer.indexOf('\n\n');
        }
      }
      buffer += decoder.end();
      if (buffer.trim()) consume(buffer);
      if (res.destroyed) return;
      if (upstreamFailed) {
        return;
      }
      if (!receivedMetadata || !answer.trim()) throw new Error('The AI stream ended before completion.');
      try {
        const { error: saveError } = await supabase
          .from('chat_messages')
          .insert({ chat_id: chatId, role: 'assistant', content: answer.trim(), citations });
        if (saveError) throw saveError;
        const { error: updateError } = await supabase
          .from('chats')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', chatId);
        if (updateError) throw updateError;
        writeSse(res, 'close', 'end');
      } catch (error) {
        console.error(JSON.stringify({ level: 'error', chatId, message: error.message }));
        writeSse(res, JSON.stringify({ message: 'The answer was generated but could not be saved.' }), 'error');
      }
    } catch (error) {
      console.error(JSON.stringify({ level: 'error', chatId, message: error.message }));
      if (!res.destroyed && !res.writableEnded) {
        writeSse(res, JSON.stringify({ message: 'The AI stream was interrupted.' }), 'error');
      }
    } finally {
      clearInterval(heartbeat);
      clearTimeout(deadline);
      if (!res.writableEnded) res.end();
    }
  }));

  return router;
}

module.exports = { createChatRouter };

