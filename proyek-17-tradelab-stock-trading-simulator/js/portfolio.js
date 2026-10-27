import { validateBuy, validateSell } from './trade-model.js';

function createId() {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }
  if (typeof cryptoApi?.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    cryptoApi.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  }
  throw new Error('Web Crypto API tidak tersedia untuk membuat ID aman.');
}
import { getStockBySymbol } from './market-data.js';

const PORTFOLIO_SCHEMA_VERSION = 1;
const MAX_TRANSACTIONS = 500;
const MAX_POSITIONS = 200;
const DEFAULT_INITIAL_CASH = 10000000;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/;

const PORTFOLIO_KEYS = Object.freeze([
  'app',
  'schemaVersion',
  'id',
  'initialCash',
  'cash',
  'realizedProfitLoss',
  'positions',
  'transactions',
  'createdAt',
  'updatedAt',
]);

const POSITION_KEYS = Object.freeze(['symbol', 'quantity', 'averageCost']);
const TRANSACTION_KEYS = Object.freeze(['id', 'type', 'symbol', 'quantity', 'price', 'total', 'timestamp']);

function clone(value) {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateId(value, fieldName, errors) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(value)) {
    errors.push(`${fieldName} harus berupa ID aman.`);
  }
}

function validateTimestamp(value, fieldName, errors) {
  if (typeof value !== 'string' || !ISO_DATE_PATTERN.test(value) || Number.isNaN(Date.parse(value))) {
    errors.push(`${fieldName} harus berupa timestamp ISO 8601 UTC.`);
  }
}

function unknownKeys(object, allowedKeys, objectName, errors) {
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(object)) {
    if (!allowed.has(key)) {
      errors.push(`${objectName} memiliki field asing: ${key}.`);
    }
  }
}

function validatePosition(position, errors, symbols, index) {
  if (!isPlainObject(position)) {
    errors.push(`Posisi pada indeks ${index} harus berupa objek.`);
    return;
  }
  unknownKeys(position, POSITION_KEYS, `Posisi ${index}`, errors);
  for (const key of POSITION_KEYS) {
    if (!(key in position)) {
      errors.push(`Posisi ${index} kehilangan field wajib: ${key}.`);
    }
  }

  if (typeof position.symbol !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,15}$/.test(position.symbol)) {
    errors.push(`Posisi ${index}.symbol tidak valid.`);
  } else {
    const normalized = position.symbol.toUpperCase();
    if (symbols.has(normalized)) {
      errors.push(`Simbol posisi duplikat: ${normalized}.`);
    }
    symbols.add(normalized);
  }

  if (!Number.isSafeInteger(position.quantity) || position.quantity <= 0) {
    errors.push(`Posisi ${index}.quantity harus berupa integer positif.`);
  }
  if (!Number.isSafeInteger(position.averageCost) || position.averageCost <= 0) {
    errors.push(`Posisi ${index}.averageCost harus berupa integer rupiah positif.`);
  }
}

function validateTransaction(transaction, errors, ids, index) {
  if (!isPlainObject(transaction)) {
    errors.push(`Transaksi pada indeks ${index} harus berupa objek.`);
    return;
  }
  unknownKeys(transaction, TRANSACTION_KEYS, `Transaksi ${index}`, errors);
  for (const key of TRANSACTION_KEYS) {
    if (!(key in transaction)) {
      errors.push(`Transaksi ${index} kehilangan field wajib: ${key}.`);
    }
  }

  validateId(transaction.id, `Transaksi ${index}.id`, errors);
  if (typeof transaction.id === 'string' && ids.has(transaction.id)) {
    errors.push(`ID transaksi duplikat: ${transaction.id}.`);
  }
  if (typeof transaction.id === 'string') {
    ids.add(transaction.id);
  }

  if (transaction.type !== 'buy' && transaction.type !== 'sell') {
    errors.push(`Transaksi ${index}.type harus "buy" atau "sell".`);
  }
  if (typeof transaction.symbol !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,15}$/.test(transaction.symbol)) {
    errors.push(`Transaksi ${index}.symbol tidak valid.`);
  }
  if (!Number.isSafeInteger(transaction.quantity) || transaction.quantity <= 0) {
    errors.push(`Transaksi ${index}.quantity harus berupa integer positif.`);
  }
  if (!Number.isSafeInteger(transaction.price) || transaction.price <= 0) {
    errors.push(`Transaksi ${index}.price harus berupa integer rupiah positif.`);
  }
  if (!Number.isSafeInteger(transaction.total) || transaction.total <= 0) {
    errors.push(`Transaksi ${index}.total harus berupa integer rupiah positif.`);
  }
  if (Number.isSafeInteger(transaction.price) && Number.isSafeInteger(transaction.quantity)) {
    if (transaction.total !== transaction.price * transaction.quantity) {
      errors.push(`Transaksi ${index}.total tidak cocok dengan price x quantity.`);
    }
  }
  validateTimestamp(transaction.timestamp, `Transaksi ${index}.timestamp`, errors);
}

