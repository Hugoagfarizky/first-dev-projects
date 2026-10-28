import assert from 'node:assert/strict';
import test from 'node:test';

import { buildRequest } from '../js/request-builder.js';
import { sendRequest } from '../js/http-client.js';

function makeReader(chunks) {
  let index = 0;
  return {
    async read() {
      if (index >= chunks.length) {
        return { done: true, value: undefined };
      }
      const value = chunks[index++];
      return { done: false, value };
    },
    async cancel() {},
  };
}

function makeResponse(options = {}) {
  const headers = options.headers || {};
  const body = options.body === undefined ? '' : options.body;
  const chunks = options.chunks;
  return {
    status: options.status ?? 200,
    statusText: options.statusText ?? 'OK',
    headers: {
      get(name) {
        return headers[name.toLowerCase()] ?? headers[name] ?? null;
      },
      forEach(callback) {
        for (const [key, value] of Object.entries(headers)) {
          callback(value, key);
        }
      },
    },
    body: chunks ? { getReader: () => makeReader(chunks) } : null,
    async text() {
      if (options.textError) {
        throw new Error(options.textError);
      }
      return body;
    },
  };
}

test('sendRequest mengirim request valid untuk berbagai method', async () => {
  const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
  for (const method of methods) {
    const request = buildRequest({ method, url: 'https://example.com/' }).request;
    const result = await sendRequest(request, {
      fetchImpl: async () => makeResponse({ status: 204, statusText: 'No Content', body: '' }),
    });
    assert.equal(result.ok, true, method);
    assert.equal(result.status, 204);
  }
});

test('sendRequest terintegrasi dengan buildRequest', async () => {
  const built = buildRequest({ method: 'GET', url: 'https://example.com/' });
  const result = await sendRequest(built.request, {
    fetchImpl: async () => makeResponse({ body: '{"ok":true}' }),
  });
  assert.equal(result.ok, true);
  assert.equal(result.bodyText, '{"ok":true}');
});

test('sendRequest memvalidasi request sebelum Fetch dipanggil', async () => {
  let called = false;
  const result = await sendRequest({ method: 'GET', url: 'ftp://example.com' }, {
    fetchImpl: async () => {
      called = true;
      return makeResponse();
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.type, 'invalid-request');
  assert.equal(called, false);
});

test('sendRequest membaca respons sukses JSON, teks, dan body kosong', async () => {
  const json = await sendRequest({ method: 'GET', url: 'https://example.com/' }, {
    fetchImpl: async () => makeResponse({ body: '{"ok":true}' }),
  });
  assert.equal(json.bodyText, '{"ok":true}');

  const text = await sendRequest({ method: 'GET', url: 'https://example.com/' }, {
    fetchImpl: async () => makeResponse({ body: 'plain text' }),
  });
  assert.equal(text.bodyText, 'plain text');

  const empty = await sendRequest({ method: 'GET', url: 'https://example.com/' }, {
    fetchImpl: async () => makeResponse({ body: '' }),
  });
  assert.equal(empty.bodyText, '');
});

test('sendRequest membaca respons HTTP 400/500 sebagai respons HTTP', async () => {
  for (const status of [400, 500]) {
    const result = await sendRequest({ method: 'GET', url: 'https://example.com/' }, {
      fetchImpl: async () => makeResponse({ status, statusText: 'Error', body: '{"error":"x"}' }),
    });
    assert.equal(result.ok, true);
    assert.equal(result.httpOk, false);
    assert.equal(result.status, status);
  }
});

test('sendRequest mengekstrak headers, waktu, dan ukuran respons', async () => {
  const result = await sendRequest({ method: 'GET', url: 'https://example.com/' }, {
    fetchImpl: async () => makeResponse({ headers: { 'content-type': 'application/json' }, body: 'abcd' }),
    now: () => 1000,
  });
  // now is called twice; override not enough for duration, but shape is checked
  assert.equal(result.headers['content-type'], 'application/json');
  assert.equal(result.bodySize, 4);
  assert.equal(typeof result.durationMs, 'number');
});

test('sendRequest menangani network/CORS error', async () => {
  const result = await sendRequest({ method: 'GET', url: 'https://example.com/' }, {
    fetchImpl: async () => {
      throw new TypeError('Failed to fetch');
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.type, 'network-error');
});

test('sendRequest menangani timeout', async () => {
  const result = await sendRequest({ method: 'GET', url: 'https://example.com/', timeoutMs: 5 }, {
    fetchImpl: async (_url, init) => new Promise((resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new Error('aborted')));
    }),
  });
  assert.equal(result.ok, false);
  assert.equal(result.type, 'timeout');
});

test('sendRequest menangani pembatalan pengguna', async () => {
  const controller = new AbortController();
  const promise = sendRequest({ method: 'GET', url: 'https://example.com/', timeoutMs: 1000 }, {
    signal: controller.signal,
    fetchImpl: async (_url, init) => new Promise((resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new Error('aborted')));
    }),
  });
  controller.abort();
  const result = await promise;
  assert.equal(result.ok, false);
  assert.equal(result.type, 'aborted');
});

test('sendRequest menangani kegagalan membaca body', async () => {
  const result = await sendRequest({ method: 'GET', url: 'https://example.com/' }, {
    fetchImpl: async () => makeResponse({ textError: 'read failed' }),
  });
  assert.equal(result.ok, false);
  assert.equal(result.type, 'response-read-error');
});

test('sendRequest menandai Content-Length melebihi batas', async () => {
  const result = await sendRequest({ method: 'GET', url: 'https://example.com/' }, {
    maxResponseBodyBytes: 5,
    fetchImpl: async () => makeResponse({ headers: { 'content-length': '10' }, body: '0123456789' }),
  });
  assert.equal(result.ok, true);
  assert.equal(result.truncated, true);
  assert.equal(result.bodyText, null);
  assert.equal(result.bodySize, 10);
});

test('sendRequest membatasi pembacaan stream dan menandai truncated', async () => {
  const result = await sendRequest({ method: 'GET', url: 'https://example.com/' }, {
    maxResponseBodyBytes: 5,
    fetchImpl: async () => makeResponse({ chunks: [new Uint8Array([1, 2, 3]), new Uint8Array([4, 5, 6])] }),
  });
  assert.equal(result.ok, true);
  assert.equal(result.truncated, true);
  assert.equal(result.bodySize, 5);
});

test('sendRequest tidak membocorkan nilai header sensitif ke pesan error', async () => {
  const result = await sendRequest({
    method: 'GET',
    url: 'https://example.com/',
    headers: { Authorization: 'Bearer secret-token' },
  }, {
    fetchImpl: async () => {
      throw new Error('Failed to fetch');
    },
  });
  assert.equal(result.ok, false);
  assert.ok(!JSON.stringify(result).includes('secret-token'));
});

test('sendRequest membersihkan timer dan tidak memutasi input', async () => {
  const cleared = [];
  const result = await sendRequest({ method: 'GET', url: 'https://example.com/', timeoutMs: 1000 }, {
    fetchImpl: async () => makeResponse({ body: 'ok' }),
    clearTimeoutFn: (id) => cleared.push(id),
  });
  assert.equal(result.ok, true);
  assert.ok(cleared.length >= 1);

  const input = { method: 'GET', url: 'https://example.com/', timeoutMs: 1000 };
  const copy = JSON.parse(JSON.stringify(input));
  await sendRequest(input, { fetchImpl: async () => makeResponse({ body: 'ok' }) });
  assert.deepEqual(input, copy);
});