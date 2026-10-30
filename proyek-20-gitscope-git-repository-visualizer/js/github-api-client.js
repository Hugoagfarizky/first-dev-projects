const GITHUB_API_BASE = 'https://api.github.com';
const DEFAULT_API_VERSION = '2026-03-10';

function parseRateLimit(headers) {
  if (!headers || typeof headers.get !== 'function') {
    return null;
  }

  function numberOrNull(value) {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  const limit = numberOrNull(headers.get('x-ratelimit-limit'));
  const remaining = numberOrNull(headers.get('x-ratelimit-remaining'));
  const used = numberOrNull(headers.get('x-ratelimit-used'));
  const reset = numberOrNull(headers.get('x-ratelimit-reset'));
  const retryAfter = numberOrNull(headers.get('retry-after'));

  return {
    limit,
    remaining,
    used,
    reset,
    resetAt: reset === null ? null : new Date(reset * 1000).toISOString(),
    resource: headers.get('x-ratelimit-resource'),
    retryAfterSeconds: retryAfter,
  };
}

function parseLinkHeader(headers) {
  const link = headers?.get?.('link');
  const result = {
    next: null,
    prev: null,
    first: null,
    last: null,
  };

  if (typeof link !== 'string' || link === '') {
    return result;
  }

  for (const part of link.split(',')) {
    const match = part.match(/<([^>]+)>;\s*rel="([^"]+)"/);
    if (match) {
      result[match[2]] = match[1];
    }
  }

  return result;
}

function isAllowedPath(pathname) {
  return /^\/repos\/[^/]+\/[^/]+$/.test(pathname)
    || /^\/repos\/[^/]+\/[^/]+\/branches$/.test(pathname)
    || /^\/repos\/[^/]+\/[^/]+\/commits$/.test(pathname)
    || /^\/repos\/[^/]+\/[^/]+\/commits\/[^/]+$/.test(pathname)
    || /^\/repos\/[^/]+\/[^/]+\/compare\/[^/]+\.\.\.[^/]+$/.test(pathname);
}

function classifyResponse(status, data, rateLimit) {
  const message = typeof data?.message === 'string' ? data.message : '';

  if (status === 404) {
    return {
      type: 'not_found',
      message: message || 'Repositori tidak ditemukan.',
    };
  }

  if (status === 429) {
    return {
      type: 'secondary_rate_limit',
      message: message || 'Batas laju sekunder GitHub tercapai.',
    };
  }

  if (status === 403) {
    const lowerMessage = message.toLowerCase();
    if (rateLimit?.remaining === 0) {
      return {
        type: 'rate_limit',
        message: message || 'Batas laju GitHub tercapai.',
      };
    }
    if (lowerMessage.includes('secondary rate limit')) {
      return {
        type: 'secondary_rate_limit',
        message: message || 'Batas laju sekunder GitHub tercapai.',
      };
    }
    return {
      type: 'http_error',
      message: message || 'Akses ke GitHub API ditolak.',
    };
  }

  return {
    type: 'http_error',
    message: message || `GitHub API mengembalikan status ${status}.`,
  };
}

