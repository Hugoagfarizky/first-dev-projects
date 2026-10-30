import test from 'node:test';
import assert from 'node:assert/strict';

import { createGitHubApiClient, GITHUB_API_VERSION } from '../js/github-api-client.js';

function headers(values = {}) {
  const normalized = Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key.toLowerCase(), value]),
  );
  return {
    get(name) {
      return Object.prototype.hasOwnProperty.call(normalized, name.toLowerCase())
        ? normalized[name.toLowerCase()]
        : null;
    },
  };
}

function mockFetch(handler) {
  let calls = 0;
  const fetchImpl = async (url, init) => {
    calls += 1;
    return handler(url, init, calls);
  };
  fetchImpl.calls = () => calls;
  return fetchImpl;
}

test('uses the verified GitHub API version and host', async () => {
  const fetchImpl = mockFetch(async (url, init) => {
    assert.equal(url, 'https://api.github.com/repos/octocat/Hello-World');
    assert.equal(init.headers.Accept, 'application/vnd.github+json');
    assert.equal(init.headers['X-GitHub-Api-Version'], GITHUB_API_VERSION);
    return {
      ok: true,
      status: 200,
      headers: headers({ 'x-ratelimit-limit': '60' }),
      text: async () => JSON.stringify({ id: 1, name: 'Hello-World' }),
    };
  });

  const client = createGitHubApiClient({ fetchImpl });
  const result = await client.getRepository('octocat', 'Hello-World');

  assert.equal(result.ok, true);
  assert.equal(result.status, 200);
  assert.equal(result.data.id, 1);
  assert.equal(result.rateLimit.limit, 60);
  assert.equal(fetchImpl.calls(), 1);
});

test('returns not_found for HTTP 404', async () => {
  const fetchImpl = mockFetch(async () => ({
    ok: false,
    status: 404,
    headers: headers({}),
    text: async () => JSON.stringify({ message: 'Not Found' }),
  }));

  const client = createGitHubApiClient({ fetchImpl });
  const result = await client.getRepository('octocat', 'missing');

  assert.equal(result.ok, false);
  assert.equal(result.type, 'not_found');
  assert.equal(result.status, 404);
  assert.equal(result.message, 'Not Found');
});

test('classifies exhausted primary rate limit', async () => {
  const fetchImpl = mockFetch(async () => ({
    ok: false,
    status: 403,
    headers: headers({
      'x-ratelimit-limit': '60',
      'x-ratelimit-remaining': '0',
      'x-ratelimit-reset': '1700000000',
    }),
    text: async () => JSON.stringify({ message: 'API rate limit exceeded' }),
  }));

  const client = createGitHubApiClient({ fetchImpl });
  const result = await client.getRepository('octocat', 'Hello-World');

  assert.equal(result.ok, false);
  assert.equal(result.type, 'rate_limit');
  assert.equal(result.rateLimit.remaining, 0);
  assert.equal(result.rateLimit.reset, 1700000000);
});

test('classifies secondary rate limit from 429', async () => {
  const fetchImpl = mockFetch(async () => ({
    ok: false,
    status: 429,
    headers: headers({ 'retry-after': '30' }),
    text: async () => JSON.stringify({ message: 'Too Many Requests' }),
  }));

  const client = createGitHubApiClient({ fetchImpl });
  const result = await client.getRepository('octocat', 'Hello-World');

  assert.equal(result.ok, false);
  assert.equal(result.type, 'secondary_rate_limit');
  assert.equal(result.rateLimit.retryAfterSeconds, 30);
});

test('classifies secondary rate limit from 403 message', async () => {
  const fetchImpl = mockFetch(async () => ({
    ok: false,
    status: 403,
    headers: headers({ 'x-ratelimit-remaining': '10' }),
    text: async () => JSON.stringify({ message: 'You have exceeded a secondary rate limit' }),
  }));

  const client = createGitHubApiClient({ fetchImpl });
  const result = await client.getRepository('octocat', 'Hello-World');

  assert.equal(result.ok, false);
  assert.equal(result.type, 'secondary_rate_limit');
});

