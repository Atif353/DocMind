const path = require('path');
const dotenv = require('dotenv');

const backendRoot = path.resolve(__dirname, '../..');
const projectRoot = path.resolve(backendRoot, '..');

dotenv.config({ path: path.join(projectRoot, '.env'), quiet: true });
dotenv.config({ path: path.join(backendRoot, '.env'), quiet: true });

function requireValue(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function integerValue(name, fallback, minimum, maximum) {
  const value = Number(process.env[name] || fallback);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be between ${minimum} and ${maximum}`);
  }
  return value;
}

function csvValue(name, fallback = '') {
  return (process.env[name] || fallback)
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
}

function loadConfig() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const jwtSecret = requireValue('JWT_SECRET');
  const internalApiKey = process.env.INTERNAL_API_KEY?.trim() || '';

  if (jwtSecret.length < 32 || /replace-with|change-me/i.test(jwtSecret)) {
    throw new Error('JWT_SECRET must contain at least 32 random characters');
  }
  if (internalApiKey.length < 32 || /replace-with|change-me/i.test(internalApiKey)) {
    throw new Error('INTERNAL_API_KEY must contain at least 32 random characters');
  }

  return Object.freeze({
    nodeEnv,
    isProduction: nodeEnv === 'production',
    port: integerValue('PORT', 5000, 1, 65535),
    jwtSecret,
    jwtIssuer: process.env.JWT_ISSUER || 'docmind-api',
    jwtAudience: process.env.JWT_AUDIENCE || 'docmind-web',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
    bcryptRounds: integerValue('BCRYPT_ROUNDS', 12, 10, 15),
    corsOrigins: csvValue('CORS_ORIGINS', 'http://localhost:3000'),
    supabaseUrl: requireValue('SUPABASE_URL'),
    supabaseKey: (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_KEY || '').trim()
      || requireValue('SUPABASE_SECRET_KEY'),
    aiEngineUrl: process.env.AI_ENGINE_URL || 'http://localhost:8000',
    aiEngineTimeoutMs: integerValue('AI_ENGINE_TIMEOUT_MS', 120000, 1000, 600000),
    internalApiKey,
    workerPollMs: integerValue('WORKER_POLL_MS', 5000, 100, 60000),
    trustProxy: integerValue('TRUST_PROXY_HOPS', nodeEnv === 'production' ? 1 : 0, 0, 5),
    bootstrapAdminEmails: new Set(csvValue('BOOTSTRAP_ADMIN_EMAILS').map(email => email.toLowerCase())),
    uploadDir: path.resolve(process.env.UPLOAD_DIR || path.join(backendRoot, 'uploads'))
  });
}

module.exports = { loadConfig };

