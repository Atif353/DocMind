const axios = require('axios');

function createAiEngineClient(config) {
  const client = axios.create({
    baseURL: config.aiEngineUrl,
    timeout: config.aiEngineTimeoutMs,
    headers: config.internalApiKey ? { 'X-Internal-Api-Key': config.internalApiKey } : {}
  });

  return {
    processDocument(payload) {
      return client.post('/process', payload);
    },
    deleteDocument(docId) {
      return client.delete(`/documents/${docId}`);
    },
    streamAnswer(payload, signal) {
      return client.post('/query', payload, { responseType: 'stream', signal });
    },
    health() {
      return client.get('/health/ready', { timeout: 5000 });
    }
  };
}

module.exports = { createAiEngineClient };
