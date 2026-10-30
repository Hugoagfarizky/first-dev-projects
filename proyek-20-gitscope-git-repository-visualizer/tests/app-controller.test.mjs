import test from 'node:test';
import assert from 'node:assert/strict';

import { createGitScopeController } from '../js/app-controller.js';

function createMockApiClient() {
  let calls = 0;
  let resolver = null;
  let rejecter = null;
  let signal = null;

  const client = {
    calls: () => calls,
    getRepository: async (owner, repo, options = {}) => {
      calls += 1;
      signal = options.signal;
      return new Promise((resolve, reject) => {
        resolver = resolve;
        rejecter = reject;
        if (signal?.aborted) {
          reject(new DOMException('Aborted', 'AbortError'));
          return;
        }
        signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        }, { once: true });
      });
    },
    resolve(value) {
      resolver?.(value);
    },
    reject(error) {
      rejecter?.(error);
    },
    abort() {
      if (signal && !signal.aborted) {
        // Simulate the browser aborting the in-flight request.
        signal.dispatchEvent(new Event('abort'));
      }
    },
    getSignal() {
      return signal;
    },
  };

  return client;
}

test('invalid URL does not call the API client', async () => {
  const apiClient = createMockApiClient();
  const controller = createGitScopeController({ apiClient });

  const state = await controller.checkRepository('not a url');

  assert.equal(apiClient.calls(), 0);
  assert.equal(state.status, 'invalid_url');
  assert.equal(state.repository, null);
});

test('valid URL checks repository and stores metadata', async () => {
  const apiClient = createMockApiClient();
  const controller = createGitScopeController({ apiClient });

  const pending = controller.checkRepository('https://github.com/octocat/Hello-World');
  assert.equal(apiClient.calls(), 1);

  apiClient.resolve({
    ok: true,
    type: 'success',
    status: 200,
    message: 'OK',
    data: { id: 1, full_name: 'octocat/Hello-World', default_branch: 'main' },
    rateLimit: { remaining: 59, limit: 60 },
  });

  const state = await pending;
  assert.equal(state.status, 'success');
  assert.equal(state.repository.id, 1);
  assert.equal(state.repository.fullName, 'octocat/Hello-World');
  assert.equal(state.rateLimit.remaining, 59);
});

test('not found response is exposed as an error state', async () => {
  const apiClient = createMockApiClient();
  const controller = createGitScopeController({ apiClient });

  const pending = controller.checkRepository('https://github.com/octocat/missing');
  apiClient.resolve({
    ok: false,
    type: 'not_found',
    status: 404,
    message: 'Not Found',
    data: null,
    rateLimit: null,
  });

  const state = await pending;
  assert.equal(state.status, 'error');
  assert.equal(state.error.type, 'not_found');
  assert.equal(state.error.status, 404);
});

test('rate-limit response is exposed as an error state', async () => {
  const apiClient = createMockApiClient();
  const controller = createGitScopeController({ apiClient });

  const pending = controller.checkRepository('https://github.com/octocat/Hello-World');
  apiClient.resolve({
    ok: false,
    type: 'rate_limit',
    status: 403,
    message: 'API rate limit exceeded',
    data: null,
    rateLimit: { remaining: 0, limit: 60 },
  });

  const state = await pending;
  assert.equal(state.status, 'error');
  assert.equal(state.error.type, 'rate_limit');
  assert.equal(state.rateLimit.remaining, 0);
});

test('network error is exposed as an error state', async () => {
  const apiClient = createMockApiClient();
  const controller = createGitScopeController({ apiClient });

  const pending = controller.checkRepository('https://github.com/octocat/Hello-World');
  apiClient.reject(new Error('network down'));

  const state = await pending;
  assert.equal(state.status, 'error');
  assert.equal(state.error.type, 'network_error');
});

test('starting a new check cancels the previous request', async () => {
  const apiClient = createMockApiClient();
  const controller = createGitScopeController({ apiClient });

  const first = controller.checkRepository('https://github.com/octocat/first');
  const second = controller.checkRepository('https://github.com/octocat/second');

  assert.equal(apiClient.calls(), 2);

  apiClient.resolve({
    ok: true,
    type: 'success',
    status: 200,
    message: 'OK',
    data: { id: 2, full_name: 'octocat/second' },
    rateLimit: null,
  });

  const finalState = await second;
  assert.equal(finalState.status, 'success');
  assert.equal(finalState.repository.id, 2);
  assert.equal(finalState.repositoryUrl, 'https://github.com/octocat/second');

  // The first result must not overwrite the newer state.
  apiClient.resolve({
    ok: true,
    type: 'success',
    status: 200,
    message: 'OK',
    data: { id: 1, full_name: 'octocat/first' },
    rateLimit: null,
  });
  await first.catch(() => {});

  const afterFirst = controller.getState();
  assert.equal(afterFirst.repository.id, 2);
});

test('cancel exposes a cancelled state', async () => {
  const apiClient = createMockApiClient();
  const controller = createGitScopeController({ apiClient });

  const pending = controller.checkRepository('https://github.com/octocat/Hello-World');
  controller.cancel();

  apiClient.reject(new DOMException('Aborted', 'AbortError'));
  const state = await pending;

  assert.equal(state.status, 'cancelled');
  assert.equal(state.error.type, 'aborted');
});

test('reset clears repository state', async () => {
  const apiClient = createMockApiClient();
  const controller = createGitScopeController({ apiClient });

  const pending = controller.checkRepository('https://github.com/octocat/Hello-World');
  apiClient.resolve({
    ok: true,
    type: 'success',
    status: 200,
    message: 'OK',
    data: { id: 1, full_name: 'octocat/Hello-World' },
    rateLimit: null,
  });
  await pending;

  const resetState = controller.reset();
  assert.equal(resetState.status, 'idle');
  assert.equal(resetState.repository, null);
  assert.equal(resetState.repositoryUrl, '');
});
