import { getStockBySymbol } from './market-data.js';

export const TRADE_TYPES = Object.freeze({
  BUY: 'buy',
  SELL: 'sell',
});

export const TRADE_LIMITS = Object.freeze({
  maxQuantity: 1000000,
  maxPrice: 100000000,
  maxCash: Number.MAX_SAFE_INTEGER,
});

const INTEGER_PATTERN = /^-?\d+$/;

function isSafeInteger(value) {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

function positiveInteger(value) {
  return isSafeInteger(value) && value > 0;
}

function nonNegativeInteger(value) {
  return isSafeInteger(value) && value >= 0;
}

function validPrice(value) {
  return isSafeInteger(value) && value > 0 && value <= TRADE_LIMITS.maxPrice;
}

function validQuantity(value) {
  return positiveInteger(value) && value <= TRADE_LIMITS.maxQuantity;
}

function cloneResult(result) {
  return {
    valid: result.valid,
    errors: [...result.errors],
    ...(result.total !== undefined ? { total: result.total } : {}),
  };
}

export function calculateTradeTotal(price, quantity) {
  if (typeof price !== 'number' || !Number.isInteger(price) || price <= 0) {
    throw new Error('Harga harus berupa integer rupiah positif.');
  }
  if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity <= 0) {
    throw new Error('Jumlah saham harus berupa bilangan bulat positif.');
  }

  const total = price * quantity;
  if (!Number.isSafeInteger(total)) {
    throw new Error('Total transaksi melebihi batas safe integer.');
  }
  if (!validPrice(price) || !validQuantity(quantity)) {
    throw new Error('Harga atau jumlah melebihi batas yang diizinkan.');
  }
  return total;
}

export function validateBuy(input = {}) {
  const errors = [];
  const symbol = typeof input?.symbol === 'string' ? input.symbol.trim().toUpperCase() : '';
  const quantity = input?.quantity;
  const price = input?.price;
  const cash = input?.cash;

  if (!symbol) {
    errors.push('Simbol saham wajib diisi.');
  } else if (!getStockBySymbol(symbol)) {
    errors.push(`Simbol saham tidak dikenal: ${symbol}.`);
  }

  if (!validQuantity(quantity)) {
    errors.push('Jumlah beli harus berupa bilangan bulat positif.');
  }
  if (!validPrice(price)) {
    errors.push('Harga beli harus berupa integer rupiah positif.');
  }
  if (!nonNegativeInteger(cash)) {
    errors.push('Saldo harus berupa integer rupiah non-negatif.');
  }

  let total = 0;
  if (errors.length === 0) {
    try {
      total = calculateTradeTotal(price, quantity);
    } catch (error) {
      errors.push(error.message);
    }
  }

  if (errors.length === 0 && cash < total) {
    errors.push('Saldo tidak cukup untuk transaksi beli.');
  }

  return cloneResult({
    valid: errors.length === 0,
    errors,
    total,
  });
}

export function validateSell(input = {}) {
  const errors = [];
  const symbol = typeof input?.symbol === 'string' ? input.symbol.trim().toUpperCase() : '';
  const quantity = input?.quantity;
  const price = input?.price;
  const ownedQuantity = input?.ownedQuantity;

  if (!symbol) {
    errors.push('Simbol saham wajib diisi.');
  } else if (!getStockBySymbol(symbol)) {
    errors.push(`Simbol saham tidak dikenal: ${symbol}.`);
  }

  if (!validQuantity(quantity)) {
    errors.push('Jumlah jual harus berupa bilangan bulat positif.');
  }
  if (!validPrice(price)) {
    errors.push('Harga jual harus berupa integer rupiah positif.');
  }
  if (!nonNegativeInteger(ownedQuantity)) {
    errors.push('Kepemilikan harus berupa integer rupiah non-negatif.');
  }

  let total = 0;
  if (errors.length === 0) {
    try {
      total = calculateTradeTotal(price, quantity);
    } catch (error) {
      errors.push(error.message);
    }
  }

  if (errors.length === 0 && quantity > ownedQuantity) {
    errors.push('Jumlah jual melebihi kepemilikan.');
  }

  return cloneResult({
    valid: errors.length === 0,
    errors,
    total,
  });
}

export function canBuy(input) {
  return validateBuy(input).valid;
}

export function canSell(input) {
  return validateSell(input).valid;
}

export const validateBuyOrder = validateBuy;
export const validateSellOrder = validateSell;
export const calculateTotal = calculateTradeTotal;
export const calculateTransactionTotal = calculateTradeTotal;
export const tradeTypes = TRADE_TYPES;
export const tradeLimits = TRADE_LIMITS;
