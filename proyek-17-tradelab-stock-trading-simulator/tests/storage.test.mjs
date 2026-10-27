import assert from 'node:assert/strict';
import test from 'node:test';

import { buy } from '../js/portfolio.js';
import { createPortfolio } from '../js/portfolio.js';
import {
  STORAGE_KEY,
  clearPortfolio,
  createPortfolioStorage,
  loadPortfolio,
  savePortfolio,
} from '../js/storage.js';

const FIXED_SAVED_AT = '2026-10-27T10:00:00.000Z';

function createMemoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  const calls = {
    getItem: [],
    setItem: [],
    removeItem: [],
  };

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
    raw(key = STORAGE_KEY) {
      return data.get(key);
    },
  };
}

function makePortfolio() {
  const portfolio = createPortfolio({
    initialCash: 1000000,
    id: 'portfolio-1',
    createdAt: '2026-10-27T09:00:00.000Z',
    updatedAt: '2026-10-27T09:00:00.000Z',
  });
  return buy(portfolio, {
    symbol: 'TLAB',
    quantity: 4,
    price: 10000,
    id: 'buy-1',
    timestamp: '2026-10-27T09:30:00.000Z',
  }).portfolio;
}

test('loadPortfolio mengembalikan status empty saat storage kosong', () => {
  const storage = createMemoryStorage();
  const result = loadPortfolio(storage);

  assert.equal(result.ok, true);
  assert.equal(result.status, 'empty');
  assert.equal(result.portfolio, null);
  assert.equal(result.key, STORAGE_KEY);
});

test('savePortfolio dan loadPortfolio melakukan round-trip state valid', () => {
  const portfolio = makePortfolio();
  const storage = createMemoryStorage();
  const saved = savePortfolio(portfolio, { storage, savedAt: FIXED_SAVED_AT });

  assert.equal(saved.ok, true);
  assert.equal(saved.status, 'saved');

  const envelope = JSON.parse(storage.raw());
  assert.deepEqual(Object.keys(envelope).sort(), ['app', 'portfolio', 'savedAt', 'schemaVersion']);
  assert.equal(envelope.app, 'tradelab');
  assert.equal(envelope.schemaVersion, 1);
  assert.equal(envelope.savedAt, FIXED_SAVED_AT);
  assert.equal(envelope.portfolio.cash, portfolio.cash);

  const loaded = loadPortfolio(storage);
  assert.equal(loaded.ok, true);
  assert.equal(loaded.status, 'loaded');
  assert.equal(loaded.savedAt, FIXED_SAVED_AT);
  assert.deepEqual(loaded.portfolio, JSON.parse(JSON.stringify(portfolio)));
});

test('loadPortfolio menolak JSON yang tidak valid tanpa menghapus data', () => {
  const raw = '{ini bukan json';
  const storage = createMemoryStorage({ [STORAGE_KEY]: raw });
  const result = loadPortfolio(storage);

  assert.equal(result.ok, false);
  assert.equal(result.status, 'corrupt');
  assert.equal(result.code, 'invalid-json');
  assert.equal(storage.raw(), raw);
  assert.equal(storage.calls.removeItem.length, 0);
  assert.equal(storage.calls.setItem.length, 0);
});

test('loadPortfolio menolak schema storage yang tidak didukung', () => {
  const portfolio = makePortfolio();
  const envelope = {
    app: 'tradelab',
    schemaVersion: 2,
    savedAt: FIXED_SAVED_AT,
    portfolio,
  };
  const storage = createMemoryStorage({ [STORAGE_KEY]: JSON.stringify(envelope) });
  const result = loadPortfolio(storage);

  assert.equal(result.ok, false);
  assert.equal(result.status, 'unsupported-schema');
  assert.equal(result.schemaVersion, 2);
  assert.equal(storage.calls.removeItem.length, 0);
});

test('loadPortfolio menolak envelope yang tidak valid', () => {
  const storage = createMemoryStorage({
    [STORAGE_KEY]: JSON.stringify({
      app: 'bukan-tradelab',
      schemaVersion: 1,
      savedAt: 'bukan-timestamp',
      portfolio: makePortfolio(),
    }),
  });
  const result = loadPortfolio(storage);

  assert.equal(result.ok, false);
  assert.equal(result.status, 'corrupt');
  assert.equal(result.code, 'invalid-envelope');
  assert.match(result.errors.join(' '), /Envelope\.app/);
  assert.match(result.errors.join(' '), /Envelope\.savedAt/);
});

