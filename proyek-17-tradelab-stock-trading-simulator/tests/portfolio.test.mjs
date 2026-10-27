import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createPortfolio,
  buy,
  sell,
  getPortfolioSummary,
  resetPortfolio,
  validatePortfolio,
} from '../js/portfolio.js';

test('createPortfolio membuat portofolio awal dengan saldo default', () => {
  const portfolio = createPortfolio();

  assert.equal(portfolio.app, 'tradelab');
  assert.equal(portfolio.schemaVersion, 1);
  assert.equal(portfolio.initialCash, 10000000);
  assert.equal(portfolio.cash, 10000000);
  assert.equal(portfolio.realizedProfitLoss, 0);
  assert.deepEqual(portfolio.positions, []);
  assert.deepEqual(portfolio.transactions, []);
  assert.equal(validatePortfolio(portfolio).valid, true);
});

test('buy pertama membuat posisi baru', () => {
  const portfolio = createPortfolio({ initialCash: 500000 });
  const result = buy(portfolio, {
    symbol: 'TLAB',
    quantity: 10,
    price: 12000,
    id: 'buy-1',
    timestamp: '2026-10-26T10:00:00.000Z',
  });

  assert.equal(result.ok, true);
  assert.equal(result.transaction.type, 'buy');
  assert.equal(result.transaction.total, 120000);
  assert.equal(result.portfolio.cash, 380000);
  assert.equal(result.portfolio.positions.length, 1);
  assert.equal(result.portfolio.positions[0].symbol, 'TLAB');
  assert.equal(result.portfolio.positions[0].quantity, 10);
  assert.equal(result.portfolio.positions[0].averageCost, 12000);
  assert.equal(portfolio.cash, 500000);
  assert.equal(portfolio.positions.length, 0);
});

test('buy tambahan menghitung weighted average cost', () => {
  const portfolio = createPortfolio({ initialCash: 1000000 });
  const first = buy(portfolio, { symbol: 'TLAB', quantity: 10, price: 10000, id: 'buy-1', timestamp: '2026-10-26T10:00:00.000Z' });
  const second = buy(first.portfolio, { symbol: 'TLAB', quantity: 5, price: 13000, id: 'buy-2', timestamp: '2026-10-26T10:01:00.000Z' });

  assert.equal(second.ok, true);
  assert.equal(second.portfolio.positions[0].quantity, 15);
  assert.equal(second.portfolio.positions[0].averageCost, 11000);
  assert.equal(second.portfolio.cash, 1000000 - 100000 - 65000);
});

test('sell sebagian mempertahankan harga rata-rata dan menambah saldo', () => {
  const portfolio = createPortfolio({ initialCash: 1000000 });
  const bought = buy(portfolio, { symbol: 'TLAB', quantity: 10, price: 10000, id: 'buy-1', timestamp: '2026-10-26T10:00:00.000Z' });
  const sold = sell(bought.portfolio, { symbol: 'TLAB', quantity: 4, price: 12000, id: 'sell-1', timestamp: '2026-10-26T10:02:00.000Z' });

  assert.equal(sold.ok, true);
  assert.equal(sold.portfolio.positions[0].quantity, 6);
  assert.equal(sold.portfolio.positions[0].averageCost, 10000);
  assert.equal(sold.portfolio.cash, 1000000 - 100000 + 48000);
  assert.equal(sold.portfolio.realizedProfitLoss, 8000);
  assert.equal(sold.transaction.type, 'sell');
  assert.equal(sold.transaction.total, 48000);
});

test('sell seluruh posisi menghapus posisi', () => {
  const portfolio = createPortfolio({ initialCash: 1000000 });
  const bought = buy(portfolio, { symbol: 'TLAB', quantity: 3, price: 10000, id: 'buy-1', timestamp: '2026-10-26T10:00:00.000Z' });
  const sold = sell(bought.portfolio, { symbol: 'TLAB', quantity: 3, price: 9000, id: 'sell-1', timestamp: '2026-10-26T10:02:00.000Z' });

  assert.equal(sold.ok, true);
  assert.equal(sold.portfolio.positions.length, 0);
  assert.equal(sold.portfolio.realizedProfitLoss, -3000);
});