test('returns http_error for other non-success statuses', async () => {
  const fetchImpl = mockFetch(async () => ({
    ok: false,
    status: 400,
    headers: headers({}),
    text: async () => JSON.stringify({ message: 'Bad request' }),
  }));

  const client = createGitHubApiClient({ fetchImpl });
  const result = await client.getRepository('octocat', 'Hello-World');

  assert.equal(result.ok, false);
  assert.equal(result.type, 'http_error');
  assert.equal(result.status, 400);
});

test('returns network_error when fetch throws', async () => {
  const fetchImpl = mockFetch(async () => {
    throw new Error('network down');
  });

  const client = createGitHubApiClient({ fetchImpl });
  const result = await client.getRepository('octocat', 'Hello-World');

  assert.equal(result.ok, false);
  assert.equal(result.type, 'network_error');
  assert.equal(fetchImpl.calls(), 1);
});

test('returns invalid_response for malformed JSON', async () => {
  const fetchImpl = mockFetch(async () => ({
    ok: true,
    status: 200,
    headers: headers({}),
    text: async () => '{not json',
  }));

  const client = createGitHubApiClient({ fetchImpl });
  const result = await client.getRepository('octocat', 'Hello-World');

  assert.equal(result.ok, false);
  assert.equal(result.type, 'invalid_response');
});

test('parses available and missing rate-limit headers', async () => {
  const fetchImpl = mockFetch(async () => ({
    ok: true,
    status: 200,
    headers: headers({
      'x-ratelimit-limit': '5000',
      'x-ratelimit-remaining': '4999',
      'x-ratelimit-used': '1',
      'x-ratelimit-reset': '1700000000',
      'x-ratelimit-resource': 'core',
    }),
    text: async () => JSON.stringify({ id: 1 }),
  }));

  const client = createGitHubApiClient({ fetchImpl });
  const result = await client.getRepository('octocat', 'Hello-World');

  assert.equal(result.rateLimit.limit, 5000);
  assert.equal(result.rateLimit.remaining, 4999);
  assert.equal(result.rateLimit.used, 1);
  assert.equal(result.rateLimit.resource, 'core');
  assert.equal(result.rateLimit.resetAt, new Date(1700000000 * 1000).toISOString());

  const missingHeaders = mockFetch(async () => ({
    ok: true,
    status: 200,
    headers: headers({}),
    text: async () => JSON.stringify({ id: 1 }),
  }));
  const secondClient = createGitHubApiClient({ fetchImpl: missingHeaders });
  const secondResult = await secondClient.getRepository('octocat', 'Hello-World');

  assert.equal(secondResult.rateLimit.limit, null);
  assert.equal(secondResult.rateLimit.remaining, null);
  assert.equal(secondResult.rateLimit.reset, null);
  assert.equal(secondResult.rateLimit.resetAt, null);
});

test('classifies aborted request as aborted', async () => {
  const controller = new AbortController();
  const fetchImpl = mockFetch(async (_url, init) => {
    if (init.signal?.aborted) {
      const error = new Error('aborted');
      error.name = 'AbortError';
      throw error;
    }
    controller.abort();
    const error = new Error('aborted');
    error.name = 'AbortError';
    throw error;
  });

  const client = createGitHubApiClient({ fetchImpl });
  const result = await client.getRepository('octocat', 'Hello-World', {
    signal: controller.signal,
  });

  assert.equal(result.ok, false);
  assert.equal(result.type, 'aborted');
});

test('does not retry rate-limited responses', async () => {
  const fetchImpl = mockFetch(async () => ({
    ok: false,
    status: 429,
    headers: headers({ 'retry-after': '1' }),
    text: async () => JSON.stringify({ message: 'Too Many Requests' }),
  }));

  const client = createGitHubApiClient({ fetchImpl });
  await client.getRepository('octocat', 'Hello-World');

  assert.equal(fetchImpl.calls(), 1);
});
test('getBranches builds the branches endpoint and parses pagination', async () => {
  const fetchImpl = async (url) => {
    assert.equal(url, 'https://api.github.com/repos/octocat/Hello-World/branches?per_page=100&page=2');
    return {
      ok: true,
      status: 200,
      headers: headers({
        link: '<https://api.github.com/repos/octocat/Hello-World/branches?per_page=100&page=3>; rel="next", <https://api.github.com/repos/octocat/Hello-World/branches?per_page=100&page=1>; rel="prev"',
      }),
      text: async () => JSON.stringify([{ name: 'main', commit: { sha: 'abc123' }, protected: false }]),
    };
  };

  const client = createGitHubApiClient({ fetchImpl });
  const result = await client.getBranches('octocat', 'Hello-World', { page: 2 });

  assert.equal(result.ok, true);
  assert.equal(result.data[0].name, 'main');
  assert.equal(result.pagination.hasNext, true);
  assert.equal(result.pagination.hasPrev, true);
});

