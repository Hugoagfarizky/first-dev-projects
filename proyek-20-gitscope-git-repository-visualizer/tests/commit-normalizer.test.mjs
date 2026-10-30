import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeCommitList, normalizeCommitDetail } from '../js/commit-normalizer.js';

test('normalizes commit list and deduplicates by SHA', () => {
  const result = normalizeCommitList([
    {
      sha: 'abc123def456',
      commit: {
        message: 'Initial commit\n\nDetails',
        author: { name: 'Octocat', email: 'octo@example.com', date: '2024-01-01T00:00:00Z' },
        committer: { name: 'Octocat', date: '2024-01-01T00:00:00Z' },
      },
      parents: [{ sha: 'parent1' }],
      html_url: 'https://github.com/octocat/Hello-World/commit/abc123def456',
      author: { login: 'octocat' },
    },
    {
      sha: 'abc123def456',
      commit: { message: 'Duplicate' },
    },
  ]);

  assert.equal(result.ok, true);
  assert.equal(result.commits.length, 1);
  assert.equal(result.commits[0].shortSha, 'abc123d');
  assert.equal(result.commits[0].message, 'Initial commit\n\nDetails');
  assert.equal(result.commits[0].authorName, 'Octocat');
  assert.equal(result.commits[0].authorLogin, 'octocat');
  assert.deepEqual(result.commits[0].parentShas, ['parent1']);
});

test('handles missing author and committer', () => {
  const result = normalizeCommitList([
    {
      sha: 'def456abc123',
      commit: { message: 'No author' },
      parents: [],
    },
  ]);

  assert.equal(result.ok, true);
  assert.equal(result.commits[0].authorName, null);
  assert.equal(result.commits[0].authorDate, null);
  assert.equal(result.commits[0].committerName, null);
  assert.deepEqual(result.commits[0].parentShas, []);
});

test('rejects invalid commit list', () => {
  const result = normalizeCommitList({ commits: [] });
  assert.equal(result.ok, false);
});

test('normalizes commit detail and changed files', () => {
  const result = normalizeCommitDetail({
    sha: 'abc123def456',
    commit: {
      message: 'Detail',
      author: { name: 'Octocat', date: '2024-01-01T00:00:00Z' },
      committer: { name: 'Octocat', date: '2024-01-01T00:00:00Z' },
    },
    parents: [{ sha: 'parent1' }],
    files: [
      {
        filename: 'README.md',
        status: 'modified',
        additions: 3,
        deletions: 1,
        changes: 4,
        patch: '@@ -1 +1 @@',
      },
      {
        filename: 'image.png',
        status: 'added',
        additions: 0,
        deletions: 0,
        changes: 0,
      },
    ],
    stats: { additions: 3, deletions: 1, total: 4 },
  });

  assert.equal(result.ok, true);
  assert.equal(result.commit.files.length, 2);
  assert.equal(result.commit.files[0].filename, 'README.md');
  assert.equal(result.commit.files[0].patch, '@@ -1 +1 @@');
  assert.equal(result.commit.files[1].patch, null);
  assert.equal(result.commit.stats.total, 4);
});

test('rejects invalid commit detail', () => {
  const result = normalizeCommitDetail(null);
  assert.equal(result.ok, false);
});
