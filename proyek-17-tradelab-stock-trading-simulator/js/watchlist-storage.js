export const WATCHLIST_STORAGE_KEY_EXPORT = 'tradelab.watchlist';
export { WATCHLIST_STORAGE_KEY_EXPORT as WATCHLIST_KEY };

const APP_ID = 'tradelab';
const WATCHLIST_SCHEMA_VERSION = 1;
const MAX_WATCHLIST_ITEMS = 20;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}(?:\.\d{1,6})?Z$/;

// Use same ISO pattern as storage.js (seconds with colons).
const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/;

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

function errorInfo(error) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, code: error.code === undefined ? null : error.code };
  }
  if (isPlainObject(error) && typeof error.message === 'string') {
    return { name: typeof error.name === 'string' ? error.name : 'Error', message: error.message, code: error.code === undefined ? null : error.code };
  }
  return { name: 'Error', message: typeof error === 'string' ? error : 'Kesalahan storage tidak diketahui.', code: null };
}

function isQuotaError(error) {
  const name = typeof error?.name === 'string' ? error.name : '';
  const code = error?.code;
  const message = typeof error?.message === 'string' ? error.message : '';
  return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED' || code === 22 || code === 1014 || /quota/i.test(message);
}

function normalizeOptions(input) {
  if (input === undefined) {
    return { explicitStorage: false };
  }
  if (input === null) {
    return { explicitStorage: true, storage: null };
  }
  if (isPlainObject(input) && Object.prototype.hasOwnProperty.call(input, 'storage')) {
    const result = { explicitStorage: true };
    for (const property of ['storage', 'validSymbols', 'now', 'savedAt', 'key']) {
      if (Object.prototype.hasOwnProperty.call(input, property)) {
        try {
          result[property] = input[property];
        } catch {
          // handled later
        }
      }
    }
    return result;
  }
  // Treat direct storage-like object.
  if (input && typeof input.getItem === 'function') {
    return { explicitStorage: true, storage: input };
  }
  if (isPlainObject(input)) {
    return { ...input, explicitStorage: false };
  }
  return { explicitStorage: true, storage: null, invalidOptions: true };
}

function defaultStorage() {
  try {
    const storage = globalThis.localStorage;
    if (!storage) {
      return { storage: null, code: 'storage-unavailable', message: 'localStorage tidak tersedia.' };
    }
    return { storage, code: null, message: null };
  } catch (error) {
    const details = errorInfo(error);
    return { storage: null, code: 'storage-getter-error', message: details.message, errorDetails: details };
  }
}

function resolveStorage(options) {
  let storage;
  if (options.explicitStorage) {
    storage = options.storage;
    if (!storage) {
      return { storage: null, code: 'storage-unavailable', message: 'Storage tidak tersedia.' };
    }
  } else {
    const result = defaultStorage();
    if (!result.storage) {
      return result;
    }
    storage = result.storage;
  }
  try {
    if (typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function' || typeof storage.removeItem !== 'function') {
      return { storage: null, code: 'storage-unavailable', message: 'Storage tidak mendukung operasi ini.' };
    }
  } catch (error) {
    const details = errorInfo(error);
    return { storage: null, code: 'storage-method-error', message: details.message, errorDetails: details };
  }
  return { storage, code: null, message: null };
}

function resolveKey(options) {
  if (typeof options.key === 'string' && options.key.trim()) {
    return options.key;
  }
  return WATCHLIST_STORAGE_KEY_EXPORT;
}

function isTrustedTimestamp(value) {
  return typeof value === 'string' && ISO_PATTERN.test(value) && !Number.isNaN(Date.parse(value));
}

