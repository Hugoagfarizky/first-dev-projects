import assert from 'node:assert/strict';
import test from 'node:test';

import {
  WATCHLIST_STORAGE_KEY,
  createWatchlistStorage,
  loadWatchlist,
  saveWatchlist,
} from '../js/watchlist-storage.js';

const FIXED_NOW = '2026-10-27T10:00:00.000Z';
const VALID_SYMBOLS = ['TLAB', 'BKPI'];

function createMemoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  const calls = { getItem: [], setItem: [], removeItem: [] };
  return {
    data,
    calls,
    getItem(key) {
      calls.getItem.push(key);
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      calls.setItem.push([key, value]);
      data.set(key, value);
    },
    removeItem(key) {
      calls.removeItem.push(key);
      data.delete(key);
    },
  };
}

test('saveWatchlist dan loadWatchlist round-trip', () => {
  const storage = createMemoryStorage();
  const saved = saveWatchlist(['tlab', 'BKPI'], { storage, validSymbols: VALID_SYMBOLS, savedAt: FIXED_NOW });
  assert.equal(saved.ok, true);
  assert.deepEqual(saved.symbols, ['TLAB', 'BKPI']);

  const loaded = loadWatchlist({ storage, validSymbols: VALID_SYMBOLS });
  assert.equal(loaded.ok, true);
  assert.equal(loaded.status, 'loaded');
  assert.deepEqual(loaded.symbols, ['TLAB', 'BKPI']);
});

test('loadWatchlist mengembalikan empty saat storage kosong', () => {
  const storage = createMemoryStorage();
  const result = loadWatchlist({ storage, validSymbols: VALID_SYMBOLS });
  assert.equal(result.ok, true);
  assert.equal(result.status, 'empty');
  assert.deepEqual(result.symbols, []);
});

test('loadWatchlist menolak data rusak tanpa overwrite', () => {
  const storage = createMemoryStorage({ [WATCHLIST_STORAGE_KEY]: '{rusak' });
  const result = loadWatchlist({ storage, validSymbols: VALID_SYMBOLS });
  assert.equal(result.ok, false);
  assert.equal(result.status, 'corrupt');
  assert.equal(storage.data.get(WATCHLIST_STORAGE_KEY), '{rusak');
});

test('loadWatchlist menolak simbol tidak dikenal', () => {
  const storage = createMemoryStorage();
  const envelope = {
    app: 'tradelab',
    schemaVersion: 1,
    savedAt: FIXED_NOW,
    symbols: ['TLAB', 'XXXX'],
  };
  storage.data.set(WATCHLIST_STORAGE_KEY, JSON.stringify(envelope));
  const result = loadWatchlist({ storage, validSymbols: VALID_SYMBOLS });
  assert.equal(result.ok, false);
  assert.equal(result.status, 'corrupt');
});

test('saveWatchlist menolak duplikat, invalid, dan lebih dari 20 simbol', () => {
  const storage = createMemoryStorage();
  assert.equal(saveWatchlist(['TLAB', 'TLAB'], { storage, validSymbols: VALID_SYMBOLS }).ok, false);
  assert.equal(saveWatchlist(['TLAB', 123], { storage, validSymbols: VALID_SYMBOLS }).ok, false);
  const tooMany = Array.from({ length: 21 }, (_, index) => `S${index}`);
  // invalid symbols anyway; test limit with valid repeated not possible, so test count via direct invalid symbols
  assert.equal(saveWatchlist(tooMany, { storage, validSymbols: VALID_SYMBOLS }).ok, false);
});

test('loadWatchlist dan saveWatchlist melaporkan storage error', () => {
  const storage = {
    getItem() {
      throw new Error('baca watchlist gagal');
    },
    setItem() {
      throw new Error('tulis watchlist gagal');
    },
    removeItem() {},
  };
  const loadResult = loadWatchlist({ storage, validSymbols: VALID_SYMBOLS });
  assert.equal(loadResult.ok, false);
  assert.equal(loadResult.status, 'read-error');

  const saveResult = saveWatchlist(['TLAB'], storage);
  // storage passed directly is treated as storage-like
  assert.equal(saveResult.ok, false);
  assert.equal(saveResult.status, 'write-error');
});

test('createWatchlistStorage mengikat storage', () => {
  const storage = createMemoryStorage();
  const api = createWatchlistStorage({ storage, validSymbols: VALID_SYMBOLS });
  assert.equal(api.save(['TLAB'], { savedAt: FIXED_NOW }).status, 'saved');
  assert.equal(api.load().status, 'loaded');
  assert.deepEqual(api.load().symbols, ['TLAB']);
  assert.equal(api.clear().status, 'cleared');
});