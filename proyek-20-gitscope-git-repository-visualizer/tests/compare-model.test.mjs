import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeComparison } from '../js/compare-model.js';

test('normalizes a complete comparison', () => {
  const result = normalizeComparison({
    status: 'ahead',
    ahead_by: 2,
    behind_by: 0,
    total_commits: 2,
    base_commit: { sha: 'base123', commit: { message: 'Base', author: { name: 'Octocat', date: '2024-01-01T00:00:00Z' } } },
    merge_base_commit: { sha: 'base123', commit: { message: 'Base', author: { name: 'Octocat', date: '2024-01-01T00:00:00Z' } } },
    commits: [
      { sha: 'head1', commit: { message: 'Head 1', author: { name: 'Octocat', date: '2024-01-02T00:00:00Z' } }, parents: [] },
    ],
    files: [
      { filename: 'README.md', status: 'modified', additions: 3, deletions: 1, changes: 4, patch: '@@ -1 +1 @@' },
    ],
    stats: { additions: 3, deletions: 1, total: 4 },
    html_url: 'https://github.com/octocat/Hello-World/compare/main...dev',
  }, { base: 'main', head: 'dev' });

  assert.equal(result.ok, true);
  assert.equal(result.comparison.base, 'main');
  assert.equal(result.comparison.head, 'dev');
  assert.equal(result.comparison.status, 'ahead');
  assert.equal(result.comparison.aheadBy, 2);
  assert.equal(result.comparison.behindBy, 0);
  assert.equal(result.comparison.totalCommits, 2);
  assert.equal(result.comparison.commits.length, 1);
  assert.equal(result.comparison.files.length, 1);
  assert.equal(result.comparison.files[0].filename, 'README.md');
  assert.equal(result.comparison.filesPossiblyTruncated, false);
});

test('handles missing optional comparison fields', () => {
  const result = normalizeComparison({
    status: 'identical',
  }, { base: 'main', head: 'main' });

  assert.equal(result.ok, true);
  assert.equal(result.comparison.status, 'identical');
  assert.equal(result.comparison.aheadBy, 0);
  assert.equal(result.comparison.behindBy, 0);
  assert.equal(result.comparison.totalCommits, 0);
  assert.equal(result.comparison.commits.length, 0);
  assert.equal(result.comparison.files.length, 0);
  assert.equal(result.comparison.filesAvailable, false);
});

test('handles renamed files and missing patch', () => {
  const result = normalizeComparison({
    status: 'diverged',
    ahead_by: 1,
    behind_by: 1,
    commits: [],
    files: [
      { filename: 'new.md', status: 'renamed', additions: 2, deletions: 2, changes: 4, previous_filename: 'old.md' },
      { filename: 'binary.png', status: 'added', additions: 0, deletions: 0, changes: 0 },
    ],
  }, { base: 'main', head: 'dev' });

  assert.equal(result.ok, true);
  assert.equal(result.comparison.files[0].previousFilename, 'old.md');
  assert.equal(result.comparison.files[1].patch, null);
});

test('rejects invalid comparison response', () => {
  const result = normalizeComparison(null, { base: 'main', head: 'dev' });
  assert.equal(result.ok, false);
});

test('flags a file list that may have hit the GitHub 300-file cap', () => {
  const files = Array.from({ length: 300 }, (_, index) => ({
    filename: `file-${index}.txt`,
    status: 'modified',
    additions: 1,
    deletions: 1,
    changes: 2,
  }));
  const result = normalizeComparison({
    status: 'ahead',
    ahead_by: 1,
    behind_by: 0,
    commits: [],
    files,
  }, { base: 'main', head: 'dev' });

  assert.equal(result.ok, true);
  assert.equal(result.comparison.files.length, 300);
  assert.equal(result.comparison.filesAvailable, true);
  assert.equal(result.comparison.filesPossiblyTruncated, true);
});
