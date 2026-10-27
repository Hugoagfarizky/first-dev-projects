import { getStockCatalog, getStockBySymbol } from './market-data.js';
import {
  createPortfolio,
  buy as buyStock,
  sell as sellStock,
  getPortfolioSummary,
  resetPortfolio,
} from './portfolio.js';
import {
  createPortfolioStorage,
} from './storage.js';
import { createWatchlistStorage } from './watchlist-storage.js';
import { createAutosaveController } from './autosave.js';

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

function nowIso() {
  return new Date().toISOString();
}

export function createTradingController(options = {}) {
  if (!isPlainObject(options)) {
    throw new TypeError('Opsi trading controller harus berupa objek.');
  }

  const stocks = Array.isArray(options.stocks) ? options.stocks.map((stock) => clone(stock)) : getStockCatalog();
  const stockBySymbol = new Map(stocks.map((stock) => [String(stock.symbol).toUpperCase(), stock]));
  const initialCash = options.initialCash === undefined ? 10000000 : options.initialCash;
  const now = typeof options.now === 'function' ? options.now : nowIso;

  const storage = options.portfolioStorage ?? createPortfolioStorage(options.storage);
  const watchlistStorage = options.watchlistStorage ?? createWatchlistStorage(options.watchlistStorageInput ?? options.storage);
  const autosave = options.autosave ?? createAutosaveController({
    save: async (portfolio) => storage.save(portfolio),
    delay: options.autosaveDelay ?? 500,
    scheduler: options.scheduler,
    setTimeout: options.setTimeout,
    clearTimeout: options.clearTimeout,
    now,
    snapshot: clone,
  });

  let portfolio = null;
  let initialized = false;
  let storageStatus = 'not-loaded';
  let storageIssue = null;
  let storageResult = null;
  let watchlist = [];
  let watchlistStorageStatus = 'not-loaded';
  let watchlistStorageIssue = null;
  let watchlistStorageResult = null;
  let saveStatus = 'idle';

  function getStock(symbol) {
    return stockBySymbol.get(String(symbol ?? '').trim().toUpperCase()) ?? getStockBySymbol(symbol);
  }

  function marketPrices() {
    const prices = {};
    for (const stock of stocks) {
      prices[stock.symbol] = stock.price;
    }
    return prices;
  }

  async function init() {
    if (initialized) {
      return {
        ok: true,
        status: storageStatus,
        portfolio: clone(portfolio),
        storageResult,
      };
    }

    storageResult = storage.load();
    if (storageResult.ok && storageResult.status === 'loaded') {
      portfolio = clone(storageResult.portfolio);
      storageStatus = 'loaded';
    } else if (storageResult.status === 'empty') {
      portfolio = createPortfolio({ initialCash, id: options.id, createdAt: now(), updatedAt: now() });
      storageStatus = 'empty';
    } else {
      portfolio = createPortfolio({ initialCash, id: options.id, createdAt: now(), updatedAt: now() });
      storageStatus = storageResult.status;
      storageIssue = clone(storageResult);
    }

    watchlistStorageResult = watchlistStorage.load({ validSymbols: stocks.map((stock) => stock.symbol) });
    if (watchlistStorageResult.ok && watchlistStorageResult.status === 'loaded') {
      watchlist = [...watchlistStorageResult.symbols];
      watchlistStorageStatus = 'loaded';
    } else if (watchlistStorageResult.status === 'empty') {
      watchlist = [];
      watchlistStorageStatus = 'empty';
    } else {
      watchlist = [];
      watchlistStorageStatus = watchlistStorageResult.status;
      watchlistStorageIssue = clone(watchlistStorageResult);
    }

    initialized = true;
    return {
      ok: true,
      status: storageStatus,
      portfolio: clone(portfolio),
      storageResult: clone(storageResult),
    };
  }

  function ensureInitialized() {
    if (!initialized || !portfolio) {
      throw new Error('Trading controller belum diinisialisasi.');
    }
  }

  function getPortfolio() {
    ensureInitialized();
    return clone(portfolio);
  }

  function getSummary() {
    ensureInitialized();
    return getPortfolioSummary(portfolio, marketPrices());
  }

  function getStocks() {
    return stocks.map((stock) => clone(stock));
  }

  function getStorageStatus() {
    return storageStatus;
  }

  function getWatchlistStorageStatus() {
    return watchlistStorageStatus;
  }

  function getWatchlistStorageIssue() {
    return watchlistStorageIssue ? clone(watchlistStorageIssue) : null;
  }

  function getStorageIssue() {
    return storageIssue ? clone(storageIssue) : null;
  }

  function isPersistent() {
    return storageStatus === 'loaded' || storageStatus === 'empty';
  }

  function getAutosaveStatus() {
    return autosave.getStatus();
  }

  async function scheduleSave() {
    if (!initialized) {
      return { ok: false, status: 'not-initialized', code: 'not-initialized' };
    }
    const result = autosave.schedule(clone(portfolio));
    saveStatus = result.ok ? 'scheduled' : result.status;
    return result;
  }

  async function buy(input = {}) {
    ensureInitialized();
    const payload = isPlainObject(input) ? input : {};
    const stock = getStock(payload.symbol);
    const price = payload.price === undefined ? stock?.price : payload.price;
    const result = buyStock(portfolio, {
      symbol: payload.symbol,
      quantity: payload.quantity,
      price,
      timestamp: payload.timestamp ?? now(),
    });

    if (!result.ok) {
      return {
        ok: false,
        error: result.error,
        portfolio: clone(portfolio),
        transaction: null,
      };
    }

    portfolio = result.portfolio;
    await scheduleSave();
    return {
      ok: true,
      portfolio: clone(portfolio),
      transaction: clone(result.transaction),
      error: null,
    };
  }

  async function sell(input = {}) {
    ensureInitialized();
    const payload = isPlainObject(input) ? input : {};
    const stock = getStock(payload.symbol);
    const price = payload.price === undefined ? stock?.price : payload.price;
    const result = sellStock(portfolio, {
      symbol: payload.symbol,
      quantity: payload.quantity,
      price,
      timestamp: payload.timestamp ?? now(),
    });

    if (!result.ok) {
      return {
        ok: false,
        error: result.error,
        portfolio: clone(portfolio),
        transaction: null,
      };
    }

    portfolio = result.portfolio;
    await scheduleSave();
    return {
      ok: true,
      portfolio: clone(portfolio),
      transaction: clone(result.transaction),
      error: null,
    };
  }

  async function reset() {
    ensureInitialized();
    await autosave.flush();
    portfolio = resetPortfolio(portfolio);
    await scheduleSave();
    return {
      ok: true,
      portfolio: clone(portfolio),
    };
  }

  function getWatchlist() {
    return [...watchlist];
  }

  function addToWatchlist(symbol) {
    const normalized = String(symbol ?? '').trim().toUpperCase();
    if (!normalized || watchlist.includes(normalized)) {
      return { ok: false, error: 'Simbol watchlist tidak valid atau sudah ada.' };
    }
    if (watchlist.length >= 20) {
      return { ok: false, error: 'Watchlist melebihi batas 20 simbol.' };
    }
    if (!stocks.some((stock) => stock.symbol === normalized)) {
      return { ok: false, error: `Simbol watchlist tidak dikenal: ${normalized}.` };
    }
    watchlist = [...watchlist, normalized];
    const saveResult = watchlistStorage.save(watchlist, { validSymbols: stocks.map((stock) => stock.symbol) });
    watchlistStorageStatus = saveResult.ok ? 'saved' : saveResult.status;
    return { ok: true, watchlist: [...watchlist], storage: saveResult };
  }

  function removeFromWatchlist(symbol) {
    const normalized = String(symbol ?? '').trim().toUpperCase();
    const next = watchlist.filter((item) => item !== normalized);
    const changed = next.length !== watchlist.length;
    watchlist = next;
    const saveResult = watchlistStorage.save(watchlist, { validSymbols: stocks.map((stock) => stock.symbol) });
    watchlistStorageStatus = saveResult.ok ? 'saved' : saveResult.status;
    return { ok: changed, watchlist: [...watchlist], storage: saveResult };
  }

  async function flush() {
    return autosave.flush();
  }

  function dispose() {
    autosave.dispose();
  }

  return {
    init,
    getPortfolio,
    getSummary,
    getStocks,
    getStock,
    getStorageStatus,
    getStorageIssue,
    getWatchlistStorageStatus,
    getWatchlistStorageIssue,
    isPersistent,
    getAutosaveStatus,
    buy,
    sell,
    reset,
    getWatchlist,
    addToWatchlist,
    removeFromWatchlist,
    scheduleSave,
    flush,
    dispose,
  };
}