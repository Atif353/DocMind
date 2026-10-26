const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { parseSseData } = require('../src/lib/sse');
const { cleanString, emailAddress, uuid } = require('../src/lib/validation');
const { isInside } = require('../src/routes/documents');

test('SSE parser preserves multiline payloads', () => {
  assert.equal(parseSseData('data: first\r\ndata: second'), 'first\nsecond');
});

test('validation normalizes accepted values', () => {
  assert.equal(cleanString('  hello  ', { name: 'Value' }), 'hello');
  assert.equal(emailAddress(' Person@Example.COM '), 'person@example.com');
  assert.equal(uuid('123e4567-e89b-42d3-a456-426614174000'), '123e4567-e89b-42d3-a456-426614174000');
});

test('path containment rejects traversal and the root itself', () => {
  const root = path.resolve('uploads');
  assert.equal(isInside(root, path.join(root, 'file.pdf')), true);
  assert.equal(isInside(root, path.resolve(root, '..', 'file.pdf')), false);
  assert.equal(isInside(root, root), false);
});
