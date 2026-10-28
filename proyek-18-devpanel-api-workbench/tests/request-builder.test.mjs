import assert from 'node:assert/strict';
import test from 'node:test';

import {
  appendQueryParams,
  buildJsonBody,
  buildRequest,
  normalizeHeaders,
  normalizeQueryParams,
} from '../js/request-builder.js';

test('normalizeQueryParams mendukung array, object, disabled, dan nilai kosong', () => {
  const result = normalizeQueryParams([
    { key: 'q', value: 'hello world', enabled: true },
    { key: 'page', value: 2, enabled: false },
    { key: 'empty', value: '' },
  ]);
  assert.equal(result.ok, true);
  assert.equal(result.params.length, 3);
  assert.equal(result.params[1].enabled, false);
});

test('appendQueryParams meng-encode karakter khusus dan mempertahankan query/hash existing', () => {
  const result = appendQueryParams('https://example.com/path?existing=1#section', [
    { key: 'q', value: 'a b&c', enabled: true },
  ]);
  assert.equal(result.ok, true);
  assert.match(result.url, /existing=1/);
  assert.match(result.url, /q=a\+b%26c/);
  assert.match(result.url, /#section$/);
});

test('appendQueryParams menolak query parameter invalid', () => {
  const result = appendQueryParams('https://example.com', [{ key: '', value: 'x' }]);
  assert.equal(result.ok, false);
});

test('normalizeHeaders memvalidasi nama, nilai, newline, dan duplikasi case-insensitive', () => {
  const valid = normalizeHeaders({ 'X-Test': 'value', Accept: 'application/json' });
  assert.equal(valid.ok, true);
  assert.equal(valid.headers['X-Test'], 'value');

  assert.equal(normalizeHeaders({ 'Bad Name': 'x' }).ok, false);
  assert.equal(normalizeHeaders({ 'X-Test': 'line1\nline2' }).ok, false);
  assert.equal(normalizeHeaders([{ key: 'X-Test', value: '1' }, { key: 'x-test', value: '2' }]).ok, false);
});

test('normalizeHeaders mendeteksi header sensitif tanpa menyalin nilai ke error', () => {
  const result = normalizeHeaders({ Authorization: 'secret-token', 'X-Test': 'value' });
  assert.equal(result.ok, true);
  assert.deepEqual(result.sensitiveHeaders, ['Authorization']);
});

test('buildJsonBody memvalidasi JSON dan menolak body pada GET', () => {
  const valid = buildJsonBody('POST', '{"a":1}', 'application/json');
  assert.equal(valid.ok, true);
  assert.equal(valid.body, '{"a":1}');

  assert.equal(buildJsonBody('POST', '{bad json}').ok, false);
  assert.equal(buildJsonBody('GET', '{"a":1}').ok, false);
});

test('buildJsonBody mengizinkan body kosong', () => {
  const result = buildJsonBody('DELETE', '');
  assert.equal(result.ok, true);
  assert.equal(result.body, null);
});

test('buildRequest membangun request lengkap dan menambah Content-Type', () => {
  const result = buildRequest({
    method: 'post',
    url: 'https://example.com/api?existing=1',
    timeoutMs: 5000,
    queryParams: [{ key: 'q', value: 'hello', enabled: true }],
    headers: { 'X-Test': 'value' },
    body: '{"name":"dev"}',
  });

  assert.equal(result.ok, true);
  assert.equal(result.request.method, 'POST');
  assert.match(result.request.url, /q=hello/);
  assert.equal(result.request.headers['Content-Type'], 'application/json');
  assert.equal(result.request.body, '{"name":"dev"}');
});

test('buildRequest menolak body pada GET dan tidak memutasi input', () => {
  const input = { method: 'GET', url: 'https://example.com/', body: '{"a":1}' };
  const copy = JSON.parse(JSON.stringify(input));
  const result = buildRequest(input);
  assert.equal(result.ok, false);
  assert.deepEqual(input, copy);
});

test('buildRequest melaporkan header sensitif tanpa nilai rahasia di errors', () => {
  const result = buildRequest({
    method: 'POST',
    url: 'https://example.com/',
    headers: { Authorization: 'Bearer secret' },
    body: '{"a":1}',
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.sensitiveHeaders, ['Authorization']);
  assert.ok(!JSON.stringify(result.errors).includes('secret'));
});