import { validateRepositoryUrl } from './url-validator.js';
import { normalizeRepository } from './repo-model.js';
import { normalizeBranches, resolveSelectedBranch } from './branch-model.js';
import { normalizeCommitList, normalizeCommitDetail } from './commit-normalizer.js';
import { normalizeComparison } from './compare-model.js';

const MAX_CACHE_ENTRIES = 100;

export function createGitScopeController({
  apiClient,
} = {}) {
  const client = apiClient || null;
  const cache = new Map();

  const state = {
    status: 'idle',
    repositoryUrl: '',
    repository: null,
    rateLimit: null,
    error: null,
    repositoryFromCache: false,

    branches: [],
    branchPage: 1,
    hasMoreBranches: false,
    branchesLoading: false,
    branchesStatus: 'idle',
    branchesError: null,
    branchesFromCache: false,

    selectedBranch: null,
    commits: [],
    commitPage: 1,
    hasMoreCommits: false,
    commitsLoading: false,
    commitsStatus: 'idle',
    commitsError: null,
    commitsFromCache: false,

    selectedCommitSha: null,
    commitDetail: null,
    commitDetailStatus: 'idle',
    commitDetailError: null,
    commitDetailFromCache: false,

    comparisonBase: '',
    comparisonHead: '',
    comparison: null,
    comparisonStatus: 'idle',
    comparisonError: null,
    comparisonLoading: false,
    comparisonFromCache: false,
    comparisonPage: 1,
    hasMoreComparisonCommits: false,

    requestId: 0,
    activeRepositoryId: 0,
    branchRequestId: 0,
    activeBranchId: 0,
    commitsRequestId: 0,
    activeCommitsId: 0,
    detailRequestId: 0,
    activeDetailId: 0,
    comparisonRequestId: 0,
    activeComparisonId: 0,
  };

  let repositoryController = null;
  let branchController = null;
  let commitsController = null;
  let detailController = null;
  let comparisonController = null;
  let listeners = [];

  function clone(value) {
    if (value === null || value === undefined) {
      return value;
    }
    if (typeof structuredClone === 'function') {
      return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
  }

  function getState() {
    return {
      status: state.status,
      repositoryUrl: state.repositoryUrl,
      repository: clone(state.repository),
      rateLimit: clone(state.rateLimit),
      error: clone(state.error),
      repositoryFromCache: state.repositoryFromCache,

      branches: clone(state.branches),
      branchPage: state.branchPage,
      hasMoreBranches: state.hasMoreBranches,
      branchesLoading: state.branchesLoading,
      branchesStatus: state.branchesStatus,
      branchesError: clone(state.branchesError),
      branchesFromCache: state.branchesFromCache,

      selectedBranch: state.selectedBranch,
      commits: clone(state.commits),
      commitPage: state.commitPage,
      hasMoreCommits: state.hasMoreCommits,
      commitsLoading: state.commitsLoading,
      commitsStatus: state.commitsStatus,
      commitsError: clone(state.commitsError),
      commitsFromCache: state.commitsFromCache,

      selectedCommitSha: state.selectedCommitSha,
      commitDetail: clone(state.commitDetail),
      commitDetailStatus: state.commitDetailStatus,
      commitDetailError: clone(state.commitDetailError),
      commitDetailFromCache: state.commitDetailFromCache,

      comparisonBase: state.comparisonBase,
      comparisonHead: state.comparisonHead,
      comparison: clone(state.comparison),
      comparisonStatus: state.comparisonStatus,
      comparisonError: clone(state.comparisonError),
      comparisonLoading: state.comparisonLoading,
      comparisonFromCache: state.comparisonFromCache,
      comparisonPage: state.comparisonPage,
      hasMoreComparisonCommits: state.hasMoreComparisonCommits,
    };
  }

  function notify() {
    const snapshot = getState();
    for (const listener of listeners) {
      listener(snapshot);
    }
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') {
      return () => {};
    }
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((item) => item !== listener);
    };
  }

  function abortController(controller) {
    if (controller) {
      try {
        controller.abort();
      } catch {
        // Ignore abort errors.
      }
    }
  }

  function abortAllRequests() {
    abortController(repositoryController);
    abortController(branchController);
    abortController(commitsController);
    abortController(detailController);
    abortController(comparisonController);
    repositoryController = null;
    branchController = null;
    commitsController = null;
    detailController = null;
    comparisonController = null;
  }

  function cacheKey(type, owner, repo, params = {}) {
    return `${type}:${owner}/${repo}:${JSON.stringify(params)}`;
  }

  function getCached(key) {
    if (!cache.has(key)) {
      return null;
    }
    const value = cache.get(key);
    cache.delete(key);
    cache.set(key, value);
    return clone(value);
  }

  function setCached(key, value) {
    if (cache.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey !== undefined) {
        cache.delete(oldestKey);
      }
    }
    cache.set(key, clone(value));
  }

  function ownerRepo() {
    return state.repository
      ? { owner: state.repository.owner, repo: state.repository.name }
      : null;
  }

  async function loadBranches(page = 1, { append = false, refresh = false } = {}) {
    const repository = state.repository;
    if (!repository?.owner || !repository?.name) {
      return getState();
    }

    const owner = repository.owner;
    const repo = repository.name;
    const key = cacheKey('branches', owner, repo, { page });
    const requestId = ++state.branchRequestId;
    const controller = new AbortController();

    branchController = controller;
    state.activeBranchId = requestId;
    state.branchesLoading = true;
    state.branchesStatus = 'loading';
    state.branchesError = null;
    state.branchesFromCache = false;
    notify();

    let result;
    if (!refresh) {
      const cached = getCached(key);
      if (cached) {
        const normalized = normalizeBranches(cached.data);
        if (normalized.ok) {
          state.branches = append
            ? mergeBranches(state.branches, normalized.branches)
            : normalized.branches;
          state.branchPage = page;
          state.hasMoreBranches = Boolean(cached.pagination?.hasNext);
          state.branchesLoading = false;
          state.branchesStatus = 'success';
          state.branchesFromCache = true;
          state.rateLimit = cached.rateLimit || state.rateLimit;
          notify();
          return getState();
        }
      }
    }

    try {
      result = await client.getBranches(owner, repo, {
        page,
        signal: controller.signal,
      });
    } catch (error) {
      result = classifyThrown(error, controller.signal);
    }

    if (requestId !== state.activeBranchId || state.repository?.owner !== owner || state.repository?.name !== repo) {
      return getState();
    }

    branchController = null;
    state.branchesLoading = false;

    if (!result.ok) {
      if (result.type === 'aborted') {
        state.branchesStatus = 'cancelled';
        state.branchesError = {
          type: 'aborted',
          message: 'Pemuatan branch dibatalkan.',
        };
      } else {
        state.branchesStatus = 'error';
        state.branchesError = {
          type: result.type,
          message: result.message,
          status: result.status,
        };
      }
      state.rateLimit = result.rateLimit || state.rateLimit;
      notify();
      return getState();
    }

    const normalized = normalizeBranches(result.data);
    if (!normalized.ok) {
      state.branchesStatus = 'error';
      state.branchesError = {
        type: 'invalid_response',
        message: normalized.error,
      };
      state.rateLimit = result.rateLimit || state.rateLimit;
      notify();
      return getState();
    }

    state.branches = append
      ? mergeBranches(state.branches, normalized.branches)
      : normalized.branches;
    state.branchPage = page;
    state.hasMoreBranches = Boolean(result.pagination?.hasNext);
    state.branchesStatus = 'success';
    state.branchesFromCache = false;
    state.rateLimit = result.rateLimit || state.rateLimit;
    setCached(key, {
      data: normalized.branches,
      rateLimit: result.rateLimit,
      pagination: result.pagination,
    });
    notify();
    return getState();
  }

  async function loadCommits(page = 1, { append = false, refresh = false } = {}) {
    const repository = state.repository;
    const branch = state.selectedBranch;
    if (!repository?.owner || !repository?.name || !branch) {
      return getState();
    }

    const owner = repository.owner;
    const repo = repository.name;
    const key = cacheKey('commits', owner, repo, { branch, page });
    const requestId = ++state.commitsRequestId;
    const controller = new AbortController();

    commitsController = controller;
    state.activeCommitsId = requestId;
    state.commitsLoading = true;
    state.commitsStatus = 'loading';
    state.commitsError = null;
    state.commitsFromCache = false;
    notify();

    let result;
    if (!refresh) {
      const cached = getCached(key);
      if (cached) {
        const normalized = normalizeCommitList(cached.data);
        if (normalized.ok) {
          state.commits = append
            ? mergeCommits(state.commits, normalized.commits)
            : normalized.commits;
          state.commitPage = page;
          state.hasMoreCommits = Boolean(cached.pagination?.hasNext);
          state.commitsLoading = false;
          state.commitsStatus = 'success';
          state.commitsFromCache = true;
          state.rateLimit = cached.rateLimit || state.rateLimit;
          notify();
          return getState();
        }
      }
    }

    try {
      result = await client.getCommits(owner, repo, {
        sha: branch,
        page,
        perPage: 30,
        signal: controller.signal,
      });
    } catch (error) {
      result = classifyThrown(error, controller.signal);
    }

    if (requestId !== state.activeCommitsId || state.repository?.owner !== owner || state.repository?.name !== repo || state.selectedBranch !== branch) {
      return getState();
    }

    commitsController = null;
    state.commitsLoading = false;

    if (!result.ok) {
      if (result.type === 'aborted') {
        state.commitsStatus = 'cancelled';
        state.commitsError = {
          type: 'aborted',
          message: 'Pemuatan commit dibatalkan.',
        };
      } else {
        state.commitsStatus = 'error';
        state.commitsError = {
          type: result.type,
          message: result.message,
          status: result.status,
        };
      }
      state.rateLimit = result.rateLimit || state.rateLimit;
      notify();
      return getState();
    }

    const normalized = normalizeCommitList(result.data);
    if (!normalized.ok) {
      state.commitsStatus = 'error';
      state.commitsError = {
        type: 'invalid_response',
        message: normalized.error,
      };
      state.rateLimit = result.rateLimit || state.rateLimit;
      notify();
      return getState();
    }

    state.commits = append
      ? mergeCommits(state.commits, normalized.commits)
      : normalized.commits;
    state.commitPage = page;
    state.hasMoreCommits = Boolean(result.pagination?.hasNext);
    state.commitsStatus = 'success';
    state.commitsFromCache = false;
    state.rateLimit = result.rateLimit || state.rateLimit;
    if (!append) {
      state.selectedCommitSha = null;
      state.commitDetail = null;
      state.commitDetailStatus = 'idle';
      state.commitDetailError = null;
      state.commitDetailFromCache = false;
    }
    setCached(key, {
      data: normalized.commits,
      rateLimit: result.rateLimit,
      pagination: result.pagination,
    });
    notify();
    return getState();
  }

  async function selectCommit(sha) {
    const repository = state.repository;
    if (!repository?.owner || !repository?.name || typeof sha !== 'string' || sha === '') {
      return getState();
    }

    const owner = repository.owner;
    const repo = repository.name;
    const key = cacheKey('commit', owner, repo, { sha });
    const requestId = ++state.detailRequestId;
    const controller = new AbortController();

    abortController(detailController);
    detailController = controller;
    state.activeDetailId = requestId;
    state.selectedCommitSha = sha;
    state.commitDetail = null;
    state.commitDetailStatus = 'loading';
    state.commitDetailError = null;
    state.commitDetailFromCache = false;
    notify();

    let result;
    const cached = getCached(key);
    if (cached) {
      const normalized = normalizeCommitDetail(cached.data);
      if (normalized.ok) {
        state.commitDetail = normalized.commit;
        state.commitDetailStatus = 'success';
        state.commitDetailFromCache = true;
        state.rateLimit = cached.rateLimit || state.rateLimit;
        notify();
        return getState();
      }
    }

    try {
      result = await client.getCommit(owner, repo, sha, {
        signal: controller.signal,
      });
    } catch (error) {
      result = classifyThrown(error, controller.signal);
    }

    if (requestId !== state.activeDetailId || state.repository?.owner !== owner || state.repository?.name !== repo || state.selectedCommitSha !== sha) {
      return getState();
    }

    detailController = null;

    if (!result.ok) {
      if (result.type === 'aborted') {
        state.commitDetailStatus = 'cancelled';
        state.commitDetailError = {
          type: 'aborted',
          message: 'Pemuatan detail commit dibatalkan.',
        };
      } else {
        state.commitDetailStatus = 'error';
        state.commitDetailError = {
          type: result.type,
          message: result.message,
          status: result.status,
        };
      }
      state.rateLimit = result.rateLimit || state.rateLimit;
      notify();
      return getState();
    }

    const normalized = normalizeCommitDetail(result.data);
    if (!normalized.ok) {
      state.commitDetailStatus = 'error';
      state.commitDetailError = {
        type: 'invalid_response',
        message: normalized.error,
      };
      state.rateLimit = result.rateLimit || state.rateLimit;
      notify();
      return getState();
    }

    state.commitDetail = normalized.commit;
    state.commitDetailStatus = 'success';
    state.commitDetailFromCache = false;
    state.rateLimit = result.rateLimit || state.rateLimit;
    setCached(key, {
      data: result.data,
      rateLimit: result.rateLimit,
      pagination: null,
    });
    notify();
    return getState();
  }

  async function loadMoreBranches() {
    if (!state.hasMoreBranches || state.branchesLoading) {
      return getState();
    }
    return loadBranches(state.branchPage + 1, { append: true, refresh: false });
  }

  async function loadMoreCommits() {
    if (!state.hasMoreCommits || state.commitsLoading) {
      return getState();
    }
    return loadCommits(state.commitPage + 1, { append: true, refresh: false });
  }

  async function selectBranch(name) {
    if (typeof name !== 'string' || name === '') {
      return getState();
    }
    abortController(commitsController);
    abortController(detailController);
    commitsController = null;
    detailController = null;
    state.selectedBranch = name;
    state.commits = [];
    state.commitPage = 1;
    state.hasMoreCommits = false;
    state.commitsLoading = false;
    state.commitsStatus = 'idle';
    state.commitsError = null;
    state.commitsFromCache = false;
    state.selectedCommitSha = null;
    state.commitDetail = null;
    state.commitDetailStatus = 'idle';
    state.commitDetailError = null;
    state.commitDetailFromCache = false;
    notify();
    return loadCommits(1, { append: false, refresh: false });
  }

  async function checkRepository(url) {
    const validation = validateRepositoryUrl(url);
    const requestId = ++state.requestId;

    abortAllRequests();
    repositoryController = null;
    branchController = null;
    commitsController = null;
    detailController = null;

    // Invalidate any in-flight comparison that belonged to the previous repo.
    state.comparisonRequestId += 1;
    state.activeComparisonId = state.comparisonRequestId;

    state.activeRepositoryId = requestId;
    state.repositoryUrl = typeof url === 'string' ? url.trim() : '';
    state.repository = null;
    state.rateLimit = null;
    state.error = null;
    state.repositoryFromCache = false;

    state.branches = [];
    state.branchPage = 1;
    state.hasMoreBranches = false;
    state.branchesLoading = false;
    state.branchesStatus = 'idle';
    state.branchesError = null;
    state.branchesFromCache = false;

    state.selectedBranch = null;
    state.commits = [];
    state.commitPage = 1;
    state.hasMoreCommits = false;
    state.commitsLoading = false;
    state.commitsStatus = 'idle';
    state.commitsError = null;
    state.commitsFromCache = false;

    state.selectedCommitSha = null;
    state.commitDetail = null;
    state.commitDetailStatus = 'idle';
    state.commitDetailError = null;
    state.commitDetailFromCache = false;

    state.comparisonBase = '';
    state.comparisonHead = '';
    state.comparison = null;
    state.comparisonStatus = 'idle';
    state.comparisonError = null;
    state.comparisonLoading = false;
    state.comparisonFromCache = false;
    state.comparisonPage = 1;
    state.hasMoreComparisonCommits = false;

    if (!validation.ok) {
      state.status = 'invalid_url';
      state.error = {
        type: 'invalid_url',
        message: validation.error,
      };
      notify();
      return getState();
    }

    const owner = validation.owner;
    const repo = validation.repo;
    const controller = new AbortController();
    repositoryController = controller;
    state.status = 'loading';
    state.repositoryUrl = validation.url;
    notify();

    const repoKey = cacheKey('repo', owner, repo, {});
    let repositoryResult;
    const cachedRepository = getCached(repoKey);

    if (cachedRepository) {
      const normalizedRepository = normalizeRepository(cachedRepository.data);
      if (!normalizedRepository.ok) {
        state.status = 'error';
        state.error = {
          type: 'invalid_response',
          message: normalizedRepository.error,
        };
        state.rateLimit = cachedRepository.rateLimit || null;
        notify();
        return getState();
      }
      state.repository = normalizedRepository.repository;
      state.rateLimit = cachedRepository.rateLimit || null;
      state.repositoryFromCache = true;
    } else {
      try {
        repositoryResult = await client.getRepository(owner, repo, {
          signal: controller.signal,
        });
      } catch (error) {
        repositoryResult = classifyThrown(error, controller.signal);
      }

      if (requestId !== state.activeRepositoryId) {
        return getState();
      }

      if (!repositoryResult.ok) {
        repositoryController = null;
        if (repositoryResult.type === 'aborted') {
          state.status = 'cancelled';
          state.error = {
            type: 'aborted',
            message: 'Pemeriksaan repositori dibatalkan.',
          };
        } else {
          state.status = 'error';
          state.error = {
            type: repositoryResult.type,
            message: repositoryResult.message,
            status: repositoryResult.status,
          };
        }
        state.rateLimit = repositoryResult.rateLimit || state.rateLimit;
        notify();
        return getState();
      }

      const normalizedRepository = normalizeRepository(repositoryResult.data);
      if (!normalizedRepository.ok) {
        repositoryController = null;
        state.status = 'error';
        state.error = {
          type: 'invalid_response',
          message: normalizedRepository.error,
        };
        state.rateLimit = repositoryResult.rateLimit || state.rateLimit;
        notify();
        return getState();
      }

      state.repository = normalizedRepository.repository;
      state.rateLimit = repositoryResult.rateLimit || state.rateLimit;
      state.repositoryFromCache = false;
      setCached(repoKey, {
        data: repositoryResult.data,
        rateLimit: repositoryResult.rateLimit,
        pagination: null,
      });
    }

    repositoryController = null;
    state.status = 'success';
    notify();

    await loadBranches(1, { append: false, refresh: false });

    if (requestId !== state.activeRepositoryId || state.status !== 'success' || !state.repository) {
      return getState();
    }

    const preferredBranch = state.repository.defaultBranch;
    state.selectedBranch = resolveSelectedBranch(state.branches, preferredBranch);

    if (state.selectedBranch) {
      await loadCommits(1, { append: false, refresh: false });
    }

    return getState();
  }

  function setComparisonRefs(base, head) {
    const nextBase = typeof base === 'string' && base !== '' ? base : state.comparisonBase;
    const nextHead = typeof head === 'string' && head !== '' ? head : state.comparisonHead;

    if (nextBase === state.comparisonBase && nextHead === state.comparisonHead) {
      return getState();
    }

    // A result or request for the previous refs must not be reused or appended.
    abortController(comparisonController);
    comparisonController = null;
    state.comparisonRequestId += 1;
    state.activeComparisonId = state.comparisonRequestId;

    state.comparisonBase = nextBase;
    state.comparisonHead = nextHead;
    state.comparison = null;
    state.comparisonStatus = 'idle';
    state.comparisonError = null;
    state.comparisonLoading = false;
    state.comparisonFromCache = false;
    state.comparisonPage = 1;
    state.hasMoreComparisonCommits = false;
    notify();
    return getState();
  }

  async function compareReferences(base, head, { page = 1, append = false, refresh = false } = {}) {
    const repository = state.repository;
    if (!repository?.owner || !repository?.name) {
      return getState();
    }

    const owner = repository.owner;
    const repo = repository.name;
    const nextBase = typeof base === 'string' && base !== '' ? base : state.comparisonBase;
    const nextHead = typeof head === 'string' && head !== '' ? head : state.comparisonHead;

    state.comparisonBase = nextBase;
    state.comparisonHead = nextHead;

    if (nextBase === '' || nextHead === '') {
      state.comparisonStatus = 'error';
      state.comparisonError = {
        type: 'invalid_request',
        message: 'Pilih base dan head terlebih dahulu.',
      };
      state.comparisonLoading = false;
      notify();
      return getState();
    }

    const key = cacheKey('compare', owner, repo, { base: nextBase, head: nextHead, page });
    const requestId = ++state.comparisonRequestId;
    const controller = new AbortController();

    abortController(comparisonController);
    comparisonController = controller;
    state.activeComparisonId = requestId;
    state.comparisonLoading = true;
    state.comparisonStatus = 'loading';
    state.comparisonError = null;
    state.comparisonFromCache = false;
    notify();

    let result;
    if (!refresh) {
      const cached = getCached(key);
      if (cached) {
        const normalized = normalizeComparison(cached.data, { base: nextBase, head: nextHead });
        if (normalized.ok) {
          if (page === 1 || !append) {
            state.comparison = normalized.comparison;
            state.comparisonPage = page;
            state.hasMoreComparisonCommits = Boolean(cached.pagination?.hasNext);
          } else if (state.comparison) {
            state.comparison.commits = mergeCommits(state.comparison.commits, normalized.comparison.commits);
            state.comparisonPage = page;
            state.hasMoreComparisonCommits = Boolean(cached.pagination?.hasNext);
          }
          state.comparisonLoading = false;
          state.comparisonStatus = 'success';
          state.comparisonFromCache = true;
          state.rateLimit = cached.rateLimit || state.rateLimit;
          notify();
          return getState();
        }
      }
    }

    try {
      result = await client.compare(owner, repo, nextBase, nextHead, {
        page,
        perPage: 30,
        signal: controller.signal,
      });
    } catch (error) {
      result = classifyThrown(error, controller.signal);
    }

    if (requestId !== state.activeComparisonId || state.repository?.owner !== owner || state.repository?.name !== repo) {
      return getState();
    }

    comparisonController = null;
    state.comparisonLoading = false;

    if (!result.ok) {
      if (result.type === 'aborted') {
        state.comparisonStatus = 'cancelled';
        state.comparisonError = {
          type: 'aborted',
          message: 'Perbandingan dibatalkan.',
        };
      } else {
        state.comparisonStatus = 'error';
        state.comparisonError = {
          type: result.type,
          message: result.message,
          status: result.status,
        };
      }
      state.rateLimit = result.rateLimit || state.rateLimit;
      notify();
      return getState();
    }

    const normalized = normalizeComparison(result.data, { base: nextBase, head: nextHead });
    if (!normalized.ok) {
      state.comparisonStatus = 'error';
      state.comparisonError = {
        type: 'invalid_response',
        message: normalized.error,
      };
      state.rateLimit = result.rateLimit || state.rateLimit;
      notify();
      return getState();
    }

    if (page === 1 || !append) {
      state.comparison = normalized.comparison;
    } else if (state.comparison) {
      state.comparison.commits = mergeCommits(state.comparison.commits, normalized.comparison.commits);
    }

    state.comparisonPage = page;
    state.hasMoreComparisonCommits = Boolean(result.pagination?.hasNext);
    state.comparisonStatus = 'success';
    state.comparisonFromCache = false;
    state.rateLimit = result.rateLimit || state.rateLimit;
    setCached(key, {
      data: result.data,
      rateLimit: result.rateLimit,
      pagination: result.pagination,
    });
    notify();
    return getState();
  }

  async function loadMoreComparisonCommits() {
    if (!state.comparison || !state.hasMoreComparisonCommits || state.comparisonLoading) {
      return getState();
    }
    return compareReferences(state.comparison.base, state.comparison.head, {
      page: state.comparisonPage + 1,
      append: true,
      refresh: false,
    });
  }

  function clearComparison() {
    abortController(comparisonController);
    comparisonController = null;
    state.comparisonBase = '';
    state.comparisonHead = '';
    state.comparison = null;
    state.comparisonStatus = 'idle';
    state.comparisonError = null;
    state.comparisonLoading = false;
    state.comparisonFromCache = false;
    state.comparisonPage = 1;
    state.hasMoreComparisonCommits = false;
    notify();
    return getState();
  }

  function cancel() {
    let changed = false;

    if (repositoryController && state.status === 'loading') {
      abortController(repositoryController);
      repositoryController = null;
      state.status = 'cancelled';
      state.error = {
        type: 'aborted',
        message: 'Pemeriksaan repositori dibatalkan.',
      };
      changed = true;
    }

    if (branchController && state.branchesLoading) {
      abortController(branchController);
      branchController = null;
      state.branchesLoading = false;
      state.branchesStatus = 'cancelled';
      state.branchesError = {
        type: 'aborted',
        message: 'Pemuatan branch dibatalkan.',
      };
      changed = true;
    }

    if (commitsController && state.commitsLoading) {
      abortController(commitsController);
      commitsController = null;
      state.commitsLoading = false;
      state.commitsStatus = 'cancelled';
      state.commitsError = {
        type: 'aborted',
        message: 'Pemuatan commit dibatalkan.',
      };
      changed = true;
    }

    if (detailController && state.commitDetailStatus === 'loading') {
      abortController(detailController);
      detailController = null;
      state.commitDetailStatus = 'cancelled';
      state.commitDetailError = {
        type: 'aborted',
        message: 'Pemuatan detail commit dibatalkan.',
      };
      changed = true;
    }

    if (changed) {
      notify();
    }
    return getState();
  }

  function reset() {
    abortAllRequests();
    repositoryController = null;
    branchController = null;
    commitsController = null;
    detailController = null;

    state.status = 'idle';
    state.repositoryUrl = '';
    state.repository = null;
    state.rateLimit = null;
    state.error = null;
    state.repositoryFromCache = false;

    state.branches = [];
    state.branchPage = 1;
    state.hasMoreBranches = false;
    state.branchesLoading = false;
    state.branchesStatus = 'idle';
    state.branchesError = null;
    state.branchesFromCache = false;

    state.selectedBranch = null;
    state.commits = [];
    state.commitPage = 1;
    state.hasMoreCommits = false;
    state.commitsLoading = false;
    state.commitsStatus = 'idle';
    state.commitsError = null;
    state.commitsFromCache = false;

    state.selectedCommitSha = null;
    state.commitDetail = null;
    state.commitDetailStatus = 'idle';
    state.commitDetailError = null;
    state.commitDetailFromCache = false;

    state.comparisonBase = '';
    state.comparisonHead = '';
    state.comparison = null;
    state.comparisonStatus = 'idle';
    state.comparisonError = null;
    state.comparisonLoading = false;
    state.comparisonFromCache = false;
    state.comparisonPage = 1;
    state.hasMoreComparisonCommits = false;

    state.activeRepositoryId = 0;
    state.activeBranchId = 0;
    state.activeCommitsId = 0;
    state.activeDetailId = 0;
    state.activeComparisonId = 0;
    notify();
    return getState();
  }

  return {
    getState,
    subscribe,
    checkRepository,
    selectBranch,
    loadMoreBranches,
    loadMoreCommits,
    selectCommit,
    setComparisonRefs,
    compareReferences,
    loadMoreComparisonCommits,
    clearComparison,
    cancel,
    reset,
  };
}

function mergeBranches(existing, incoming) {
  const seen = new Set(existing.map((branch) => branch.name));
  const merged = [...existing];
  for (const branch of incoming) {
    if (!seen.has(branch.name)) {
      seen.add(branch.name);
      merged.push(branch);
    }
  }
  return merged;
}

function mergeCommits(existing, incoming) {
  const seen = new Set(existing.map((commit) => commit.sha));
  const merged = [...existing];
  for (const commit of incoming) {
    if (!seen.has(commit.sha)) {
      seen.add(commit.sha);
      merged.push(commit);
    }
  }
  return merged;
}

function classifyThrown(error, signal) {
  if (signal?.aborted || error?.name === 'AbortError') {
    return {
      ok: false,
      type: 'aborted',
      status: null,
      message: 'Permintaan dibatalkan.',
      rateLimit: null,
    };
  }
  return {
    ok: false,
    type: 'network_error',
    status: null,
    message: error?.message || 'Gagal menghubungi GitHub API.',
    rateLimit: null,
  };
}