function normalizeSymbols(symbols, validSymbols) {
  if (!Array.isArray(symbols)) {
    return { valid: false, error: 'Watchlist harus berupa larik simbol.' };
  }
  if (symbols.length > MAX_WATCHLIST_ITEMS) {
    return { valid: false, error: `Watchlist melebihi batas ${MAX_WATCHLIST_ITEMS} simbol.` };
  }
  const normalized = [];
  const seen = new Set();
  for (const symbol of symbols) {
    if (typeof symbol !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,15}$/.test(symbol)) {
      return { valid: false, error: 'Simbol watchlist tidak valid.' };
    }
    const upper = symbol.trim().toUpperCase();
    if (seen.has(upper)) {
      return { valid: false, error: 'Simbol watchlist duplikat.' };
    }
    if (validSymbols instanceof Set && !validSymbols.has(upper)) {
      return { valid: false, error: `Simbol watchlist tidak dikenal: ${upper}.` };
    }
    if (Array.isArray(validSymbols) && !validSymbols.includes(upper)) {
      return { valid: false, error: `Simbol watchlist tidak dikenal: ${upper}.` };
    }
    seen.add(upper);
    normalized.push(upper);
  }
  return { valid: true, symbols: normalized };
}

function validateEnvelope(envelope, validSymbols) {
  const errors = [];
  if (!isPlainObject(envelope)) {
    return { valid: false, code: 'invalid-envelope', errors: ['Envelope watchlist harus berupa objek.'] };
  }
  if (envelope.app !== APP_ID) {
    errors.push('Envelope.app harus "tradelab".');
  }
  if (envelope.schemaVersion !== WATCHLIST_SCHEMA_VERSION) {
    if (Number.isInteger(envelope.schemaVersion)) {
      return { valid: false, code: 'unsupported-schema', schemaVersion: envelope.schemaVersion, errors: [`Schema watchlist ${envelope.schemaVersion} tidak didukung.`] };
    }
    errors.push('Envelope.schemaVersion harus integer.');
  }
  if (!isTrustedTimestamp(envelope.savedAt)) {
    errors.push('Envelope.savedAt harus berupa timestamp ISO 8601 UTC.');
  }
  if (!Object.prototype.hasOwnProperty.call(envelope, 'symbols')) {
    errors.push('Envelope.symbols wajib ada.');
  } else {
    const normalized = normalizeSymbols(envelope.symbols, validSymbols);
    if (!normalized.valid) {
      errors.push(normalized.error);
      return { valid: false, code: 'invalid-watchlist', errors };
    }
  }
  if (errors.length > 0) {
    return { valid: false, code: 'invalid-envelope', errors };
  }
  return { valid: true, code: null, errors: [] };
}

export function loadWatchlist(input) {
  const options = normalizeOptions(input);
  const key = resolveKey(options);
  const storageResult = resolveStorage(options);
  if (!storageResult.storage) {
    return {
      ok: false,
      status: storageResult.code === 'storage-method-error' ? 'read-error' : 'unavailable',
      code: storageResult.code,
      key,
      symbols: [],
      error: storageResult.message,
      errorDetails: storageResult.errorDetails,
    };
  }

  let raw;
  try {
    raw = storageResult.storage.getItem(key);
  } catch (error) {
    const details = errorInfo(error);
    return { ok: false, status: 'read-error', code: 'read-failed', key, symbols: [], error: details.message, errorDetails: details };
  }

  if (raw === null || raw === undefined) {
    return { ok: true, status: 'empty', code: 'empty', key, symbols: [], error: null };
  }
  if (typeof raw !== 'string') {
    return { ok: false, status: 'corrupt', code: 'invalid-raw', key, symbols: [], error: 'Data watchlist bukan string JSON.' };
  }

  let envelope;
  try {
    envelope = JSON.parse(raw);
  } catch (error) {
    const details = errorInfo(error);
    return { ok: false, status: 'corrupt', code: 'invalid-json', key, symbols: [], error: 'Data watchlist berisi JSON yang tidak valid.', errorDetails: details };
  }

  const validSymbols = options.validSymbols;
  const result = validateEnvelope(envelope, validSymbols);
  if (!result.valid) {
    if (result.code === 'unsupported-schema') {
      return { ok: false, status: 'unsupported-schema', code: 'unsupported-schema', key, symbols: [], schemaVersion: result.schemaVersion, error: result.errors.join(' ') };
    }
    return { ok: false, status: 'corrupt', code: result.code, key, symbols: [], error: result.errors.join(' ') };
  }

  const normalized = normalizeSymbols(envelope.symbols, validSymbols);
  return {
    ok: true,
    status: 'loaded',
    code: 'loaded',
    key,
    symbols: normalized.symbols,
    savedAt: envelope.savedAt,
    error: null,
  };
}

