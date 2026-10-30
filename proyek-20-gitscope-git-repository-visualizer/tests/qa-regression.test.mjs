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

function commitSummary(sha, date = '2024-01-01T00:00:00Z') {
  return {
    sha,
    commit: {
      message: `Commit ${sha}`,
      author: { name: 'Octocat', date },
    },
    parents: [],
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createMockApiClient(overrides = {}) {
  const calls = [];
  const defaults = {
    getRepository: async (owner, repo) => makeResponse(true, {
      id: 1,
      full_name: `${owner}/${repo}`,
      name: repo,
      owner: { login: owner },
      default_branch: 'main',
      html_url: `https://github.com/${owner}/${repo}`,
    }),
    getBranches: async () => makeResponse(true, [
      { name: 'main', commit: { sha: 'mainsha' }, protected: false },
    ]),
    getCommits: async (_owner, _repo, params) => makeResponse(true, [
      commitSummary(`page${params.page}`),
    ], { pagination: { hasNext: false, hasPrev: params.page > 1 } }),
    getCommit: async (_owner, _repo, sha) => makeResponse(true, {
      sha,
      commit: { message: 'Detail', author: { name: 'Octocat', date: '2024-01-01T00:00:00Z' } },
      parents: [],
      files: [],
    }),
    compare: async () => makeResponse(true, {
      status: 'ahead',
      ahead_by: 1,
      behind_by: 0,
      total_commits: 1,
      commits: [commitSummary('compared')],
      files: [],
    }),
  };

  const client = { calls };
  for (const [method, fallback] of Object.entries(defaults)) {
    client[method] = async (...args) => {
      calls.push({ method, args });
      const implementation = overrides[method] || fallback;
      return implementation(...args);
    };
  }
  return client;
}

async function waitFor(predicate, attempts = 50) {
  for (let index = 0; index < attempts; index += 1) {
    if (predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error('Condition was not reached in time.');
}

test('loading more commits keeps the selected commit detail', async () => {
  const apiClient = createMockApiClient({
    getCommits: async (_owner, _repo, params) => makeResponse(true, [
      commitSummary(`page${params.page}`),
    ], { pagination: { hasNext: params.page === 1, hasPrev: params.page > 1 } }),
  });
  const controller = createGitScopeController({ apiClient });

  await controller.checkRepository('https://github.com/octocat/Hello-World');
  await controller.selectCommit('page1');
  assert.equal(controller.getState().commitDetailStatus, 'success');

  const state = await controller.loadMoreCommits();

  assert.equal(state.commits.length, 2);
  assert.equal(state.selectedCommitSha, 'page1');
  assert.equal(state.commitDetail.sha, 'page1');
});

test('changing comparison refs cancels an in-flight comparison', async () => {
  const pendingCompare = deferred();
  const apiClient = createMockApiClient({
    compare: async () => pendingCompare.promise,
  });
  const controller = createGitScopeController({ apiClient });
  await controller.checkRepository('https://github.com/octocat/Hello-World');

  const comparison = controller.compareReferences('main', 'dev');
  const refsState = controller.setComparisonRefs('main', 'feature');

  assert.equal(refsState.comparisonHead, 'feature');
  assert.equal(refsState.comparison, null);
  assert.equal(refsState.comparisonStatus, 'idle');

  pendingCompare.resolve(makeResponse(true, {
    status: 'ahead',
    ahead_by: 1,
    behind_by: 0,
    total_commits: 1,
    commits: [commitSummary('old')],
    files: [],
  }));
  await comparison;

  const state = controller.getState();
  assert.equal(state.comparison, null);
  assert.equal(state.comparisonStatus, 'idle');
  assert.equal(state.comparisonHead, 'feature');
});

test('re-checking a repository ignores a late comparison response', async () => {
  const pendingCompare = deferred();
  const apiClient = createMockApiClient({
    compare: async () => pendingCompare.promise,
  });
  const controller = createGitScopeController({ apiClient });
  const url = 'https://github.com/octocat/Hello-World';

  await controller.checkRepository(url);
  const comparison = controller.compareReferences('main', 'dev');
  await controller.checkRepository(url);

  pendingCompare.resolve(makeResponse(true, {
    status: 'ahead',
    ahead_by: 1,
    behind_by: 0,
    total_commits: 1,
    commits: [commitSummary('stale')],
    files: [],
  }));
  await comparison;

  const state = controller.getState();
  assert.equal(state.comparison, null);
  assert.equal(state.comparisonStatus, 'idle');
});

test('switching branches while a commit page is in flight does not mix commits', async () => {
  const pendingPage = deferred();
  const apiClient = createMockApiClient({
    getCommits: async (_owner, _repo, params) => {
      if (params.sha === 'main' && params.page === 1) {
        return makeResponse(true, [commitSummary('main-page1')], {
          pagination: { hasNext: true, hasPrev: false },
        });
      }
      if (params.sha === 'main' && params.page === 2) {
        return pendingPage.promise;
      }
      return makeResponse(true, [commitSummary('dev-page1')]);
    },
  });
  const controller = createGitScopeController({ apiClient });

  await controller.checkRepository('https://github.com/octocat/Hello-World');
  const more = controller.loadMoreCommits();
  const switched = controller.selectBranch('dev');
  await switched;

  pendingPage.resolve(makeResponse(true, [commitSummary('main-page2')], {
    pagination: { hasNext: false, hasPrev: true },
  }));
  await more;

  const state = controller.getState();
  assert.equal(state.selectedBranch, 'dev');
  assert.deepEqual(state.commits.map((item) => item.sha), ['dev-page1']);
});

test('switching repositories ignores late branch data from the previous repo', async () => {
  const pendingBranches = deferred();
  const apiClient = createMockApiClient({
    getBranches: async (owner) => {
      if (owner === 'first') {
        return pendingBranches.promise;
      }
      return makeResponse(true, [
        { name: 'main', commit: { sha: 'secondsha' }, protected: false },
      ]);
    },
  });
  const controller = createGitScopeController({ apiClient });

  const first = controller.checkRepository('https://github.com/first/repo');
  await waitFor(() => apiClient.calls.some((call) => call.method === 'getBranches' && call.args[0] === 'first'));

  const second = await controller.checkRepository('https://github.com/second/repo');
  assert.equal(second.repository.owner, 'second');

  pendingBranches.resolve(makeResponse(true, [
    { name: 'first-only', commit: { sha: 'firstsha' }, protected: false },
  ]));
  await first;

  const state = controller.getState();
  assert.equal(state.repository.owner, 'second');
  assert.deepEqual(state.branches.map((branch) => branch.name), ['main']);
  assert.equal(state.selectedBranch, 'main');
  assert.equal(state.commits.length, 1);
});

test('comparison does not change the active repository explorer branch', async () => {
  const apiClient = createMockApiClient();
  const controller = createGitScopeController({ apiClient });

  await controller.checkRepository('https://github.com/octocat/Hello-World');
  await controller.selectBranch('main');
  await controller.compareReferences('main', 'dev');

  const state = controller.getState();
  assert.equal(state.selectedBranch, 'main');
  assert.equal(state.comparison.head, 'dev');
});

test('recomparing cached first page resets comparison pagination state', async () => {
  const apiClient = createMockApiClient({
    compare: async (_owner, _repo, _base, _head, params) => makeResponse(true, {
      status: 'ahead',
      ahead_by: 1,
      behind_by: 0,
      total_commits: 2,
      commits: [commitSummary(params.page === 1 ? 'page1' : 'page2')],
      files: params.page === 1
        ? [{ filename: 'README.md', status: 'modified', additions: 1, deletions: 0, changes: 1, patch: '@@ -1 +1 @@' }]
        : [],
    }, { pagination: { hasNext: params.page === 1, hasPrev: params.page > 1 } }),
  });
  const controller = createGitScopeController({ apiClient });

  await controller.checkRepository('https://github.com/octocat/Hello-World');
  await controller.compareReferences('main', 'dev');
  await controller.loadMoreComparisonCommits();
  assert.equal(controller.getState().comparisonPage, 2);
  assert.equal(controller.getState().hasMoreComparisonCommits, false);

  const cached = await controller.compareReferences('main', 'dev');
  assert.equal(cached.comparisonPage, 1);
  assert.equal(cached.hasMoreComparisonCommits, true);
  assert.deepEqual(cached.comparison.commits.map((item) => item.sha), ['page1']);
  assert.equal(cached.comparison.files.length, 1);
});

test('cache keeps branches and commit pages separate per repository', async () => {
  const apiClient = createMockApiClient({
    getCommits: async (owner, _repo, params) => makeResponse(true, [
      commitSummary(`${owner}-${params.sha}-page${params.page}`),
    ]),
  });
  const controller = createGitScopeController({ apiClient });

  await controller.checkRepository('https://github.com/first/repo');
  await controller.checkRepository('https://github.com/second/repo');
  assert.equal(controller.getState().commits[0].sha, 'second-main-page1');

  await controller.checkRepository('https://github.com/first/repo');
  const state = controller.getState();
  assert.equal(state.commits[0].sha, 'first-main-page1');
  assert.equal(state.commitsFromCache, true);
  assert.equal(
    apiClient.calls.filter((call) => call.method === 'getCommits').length,
    2,
  );
});
