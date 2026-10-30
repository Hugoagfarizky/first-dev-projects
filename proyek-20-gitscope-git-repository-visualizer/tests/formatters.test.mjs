import test from 'node:test';
import assert from 'node:assert/strict';

import { sanitizeExternalUrl, truncateText } from '../js/formatters.js';

test('sanitizeExternalUrl accepts HTTPS GitHub links', () => {
  assert.equal(
    sanitizeExternalUrl('https://github.com/octocat/Hello-World'),
    'https://github.com/octocat/Hello-World',
  );
  assert.equal(
    sanitizeExternalUrl('https://github.com/octocat/Hello-World/commit/abc123'),
    'https://github.com/octocat/Hello-World/commit/abc123',
  );
});

test('sanitizeExternalUrl rejects non-HTTPS, non-GitHub, and malformed URLs', () => {
  for (const value of [
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'http://github.com/octocat/Hello-World',
    'https://github.com.evil.example/octocat/Hello-World',
    'https://user:pass@github.com/octocat/Hello-World',
    'not a url',
    '',
    null,
    undefined,
    42,
  ]) {
    assert.equal(sanitizeExternalUrl(value), null, String(value));
  }
});

test('truncateText keeps short values and marks long values', () => {
  assert.equal(truncateText('short', 10), 'short');
  assert.equal(truncateText('abcdefghij', 10), 'abcdefghij');
  assert.equal(truncateText('abcdefghijk', 10), 'abcdefghij…');
  assert.equal(truncateText(null), '');
});
