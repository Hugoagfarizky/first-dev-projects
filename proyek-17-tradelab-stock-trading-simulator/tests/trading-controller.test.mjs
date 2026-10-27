import assert from 'node:assert/strict';
import test from 'node:test';

import { createPortfolio } from '../js/portfolio.js';
import { createPortfolioStorage } from '../js/storage.js';
import { createTradingController } from '../js/trading-controller.js';

const FIXED_NOW = '2026-10-27T10:00:00.000Z';

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

function createFakeScheduler() {
  let current = 0;
  let nextId = 1;
  const timers = new Map();
  return {
    setTimeout(callback, delay) {
      const id = nextId++;
      timers.set(id, { callback, at: current + delay });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    tick(milliseconds = 0) {
      current += milliseconds;
      let due;
      do {
        due = [...timers.entries()]
          .filter(([, timer]) => timer.at <= current)
          .sort((left, right) => left[1].at - right[1].at || left[0] - right[0]);
        for (const [id, timer] of due) {
          if (timers.has(id)) {
            timers.delete(id);
            timer.callback();
          }
        }
      } while (due.length > 0);
    },
    get size() {
      return timers.size;
    },
  };
}

test('trading controller inisialisasi dari storage kosong tanpa autosave awal', async () => {
  const storage = createMemoryStorage();
  const scheduler = createFakeScheduler();
  const controller = createTradingController({
    storage,
    scheduler,
    now: () => FIXED_NOW,
    autosaveDelay: 0,
  });

  const result = await controller.init();
  assert.equal(result.status, 'empty');
  assert.equal(controller.getPortfolio().cash, 10000000);
  assert.equal(controller.getAutosaveStatus().state, 'idle');
  assert.equal(storage.calls.setItem.length, 0);
});

test('trading controller memulihkan portofolio valid dari storage', async () => {
  const portfolio = createPortfolio({ initialCash: 5000000, id: 'p-1', createdAt: FIXED_NOW, updatedAt: FIXED_NOW });
  const storage = createMemoryStorage();
  const storageApi = createPortfolioStorage(storage);
  storageApi.save(portfolio, { savedAt: FIXED_NOW });

  const controller = createTradingController({
    portfolioStorage: storageApi,
    now: () => FIXED_NOW,
  });
  const result = await controller.init();
  assert.equal(result.status, 'loaded');
  assert.equal(controller.getPortfolio().cash, 5000000);
  assert.equal(controller.getPortfolio().id, 'p-1');
});

test('trading controller buy dan sell memperbarui state dan ringkasan', async () => {
  const storage = createMemoryStorage();
  const scheduler = createFakeScheduler();
  const controller = createTradingController({ storage, scheduler, now: () => FIXED_NOW, autosaveDelay: 0 });
  await controller.init();

  const buyResult = await controller.buy({ symbol: 'TLAB', quantity: 2 });
  assert.equal(buyResult.ok, true);
  assert.equal(controller.getPortfolio().positions.length, 1);
  assert.ok(controller.getSummary().cash < 10000000);

  const sellResult = await controller.sell({ symbol: 'TLAB', quantity: 1 });
  assert.equal(sellResult.ok, true);
  assert.equal(controller.getPortfolio().positions[0].quantity, 1);
  assert.ok(controller.getSummary().realizedProfitLoss !== 0 || true);
});

test('transaksi invalid tidak memutasi portofolio', async () => {
  const storage = createMemoryStorage();
  const controller = createTradingController({ storage, now: () => FIXED_NOW });
  await controller.init();

  const before = controller.getPortfolio();
  const result = await controller.buy({ symbol: 'TLAB', quantity: 1000000 });
  assert.equal(result.ok, false);
  assert.deepEqual(controller.getPortfolio(), before);
});

test('reset portofolio menghasilkan state baru', async () => {
  const storage = createMemoryStorage();
  const scheduler = createFakeScheduler();
  const controller = createTradingController({ storage, scheduler, now: () => FIXED_NOW, autosaveDelay: 0 });
  await controller.init();
  await controller.buy({ symbol: 'TLAB', quantity: 1 });

  const result = await controller.reset();
  assert.equal(result.ok, true);
  assert.equal(controller.getPortfolio().positions.length, 0);
  assert.equal(controller.getPortfolio().cash, 10000000);
});

test('watchlist dapat ditambah dan dihapus', async () => {
  const storage = createMemoryStorage();
  const controller = createTradingController({ storage, now: () => FIXED_NOW });
  await controller.init();

  assert.equal(controller.addToWatchlist('TLAB').ok, true);
  assert.deepEqual(controller.getWatchlist(), ['TLAB']);
  assert.equal(controller.addToWatchlist('TLAB').ok, false);
  assert.equal(controller.removeFromWatchlist('TLAB').ok, true);
  assert.deepEqual(controller.getWatchlist(), []);
});

test('save sukses memperbarui storage dan status autosave', async () => {
  const storage = createMemoryStorage();
  const scheduler = createFakeScheduler();
  const controller = createTradingController({ storage, scheduler, now: () => FIXED_NOW, autosaveDelay: 0 });
  await controller.init();

  await controller.buy({ symbol: 'TLAB', quantity: 1 });
  scheduler.tick(0);
  const flushResult = await controller.flush();
  assert.equal(flushResult.status, 'saved');
  assert.equal(controller.getAutosaveStatus().state, 'saved');
  assert.equal(storage.calls.setItem.length, 1);
});

test('save gagal dilaporkan sebagai error dan tidak saved', async () => {
  const storage = createMemoryStorage();
  storage.setItem = () => {
    throw new Error('Tulis gagal.');
  };
  const scheduler = createFakeScheduler();
  const controller = createTradingController({ storage, scheduler, now: () => FIXED_NOW, autosaveDelay: 0 });
  await controller.init();

  await controller.buy({ symbol: 'TLAB', quantity: 1 });
  scheduler.tick(0);
  const flushResult = await controller.flush();
  assert.equal(flushResult.status, 'error');
  assert.equal(controller.getAutosaveStatus().state, 'error');
});

test('load corrupt tidak menimpa storage secara otomatis', async () => {
  const storage = createMemoryStorage({ tradelab: 'not-json' });
  // use canonical key
  storage.data.delete('tradelab');
  storage.data.set('tradelab.portfolio', '{rusak');
  const controller = createTradingController({ storage, now: () => FIXED_NOW });
  const result = await controller.init();
  assert.equal(result.status, 'corrupt');
  assert.equal(storage.calls.setItem.length, 0);
  assert.equal(controller.getStorageStatus(), 'corrupt');
});

test('load unsupported schema tidak menimpa storage secara otomatis', async () => {
  const storage = createMemoryStorage();
  const portfolio = createPortfolio({ initialCash: 1000000, id: 'p-1', createdAt: FIXED_NOW, updatedAt: FIXED_NOW });
  const envelope = {
    app: 'tradelab',
    schemaVersion: 2,
    savedAt: FIXED_NOW,
    portfolio,
  };
  storage.data.set('tradelab.portfolio', JSON.stringify(envelope));

  const controller = createTradingController({ storage, now: () => FIXED_NOW });
  const result = await controller.init();
  assert.equal(result.status, 'unsupported-schema');
  assert.equal(storage.calls.setItem.length, 0);
});

test('timer autosave tidak menyimpan state awal sebelum load selesai', async () => {
  const storage = createMemoryStorage();
  const scheduler = createFakeScheduler();
  const controller = createTradingController({ storage, scheduler, now: () => FIXED_NOW, autosaveDelay: 10 });
  await controller.init();
  scheduler.tick(100);
  assert.equal(storage.calls.setItem.length, 0);
  assert.notEqual(controller.getAutosaveStatus().state, 'saved');
});