test('loadPortfolio menolak portofolio yang tidak valid', () => {
  const invalidPortfolio = {
    ...makePortfolio(),
    cash: '1000000',
  };
  const storage = createMemoryStorage({
    [STORAGE_KEY]: JSON.stringify({
      app: 'tradelab',
      schemaVersion: 1,
      savedAt: FIXED_SAVED_AT,
      portfolio: invalidPortfolio,
    }),
  });
  const result = loadPortfolio(storage);

  assert.equal(result.ok, false);
  assert.equal(result.status, 'corrupt');
  assert.equal(result.code, 'invalid-portfolio');
  assert.match(result.error, /cash/);
  assert.equal(storage.calls.removeItem.length, 0);
});

test('load dan save melaporkan storage yang tidak tersedia', () => {
  const portfolio = makePortfolio();

  assert.equal(loadPortfolio({ storage: null }).status, 'unavailable');
  assert.equal(savePortfolio(portfolio, { storage: null }).status, 'unavailable');
});

test('loadPortfolio menangani getter localStorage yang melempar error', () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      throw new Error('Akses localStorage diblokir.');
    },
  });

  try {
    const result = loadPortfolio();
    assert.equal(result.ok, false);
    assert.equal(result.status, 'unavailable');
    assert.equal(result.code, 'storage-getter-error');
    assert.match(result.error, /diblokir/);
  } finally {
    if (originalDescriptor) {
      Object.defineProperty(globalThis, 'localStorage', originalDescriptor);
    } else {
      delete globalThis.localStorage;
    }
  }
});

test('loadPortfolio melaporkan read error dari storage', () => {
  const storage = {
    getItem() {
      throw new Error('Baca storage gagal.');
    },
    setItem() {},
  };
  const result = loadPortfolio(storage);

  assert.equal(result.ok, false);
  assert.equal(result.status, 'read-error');
  assert.equal(result.code, 'read-failed');
  assert.match(result.error, /Baca storage gagal/);
});

test('savePortfolio melaporkan write error dari storage', () => {
  const storage = {
    getItem() {
      return null;
    },
    setItem() {
      throw new Error('Tulis storage gagal.');
    },
  };
  const result = savePortfolio(makePortfolio(), storage);

  assert.equal(result.ok, false);
  assert.equal(result.status, 'write-error');
  assert.equal(result.code, 'write-failed');
  assert.match(result.error, /Tulis storage gagal/);
});

test('savePortfolio membedakan quota error dari write error biasa', () => {
  const storage = {
    getItem() {
      return null;
    },
    setItem() {
      const error = new Error('Kuota penyimpanan habis.');
      error.name = 'QuotaExceededError';
      throw error;
    },
  };
  const result = savePortfolio(makePortfolio(), storage);

  assert.equal(result.ok, false);
  assert.equal(result.status, 'quota-exceeded');
  assert.equal(result.code, 'quota-exceeded');
});

test('loadPortfolio tidak menghapus atau menimpa data rusak secara otomatis', () => {
  const raw = JSON.stringify({
    app: 'tradelab',
    schemaVersion: 1,
    savedAt: FIXED_SAVED_AT,
    portfolio: { rusak: true },
  });
  const storage = createMemoryStorage({ [STORAGE_KEY]: raw });

  loadPortfolio(storage);
  loadPortfolio(storage);

  assert.equal(storage.raw(), raw);
  assert.equal(storage.calls.removeItem.length, 0);
  assert.equal(storage.calls.setItem.length, 0);
});

test('portofolio hasil load tidak dapat memutasi data storage', () => {
  const portfolio = makePortfolio();
  const storage = createMemoryStorage();
  savePortfolio(portfolio, { storage, savedAt: FIXED_SAVED_AT });

  const first = loadPortfolio(storage);
  first.portfolio.cash = 0;
  first.portfolio.positions.length = 0;

  const second = loadPortfolio(storage);
  assert.equal(second.portfolio.cash, portfolio.cash);
  assert.equal(second.portfolio.positions.length, portfolio.positions.length);

  portfolio.cash = 123;
  const third = loadPortfolio(storage);
  assert.equal(third.portfolio.cash, second.portfolio.cash);
});

test('savePortfolio menolak portofolio invalid tanpa menulis ke storage', () => {
  const storage = createMemoryStorage();
  const invalidPortfolio = {
    ...makePortfolio(),
    cash: 1.5,
  };
  const result = savePortfolio(invalidPortfolio, { storage, savedAt: FIXED_SAVED_AT });

  assert.equal(result.ok, false);
  assert.equal(result.status, 'invalid-portfolio');
  assert.equal(result.code, 'invalid-portfolio');
  assert.equal(storage.calls.setItem.length, 0);
});

test('createPortfolioStorage mengikat storage yang diinjeksi', () => {
  const storage = createMemoryStorage();
  const api = createPortfolioStorage(storage);
  const portfolio = makePortfolio();

  assert.equal(api.key, STORAGE_KEY);
  assert.equal(api.save(portfolio, { savedAt: FIXED_SAVED_AT }).status, 'saved');
  assert.equal(api.load().status, 'loaded');
  assert.equal(api.clear().status, 'cleared');
  assert.equal(api.load().status, 'empty');
});

