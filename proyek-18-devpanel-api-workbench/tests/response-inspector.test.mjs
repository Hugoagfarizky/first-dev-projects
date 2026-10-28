import assert from 'node:assert/strict';
import test from 'node:test';

import { inspectResponse } from '../js/response-inspector.js';

test('inspectResponse menangani status 2xx dan non-2xx', () => {
  const ok = inspectResponse({ ok: true, status: 200, statusText: 'OK', headers: {}, bodyText: '{}', bodySize: 2, truncated: false, durationMs: 10, httpOk: true });
  assert.equal(ok.httpOk, true);
  assert.equal(ok.status, 200);

  const fail = inspectResponse({ ok: true, status: 404, statusText: 'Not Found', headers: {}, bodyText: '', bodySize: 0, truncated: false, durationMs: 10, httpOk: false });
  assert.equal(fail.httpOk, false);
  assert.equal(fail.status, 404);
});

test('inspectResponse menangani headers dan body kosong', () => {
  const result = inspectResponse({ ok: true, status: 204, statusText: 'No Content', headers: {}, bodyText: '', bodySize: 0, truncated: false, durationMs: 5, httpOk: true });
  assert.equal(result.body.raw, null);
  assert.equal(result.headerEntries.length, 0);
});

test('inspectResponse memformat JSON valid dan menandai JSON invalid/teks', () => {
  const valid = inspectResponse({ ok: true, status: 200, statusText: 'OK', headers: {}, bodyText: '{"a":1}', bodySize: 7, truncated: false, durationMs: 5, httpOk: true });
  assert.equal(valid.body.isJson, true);
  assert.match(valid.body.formatted, /"a": 1/);

  const invalid = inspectResponse({ ok: true, status: 200, statusText: 'OK', headers: {}, bodyText: '{bad', bodySize: 4, truncated: false, durationMs: 5, httpOk: true });
  assert.equal(invalid.body.isJson, false);
  assert.equal(invalid.body.formatted, null);

  const text = inspectResponse({ ok: true, status: 200, statusText: 'OK', headers: {}, bodyText: 'plain', bodySize: 5, truncated: false, durationMs: 5, httpOk: true });
  assert.equal(text.body.isJson, false);
});

test('inspectResponse menangani respons terpotong', () => {
  const result = inspectResponse({ ok: true, status: 200, statusText: 'OK', headers: {}, bodyText: 'partial', bodySize: 10, truncated: true, durationMs: 5, httpOk: true });
  assert.equal(result.body.truncated, true);
  assert.equal(result.body.isJson, false);
});

test('inspectResponse menyertakan metadata waktu dan ukuran', () => {
  const result = inspectResponse({ ok: true, status: 200, statusText: 'OK', headers: { 'content-type': 'text/plain' }, bodyText: 'abc', bodySize: 3, truncated: false, durationMs: 42, httpOk: true });
  assert.equal(result.durationMs, 42);
  assert.equal(result.body.size, 3);
  assert.equal(result.headerEntries.length, 1);
});

test('inspectResponse menangani hasil error HTTP client', () => {
  const result = inspectResponse({ ok: false, type: 'timeout', error: 'Request timed out.', durationMs: 5 });
  assert.equal(result.ok, false);
  assert.equal(result.type, 'timeout');
  assert.equal(result.error, 'Request timed out.');
});

test('inspectResponse menangani input invalid tanpa crash', () => {
  const result = inspectResponse(null);
  assert.equal(result.ok, false);
  assert.equal(result.type, 'invalid-input');
});