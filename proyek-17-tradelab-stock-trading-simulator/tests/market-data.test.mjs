import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getStockCatalog,
  getStocks,
  getStockBySymbol,
  getStock,
  getStockHistory,
  getPriceHistory,
  getStockSectors,
} from '../js/market-data.js';

test('katalog berisi 12 saham dengan simbol unik dan field wajib', () => {
  const stocks = getStockCatalog();

  assert.equal(stocks.length, 12);
  const symbols = new Set(stocks.map((stock) => stock.symbol));
  assert.equal(symbols.size, 12);

  for (const stock of stocks) {
    assert.equal(typeof stock.symbol, 'string');
    assert.equal(typeof stock.name, 'string');
    assert.equal(typeof stock.sector, 'string');
    assert.equal(typeof stock.basePrice, 'number');
    assert.equal(typeof stock.price, 'number');
    assert.equal(typeof stock.changePercent, 'number');
    assert.ok(Array.isArray(stock.series));
    assert.equal(stock.series.length, 30);
  }
});

test('harga dan histori selalu berupa integer rupiah positif', () => {
  for (const stock of getStockCatalog()) {
    assert.ok(Number.isInteger(stock.price));
    assert.ok(stock.price > 0);
    assert.ok(Number.isInteger(stock.basePrice));
    assert.ok(stock.basePrice > 0);

    for (const item of stock.series) {
      assert.ok(Number.isInteger(item.open));
      assert.ok(Number.isInteger(item.high));
      assert.ok(Number.isInteger(item.low));
      assert.ok(Number.isInteger(item.close));
      assert.ok(item.open > 0);
      assert.ok(item.high > 0);
      assert.ok(item.low > 0);
      assert.ok(item.close > 0);
      assert.ok(item.high >= item.low);
    }
  }
});

test('histori setiap saham berisi 30 titik dalam urutan konsisten', () => {
  for (const stock of getStockCatalog()) {
    assert.equal(stock.series.length, 30);

    for (let i = 1; i < stock.series.length; i += 1) {
      const previous = new Date(stock.series[i - 1].date);
      const current = new Date(stock.series[i].date);
      assert.ok(current > previous);
    }
  }
});

test('generator deterministik untuk simbol yang sama', () => {
  const first = getStockBySymbol('TLAB');
  const second = getStockBySymbol('TLAB');

  assert.deepEqual(first, second);
  assert.deepEqual(getStockHistory('TLAB'), getPriceHistory('TLAB'));
});

test('simbol tidak dikenal ditangani dengan aman', () => {
  assert.equal(getStockBySymbol('TIDAKADA'), null);
  assert.equal(getStock('TIDAKADA'), null);
  assert.deepEqual(getStockHistory('TIDAKADA'), []);
  assert.deepEqual(getPriceHistory('TIDAKADA'), []);
});

test('data yang dikembalikan tidak merusak katalog internal', () => {
  const stock = getStockBySymbol('BKPI');
  stock.price = 1;
  stock.series[0].close = 1;
  stock.series.push({ date: '2026-01-01', open: 1, high: 1, low: 1, close: 1 });

  const fresh = getStockBySymbol('BKPI');
  assert.notEqual(fresh.price, 1);
  assert.equal(fresh.series.length, 30);
  assert.equal(fresh.series[0].close !== 1, true);
});

test('alias API mengembalikan data yang sama', () => {
  assert.deepEqual(getStocks(), getStockCatalog());
  assert.deepEqual(getStock('TLAB'), getStockBySymbol('TLAB'));
  assert.deepEqual(getPriceHistory('TLAB'), getStockHistory('TLAB'));
});

test('sektor tersedia dan unik', () => {
  const sectors = getStockSectors();
  assert.ok(sectors.length > 0);
  assert.equal(new Set(sectors).size, sectors.length);
});