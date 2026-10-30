import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeBranches, findBranch, resolveSelectedBranch } from '../js/branch-model.js';

test('normalizes branch list and deduplicates names', () => {
  const result = normalizeBranches([
    { name: 'main', commit: { sha: 'abc123' }, protected: true },
    { name: 'dev', commit: { sha: 'def456' }, protected: false },
    { name: 'main', commit: { sha: 'duplicate' }, protected: false },
  ]);

  assert.equal(result.ok, true);
  assert.equal(result.branches.length, 2);
  assert.equal(result.branches[0].name, 'main');
  assert.equal(result.branches[0].commitSha, 'abc123');
  assert.equal(result.branches[0].protected, true);
});

test('rejects invalid branch response', () => {
  const result = normalizeBranches({ branches: [] });
  assert.equal(result.ok, false);
});

test('finds and resolves selected branch', () => {
  const branches = [
    { name: 'main', commitSha: 'abc', protected: false },
    { name: 'dev', commitSha: 'def', protected: false },
  ];

  assert.equal(findBranch(branches, 'dev').name, 'dev');
  assert.equal(findBranch(branches, 'missing'), null);
  assert.equal(resolveSelectedBranch(branches, 'main'), 'main');
  assert.equal(resolveSelectedBranch(branches, 'missing'), 'missing');
  assert.equal(resolveSelectedBranch([], 'main'), 'main');
});
