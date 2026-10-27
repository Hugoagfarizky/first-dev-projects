import { validatePortfolio } from './portfolio.js';

export const STORAGE_KEY = 'tradelab.portfolio';
export const STORAGE_SCHEMA_VERSION = 1;

const APP_ID = 'tradelab';
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/;

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

function getStorageMethod(storage, method) {
  try {
    const value = storage?.[method];
    if (typeof value !== 'function') {
      return { ok: false, missing: true };
    }
    return { ok: true, method: value };
  } catch (error) {
    return { ok: false, error };
  }
}

function isStorageObject(value) {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  for (const method of ['getItem', 'setItem', 'removeItem']) {
    try {
      if (typeof value[method] === 'function') {
        return true;
      }
    } catch {
      return true;
    }
  }
  return false;
}

function isTrustedTimestamp(value) {
  return typeof value === 'string'
    && ISO_DATE_PATTERN.test(value)
    && !Number.isNaN(Date.parse(value));
}

function errorInfo(error) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      code: error.code === undefined ? null : error.code,
    };
  }
  if (isPlainObject(error) && typeof error.message === 'string') {
    return {
      name: typeof error.name === 'string' ? error.name : 'Error',
      message: error.message,
      code: error.code === undefined ? null : error.code,
    };
  }
  return {
    name: 'Error',
    message: typeof error === 'string' ? error : 'Kesalahan storage tidak diketahui.',
    code: null,
  };
}

function isQuotaError(error) {
  if (!error) {
    return false;
  }
  const name = typeof error.name === 'string' ? error.name : '';
  const code = error.code;
  const message = typeof error.message === 'string' ? error.message : '';
  return name === 'QuotaExceededError'
    || name === 'NS_ERROR_DOM_QUOTA_REACHED'
    || code === 22
    || code === 1014
    || /quota/i.test(message);
}

function failure(status, code, message, extra = {}) {
  return {
    ok: false,
    status,
    code,
    error: message,
    ...extra,
  };
}

function storageFailure(status, code, error, extra = {}) {
  const details = errorInfo(error);
  return {
    ok: false,
    status,
    code,
    error: details.message,
    errorDetails: details,
    ...extra,
  };
}

function normalizeOptions(input) {
  if (input === undefined) {
    return { explicitStorage: false };
  }
  if (input === null) {
    return { explicitStorage: true, storage: null };
  }
  if (isStorageObject(input)) {
    return { explicitStorage: true, storage: input };
  }
  if (isPlainObject(input)) {
    const result = {
      explicitStorage: Object.prototype.hasOwnProperty.call(input, 'storage'),
    };
    for (const property of ['key', 'savedAt', 'now', 'storage']) {
      if (Object.prototype.hasOwnProperty.call(input, property)) {
        try {
          result[property] = input[property];
        } catch {
          // Akses getter yang gagal akan ditangani oleh resolveStorage.
        }
      }
    }
    return result;
  }
  return { explicitStorage: true, storage: null, invalidOptions: true };
}

function defaultStorage() {
  try {
    const storage = globalThis.localStorage;
    if (!storage) {
      return {
        storage: null,
        code: 'storage-unavailable',
        message: 'localStorage tidak tersedia di lingkungan ini.',
      };
    }
    return { storage, code: null, message: null };
  } catch (error) {
    const details = errorInfo(error);
    return {
      storage: null,
      code: 'storage-getter-error',
      message: details.message,
      errorDetails: details,
    };
  }
}

function resolveStorage(options, method) {
  let storage;
  if (options.explicitStorage) {
    storage = options.storage;
    if (!storage) {
      return {
        storage: null,
        code: 'storage-unavailable',
        message: 'Storage tidak tersedia atau tidak mendukung operasi ini.',
      };
    }
  } else {
    const result = defaultStorage();
    if (!result.storage) {
      return result;
    }
    storage = result.storage;
  }

  const methodResult = getStorageMethod(storage, method);
  if (!methodResult.ok) {
    if (methodResult.error) {
      return {
        storage: null,
        code: 'storage-method-error',
        message: methodResult.error?.message ?? 'Akses method storage gagal.',
        errorDetails: errorInfo(methodResult.error),
      };
    }
    return {
      storage: null,
      code: 'storage-unavailable',
      message: 'Storage tidak mendukung operasi ini.',
    };
  }

  return { storage, method: methodResult.method, code: null, message: null };
}