export function createGitHubApiClient({
  fetchImpl = globalThis.fetch,
  apiVersion = DEFAULT_API_VERSION,
} = {}) {
  async function request(path, { signal } = {}) {
    const [pathname, queryString = ''] = String(path).split('?', 2);

    if (!isAllowedPath(pathname)) {
      return {
        ok: false,
        type: 'invalid_request',
        status: null,
        message: 'Path API tidak diizinkan.',
        data: null,
        rateLimit: null,
      };
    }

    if (typeof fetchImpl !== 'function') {
      return {
        ok: false,
        type: 'network_error',
        status: null,
        message: 'Fetch API tidak tersedia.',
        data: null,
        rateLimit: null,
      };
    }

    const url = `${GITHUB_API_BASE}${pathname}${queryString ? `?${queryString}` : ''}`;
    let response;

    try {
      response = await fetchImpl(url, {
        method: 'GET',
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': apiVersion,
        },
        signal,
      });
    } catch (error) {
      if (signal?.aborted || error?.name === 'AbortError') {
        return {
          ok: false,
          type: 'aborted',
          status: null,
          message: 'Permintaan dibatalkan.',
          data: null,
          rateLimit: null,
        };
      }

      return {
        ok: false,
        type: 'network_error',
        status: null,
        message: 'Gagal menghubungi GitHub API.',
        data: null,
        rateLimit: null,
      };
    }

    const rateLimit = parseRateLimit(response.headers);
    let text = '';

    try {
      text = await response.text();
    } catch (error) {
      if (signal?.aborted || error?.name === 'AbortError') {
        return {
          ok: false,
          type: 'aborted',
          status: response.status,
          message: 'Permintaan dibatalkan.',
          data: null,
          rateLimit,
        };
      }

      return {
        ok: false,
        type: 'invalid_response',
        status: response.status,
        message: 'Gagal membaca respons GitHub API.',
        data: null,
        rateLimit,
      };
    }

    let data = null;
    if (text !== '') {
      try {
        data = JSON.parse(text);
      } catch {
        return {
          ok: false,
          type: 'invalid_response',
          status: response.status,
          message: 'Respons GitHub API bukan JSON yang valid.',
          data: null,
          rateLimit,
        };
      }
    }

    if (!response.ok) {
      const classified = classifyResponse(response.status, data, rateLimit);
      return {
        ok: false,
        type: classified.type,
        status: response.status,
        message: classified.message,
        data,
        rateLimit,
      };
    }

    const links = parseLinkHeader(response.headers);

    return {
      ok: true,
      type: 'success',
      status: response.status,
      message: 'OK',
      data,
      rateLimit,
      pagination: {
        hasNext: Boolean(links.next),
        hasPrev: Boolean(links.prev),
      },
    };
  }

  function encodeSegment(value) {
    return encodeURIComponent(String(value ?? ''));
  }

  return {
    getRepository(owner, repo, options = {}) {
      return request(`/repos/${encodeSegment(owner)}/${encodeSegment(repo)}`, options);
    },
    getBranches(owner, repo, options = {}) {
      const page = normalizePage(options.page);
      const params = new URLSearchParams({ per_page: '100', page: String(page) });
      return request(`/repos/${encodeSegment(owner)}/${encodeSegment(repo)}/branches?${params.toString()}`, options);
    },
    getCommits(owner, repo, params = {}, options = {}) {
      const page = normalizePage(params.page);
      const perPage = normalizePerPage(params.perPage, 30);
      const query = new URLSearchParams();
      if (typeof params.sha === 'string' && params.sha !== '') {
        query.set('sha', params.sha);
      }
      query.set('per_page', String(perPage));
      query.set('page', String(page));
      return request(`/repos/${encodeSegment(owner)}/${encodeSegment(repo)}/commits?${query.toString()}`, options);
    },
    getCommit(owner, repo, sha, options = {}) {
      if (typeof sha !== 'string' || !/^[0-9a-fA-F]{7,40}$/.test(sha)) {
        return Promise.resolve({
          ok: false,
          type: 'invalid_request',
          status: null,
          message: 'SHA commit tidak valid.',
          data: null,
          rateLimit: null,
          pagination: { hasNext: false, hasPrev: false },
        });
      }
      return request(`/repos/${encodeSegment(owner)}/${encodeSegment(repo)}/commits/${encodeURIComponent(sha)}`, options);
    },
    compare(owner, repo, base, head, params = {}, options = {}) {
      if (typeof base !== 'string' || base === '' || typeof head !== 'string' || head === '') {
        return Promise.resolve({
          ok: false,
          type: 'invalid_request',
          status: null,
          message: 'Referensi base dan head harus tersedia.',
          data: null,
          rateLimit: null,
          pagination: { hasNext: false, hasPrev: false },
        });
      }
      const page = normalizePage(params.page);
      const perPage = normalizePerPage(params.perPage, 30);
      const query = new URLSearchParams({ per_page: String(perPage), page: String(page) });
      const path = `/repos/${encodeSegment(owner)}/${encodeSegment(repo)}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}?${query.toString()}`;
      return request(path, options);
    },
  };
}

function normalizePage(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) {
    return 1;
  }
  return number;
}

function normalizePerPage(value, fallback) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) {
    return fallback;
  }
  return Math.min(number, 100);
}

export const GITHUB_API_VERSION = DEFAULT_API_VERSION;
export const GITHUB_API_BASE_URL = GITHUB_API_BASE;
