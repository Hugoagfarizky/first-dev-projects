import test from 'node:test';
import assert from 'node:assert/strict';

import { validateRepositoryUrl } from '../js/url-validator.js';

function valid(value) {
  const result = validateRepositoryUrl(value);
  assert.equal(result.ok, true, `expected valid: ${value}`);
  return result;
}

function invalid(value) {
  const result = validateRepositoryUrl(value);
  assert.equal(result.ok, false, `expected invalid: ${value}`);
  assert.equal(typeof result.error, 'string');
  assert.notEqual(result.error, '');
  return result;
}

test('accepts a basic GitHub repository URL', () => {
  const result = valid('https://github.com/octocat/Hello-World');
  assert.equal(result.owner, 'octocat');
  assert.equal(result.repo, 'Hello-World');
  assert.equal(result.repository, 'octocat/Hello-World');
  assert.equal(result.url, 'https://github.com/octocat/Hello-World');
});

test('accepts trailing slash and .git suffix', () => {
  assert.deepEqual(
    valid('https://github.com/octocat/Hello-World/'),
    valid('https://github.com/octocat/Hello-World'),
  );
  assert.deepEqual(
    valid('https://github.com/octocat/Hello-World.git'),
    valid('https://github.com/octocat/Hello-World'),
  );
});

test('rejects non-GitHub hosts and subpages', () => {
  invalid('http://github.com/octocat/Hello-World');
  invalid('https://www.github.com/octocat/Hello-World');
  invalid('https://github.com.evil.example/octocat/Hello-World');
  invalid('https://github.com/octocat/Hello-World/issues');
  invalid('https://github.com/octocat/Hello-World/pull/1');
  invalid('https://github.com/octocat/Hello-World/tree/main');
});

test('rejects malformed, empty, and credential-bearing URLs', () => {
  invalid('');
  invalid('   ');
  invalid('not a url');
  invalid('https://github.com/octocat');
  invalid('https://github.com//Hello-World');
  invalid('https://user:pass@github.com/octocat/Hello-World');
  invalid('https://github.com/octocat/Hello-World?tab=readme');
  invalid('https://github.com/octocat/Hello-World#readme');
});

test('accepts common repository name characters', () => {
  const result = valid('https://github.com/a-b_c.d/e.f_g-h');
  assert.equal(result.owner, 'a-b_c.d');
  assert.equal(result.repo, 'e.f_g-h');
});

test('does not check repository existence', () => {
  const result = validateRepositoryUrl('https://github.com/this-owner-probably-does-not-exist/this-repo-probably-does-not-exist');
  assert.equal(result.ok, true);
});
