const crypto = require('crypto');

function createDocumentWorker({ supabase, aiEngine, config }) {
  const workerId = crypto.randomUUID();
  let stopped = false;
  let timer;
  let current = Promise.resolve();
  let lastError = '';

  async function processNext() {
    const { data, error } = await supabase.rpc('claim_document_job', { worker_id: workerId });
    if (error) throw new Error('Document queue unavailable. Check Supabase and apply migrations 001 and 002.');
    const document = data?.[0];
    if (!document) return;
    let result;
    try {
      const response = await aiEngine.processDocument({
        doc_id: document.id, file_path: document.file_path, doc_title: document.title
      });
      if (!response.data?.success) throw new Error('The AI service rejected the document.');
      result = { status: 'ready', processing_error: null };
    } catch (error) {
      console.error(JSON.stringify({ level: 'error', documentId: document.id, message: error.message }));
      const terminal = document.attempts >= 3;
      result = {
        status: terminal ? 'failed' : 'processing',
        processing_error: 'Indexing failed. Check the PDF, Gemini credentials and API quota, then retry.',
        next_attempt_at: new Date(Date.now() + 30000 * document.attempts).toISOString()
      };
    }
    const { error: saveError } = await supabase.from('documents').update({
      ...result, lease_owner: null, lease_expires_at: null
    }).eq('id', document.id).eq('lease_owner', workerId);
    if (saveError) throw saveError;
    console.log(JSON.stringify({ level: 'info', message: 'Document job finished', documentId: document.id, status: result.status }));
  }

  async function tick() {
    try {
      await processNext();
      lastError = '';
    } catch (error) {
      if (lastError !== error.message) {
        console.error(JSON.stringify({ level: 'error', message: error.message }));
        lastError = error.message;
      }
    } finally {
      if (!stopped) timer = setTimeout(() => { current = tick(); }, config.workerPollMs);
    }
  }

  return {
    start() { current = tick(); },
    async stop() { stopped = true; clearTimeout(timer); await current; },
    processNext
  };
}

module.exports = { createDocumentWorker };