test('realized P/L negatif dihitung dengan benar', () => {
  const portfolio = createPortfolio({ initialCash: 1000000 });
  const bought = buy(portfolio, { symbol: 'TLAB', quantity: 5, price: 10000, id: 'buy-1', timestamp: '2026-10-26T10:00:00.000Z' });
  const sold = sell(bought.portfolio, { symbol: 'TLAB', quantity: 2, price: 9000, id: 'sell-1', timestamp: '2026-10-26T10:02:00.000Z' });

  assert.equal(sold.portfolio.realizedProfitLoss, -2000);
});

test('getPortfolioSummary menghitung market value, equity, dan unrealized P/L', () => {
  const portfolio = createPortfolio({ initialCash: 1000000 });
  const bought = buy(portfolio, { symbol: 'TLAB', quantity: 10, price: 10000, id: 'buy-1', timestamp: '2026-10-26T10:00:00.000Z' });
  const summary = getPortfolioSummary(bought.portfolio, { TLAB: 12000 });

  assert.equal(summary.cash, 900000);
  assert.equal(summary.marketValue, 120000);
  assert.equal(summary.totalEquity, 1020000);
  assert.equal(summary.unrealizedProfitLoss, 20000);
  assert.deepEqual(summary.missingMarketPrices, []);
  assert.equal(summary.positions[0].marketPrice, 12000);
  assert.equal(summary.positions[0].marketValue, 120000);
});

test('getPortfolioSummary menangani harga pasar yang hilang', () => {
  const portfolio = createPortfolio({ initialCash: 1000000 });
  const bought = buy(portfolio, { symbol: 'TLAB', quantity: 10, price: 10000, id: 'buy-1', timestamp: '2026-10-26T10:00:00.000Z' });
  const summary = getPortfolioSummary(bought.portfolio, {});

  assert.equal(summary.marketValue, 0);
  assert.equal(summary.totalEquity, 900000);
  assert.equal(summary.positions[0].marketPrice, null);
  assert.equal(summary.positions[0].unrealizedProfitLoss, null);
  assert.deepEqual(summary.missingMarketPrices, ['TLAB']);
});

test('buy menolak saldo tidak cukup', () => {
  const portfolio = createPortfolio({ initialCash: 10000 });
  const result = buy(portfolio, { symbol: 'TLAB', quantity: 1, price: 12000, id: 'buy-1', timestamp: '2026-10-26T10:00:00.000Z' });

  assert.equal(result.ok, false);
  assert.match(result.error, /Saldo tidak cukup/);
  assert.equal(result.portfolio.cash, 10000);
  assert.equal(result.portfolio.positions.length, 0);
  assert.equal(result.portfolio.transactions.length, 0);
});

test('sell menolak oversell', () => {
  const portfolio = createPortfolio({ initialCash: 1000000 });
  const bought = buy(portfolio, { symbol: 'TLAB', quantity: 3, price: 10000, id: 'buy-1', timestamp: '2026-10-26T10:00:00.000Z' });
  const result = sell(bought.portfolio, { symbol: 'TLAB', quantity: 4, price: 11000, id: 'sell-1', timestamp: '2026-10-26T10:02:00.000Z' });

  assert.equal(result.ok, false);
  assert.match(result.error, /melebihi kepemilikan/);
  assert.equal(result.portfolio.positions[0].quantity, 3);
  assert.equal(result.portfolio.cash, 970000);
});