test('getCommits builds the commits endpoint with sha and page', async () => {
  const fetchImpl = async (url) => {
    assert.equal(url, 'https://api.github.com/repos/octocat/Hello-World/commits?sha=main&per_page=30&page=2');
    return {
      ok: true,
      status: 200,
      headers: headers({}),
      text: async () => JSON.stringify([{ sha: 'abc123', commit: { message: 'Initial commit', author: { name: 'Octocat', date: '2024-01-01T00:00:00Z' } }, parents: [] }]),
    };
  };

  const client = createGitHubApiClient({ fetchImpl });
  const result = await client.getCommits('octocat', 'Hello-World', { sha: 'main', page: 2 });

  assert.equal(result.ok, true);
  assert.equal(result.data[0].sha, 'abc123');
  assert.equal(result.pagination.hasNext, false);
});

test('getCommit builds the commit detail endpoint', async () => {
  const fetchImpl = async (url) => {
    assert.equal(url, 'https://api.github.com/repos/octocat/Hello-World/commits/abc123def456');
    return {
      ok: true,
      status: 200,
      headers: headers({}),
      text: async () => JSON.stringify({ sha: 'abc123def456', commit: { message: 'Detail', author: { name: 'Octocat', date: '2024-01-01T00:00:00Z' } }, parents: [], files: [] }),
    };
  };

  const client = createGitHubApiClient({ fetchImpl });
  const result = await client.getCommit('octocat', 'Hello-World', 'abc123def456');

  assert.equal(result.ok, true);
  assert.equal(result.data.sha, 'abc123def456');
});

test('getCommit rejects invalid SHA without network request', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return { ok: true, status: 200, headers: headers({}), text: async () => '{}' };
  };

  const client = createGitHubApiClient({ fetchImpl });
  const result = await client.getCommit('octocat', 'Hello-World', '../secret');

  assert.equal(result.ok, false);
  assert.equal(result.type, 'invalid_request');
  assert.equal(calls, 0);
});
test('compare builds the compare endpoint', async () => {
  const fetchImpl = async (url) => {
    assert.equal(url, 'https://api.github.com/repos/octocat/Hello-World/compare/main...dev?per_page=30&page=1');
    return {
      ok: true,
      status: 200,
      headers: headers({}),
      text: async () => JSON.stringify({ status: 'ahead', ahead_by: 1, behind_by: 0, total_commits: 1, commits: [], files: [] }),
    };
  };

  const client = createGitHubApiClient({ fetchImpl });
  const result = await client.compare('octocat', 'Hello-World', 'main', 'dev');

  assert.equal(result.ok, true);
  assert.equal(result.data.status, 'ahead');
});

test('compare supports slash refs and pagination', async () => {
  const fetchImpl = async (url) => {
    assert.equal(url, 'https://api.github.com/repos/octocat/Hello-World/compare/feature%2Ftest...main?per_page=30&page=2');
    return {
      ok: true,
      status: 200,
      headers: headers({}),
      text: async () => JSON.stringify({ status: 'diverged', ahead_by: 1, behind_by: 1, total_commits: 2, commits: [], files: [] }),
    };
  };

  const client = createGitHubApiClient({ fetchImpl });
  const result = await client.compare('octocat', 'Hello-World', 'feature/test', 'main', { page: 2 });

  assert.equal(result.ok, true);
  assert.equal(result.data.status, 'diverged');
});

test('compare rejects missing refs without network request', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return { ok: true, status: 200, headers: headers({}), text: async () => '{}' };
  };

  const client = createGitHubApiClient({ fetchImpl });
  const result = await client.compare('octocat', 'Hello-World', '', 'main');

  assert.equal(result.ok, false);
  assert.equal(result.type, 'invalid_request');
  assert.equal(calls, 0);
});
