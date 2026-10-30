import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeRepository } from '../js/repo-model.js';

test('normalizes complete repository metadata', () => {
  const result = normalizeRepository({
    id: 1,
    name: 'Hello-World',
    full_name: 'octocat/Hello-World',
    owner: { login: 'octocat' },
    description: 'Test repo',
    default_branch: 'main',
    language: 'JavaScript',
    stargazers_count: 10,
    forks_count: 2,
    open_issues_count: 1,
    updated_at: '2024-01-01T00:00:00Z',
    html_url: 'https://github.com/octocat/Hello-World',
  });

  assert.equal(result.ok, true);
  assert.equal(result.repository.fullName, 'octocat/Hello-World');
  assert.equal(result.repository.defaultBranch, 'main');
  assert.equal(result.repository.stars, 10);
  assert.equal(result.repository.openIssues, 1);
});

test('handles missing optional repository fields', () => {
  const result = normalizeRepository({
    name: 'Hello-World',
    owner: {},
  });

  assert.equal(result.ok, true);
  assert.equal(result.repository.fullName, 'Hello-World');
  assert.equal(result.repository.owner, '');
  assert.equal(result.repository.description, null);
  assert.equal(result.repository.defaultBranch, null);
  assert.equal(result.repository.stars, 0);
});

test('rejects invalid repository metadata', () => {
  const result = normalizeRepository(null);
  assert.equal(result.ok, false);
});
