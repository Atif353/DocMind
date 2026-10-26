const http = require('http');
const { loadConfig } = require('./config/env');
const { createSupabaseClient } = require('./config/supabase');
const { createAiEngineClient } = require('./services/aiEngine');
const { createApp } = require('./app');
const { createDocumentWorker } = require('./services/documentWorker');

const config = loadConfig();
const supabase = createSupabaseClient(config);
const aiEngine = createAiEngineClient(config);
const app = createApp({ config, supabase, aiEngine });
const server = http.createServer(app);
const worker = createDocumentWorker({ config, supabase, aiEngine });

server.requestTimeout = config.aiEngineTimeoutMs + 10000;
server.headersTimeout = 15000;
server.keepAliveTimeout = 5000;

server.listen(config.port, () => {
  console.log(JSON.stringify({ level: 'info', message: 'Gateway started', port: config.port }));
  worker.start();
});

function shutdown(signal) {
  console.log(JSON.stringify({ level: 'info', message: 'Shutting down', signal }));
  const drained = new Promise(resolve => server.close(resolve));
  Promise.all([drained, worker.stop()]).then(() => process.exit(0)).catch(() => process.exit(1));
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', error => {
  console.error(JSON.stringify({ level: 'error', message: error.message, stack: error.stack }));
  shutdown('unhandledRejection');
});
