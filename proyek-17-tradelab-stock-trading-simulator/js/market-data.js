const STOCK_SEEDS = Object.freeze([
  { symbol: 'TLAB', name: 'TradeLab Teknologi', sector: 'Teknologi', basePrice: 12500, volatility: 0.025, drift: 0.001 },
  { symbol: 'BKPI', name: 'Bank Pilar Indonesia', sector: 'Keuangan', basePrice: 9800, volatility: 0.018, drift: 0.0005 },
  { symbol: 'ENRG', name: 'Energi Nusantara', sector: 'Energi', basePrice: 7600, volatility: 0.03, drift: -0.0005 },
  { symbol: 'KONS', name: 'Konsumer Prima', sector: 'Konsumer', basePrice: 14200, volatility: 0.02, drift: 0.001 },
  { symbol: 'MEDK', name: 'Medika Karya', sector: 'Kesehatan', basePrice: 11300, volatility: 0.015, drift: 0.0008 },
  { symbol: 'CLOD', name: 'Cloud Nusantara', sector: 'Teknologi', basePrice: 16800, volatility: 0.035, drift: 0.0015 },
  { symbol: 'FINA', name: 'Finansial Amanah', sector: 'Keuangan', basePrice: 8900, volatility: 0.018, drift: 0.0004 },
  { symbol: 'SURY', name: 'Surya Energi', sector: 'Energi', basePrice: 6400, volatility: 0.032, drift: -0.0008 },
  { symbol: 'RETL', name: 'Retail Sejahtera', sector: 'Konsumer', basePrice: 13100, volatility: 0.022, drift: 0.0006 },
  { symbol: 'BIOK', name: 'Biomed Karsa', sector: 'Kesehatan', basePrice: 15200, volatility: 0.024, drift: 0.001 },
  { symbol: 'DATA', name: 'Data Karsa', sector: 'Teknologi', basePrice: 17900, volatility: 0.03, drift: 0.0012 },
  { symbol: 'GOLD', name: 'Emas Nusantara', sector: 'Energi', basePrice: 9200, volatility: 0.02, drift: 0.0003 },
]);

const HISTORY_LENGTH = 30;
const START_DATE = '2026-09-27';

function createRng(seed) {
  let state = seed >>> 0;
  return function rng() {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function hashSeed(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function formatIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function generateHistory(stock) {
  const rng = createRng(hashSeed(`${stock.symbol}:${stock.basePrice}:${stock.volatility}:${stock.drift}`));
  const startDate = new Date(`${START_DATE}T00:00:00.000Z`);
  const series = [];
  let price = stock.basePrice;

  for (let day = 0; day < HISTORY_LENGTH; day += 1) {
    const date = new Date(startDate);
    date.setUTCDate(startDate.getUTCDate() + day);

    const movement = (rng() - 0.5) * 2 * stock.volatility + stock.drift;
    const open = price;
    const close = Math.max(100, Math.round(price * (1 + movement)));
    const spread = Math.max(1, Math.round(price * stock.volatility));
    const high = Math.max(open, close) + Math.round(spread * rng());
    const low = Math.max(1, Math.min(open, close) - Math.round(spread * rng()));

    series.push({
      date: formatIsoDate(date),
      open,
      high,
      low,
      close,
    });

    price = close;
  }

  return series;
}

function buildStock(stock) {
  const history = generateHistory(stock);
  const lastClose = history[history.length - 1].close;
  const previousClose = history[history.length - 2]?.close ?? history[0].close;

  return Object.freeze({
    symbol: stock.symbol,
    name: stock.name,
    sector: stock.sector,
    basePrice: stock.basePrice,
    volatility: stock.volatility,
    drift: stock.drift,
    price: lastClose,
    changePercent: previousClose === 0 ? 0 : ((lastClose - previousClose) / previousClose) * 100,
    series: Object.freeze(history.map((item) => Object.freeze({ ...item }))),
  });
}

const STOCKS = Object.freeze(STOCK_SEEDS.map(buildStock));

function cloneStock(stock) {
  return {
    ...stock,
    series: stock.series.map((item) => ({ ...item })),
  };
}

export function getStockCatalog() {
  return STOCKS.map(cloneStock);
}

export function getStocks() {
  return getStockCatalog();
}

export function getStockBySymbol(symbol) {
  if (typeof symbol !== 'string') {
    return null;
  }
  const normalized = symbol.trim().toUpperCase();
  const stock = STOCKS.find((item) => item.symbol === normalized);
  return stock ? cloneStock(stock) : null;
}

export function getStock(symbol) {
  return getStockBySymbol(symbol);
}

export function getStockHistory(symbol) {
  const stock = getStockBySymbol(symbol);
  return stock ? stock.series.map((item) => ({ ...item })) : [];
}

export function getPriceHistory(symbol) {
  return getStockHistory(symbol);
}

export function getStockSectors() {
  return [...new Set(STOCKS.map((stock) => stock.sector))].sort();
}

export const stockCatalog = getStockCatalog();
export const marketDataVersion = 1;
