import test from 'node:test';
import assert from 'node:assert/strict';

import { createGitScopeController } from '../js/app-controller.js';

function makeResponse(ok, data, extra = {}) {
  return {
    ok,
    type: ok ? 'success' : (extra.type || 'http_error'),
    status: extra.status ?? (ok ? 200 : 500),
    message: extra.message || (ok ? 'OK' : 'Error'),
    data,
    rateLimit: extra.rateLimit ?? null,
    pagination: extra.pagination ?? { hasNext: false, hasPrev: false },
  };
}

function createMockApiClient(overrides = {}) {
  const calls = [];
  const client = {
    calls,
    getRepository: async (...args) => {
      calls.push({ method: 'getRepository', args });
      return overrides.getRepository ? overrides.getRepository(...args) : makeResponse(true, { id: 1, full_name: 'octocat/Hello-World', name: 'Hello-World', owner: { login: 'octocat' }, default_branch: 'main' });
    },
    getBranches: async (...args) => {
      calls.push({ method: 'getBranches', args });
      return overrides.getBranches ? overrides.getBranches(...args) : makeResponse(true, [{ name: 'main', commit: { sha: 'mainsha' }, protected: false }], { pagination: { hasNext: false, hasPrev: false } });
    },
    getCommits: async (...args) => {
      calls.push({ method: 'getCommits', args });
      return overrides.getCommits ? overrides.getCommits(...args) : makeResponse(true, [{ sha: 'commit1', commit: { message: 'Initial commit', author: { name: 'Octocat', date: '2024-01-01T00:00:00Z' } }, parents: [] }], { pagination: { hasNext: false, hasPrev: false } });
    },
    getCommit: async (...args) => {
      calls.push({ method: 'getCommit', args });
      return overrides.getCommit ? overrides.getCommit(...args) : makeResponse(true, { sha: 'commit1', commit: { message: 'Initial commit', author: { name: 'Octocat', date: '2024-01-01T00:00:00Z' } }, parents: [], files: [] });
    },
  };
  return client;
}

test('loads repository, branches, and first commit page', async () => {
  const apiClient = createMockApiClient();
  const controller = createGitScopeController({ apiClient });

  const state = await controller.checkRepository('https://github.com/octocat/Hello-World');

  assert.equal(state.status, 'success');
  assert.equal(state.repository.fullName, 'octocat/Hello-World');
  assert.equal(state.selectedBranch, 'main');
  assert.equal(state.branches.length, 1);
  assert.equal(state.commits.length, 1);
  assert.equal(state.commits[0].sha, 'commit1');
});

test('selecting a branch reloads commits', async () => {
  const apiClient = createMockApiClient({
    getBranches: async () => makeResponse(true, [
      { name: 'main', commit: { sha: 'mainsha' }, protected: false },
      { name: 'dev', commit: { sha: 'devsha' }, protected: false },
    ], { pagination: { hasNext: false, hasPrev: false } }),
    getCommits: async (_owner, _repo, params) => makeResponse(true, [
      { sha: params.sha === 'dev' ? 'devcommit' : 'maincommit', commit: { message: 'Commit', author: { name: 'Octocat', date: '2024-01-01T00:00:00Z' } }, parents: [] },
    ], { pagination: { hasNext: false, hasPrev: false } }),
  });
  const controller = createGitScopeController({ apiClient });

  await controller.checkRepository('https://github.com/octocat/Hello-World');
  const state = await controller.selectBranch('dev');

  assert.equal(state.selectedBranch, 'dev');
  assert.equal(state.commits.length, 1);
  assert.equal(state.commits[0].sha, 'devcommit');
});

