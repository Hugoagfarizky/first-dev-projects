import assert from 'node:assert/strict';
import test from 'node:test';

import { createCollectionStorage } from '../js/collection-storage.js';

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

function makeCollection(overrides = {}) {
  return {
    id: 'col-1',
    name: 'Test Collection',
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
    requests: [{ method: 'GET', url: 'https://example.com/?token=secret', headers: { Authorization: 'Bearer secret' } }],
    ...overrides,
  };
}

test('collection CRUD and validation', () => {
  const storage = createMemoryStorage();
  const collections = createCollectionStorage({ storage, key: 'devpanel.collections', now: () => FIXED_NOW });
  const saved = collections.save(makeCollection());
  assert.equal(saved.ok, true);
  assert.equal(collections.list().collections.length, 1);
  assert.equal(collections.get('col-1').ok, true);

  const updated = collections.save(makeCollection({ name: 'Other' }));
  assert.equal(updated.ok, true);

  const removed = collections.remove('col-1');
  assert.equal(removed.ok, true);
  assert.equal(collections.list().collections.length, 0);
});

test('collection duplicate name case-insensitive and invalid request', () => {
  const storage = createMemoryStorage();
  const collections = createCollectionStorage({ storage, key: 'devpanel.collections', now: () => FIXED_NOW });
  collections.save(makeCollection());
  const duplicateName = collections.save(makeCollection({ id: 'col-2', name: 'test collection' }));
  assert.equal(duplicateName.ok, false);

  const invalid = collections.save(makeCollection({ id: 'col-3', name: 'Valid', requests: [{ method: 'GET', url: 'ftp://x' }] }));
  assert.equal(invalid.ok, false);
});

test('collection import/export round-trip and atomic invalid import', () => {
  const storage = createMemoryStorage();
  const collections = createCollectionStorage({ storage, key: 'devpanel.collections', now: () => FIXED_NOW });
  collections.save(makeCollection());

  const exported = collections.exportCollections();
  assert.equal(exported.ok, true);
  assert.equal(exported.collections.length, 1);

  const imported = collections.importCollections([makeCollection({ id: 'col-2', name: 'Imported' })]);
  assert.equal(imported.ok, true);
  assert.equal(collections.list().collections.length, 1);
  assert.equal(collections.list().collections[0].id, 'col-2');

  const before = collections.list().collections.length;
  const invalidImport = collections.importCollections([{ id: 'bad', name: 'Bad', requests: [{ method: 'GET', url: 'ftp://x' }] }, makeCollection({ id: 'col-3', name: 'Valid' })]);
  assert.equal(invalidImport.ok, false);
  assert.equal(collections.list().collections.length, before);
});

test('collection sanitizes credentials on save and export', () => {
  const storage = createMemoryStorage();
  const collections = createCollectionStorage({ storage, key: 'devpanel.collections', now: () => FIXED_NOW });
  collections.save(makeCollection());
  const raw = storage.data.get('devpanel.collections');
  assert.equal(raw.includes('secret'), false);
  assert.equal(raw.includes('Bearer'), false);

  const exported = collections.exportCollections();
  assert.equal(JSON.stringify(exported).includes('secret'), false);
});

test('collection storage failure and corrupt data', () => {
  const storage = createMemoryStorage();
  const collections = createCollectionStorage({ storage, key: 'devpanel.collections', now: () => FIXED_NOW });
  storage.setItem = () => { throw new Error('write failed'); };
  assert.equal(collections.save(makeCollection()).ok, false);

  const storage2 = createMemoryStorage();
  storage2.data.set('devpanel.collections', '{bad');
  const collections2 = createCollectionStorage({ storage: storage2, key: 'devpanel.collections', now: () => FIXED_NOW });
  assert.equal(collections2.list().status, 'corrupt');
});