import assert from 'node:assert/strict';
import test from 'node:test';

import { createHistoryStorage } from '../js/history-storage.js';

const FIXED_NOW = '2026-10-27T10:00:00.000Z';

function createMemoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, value); },
    removeItem(key) { data.delete(key); },
  };
}

function makeRequest(overrides = {}) {
  return {
    method: 'GET',
    url: 'https://example.com/api?token=secret&normal=value',
    timeoutMs: 5000,
    headers: { Authorization: 'Bearer secret', 'X-Test': 'value' },
    ...overrides,
  };
}

test('history add/list/remove/clear and limit', () => {
  const storage = createMemoryStorage();
  const history = createHistoryStorage({ storage, key: 'devpanel.history', now: () => FIXED_NOW, createId: () => 'id-1' });
  const added = history.add(makeRequest());
  assert.equal(added.ok, true);
  assert.equal(history.list().items.length, 1);
  const item = history.list().items[0];
  assert.equal(item.request.headers.Authorization, undefined);
  assert.equal(item.request.url.includes('token=secret'), false);
  assert.equal(item.request.url.includes('normal=value'), true);

  history.remove('id-1');
  assert.equal(history.list().items.length, 0);
  history.add(makeRequest());
  history.clear();
  assert.equal(history.list().items.length, 0);
});

test('history rejects invalid request and handles corrupt item', () => {
  const storage = createMemoryStorage();
  const history = createHistoryStorage({ storage, key: 'devpanel.history', now: () => FIXED_NOW, createId: () => 'id-1' });
  const invalid = history.add({ method: 'GET', url: 'ftp://x' });
  assert.equal(invalid.ok, false);

  storage.data.set('devpanel.history', JSON.stringify({
    app: 'devpanel',
    schemaVersion: 1,
    savedAt: FIXED_NOW,
    data: [{ id: 'bad', createdAt: FIXED_NOW, request: { method: 'GET', url: 'ftp://x' } }, { id: 'good', createdAt: FIXED_NOW, request: { method: 'GET', url: 'https://example.com/' } }],
  }));
  const loaded = history.list();
  assert.equal(loaded.ok, true);
  assert.equal(loaded.items.length, 1);
  assert.equal(loaded.droppedCount, 1);
});

test('history does not store sensitive headers or query values', () => {
  const storage = createMemoryStorage();
  const history = createHistoryStorage({ storage, key: 'devpanel.history', now: () => FIXED_NOW, createId: () => 'id-1' });
  history.add(makeRequest());
  const raw = storage.data.get('devpanel.history');
  assert.equal(raw.includes('secret'), false);
  assert.equal(raw.includes('Bearer'), false);
});

test('history response summary excludes body', () => {
  const storage = createMemoryStorage();
  const history = createHistoryStorage({ storage, key: 'devpanel.history', now: () => FIXED_NOW, createId: () => 'id-1' });
  history.add(makeRequest(), { status: 200, body: 'secret body', durationMs: 10 });
  const item = history.list().items[0];
  assert.equal(item.responseSummary.status, 200);
  assert.equal(item.responseSummary.body, undefined);
});