test('operasi gagal tidak memutasi portofolio sumber', () => {
  const portfolio = createPortfolio({ initialCash: 10000 });
  const before = JSON.stringify(portfolio);

  buy(portfolio, { symbol: 'TLAB', quantity: 1, price: 12000, id: 'buy-1', timestamp: '2026-10-26T10:00:00.000Z' });
  sell(portfolio, { symbol: 'TLAB', quantity: 1, price: 12000, id: 'sell-1', timestamp: '2026-10-26T10:02:00.000Z' });

  assert.equal(JSON.stringify(portfolio), before);
});

test('resetPortfolio mengembalikan saldo awal dan mengosongkan data', () => {
  const portfolio = createPortfolio({ initialCash: 500000 });
  const bought = buy(portfolio, { symbol: 'TLAB', quantity: 2, price: 10000, id: 'buy-1', timestamp: '2026-10-26T10:00:00.000Z' });
  const reset = resetPortfolio(bought.portfolio);

  assert.equal(reset.initialCash, 500000);
  assert.equal(reset.cash, 500000);
  assert.equal(reset.realizedProfitLoss, 0);
  assert.deepEqual(reset.positions, []);
  assert.deepEqual(reset.transactions, []);
  assert.notEqual(reset.id, bought.portfolio.id);
  assert.equal(portfolio.cash, 500000);
  assert.equal(bought.portfolio.positions.length, 1);
});

test('riwayat dibatasi 500 transaksi terbaru', () => {
  let portfolio = createPortfolio({ initialCash: 1000000000 });
  for (let i = 0; i < 501; i += 1) {
    const result = buy(portfolio, {
      symbol: 'TLAB',
      quantity: 1,
      price: 10000,
      id: `buy-${i}`,
      timestamp: '2026-10-26T10:00:00.000Z',
    });
    assert.equal(result.ok, true);
    portfolio = result.portfolio;
  }

  assert.equal(portfolio.transactions.length, 500);
  assert.equal(portfolio.transactions[0].id, 'buy-500');
  assert.equal(portfolio.transactions[499].id, 'buy-1');
});

test('operasi gagal tidak menghasilkan transaksi seolah-olah berhasil', () => {
  const portfolio = createPortfolio({ initialCash: 1000 });
  const result = buy(portfolio, {
    symbol: 'TLAB',
    quantity: 1,
    price: 10000,
    id: 'buy-1',
    timestamp: '2026-10-26T10:00:00.000Z',
  });

  assert.equal(result.ok, false);
  assert.equal(result.transaction, null);
  assert.equal(result.portfolio.transactions.length, 0);
});

test('buy menolak input invalid', () => {
  const portfolio = createPortfolio({ initialCash: 1000000 });
  const result = buy(portfolio, {
    symbol: 'TLAB',
    quantity: '10',
    price: 10000,
    cash: 1000000,
  });

  assert.equal(result.ok, false);
  assert.match(result.error, /bilangan bulat positif/);
});

test('sell menolak input invalid', () => {
  const portfolio = createPortfolio({ initialCash: 1000000 });
  const bought = buy(portfolio, { symbol: 'TLAB', quantity: 2, price: 10000, id: 'buy-1', timestamp: '2026-10-26T10:00:00.000Z' });
  const result = sell(bought.portfolio, {
    symbol: 'TLAB',
    quantity: 1,
    price: '10000',
    ownedQuantity: 2,
  });

  assert.equal(result.ok, false);
  assert.match(result.error, /integer rupiah positif/);
});

test('validatePortfolio menolak field asing dan ID duplikat', () => {
  const portfolio = createPortfolio({ initialCash: 1000000 });
  const withTransaction = buy(portfolio, { symbol: 'TLAB', quantity: 1, price: 10000, id: 'dup', timestamp: '2026-10-26T10:00:00.000Z' }).portfolio;
  const invalid = {
    ...withTransaction,
    extra: true,
    transactions: [
      withTransaction.transactions[0],
      { ...withTransaction.transactions[0], id: 'dup' },
    ],
  };

  const result = validatePortfolio(invalid);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /field asing/);
  assert.match(result.errors.join(' '), /ID transaksi duplikat/);
});