export function validatePortfolio(portfolio) {
  const errors = [];

  if (!isPlainObject(portfolio)) {
    return { valid: false, errors: ['Portofolio harus berupa objek.'] };
  }

  unknownKeys(portfolio, PORTFOLIO_KEYS, 'Portofolio', errors);
  for (const key of PORTFOLIO_KEYS) {
    if (!(key in portfolio)) {
      errors.push(`Portofolio kehilangan field wajib: ${key}.`);
    }
  }

  if (portfolio.app !== 'tradelab') {
    errors.push('Portofolio.app harus "tradelab".');
  }
  if (portfolio.schemaVersion !== 1) {
    errors.push('Portofolio.schemaVersion harus 1.');
  }

  validateId(portfolio.id, 'Portofolio.id', errors);

  if (!Number.isSafeInteger(portfolio.initialCash) || portfolio.initialCash < 0) {
    errors.push('Portofolio.initialCash harus berupa integer rupiah non-negatif.');
  }
  if (!Number.isSafeInteger(portfolio.cash) || portfolio.cash < 0) {
    errors.push('Portofolio.cash harus berupa integer rupiah non-negatif.');
  }
  if (!Number.isSafeInteger(portfolio.realizedProfitLoss)) {
    errors.push('Portofolio.realizedProfitLoss harus berupa integer rupiah.');
  }

  validateTimestamp(portfolio.createdAt, 'Portofolio.createdAt', errors);
  validateTimestamp(portfolio.updatedAt, 'Portofolio.updatedAt', errors);

  if (!Array.isArray(portfolio.positions)) {
    errors.push('Portofolio.positions harus berupa larik.');
  } else {
    if (portfolio.positions.length > MAX_POSITIONS) {
      errors.push(`Jumlah posisi melebihi batas ${MAX_POSITIONS}.`);
    }
    const symbols = new Set();
    portfolio.positions.forEach((position, index) => validatePosition(position, errors, symbols, index));
  }

  if (!Array.isArray(portfolio.transactions)) {
    errors.push('Portofolio.transactions harus berupa larik.');
  } else {
    if (portfolio.transactions.length > MAX_TRANSACTIONS) {
      errors.push(`Jumlah transaksi melebihi batas ${MAX_TRANSACTIONS}.`);
    }
    const ids = new Set();
    portfolio.transactions.forEach((transaction, index) => validateTransaction(transaction, errors, ids, index));
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function assertValidPortfolio(portfolio) {
  const result = validatePortfolio(portfolio);
  if (!result.valid) {
    throw new Error(result.errors.join(' '));
  }
  return portfolio;
}

export function createPortfolio(options = {}) {
  if (!isPlainObject(options)) {
    throw new Error('Opsi portofolio harus berupa objek.');
  }

  const initialCash = options.initialCash === undefined ? DEFAULT_INITIAL_CASH : options.initialCash;
  if (!Number.isSafeInteger(initialCash) || initialCash < 0) {
    throw new Error('Saldo awal harus berupa integer rupiah non-negatif.');
  }

  const now = new Date().toISOString();
  const portfolio = {
    app: 'tradelab',
    schemaVersion: 1,
    id: options.id ?? createId(),
    initialCash,
    cash: options.cash === undefined ? initialCash : options.cash,
    realizedProfitLoss: options.realizedProfitLoss === undefined ? 0 : options.realizedProfitLoss,
    positions: clone(options.positions ?? []),
    transactions: clone(options.transactions ?? []),
    createdAt: options.createdAt ?? now,
    updatedAt: options.updatedAt ?? now,
  };

  assertValidPortfolio(portfolio);
  return portfolio;
}

function resolvePrice(marketPrice) {
  if (typeof marketPrice === 'number' && Number.isSafeInteger(marketPrice) && marketPrice > 0) {
    return marketPrice;
  }
  if (marketPrice && typeof marketPrice === 'object') {
    if (Number.isSafeInteger(marketPrice.price) && marketPrice.price > 0) {
      return marketPrice.price;
    }
    if (Number.isSafeInteger(marketPrice.close) && marketPrice.close > 0) {
      return marketPrice.close;
    }
  }
  return null;
}

function resolveMarketPrices(marketPrices) {
  if (marketPrices instanceof Map) {
    return marketPrices;
  }
  if (Array.isArray(marketPrices)) {
    const map = new Map();
    for (const item of marketPrices) {
      if (item && typeof item.symbol === 'string') {
        const price = resolvePrice(item);
        if (price !== null) {
          map.set(item.symbol.toUpperCase(), price);
        }
      }
    }
    return map;
  }
  if (isPlainObject(marketPrices)) {
    const map = new Map();
    for (const [symbol, price] of Object.entries(marketPrices)) {
      const resolved = resolvePrice(price);
      if (resolved !== null) {
        map.set(symbol.toUpperCase(), resolved);
      }
    }
    return map;
  }
  return new Map();
}

function failure(portfolio, error) {
  return {
    ok: false,
    portfolio: clone(portfolio),
    transaction: null,
    error,
  };
}

function success(portfolio, transaction) {
  const result = clone(portfolio);
  Object.defineProperty(result, 'ok', { value: true, enumerable: false });
  Object.defineProperty(result, 'transaction', { value: clone(transaction), enumerable: false });
  Object.defineProperty(result, 'error', { value: null, enumerable: false });
  Object.defineProperty(result, 'portfolio', { value: result, enumerable: false });
  return result;
}

function failureResult(portfolio, error) {
  const result = {
    ok: false,
    portfolio: clone(portfolio),
    transaction: null,
    error,
  };
  return result;
}

export function buy(portfolio, input = {}) {
  const validPortfolio = assertValidPortfolio(clone(portfolio));
  if (!isPlainObject(input)) {
    return failureResult(validPortfolio, 'Input beli harus berupa objek.');
  }

  const symbol = typeof input.symbol === 'string' ? input.symbol.trim().toUpperCase() : input.symbol;
  const quantity = input.quantity;
  const price = input.price === undefined ? getStockBySymbol(symbol)?.price : input.price;
  const id = input.id === undefined ? createId() : input.id;
  const timestamp = input.timestamp === undefined ? new Date().toISOString() : input.timestamp;

  if (typeof id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(id)) {
    return failureResult(validPortfolio, 'ID transaksi tidak valid.');
  }
  if (typeof timestamp !== 'string' || Number.isNaN(Date.parse(timestamp))) {
    return failureResult(validPortfolio, 'Timestamp transaksi tidak valid.');
  }

  const validation = validateBuy({ symbol, quantity, price, cash: validPortfolio.cash });
  if (!validation.valid) {
    return failureResult(validPortfolio, validation.errors.join(' '));
  }

  const total = validation.total;
  if (!Number.isSafeInteger(validPortfolio.cash - total)) {
    return failureResult(validPortfolio, 'Saldo hasil beli tidak valid.');
  }

  const next = clone(validPortfolio);
  const positionIndex = next.positions.findIndex((item) => item.symbol === symbol);
  let transaction;

  if (positionIndex === -1) {
    next.positions.push({
      symbol,
      quantity,
      averageCost: price,
    });
  } else {
    const position = next.positions[positionIndex];
    const newQuantity = position.quantity + quantity;
    if (!Number.isSafeInteger(newQuantity)) {
      return failureResult(validPortfolio, 'Jumlah posisi melebihi batas safe integer.');
    }
    const weightedCost = position.quantity * position.averageCost + quantity * price;
    if (!Number.isSafeInteger(weightedCost)) {
      return failureResult(validPortfolio, 'Biaya rata-rata melebihi batas safe integer.');
    }
    position.quantity = newQuantity;
    position.averageCost = Math.round(weightedCost / newQuantity);
  }

  next.cash -= total;
  next.updatedAt = timestamp;

  transaction = {
    id,
    type: 'buy',
    symbol,
    quantity,
    price,
    total,
    timestamp,
  };

  next.transactions = [transaction, ...next.transactions].slice(0, MAX_TRANSACTIONS);
  assertValidPortfolio(next);

  return success(next, transaction);
}

export function sell(portfolio, input = {}) {
  const validPortfolio = assertValidPortfolio(clone(portfolio));
  if (!isPlainObject(input)) {
    return failureResult(validPortfolio, 'Input jual harus berupa objek.');
  }

  const symbol = typeof input.symbol === 'string' ? input.symbol.trim().toUpperCase() : input.symbol;
  const quantity = input.quantity;
  const price = input.price === undefined ? getStockBySymbol(symbol)?.price : input.price;
  const id = input.id === undefined ? createId() : input.id;
  const timestamp = input.timestamp === undefined ? new Date().toISOString() : input.timestamp;

  if (typeof id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(id)) {
    return failureResult(validPortfolio, 'ID transaksi tidak valid.');
  }
  if (typeof timestamp !== 'string' || Number.isNaN(Date.parse(timestamp))) {
    return failureResult(validPortfolio, 'Timestamp transaksi tidak valid.');
  }

  const ownedQuantity = validPortfolio.positions.find((position) => position.symbol === symbol)?.quantity ?? 0;
  const validation = validateSell({ symbol, quantity, price, ownedQuantity });
  if (!validation.valid) {
    return failureResult(validPortfolio, validation.errors.join(' '));
  }

  const total = validation.total;
  const position = validPortfolio.positions.find((item) => item.symbol === symbol);
  const realized = (price - position.averageCost) * quantity;
  if (!Number.isSafeInteger(realized)) {
    return failureResult(validPortfolio, 'Laba/rugi realisasi melebihi batas safe integer.');
  }
  const newCash = validPortfolio.cash + total;
  if (!Number.isSafeInteger(newCash)) {
    return failureResult(validPortfolio, 'Saldo hasil jual melebihi batas safe integer.');
  }
  const newRealizedProfitLoss = validPortfolio.realizedProfitLoss + realized;
  if (!Number.isSafeInteger(newRealizedProfitLoss)) {
    return failureResult(validPortfolio, 'Laba/rugi kumulatif melebihi batas safe integer.');
  }

  const next = clone(validPortfolio);
  const nextPosition = next.positions.find((item) => item.symbol === symbol);
  nextPosition.quantity -= quantity;
  if (nextPosition.quantity === 0) {
    next.positions = next.positions.filter((item) => item.symbol !== symbol);
  }

  next.cash = newCash;
  next.realizedProfitLoss = newRealizedProfitLoss;
  next.updatedAt = timestamp;

  const transaction = {
    id,
    type: 'sell',
    symbol,
    quantity,
    price,
    total,
    timestamp,
  };

  next.transactions = [transaction, ...next.transactions].slice(0, MAX_TRANSACTIONS);
  assertValidPortfolio(next);

  return success(next, transaction);
}

export function getPortfolioSummary(portfolio, marketPrices = {}) {
  const validPortfolio = assertValidPortfolio(clone(portfolio));
  const prices = resolveMarketPrices(marketPrices);

  const positions = validPortfolio.positions.map((position) => {
    const marketPrice = prices.get(position.symbol) ?? null;
    const hasMarketPrice = marketPrice !== null;
    const marketValue = hasMarketPrice ? position.quantity * marketPrice : 0;
    const unrealizedProfitLoss = hasMarketPrice
      ? (marketPrice - position.averageCost) * position.quantity
      : null;

    if (hasMarketPrice && !Number.isSafeInteger(marketValue)) {
      throw new Error('Nilai pasar melebihi batas safe integer.');
    }
    if (hasMarketPrice && !Number.isSafeInteger(unrealizedProfitLoss)) {
      throw new Error('Laba/rugi tidak realisasi melebihi batas safe integer.');
    }

    return {
      symbol: position.symbol,
      quantity: position.quantity,
      averageCost: position.averageCost,
      marketPrice,
      marketValue,
      unrealizedProfitLoss,
    };
  });

  const marketValue = positions.reduce((sum, position) => sum + position.marketValue, 0);
  if (!Number.isSafeInteger(marketValue)) {
    throw new Error('Total nilai pasar melebihi batas safe integer.');
  }
  const totalEquity = validPortfolio.cash + marketValue;
  if (!Number.isSafeInteger(totalEquity)) {
    throw new Error('Total ekuitas melebihi batas safe integer.');
  }
  const unrealizedProfitLoss = positions.reduce((sum, position) => {
    return position.unrealizedProfitLoss === null ? sum : sum + position.unrealizedProfitLoss;
  }, 0);
  if (!Number.isSafeInteger(unrealizedProfitLoss)) {
    throw new Error('Total laba/rugi tidak realisasi melebihi batas safe integer.');
  }

  return {
    cash: validPortfolio.cash,
    marketValue,
    totalEquity,
    realizedProfitLoss: validPortfolio.realizedProfitLoss,
    unrealizedProfitLoss,
    positions,
    missingMarketPrices: validPortfolio.positions
      .map((position) => position.symbol)
      .filter((symbol) => !prices.has(symbol)),
  };
}

export function resetPortfolio(portfolio) {
  const validPortfolio = assertValidPortfolio(clone(portfolio));
  return createPortfolio({
    initialCash: validPortfolio.initialCash,
  });
}

export {
  createPortfolio as createInitialPortfolio,
  buy as buyStock,
  buy as executeBuy,
  buy as applyBuy,
  sell as sellStock,
  sell as executeSell,
  sell as applySell,
  getPortfolioSummary as getSummary,
  getPortfolioSummary as calculateSummary,
  getPortfolioSummary as portfolioSummary,
  resetPortfolio as reset,
  resetPortfolio as resetPortfolioState,
};

// Alias tambahan agar modul berikutnya dapat memilih nama yang natural.
export const buyPortfolio = buy;
export const sellPortfolio = sell;
