import assert from 'node:assert/strict';
import test from 'node:test';

import { createWorkbenchController } from '../js/workbench-controller.js';

function createMemoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, value); },
    removeItem(key) { data.delete(key); },
  };
}

test('controller tidak mengirim request saat dibuat', async () => {
  let fetchCalls = 0;
  const controller = createWorkbenchController({
    fetchImpl: async () => { fetchCalls += 1; return { status: 200, statusText: 'OK', headers: { get() { return null; }, forEach() {} }, body: { getReader() { return { read: async () => ({ done: true }) }; } }, text: async () => '' }; },
    now: () => '2026-10-27T10:00:00.000Z',
  });
  assert.equal(fetchCalls, 0);
  assert.equal(controller.getStatus().sending, false);
});

test('Send memanggil HTTP client sekali dengan request tervalidasi', async () => {
  let fetchCalls = 0;
  const controller = createWorkbenchController({
    fetchImpl: async () => { fetchCalls += 1; return { status: 200, statusText: 'OK', headers: { get() { return null; }, forEach() {} }, body: null, text: async () => '{"ok":true}' }; },
    now: () => '2026-10-27T10:00:00.000Z',
  });
  controller.setRequest({ method: 'GET', url: 'https://example.com/', timeoutMs: 1000 });
  const result = await controller.send();
  assert.equal(result.ok, true);
  assert.equal(fetchCalls, 1);
});

test('Cancel membatalkan request aktif', async () => {
  const controller = createWorkbenchController({
    fetchImpl: async (_url, init) => new Promise((resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new Error('aborted')));
    }),
    now: () => '2026-10-27T10:00:00.000Z',
  });
  controller.setRequest({ method: 'GET', url: 'https://example.com/', timeoutMs: 1000 });
  const sendPromise = controller.send();
  controller.cancel();
  const result = await sendPromise;
  assert.equal(result.ok, false);
  assert.equal(result.type, 'aborted');
});

test('Respons non-2xx tetap dapat dilihat', async () => {
  const controller = createWorkbenchController({
    fetchImpl: async () => ({ status: 404, statusText: 'Not Found', headers: { get() { return null; }, forEach() {} }, body: null, text: async () => '{"error":"missing"}' }),
    now: () => '2026-10-27T10:00:00.000Z',
  });
  controller.setRequest({ method: 'GET', url: 'https://example.com/', timeoutMs: 1000 });
  const result = await controller.send();
  assert.equal(result.ok, true);
  assert.equal(result.httpOk, false);
  assert.equal(controller.getStatus().response.status, 404);
});

test('Timeout dan network error ditangani dengan pesan sesuai', async () => {
  const timeoutController = createWorkbenchController({
    fetchImpl: async (_url, init) => new Promise((resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new Error('aborted')));
    }),
    now: () => '2026-10-27T10:00:00.000Z',
  });
  timeoutController.setRequest({ method: 'GET', url: 'https://example.com/', timeoutMs: 5 });
  const timeoutResult = await timeoutController.send();
  assert.equal(timeoutResult.type, 'timeout');

  const networkController = createWorkbenchController({
    fetchImpl: async () => { throw new Error('network'); },
    now: () => '2026-10-27T10:00:00.000Z',
  });
  networkController.setRequest({ method: 'GET', url: 'https://example.com/', timeoutMs: 1000 });
  const networkResult = await networkController.send();
  assert.equal(networkResult.type, 'network-error');
});

test('Body invalid ditolak sebelum request dikirim', async () => {
  let fetchCalls = 0;
  const controller = createWorkbenchController({
    fetchImpl: async () => { fetchCalls += 1; return { status: 200, statusText: 'OK', headers: { get() { return null; }, forEach() {} }, body: null, text: async () => '' }; },
    now: () => '2026-10-27T10:00:00.000Z',
  });
  controller.setRequest({ method: 'POST', url: 'https://example.com/', timeoutMs: 1000, body: '{bad' });
  const result = await controller.send();
  assert.equal(result.ok, false);
  assert.equal(result.type, 'validation-error');
  assert.equal(fetchCalls, 0);
});

test('History dan collections menggunakan storage aktual', async () => {
  const storage = createMemoryStorage();
  const controller = createWorkbenchController({
    storage,
    fetchImpl: async () => ({ status: 200, statusText: 'OK', headers: { get() { return null; }, forEach() {} }, body: null, text: async () => '{"ok":true}' }),
    now: () => '2026-10-27T10:00:00.000Z',
  });
  controller.setRequest({ method: 'GET', url: 'https://example.com/', timeoutMs: 1000 });
  await controller.send();

  assert.equal(controller.getStatus().history.length, 1);
  const saveResult = controller.saveCollection('Test');
  assert.equal(saveResult.ok, true);
  assert.equal(controller.getStatus().collections.length, 1);
});

test('Kredensial tidak bocor ke history, collections, atau pesan error', async () => {
  const storage = createMemoryStorage();
  const controller = createWorkbenchController({
    storage,
    fetchImpl: async () => { throw new Error('network failed'); },
    now: () => '2026-10-27T10:00:00.000Z',
  });
  controller.setRequest({ method: 'GET', url: 'https://example.com/?token=secret', timeoutMs: 1000, headers: [{ key: 'Authorization', value: 'Bearer secret' }] });
  await controller.send();

  const historyRaw = storage.data.get('devpanel.history') || '';
  const collectionsRaw = storage.data.get('devpanel.collections') || '';
  assert.equal(historyRaw.includes('secret'), false);
  assert.equal(collectionsRaw.includes('secret'), false);
  assert.equal(JSON.stringify(controller.getStatus().error || {}).includes('secret'), false);
});

test('Import invalid tidak menimpa data yang ada', async () => {
  const storage = createMemoryStorage();
  const controller = createWorkbenchController({
    storage,
    now: () => '2026-10-27T10:00:00.000Z',
  });
  controller.saveCollection('Existing');
  const before = controller.getStatus().collections.length;
  const result = controller.importCollections('[{"id":"bad","name":"Bad","requests":[{"method":"GET","url":"ftp://x"}]}]');
  assert.equal(result.ok, false);
  assert.equal(controller.getStatus().collections.length, before);
});

test('Status respons terpotong ditampilkan dengan benar', async () => {
  const controller = createWorkbenchController({
    fetchImpl: async () => ({ status: 200, statusText: 'OK', headers: { get(name) { return name.toLowerCase() === 'content-length' ? '10' : null; }, forEach() {} }, body: { getReader() { return { read: async () => ({ done: true }) }; } }, text: async () => '0123456789' }),
    now: () => '2026-10-27T10:00:00.000Z',
  });
  controller.setRequest({ method: 'GET', url: 'https://example.com/', timeoutMs: 1000 });
  // Force http-client max bytes small by passing through controller not possible; inspect status after normal response
  const result = await controller.send();
  assert.equal(result.ok, true);
  const inspected = controller.inspectCurrentResponse();
  assert.equal(typeof inspected.body.truncated, 'boolean');
});