function resolveStorageKey(options) {
  if (typeof options.key === 'string' && options.key.trim()) {
    return options.key;
  }
  return STORAGE_KEY;
}

function resolveSavedAt(options) {
  if (options.savedAt !== undefined) {
    return isTrustedTimestamp(options.savedAt)
      ? { valid: true, savedAt: options.savedAt }
      : { valid: false, error: 'savedAt harus berupa timestamp ISO 8601 UTC.' };
  }

  if (typeof options.now === 'function') {
    try {
      const value = options.now();
      const savedAt = value instanceof Date ? value.toISOString() : value;
      if (isTrustedTimestamp(savedAt)) {
        return { valid: true, savedAt };
      }
      return { valid: false, error: 'now() harus menghasilkan timestamp ISO 8601 UTC.' };
    } catch (error) {
      return { valid: false, error: errorInfo(error).message };
    }
  }

  return { valid: true, savedAt: new Date().toISOString() };
}

export function validateStorageEnvelope(envelope) {
  const errors = [];

  if (!isPlainObject(envelope)) {
    return {
      valid: false,
      code: 'invalid-envelope',
      errors: ['Envelope storage harus berupa objek.'],
    };
  }

  if (envelope.app !== APP_ID) {
    errors.push('Envelope.app harus "tradelab".');
  }

  if (!Number.isInteger(envelope.schemaVersion)) {
    errors.push('Envelope.schemaVersion harus berupa integer.');
  } else if (envelope.schemaVersion !== STORAGE_SCHEMA_VERSION) {
    return {
      valid: false,
      code: 'unsupported-schema',
      schemaVersion: envelope.schemaVersion,
      errors: [`Schema storage ${envelope.schemaVersion} tidak didukung.`],
    };
  }

  if (!isTrustedTimestamp(envelope.savedAt)) {
    errors.push('Envelope.savedAt harus berupa timestamp ISO 8601 UTC.');
  }

  if (!Object.prototype.hasOwnProperty.call(envelope, 'portfolio')) {
    errors.push('Envelope.portfolio wajib ada.');
  } else {
    const portfolioResult = validatePortfolio(envelope.portfolio);
    if (!portfolioResult.valid) {
      errors.push(...portfolioResult.errors);
      return {
        valid: false,
        code: 'invalid-portfolio',
        errors,
        portfolioErrors: portfolioResult.errors,
      };
    }
  }

  if (errors.length > 0) {
    return {
      valid: false,
      code: 'invalid-envelope',
      errors,
    };
  }

  return { valid: true, code: null, errors: [] };
}

export function loadPortfolio(input) {
  const options = normalizeOptions(input);
  const key = resolveStorageKey(options);
  const storageResult = resolveStorage(options, 'getItem');
  if (!storageResult.storage) {
    const methodError = storageResult.code === 'storage-method-error';
    return failure(
      methodError ? 'read-error' : 'unavailable',
      storageResult.code,
      storageResult.message,
      storageResult.errorDetails ? { key, errorDetails: storageResult.errorDetails } : {},
    );
  }

  let raw;
  try {
    raw = storageResult.method.call(storageResult.storage, key);
  } catch (error) {
    return storageFailure('read-error', 'read-failed', error, { key });
  }

  if (raw === null || raw === undefined) {
    return {
      ok: true,
      status: 'empty',
      code: 'empty',
      key,
      savedAt: null,
      portfolio: null,
      error: null,
    };
  }

  if (typeof raw !== 'string') {
    return failure('corrupt', 'invalid-raw', 'Data storage bukan string JSON.', { key });
  }

  let envelope;
  try {
    envelope = JSON.parse(raw);
  } catch (error) {
    return failure(
      'corrupt',
      'invalid-json',
      'Data storage berisi JSON yang tidak valid.',
      { key, errorDetails: errorInfo(error) },
    );
  }

  const envelopeResult = validateStorageEnvelope(envelope);
  if (!envelopeResult.valid) {
    if (envelopeResult.code === 'unsupported-schema') {
      return failure(
        'unsupported-schema',
        'unsupported-schema',
        envelopeResult.errors.join(' '),
        { key, errors: envelopeResult.errors, schemaVersion: envelopeResult.schemaVersion },
      );
    }
    return failure(
      'corrupt',
      envelopeResult.code,
      envelopeResult.errors.join(' '),
      { key, errors: envelopeResult.errors },
    );
  }

  return {
    ok: true,
    status: 'loaded',
    code: 'loaded',
    key,
    savedAt: envelope.savedAt,
    portfolio: clone(envelope.portfolio),
    error: null,
  };
}

