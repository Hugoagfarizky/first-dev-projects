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
      return overrides.getCommit ? overrides.getCommit(...args) : makeResponse(true, { sha: 'commit1', commit: { message: 'Detail', author: { name: 'Octocat', date: '2024-01-01T00:00:00Z' } }, parents: [], files: [] });
    },
    compare: async (...args) => {
      calls.push({ method: 'compare', args });
      return overrides.compare ? overrides.compare(...args) : makeResponse(true, { status: 'ahead', ahead_by: 1, behind_by: 0, total_commits: 1, commits: [{ sha: 'headcommit', commit: { message: 'Head commit', author: { name: 'Octocat', date: '2024-01-02T00:00:00Z' } }, parents: [] }], files: [{ filename: 'README.md', status: 'modified', additions: 1, deletions: 0, changes: 1, patch: '@@ -1 +1 @@' }] }, { pagination: { hasNext: false, hasPrev: false } });
    },
  };
  return client;
}

test('compare only runs after explicit call', async () => {
  const apiClient = createMockApiClient();
  const controller = createGitScopeController({ apiClient });
  await controller.checkRepository('https://github.com/octocat/Hello-World');

  const callsBefore = apiClient.calls.filter((call) => call.method === 'compare').length;
  assert.equal(callsBefore, 0);

  await controller.compareReferences('main', 'dev');
  const callsAfter = apiClient.calls.filter((call) => call.method === 'compare').length;
  assert.equal(callsAfter, 1);
});

test('compare stores normalized result', async () => {
  const apiClient = createMockApiClient();
  const controller = createGitScopeController({ apiClient });
  await controller.checkRepository('https://github.com/octocat/Hello-World');

  const state = await controller.compareReferences('main', 'dev');

  assert.equal(state.comparisonStatus, 'success');
  assert.equal(state.comparison.base, 'main');
  assert.equal(state.comparison.head, 'dev');
  assert.equal(state.comparison.status, 'ahead');
  assert.equal(state.comparison.aheadBy, 1);
  assert.equal(state.comparison.commits.length, 1);
  assert.equal(state.comparison.files.length, 1);
});

test('same refs are handled without crash', async () => {
  const apiClient = createMockApiClient({
    compare: async () => makeResponse(true, { status: 'identical', ahead_by: 0, behind_by: 0, total_commits: 0, commits: [], files: [] }, { pagination: { hasNext: false, hasPrev: false } }),
  });
  const controller = createGitScopeController({ apiClient });
  await controller.checkRepository('https://github.com/octocat/Hello-World');

  const state = await controller.compareReferences('main', 'main');

  assert.equal(state.comparisonStatus, 'success');
  assert.equal(state.comparison.status, 'identical');
});

test('load more comparison commits appends without removing files', async () => {
  let page = 0;
  const apiClient = createMockApiClient({
    compare: async (_owner, _repo, _base, _head, params) => {
      page += 1;
      return makeResponse(true, {
        status: 'ahead',
        ahead_by: 1,
        behind_by: 0,
        total_commits: 2,
        commits: [{ sha: page === 1 ? 'commit1' : 'commit2', commit: { message: 'Commit', author: { name: 'Octocat', date: '2024-01-01T00:00:00Z' } }, parents: [] }],
        files: page === 1 ? [{ filename: 'README.md', status: 'modified', additions: 1, deletions: 0, changes: 1, patch: '@@ -1 +1 @@' }] : [],
      }, { pagination: { hasNext: page === 1, hasPrev: page > 1 } });
    },
  });
  const controller = createGitScopeController({ apiClient });
  await controller.checkRepository('https://github.com/octocat/Hello-World');

  const first = await controller.compareReferences('main', 'dev');
  assert.equal(first.comparison.files.length, 1);

  const second = await controller.loadMoreComparisonCommits();
  assert.equal(second.comparison.commits.length, 2);
  assert.equal(second.comparison.files.length, 1);
  assert.equal(second.hasMoreComparisonCommits, false);
});

test('cache avoids repeated comparison request', async () => {
  let calls = 0;
  const apiClient = createMockApiClient({
    compare: async () => {
      calls += 1;
      return makeResponse(true, { status: 'ahead', ahead_by: 1, behind_by: 0, total_commits: 1, commits: [], files: [] }, { pagination: { hasNext: false, hasPrev: false } });
    },
  });
  const controller = createGitScopeController({ apiClient });
  await controller.checkRepository('https://github.com/octocat/Hello-World');

  await controller.compareReferences('main', 'dev');
  const firstCalls = calls;
  await controller.compareReferences('main', 'dev');

  assert.equal(calls, firstCalls);
  const state = controller.getState();
  assert.equal(state.comparisonFromCache, true);
});

test('new repository clears comparison', async () => {
  const apiClient = createMockApiClient();
  const controller = createGitScopeController({ apiClient });

  await controller.checkRepository('https://github.com/octocat/First');
  await controller.compareReferences('main', 'dev');
  assert.notEqual(controller.getState().comparison, null);

  await controller.checkRepository('https://github.com/octocat/Second');
  const state = controller.getState();
  assert.equal(state.comparison, null);
  assert.equal(state.comparisonStatus, 'idle');
});

test('comparison error does not destroy repository', async () => {
  const apiClient = createMockApiClient({
    compare: async () => makeResponse(false, null, { type: 'not_found', status: 404, message: 'Not Found' }),
  });
  const controller = createGitScopeController({ apiClient });
  await controller.checkRepository('https://github.com/octocat/Hello-World');

  const state = await controller.compareReferences('main', 'dev');

  assert.equal(state.status, 'success');
  assert.equal(state.repository.fullName, 'octocat/Hello-World');
  assert.equal(state.comparisonStatus, 'error');
  assert.equal(state.comparison, null);
});

test('late comparison response does not overwrite newer state', async () => {
  const apiClient = createMockApiClient();
  apiClient.compare = async (_owner, _repo, _base, _head, _params, options = {}) => {
    apiClient.calls.push({ method: 'compare', args: [_owner, _repo, _base, _head, _params, options] });
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve(makeResponse(true, { status: 'ahead', ahead_by: 1, behind_by: 0, total_commits: 1, commits: [], files: [] }, { pagination: { hasNext: false, hasPrev: false } })), 50);
      options.signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      }, { once: true });
    });
  };

  const controller = createGitScopeController({ apiClient });
  await controller.checkRepository('https://github.com/octocat/Hello-World');

  const first = controller.compareReferences('main', 'dev');
  const second = controller.compareReferences('main', 'feature');

  const finalState = await second;
  assert.equal(finalState.comparison.head, 'feature');

  await first.catch(() => {});
  const afterFirst = controller.getState();
  assert.equal(afterFirst.comparison.head, 'feature');
});