test('clearPortfolio hanya menghapus key portofolio', () => {
  const storage = createMemoryStorage({
    [STORAGE_KEY]: 'data',
    'tradelab.lain': 'tetap',
  });
  const result = clearPortfolio(storage);

  assert.equal(result.ok, true);
  assert.equal(result.status, 'cleared');
  assert.equal(storage.raw(), undefined);
  assert.equal(storage.raw('tradelab.lain'), 'tetap');
});

test('loadPortfolio melaporkan getter getItem yang melempar', () => {
  const storage = {};
  Object.defineProperty(storage, 'getItem', {
    get() {
      throw new Error('Getter getItem gagal.');
    },
  });

  const result = loadPortfolio(storage);
  assert.equal(result.ok, false);
  assert.equal(result.status, 'read-error');
  assert.equal(result.code, 'storage-method-error');
  assert.match(result.error, /Getter getItem gagal/);
});

test('savePortfolio melaporkan getter setItem yang melempar', () => {
  const storage = {
    getItem() {
      return null;
    },
  };
  Object.defineProperty(storage, 'setItem', {
    get() {
      throw new Error('Getter setItem gagal.');
    },
  });

  const result = savePortfolio(makePortfolio(), storage);
  assert.equal(result.ok, false);
  assert.equal(result.status, 'write-error');
  assert.equal(result.code, 'storage-method-error');
  assert.match(result.error, /Getter setItem gagal/);
});

test('clearPortfolio melaporkan getter removeItem yang melempar', () => {
  const storage = {
    getItem() {
      return null;
    },
    setItem() {},
  };
  Object.defineProperty(storage, 'removeItem', {
    get() {
      throw new Error('Getter removeItem gagal.');
    },
  });

  const result = clearPortfolio(storage);
  assert.equal(result.ok, false);
  assert.equal(result.status, 'write-error');
  assert.equal(result.code, 'storage-method-error');
  assert.match(result.error, /Getter removeItem gagal/);
});

test('loadPortfolio menolak hasil baca non-string tanpa menimpa data', () => {
  const storage = {
    getItem() {
      return { bukan: 'string' };
    },
    setItem() {
      throw new Error('setItem tidak boleh dipanggil.');
    },
  };

  const result = loadPortfolio(storage);
  assert.equal(result.ok, false);
  assert.equal(result.status, 'corrupt');
  assert.equal(result.code, 'invalid-raw');
});

test('savePortfolio menolak timestamp invalid tanpa menulis', () => {
  const storage = createMemoryStorage();
  const result = savePortfolio(makePortfolio(), { storage, savedAt: 'bukan-timestamp' });

  assert.equal(result.ok, false);
  assert.equal(result.status, 'invalid-envelope');
  assert.equal(result.code, 'invalid-saved-at');
  assert.equal(storage.calls.setItem.length, 0);
});

test('loadPortfolio menolak timestamp envelope invalid', () => {
  const storage = createMemoryStorage({
    [STORAGE_KEY]: JSON.stringify({
      app: 'tradelab',
      schemaVersion: 1,
      savedAt: 'bukan-timestamp',
      portfolio: makePortfolio(),
    }),
  });

  const result = loadPortfolio(storage);
  assert.equal(result.ok, false);
  assert.equal(result.status, 'corrupt');
  assert.equal(result.code, 'invalid-envelope');
});

test('savePortfolio membedakan quota error berdasarkan code', () => {
  const storage = {
    getItem() {
      return null;
    },
    setItem() {
      const error = new Error('Kuota habis berdasarkan code.');
      error.code = 22;
      throw error;
    },
  };
  const result = savePortfolio(makePortfolio(), storage);

  assert.equal(result.ok, false);
  assert.equal(result.status, 'quota-exceeded');
  assert.equal(result.code, 'quota-exceeded');
});

test('loadPortfolio schema tidak didukung tidak memanggil setItem', () => {
  const calls = [];
  const storage = createMemoryStorage({
    [STORAGE_KEY]: JSON.stringify({
      app: 'tradelab',
      schemaVersion: 2,
      savedAt: FIXED_SAVED_AT,
      portfolio: makePortfolio(),
    }),
  });
  const originalSetItem = storage.setItem;
  storage.setItem = (...args) => {
    calls.push(args);
    return originalSetItem(...args);
  };

  const result = loadPortfolio(storage);
  assert.equal(result.ok, false);
  assert.equal(result.status, 'unsupported-schema');
  assert.equal(calls.length, 0);
});