export function savePortfolio(portfolio, input) {
  const options = normalizeOptions(input);
  const key = resolveStorageKey(options);
  const storageResult = resolveStorage(options, 'setItem');
  if (!storageResult.storage) {
    const methodError = storageResult.code === 'storage-method-error';
    return failure(
      methodError ? 'write-error' : 'unavailable',
      storageResult.code,
      storageResult.message,
      storageResult.errorDetails ? { key, errorDetails: storageResult.errorDetails } : {},
    );
  }

  const portfolioResult = validatePortfolio(portfolio);
  if (!portfolioResult.valid) {
    return failure(
      'invalid-portfolio',
      'invalid-portfolio',
      portfolioResult.errors.join(' '),
      { errors: portfolioResult.errors },
    );
  }

  const savedAtResult = resolveSavedAt(options);
  if (!savedAtResult.valid) {
    return failure('invalid-envelope', 'invalid-saved-at', savedAtResult.error);
  }

  const envelope = {
    app: APP_ID,
    schemaVersion: STORAGE_SCHEMA_VERSION,
    savedAt: savedAtResult.savedAt,
    portfolio: clone(portfolio),
  };

  const envelopeResult = validateStorageEnvelope(envelope);
  if (!envelopeResult.valid) {
    return failure(
      'invalid-envelope',
      envelopeResult.code,
      envelopeResult.errors.join(' '),
      { errors: envelopeResult.errors },
    );
  }

  let raw;
  try {
    raw = JSON.stringify(envelope);
  } catch (error) {
    return storageFailure('write-error', 'serialize-failed', error, { key });
  }

  try {
    storageResult.method.call(storageResult.storage, key, raw);
  } catch (error) {
    if (isQuotaError(error)) {
      return storageFailure('quota-exceeded', 'quota-exceeded', error, { key });
    }
    return storageFailure('write-error', 'write-failed', error, { key });
  }

  return {
    ok: true,
    status: 'saved',
    code: 'saved',
    key,
    savedAt: savedAtResult.savedAt,
    error: null,
  };
}

export function clearPortfolio(input) {
  const options = normalizeOptions(input);
  const key = resolveStorageKey(options);
  const storageResult = resolveStorage(options, 'removeItem');
  if (!storageResult.storage) {
    const methodError = storageResult.code === 'storage-method-error';
    return failure(
      methodError ? 'write-error' : 'unavailable',
      storageResult.code,
      storageResult.message,
      storageResult.errorDetails ? { key, errorDetails: storageResult.errorDetails } : {},
    );
  }

  try {
    storageResult.method.call(storageResult.storage, key);
  } catch (error) {
    return storageFailure('write-error', 'clear-failed', error, { key });
  }

  return {
    ok: true,
    status: 'cleared',
    code: 'cleared',
    key,
    error: null,
  };
}

function mergeOptions(baseOptions, overrides) {
  if (overrides === undefined) {
    return { ...baseOptions };
  }
  const normalized = normalizeOptions(overrides);
  return { ...baseOptions, ...normalized };
}

export function createPortfolioStorage(options = {}) {
  const base = normalizeOptions(options);
  return {
    key: resolveStorageKey(base),
    load(overrides) {
      return loadPortfolio(mergeOptions(base, overrides));
    },
    save(portfolio, overrides) {
      return savePortfolio(portfolio, mergeOptions(base, overrides));
    },
    clear(overrides) {
      return clearPortfolio(mergeOptions(base, overrides));
    },
  };
}