export function saveWatchlist(symbols, input) {
  const options = normalizeOptions(input);
  const key = resolveKey(options);
  const storageResult = resolveStorage(options);
  if (!storageResult.storage) {
    return {
      ok: false,
      status: storageResult.code === 'storage-method-error' ? 'write-error' : 'unavailable',
      code: storageResult.code,
      key,
      error: storageResult.message,
      errorDetails: storageResult.errorDetails,
    };
  }

  const normalized = normalizeSymbols(symbols, options.validSymbols);
  if (!normalized.valid) {
    return { ok: false, status: 'invalid-watchlist', code: 'invalid-watchlist', key, error: normalized.error };
  }

  const savedAtResult = options.savedAt !== undefined
    ? (isTrustedTimestamp(options.savedAt) ? { valid: true, savedAt: options.savedAt } : { valid: false })
    : (typeof options.now === 'function'
      ? (() => {
        try {
          const value = options.now();
          const savedAt = value instanceof Date ? value.toISOString() : value;
          return isTrustedTimestamp(savedAt) ? { valid: true, savedAt } : { valid: false };
        } catch {
          return { valid: false };
        }
      })()
      : { valid: true, savedAt: new Date().toISOString() });

  if (!savedAtResult.valid) {
    return { ok: false, status: 'invalid-watchlist', code: 'invalid-saved-at', key, error: 'Timestamp watchlist tidak valid.' };
  }

  const envelope = {
    app: APP_ID,
    schemaVersion: WATCHLIST_SCHEMA_VERSION,
    savedAt: savedAtResult.savedAt,
    symbols: normalized.symbols,
  };

  let raw;
  try {
    raw = JSON.stringify(envelope);
  } catch (error) {
    const details = errorInfo(error);
    return { ok: false, status: 'write-error', code: 'serialize-failed', key, error: details.message, errorDetails: details };
  }

  try {
    storageResult.storage.setItem(key, raw);
  } catch (error) {
    const details = errorInfo(error);
    if (isQuotaError(error)) {
      return { ok: false, status: 'quota-exceeded', code: 'quota-exceeded', key, error: details.message, errorDetails: details };
    }
    return { ok: false, status: 'write-error', code: 'write-failed', key, error: details.message, errorDetails: details };
  }

  return { ok: true, status: 'saved', code: 'saved', key, symbols: normalized.symbols, savedAt: savedAtResult.savedAt, error: null };
}

export function clearWatchlist(input) {
  const options = normalizeOptions(input);
  const key = resolveKey(options);
  const storageResult = resolveStorage(options);
  if (!storageResult.storage) {
    return {
      ok: false,
      status: storageResult.code === 'storage-method-error' ? 'write-error' : 'unavailable',
      code: storageResult.code,
      key,
      error: storageResult.message,
      errorDetails: storageResult.errorDetails,
    };
  }
  try {
    storageResult.storage.removeItem(key);
  } catch (error) {
    const details = errorInfo(error);
    return { ok: false, status: 'write-error', code: 'clear-failed', key, error: details.message, errorDetails: details };
  }
  return { ok: true, status: 'cleared', code: 'cleared', key, error: null };
}

export function createWatchlistStorage(options = {}) {
  const base = normalizeOptions(options);
  return {
    key: resolveKey(base),
    load(overrides) {
      return loadWatchlist(mergeOptions(base, overrides));
    },
    save(symbols, overrides) {
      return saveWatchlist(symbols, mergeOptions(base, overrides));
    },
    clear(overrides) {
      return clearWatchlist(mergeOptions(base, overrides));
    },
  };
}

function mergeOptions(baseOptions, overrides) {
  if (overrides === undefined) {
    return { ...baseOptions };
  }
  const normalized = normalizeOptions(overrides);
  return { ...baseOptions, ...normalized };
}

export const WATCHLIST_STORAGE_KEY = WATCHLIST_STORAGE_KEY_EXPORT;