test('load more commits appends and deduplicates', async () => {
  let page = 0;
  const apiClient = createMockApiClient({
    getCommits: async (_owner, _repo, params) => {
      page += 1;
      const sha = page === 1 ? 'commit1' : 'commit2';
      return makeResponse(true, [
        { sha, commit: { message: 'Commit', author: { name: 'Octocat', date: '2024-01-01T00:00:00Z' } }, parents: [] },
      ], { pagination: { hasNext: page === 1, hasPrev: page > 1 } });
    },
  });
  const controller = createGitScopeController({ apiClient });

  await controller.checkRepository('https://github.com/octocat/Hello-World');
  const first = controller.getState();
  assert.equal(first.hasMoreCommits, true);

  const second = await controller.loadMoreCommits();
  assert.equal(second.commits.length, 2);
  assert.equal(second.commits[0].sha, 'commit1');
  assert.equal(second.commits[1].sha, 'commit2');
  assert.equal(second.hasMoreCommits, false);
});

test('selecting a commit loads detail', async () => {
  const apiClient = createMockApiClient({
    getCommit: async (_owner, _repo, sha) => makeResponse(true, {
      sha,
      commit: { message: 'Detail commit', author: { name: 'Octocat', date: '2024-01-01T00:00:00Z' } },
      parents: [{ sha: 'parent1' }],
      files: [{ filename: 'README.md', status: 'modified', additions: 1, deletions: 0, changes: 1, patch: '@@ -1 +1 @@' }],
      stats: { additions: 1, deletions: 0, total: 1 },
    }),
  });
  const controller = createGitScopeController({ apiClient });

  await controller.checkRepository('https://github.com/octocat/Hello-World');
  const state = await controller.selectCommit('commit1');

  assert.equal(state.selectedCommitSha, 'commit1');
  assert.equal(state.commitDetailStatus, 'success');
  assert.equal(state.commitDetail.sha, 'commit1');
  assert.equal(state.commitDetail.files.length, 1);
  assert.equal(state.commitDetail.files[0].filename, 'README.md');
});

test('cache hit avoids repeated repository request', async () => {
  let calls = 0;
  const apiClient = createMockApiClient({
    getRepository: async () => {
      calls += 1;
      return makeResponse(true, { id: 1, full_name: 'octocat/Hello-World', name: 'Hello-World', owner: { login: 'octocat' }, default_branch: 'main' });
    },
  });
  const controller = createGitScopeController({ apiClient });

  await controller.checkRepository('https://github.com/octocat/Hello-World');
  const firstCalls = calls;
  await controller.checkRepository('https://github.com/octocat/Hello-World');

  assert.equal(calls, firstCalls);
  const state = controller.getState();
  assert.equal(state.repositoryFromCache, true);
});

test('new repository request cancels previous repository request', async () => {
  const apiClient = createMockApiClient();
  // Override getRepository to respect abort.
  apiClient.getRepository = async (_owner, _repo, options = {}) => {
    apiClient.calls.push({ method: 'getRepository', args: [_owner, _repo, options] });
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve(makeResponse(true, { id: 2, full_name: 'octocat/Second', name: 'Second', owner: { login: 'octocat' }, default_branch: 'main' })), 50);
      options.signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      }, { once: true });
    });
  };

  const controller = createGitScopeController({ apiClient });
  const first = controller.checkRepository('https://github.com/octocat/First');
  const second = controller.checkRepository('https://github.com/octocat/Second');

  const finalState = await second;
  assert.equal(finalState.status, 'success');
  assert.equal(finalState.repository.id, 2);

  await first.catch(() => {});
  const afterFirst = controller.getState();
  assert.equal(afterFirst.repository.id, 2);
});

test('commit detail error does not destroy dashboard', async () => {
  const apiClient = createMockApiClient({
    getCommit: async () => makeResponse(false, null, { type: 'not_found', status: 404, message: 'Commit not found' }),
  });
  const controller = createGitScopeController({ apiClient });

  await controller.checkRepository('https://github.com/octocat/Hello-World');
  const state = await controller.selectCommit('missingcommit');

  assert.equal(state.status, 'success');
  assert.equal(state.repository.fullName, 'octocat/Hello-World');
  assert.equal(state.commitDetailStatus, 'error');
  assert.equal(state.commitDetail, null);
});
