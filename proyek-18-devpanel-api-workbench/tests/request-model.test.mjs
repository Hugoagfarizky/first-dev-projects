import assert from 'node:assert/strict';
import test from 'node:test';

import {
  HTTP_METHODS,
  DEFAULT_REQUEST_TIMEOUT_MS,
  MAX_REQUEST_TIMEOUT_MS,
  validateMethod,
  validateUrl,
  validateTimeout,
  validateRequest,
} from '../js/request-model.js';

test('validateMethod menerima semua method yang didukung', () => {
  for (const method of HTTP_METHODS) {
    const result = validateMethod(method);
    assert.equal(result.ok, true);
    assert.equal(result.value, method);
  }
  assert.equal(validateMethod('post').value, 'POST');
});

test('validateMethod menolak method invalid dan non-string', () => {
  assert.equal(validateMethod('OPTIONS').ok, false);
  assert.equal(validateMethod(123).ok, false);
  assert.equal(validateMethod('').ok, false);
});

test('validateUrl menerima HTTP dan HTTPS valid', () => {
  assert.equal(validateUrl('https://example.com/path?q=1').value, 'https://example.com/path?q=1');
  assert.equal(validateUrl('http://localhost:8080/').value, 'http://localhost:8080/');
});

test('validateUrl menolak skema lain, relatif, malformed, dan kredensial', () => {
  for (const url of ['ftp://example.com', '/relative', 'not a url', 'javascript:alert(1)', 'https://user:pass@example.com']) {
    const result = validateUrl(url);
    assert.equal(result.ok, false, url);
  }
});

test('validateUrl menolak URL tanpa host', () => {
  assert.equal(validateUrl('https://').ok, false);
});

test('validateTimeout menggunakan default untuk undefined/null', () => {
  assert.equal(validateTimeout(undefined).value, DEFAULT_REQUEST_TIMEOUT_MS);
  assert.equal(validateTimeout(null).value, DEFAULT_REQUEST_TIMEOUT_MS);
});

test('validateTimeout menolak nol, negatif, pecahan, string, dan overflow', () => {
  for (const value of [0, -1, 1.5, '1000', MAX_REQUEST_TIMEOUT_MS + 1]) {
    assert.equal(validateTimeout(value).ok, false, String(value));
  }
});

test('validateTimeout menerima timeout valid', () => {
  assert.equal(validateTimeout(5000).value, 5000);
  assert.equal(validateTimeout(MAX_REQUEST_TIMEOUT_MS).value, MAX_REQUEST_TIMEOUT_MS);
});

test('validateRequest mengembalikan request ter-normalisasi', () => {
  const result = validateRequest({ method: 'get', url: 'https://example.com/', timeoutMs: 3000 });
  assert.equal(result.ok, true);
  assert.deepEqual(result.request, { method: 'GET', url: 'https://example.com/', timeoutMs: 3000 });
});

test('validateRequest menolak method/url/timeout invalid', () => {
  const result = validateRequest({ method: 'OPTIONS', url: 'ftp://x', timeoutMs: 0 });
  assert.equal(result.ok, false);
  assert.ok(result.errors.length >= 3);
});

test('validateRequest tidak memutasi input', () => {
  const input = { method: 'GET', url: 'https://example.com/', timeoutMs: 1000 };
  const copy = JSON.parse(JSON.stringify(input));
  validateRequest(input);
  assert.deepEqual(input, copy);
});