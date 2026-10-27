import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateTradeTotal,
  validateBuy,
  validateSell,
  canBuy,
  canSell,
  TRADE_LIMITS,
} from '../js/trade-model.js';

test('calculateTradeTotal menghitung total integer', () => {
  assert.equal(calculateTradeTotal(12500, 100), 1250000);
  assert.equal(calculateTradeTotal(1, 1), 1);
});

test('validateBuy menerima beli valid dan saldo tepat sama', () => {
  const result = validateBuy({
    symbol: 'TLAB',
    quantity: 100,
    price: 12500,
    cash: 1250000,
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
  assert.equal(result.total, 1250000);
  assert.equal(canBuy({ symbol: 'TLAB', quantity: 100, price: 12500, cash: 1250000 }), true);
});

test('validateBuy menolak simbol tidak dikenal', () => {
  const result = validateBuy({
    symbol: 'XXXX',
    quantity: 1,
    price: 1000,
    cash: 10000,
  });

  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /tidak dikenal/);
});

test('validateBuy menolak jumlah invalid', () => {
  for (const quantity of [0, -1, 1.5, '10', null]) {
    const result = validateBuy({
      symbol: 'TLAB',
      quantity,
      price: 1000,
      cash: 10000,
    });
    assert.equal(result.valid, false, `quantity=${quantity}`);
    assert.match(result.errors.join(' '), /bilangan bulat positif/);
  }
});

test('validateBuy menolak harga invalid', () => {
  for (const price of [0, -1, 1.5, '1000', null]) {
    const result = validateBuy({
      symbol: 'TLAB',
      quantity: 1,
      price,
      cash: 10000,
    });
    assert.equal(result.valid, false, `price=${price}`);
    assert.match(result.errors.join(' '), /integer rupiah positif/);
  }
});

test('validateBuy menolak saldo invalid atau tidak cukup', () => {
  const invalidCash = validateBuy({
    symbol: 'TLAB',
    quantity: 1,
    price: 1000,
    cash: 1.5,
  });
  assert.equal(invalidCash.valid, false);
  assert.match(invalidCash.errors.join(' '), /Saldo/);

  const insufficient = validateBuy({
    symbol: 'TLAB',
    quantity: 2,
    price: 1000,
    cash: 1500,
  });
  assert.equal(insufficient.valid, false);
  assert.match(insufficient.errors.join(' '), /Saldo tidak cukup/);
});

test('validateBuy menolak total yang melebihi safe integer', () => {
  assert.throws(
    () => calculateTradeTotal(2000000000, 10000000),
    /melebihi batas safe integer/,
  );

  const result = validateBuy({
    symbol: 'TLAB',
    quantity: 1,
    price: TRADE_LIMITS.maxPrice + 1,
    cash: Number.MAX_SAFE_INTEGER,
  });
  assert.equal(result.valid, false);
});

test('validateSell menerima jual valid dan menjual seluruh kepemilikan', () => {
  const result = validateSell({
    symbol: 'TLAB',
    quantity: 100,
    price: 13000,
    ownedQuantity: 100,
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
  assert.equal(result.total, 1300000);
  assert.equal(canSell({ symbol: 'TLAB', quantity: 100, price: 13000, ownedQuantity: 100 }), true);
});

test('validateSell menolak simbol tidak dikenal', () => {
  const result = validateSell({
    symbol: 'XXXX',
    quantity: 1,
    price: 1000,
    ownedQuantity: 10,
  });

  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /tidak dikenal/);
});

test('validateSell menolak jumlah invalid', () => {
  for (const quantity of [0, -1, 1.5, '10', null]) {
    const result = validateSell({
      symbol: 'TLAB',
      quantity,
      price: 1000,
      ownedQuantity: 10,
    });
    assert.equal(result.valid, false, `quantity=${quantity}`);
    assert.match(result.errors.join(' '), /bilangan bulat positif/);
  }
});

test('validateSell menolak harga invalid', () => {
  for (const price of [0, -1, 1.5, '1000', null]) {
    const result = validateSell({
      symbol: 'TLAB',
      quantity: 1,
      price,
      ownedQuantity: 10,
    });
    assert.equal(result.valid, false, `price=${price}`);
    assert.match(result.errors.join(' '), /integer rupiah positif/);
  }
});

test('validateSell menolak oversell dan kepemilikan invalid', () => {
  const oversell = validateSell({
    symbol: 'TLAB',
    quantity: 11,
    price: 1000,
    ownedQuantity: 10,
  });
  assert.equal(oversell.valid, false);
  assert.match(oversell.errors.join(' '), /melebihi kepemilikan/);

  const invalidOwned = validateSell({
    symbol: 'TLAB',
    quantity: 1,
    price: 1000,
    ownedQuantity: 1.5,
  });
  assert.equal(invalidOwned.valid, false);
  assert.match(invalidOwned.errors.join(' '), /Kepemilikan/);
});

test('validasi tidak mengubah input', () => {
  const input = {
    symbol: 'TLAB',
    quantity: 2,
    price: 1000,
    cash: 1500,
  };
  const before = JSON.stringify(input);

  validateBuy(input);
  validateSell({ ...input, ownedQuantity: 1 });

  assert.equal(JSON.stringify(input), before);
});