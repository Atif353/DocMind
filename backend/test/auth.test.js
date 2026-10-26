const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { createAuthenticator, authorizeRoles } = require('../src/middleware/auth');

const config = {
  jwtSecret: 'test-secret-that-is-long-enough-for-hmac',
  jwtIssuer: 'docmind-api',
  jwtAudience: 'docmind-web'
};

function response() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    }
  };
}

test('authenticator accepts a valid signed token', () => {
  const token = jwt.sign(
    { id: 'user-1', email: 'person@example.com', role: 'viewer' },
    config.jwtSecret,
    { issuer: config.jwtIssuer, audience: config.jwtAudience }
  );
  const req = { get: name => name === 'authorization' ? `Bearer ${token}` : undefined };
  const res = response();
  let called = false;

  createAuthenticator(config)(req, res, () => { called = true; });

  assert.equal(called, true);
  assert.equal(req.user.id, 'user-1');
});

test('authenticator rejects tokens from another audience', () => {
  const token = jwt.sign(
    { id: 'user-1', role: 'viewer' },
    config.jwtSecret,
    { issuer: config.jwtIssuer, audience: 'other-app' }
  );
  const req = { get: () => `Bearer ${token}` };
  const res = response();

  createAuthenticator(config)(req, res, () => assert.fail('next should not run'));

  assert.equal(res.statusCode, 401);
});

test('role middleware enforces the allow list', () => {
  const req = { user: { role: 'viewer' } };
  const res = response();
  authorizeRoles('admin', 'manager')(req, res, () => assert.fail('next should not run'));
  assert.equal(res.statusCode, 403);
});

