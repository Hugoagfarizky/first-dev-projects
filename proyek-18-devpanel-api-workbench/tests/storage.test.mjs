import assert from 'node:assert/strict';
import test from 'node:test';

import { createJsonStorage, loadStoredJson, saveStoredJson } from '../js/storage.js';

const FIXED_NOW = '2026-10-27T10:00:00.000Z';

function createMemoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  const calls = { getItem: [], setItem: [], removeItem: [] };
  return {
    data,
    calls,
    getItem(key) { calls.getItem.push(key); return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { calls.setItem.push([key, value]); data.set(key, value); },
    removeItem(key) { calls.removeItem.push(key); data.delete(key); },
  };
}

test('generic storage round-trip save/load', () => {
  const storage = createMemoryStorage();
  const api = createJsonStorage({ storage, key: 'devpanel.test', now: () => FIXED_NOW });
  assert.equal(api.save({ a: 1 }).status, 'saved');
  const loaded = api.load();
  assert.equal(loaded.status, 'loaded');
  assert.deepEqual(loaded.data, { a: 1 });
});

test('generic storage empty, corrupt, unsupported, unavailable, read/write/quota', () => {
  const storage = createMemoryStorage();
  const api = createJsonStorage({ storage, key: 'devpanel.test', now: () => FIXED_NOW });
  assert.equal(api.load().status, 'empty');

  storage.data.set('devpanel.test', '{bad');
  assert.equal(api.load().status, 'corrupt');

  storage.data.set('devpanel.test', JSON.stringify({ app: 'devpanel', schemaVersion: 2, savedAt: FIXED_NOW, data: 1 }));
  assert.equal(api.load().status, 'unsupported-schema');

  const unavailableStorage = { getItem() { throw new Error('getter'); } };
  // direct storage-like with throwing getter is handled as unavailable/read-error depending method
  const direct = loadStoredJson({ storage: unavailableStorage, key: 'devpanel.test' });
  assert.equal(direct.ok, false);

  const writeStorage = createMemoryStorage();
  const writeApi = createJsonStorage({ storage: writeStorage, key: 'devpanel.test', now: () => FIXED_NOW });
  const originalSetItem = writeStorage.setItem;
  writeStorage.setItem = () => { throw new Error('write failed'); };
  assert.equal(writeApi.save({ a: 1 }).status, 'write-error');
  writeStorage.setItem = originalSetItem;

  const quotaStorage = createMemoryStorage();
  const quotaApi = createJsonStorage({ storage: quotaStorage, key: 'devpanel.test', now: () => FIXED_NOW });
  quotaStorage.setItem = () => { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; };
  assert.equal(quotaApi.save({ a: 1 }).status, 'quota-exceeded');
});

test('generic storage load result is cloned and corrupt data not overwritten', () => {
  const storage = createMemoryStorage();
  const api = createJsonStorage({ storage, key: 'devpanel.test', now: () => FIXED_NOW });
  api.save({ a: 1 });
  const loaded = api.load();
  loaded.data.a = 999;
  assert.equal(api.load().data.a, 1);
  storage.data.set('devpanel.test', '{bad');
  api.load();
  assert.equal(storage.data.get('devpanel.test'), '{bad');
});

test('saveStoredJson direct function works', () => {
  const storage = createMemoryStorage();
  const result = saveStoredJson({ x: 2 }, { storage, key: 'devpanel.test', now: () => FIXED_NOW });
  assert.equal(result.status, 'saved');
});