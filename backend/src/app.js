const express = require('express');
const cors = require('cors');
const { createAuthenticator } = require('./middleware/auth');
const { requestContext, createRateLimiter } = require('./middleware/security');
const { notFoundHandler, errorHandler } = require('./middleware/errors');
const { createAuthRouter } = require('./routes/auth');
const { createDocumentsRouter } = require('./routes/documents');
const { createChatRouter } = require('./routes/chat');

function createApp({ config, supabase, aiEngine }) {
  const app = express();
  const authenticate = createAuthenticator(config, supabase);

  app.set('trust proxy', config.trustProxy || false);
  app.disable('x-powered-by');
  app.use(requestContext);
  app.use(cors({
    origin(origin, callback) {
      if (!origin || config.corsOrigins.includes(origin)) return callback(null, true);
      return callback(Object.assign(new Error('Origin is not allowed.'), { status: 403 }));
    },
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-Id'],
    maxAge: 86400
  }));
  app.use(express.json({ limit: '1mb', inflate: false }));
  app.use((req, res, next) => {
    if (req.method === 'POST' && !req.is('multipart/form-data') && (!req.body || Array.isArray(req.body))) {
      return res.status(400).json({ error: 'A JSON object is required.' });
    }
    return next();
  });
  app.use(createRateLimiter());

  app.get('/health/live', (req, res) => res.json({ status: 'ok' }));
  app.get('/health/ready', async (req, res) => {
    try {
      await Promise.all([
        aiEngine.health(),
        supabase.from('documents').select('id', { head: true }).limit(1).then(({ error }) => {
          if (error) throw error;
        }),
        supabase.rpc('docmind_schema_version').then(({ data, error }) => {
          if (error || data !== 2) throw new Error('Apply the database migrations.');
        })
      ]);
      res.json({ status: 'ready' });
    } catch {
      res.status(503).json({ status: 'not_ready' });
    }
  });
  app.get('/health', (req, res) => res.json({ status: 'ok', service: 'docmind-gateway' }));

  app.use(
    '/api/auth',
    createRateLimiter({ windowMs: 15 * 60 * 1000, limit: 30 }),
    createAuthRouter({ config, supabase, authenticate })
  );
  app.use('/api/documents', createDocumentsRouter({ config, supabase, authenticate, aiEngine }));
  app.use('/api/chat', createChatRouter({ supabase, authenticate, aiEngine }));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };

