const APP_ID = 'devpanel';
const STORAGE_SCHEMA_VERSION = 1;
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
  if (isPlainObject(input) && Object.prototype.hasOwnProperty.call(input, 'storage') && input.storage !== undefined) {
    const result = { explicitStorage: true };
    for (const property of ['storage', 'key', 'now', 'savedAt']) {
      if (Object.prototype.hasOwnProperty.call(input, property)) {
        try {
          result[property] = input[property];
        } catch {
          // handled by resolveStorage
        }
      }
    }
    return result;
  }
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
  return 'devpanel.storage';
}

function isTrustedTimestamp(value) {
  return typeof value === 'string' && ISO_DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(value));
}

export function validateStorageEnvelope(envelope) {
  const errors = [];
  if (!isPlainObject(envelope)) {
    return { valid: false, code: 'invalid-envelope', errors: ['Envelope storage harus berupa objek.'] };
  }
  if (envelope.app !== APP_ID) {
    errors.push('Envelope.app harus "devpanel".');
  }
  if (!Number.isInteger(envelope.schemaVersion)) {
    errors.push('Envelope.schemaVersion harus berupa integer.');
  } else if (envelope.schemaVersion !== STORAGE_SCHEMA_VERSION) {
    return { valid: false, code: 'unsupported-schema', schemaVersion: envelope.schemaVersion, errors: [`Schema storage ${envelope.schemaVersion} tidak didukung.`] };
  }
  if (!isTrustedTimestamp(envelope.savedAt)) {
    errors.push('Envelope.savedAt harus berupa timestamp ISO 8601 UTC.');
  }
  if (!Object.prototype.hasOwnProperty.call(envelope, 'data')) {
    errors.push('Envelope.data wajib ada.');
  }
  if (errors.length > 0) {
    return { valid: false, code: 'invalid-envelope', errors };
  }
  return { valid: true, code: null, errors: [] };
}

export function loadStoredJson(input) {
  const options = normalizeOptions(input);
  const key = resolveKey(options);
  const storageResult = resolveStorage(options);
  if (!storageResult.storage) {
    return {
      ok: false,
      status: storageResult.code === 'storage-method-error' ? 'read-error' : 'unavailable',
      code: storageResult.code,
      key,
      data: null,
      savedAt: null,
      error: storageResult.message,
      errorDetails: storageResult.errorDetails,
    };
  }

  let raw;
  try {
    raw = storageResult.storage.getItem(key);
  } catch (error) {
    const details = errorInfo(error);
    return { ok: false, status: 'read-error', code: 'read-failed', key, data: null, savedAt: null, error: details.message, errorDetails: details };
  }

  if (raw === null || raw === undefined) {
    return { ok: true, status: 'empty', code: 'empty', key, data: null, savedAt: null, error: null };
  }
  if (typeof raw !== 'string') {
    return { ok: false, status: 'corrupt', code: 'invalid-raw', key, data: null, savedAt: null, error: 'Data storage bukan string JSON.' };
  }

  let envelope;
  try {
    envelope = JSON.parse(raw);
  } catch (error) {
    const details = errorInfo(error);
    return { ok: false, status: 'corrupt', code: 'invalid-json', key, data: null, savedAt: null, error: 'Data storage berisi JSON yang tidak valid.', errorDetails: details };
  }

  const result = validateStorageEnvelope(envelope);
  if (!result.valid) {
    if (result.code === 'unsupported-schema') {
      return { ok: false, status: 'unsupported-schema', code: 'unsupported-schema', key, data: null, savedAt: null, schemaVersion: result.schemaVersion, error: result.errors.join(' ') };
    }
    return { ok: false, status: 'corrupt', code: result.code, key, data: null, savedAt: null, error: result.errors.join(' ') };
  }

  return {
    ok: true,
    status: 'loaded',
    code: 'loaded',
    key,
    data: clone(envelope.data),
    savedAt: envelope.savedAt,
    error: null,
  };
}

export function saveStoredJson(data, input) {
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

  const savedAt = options.savedAt !== undefined
    ? (isTrustedTimestamp(options.savedAt) ? options.savedAt : null)
    : (typeof options.now === 'function'
      ? (() => {
        try {
          const value = options.now();
          const timestamp = value instanceof Date ? value.toISOString() : value;
          return isTrustedTimestamp(timestamp) ? timestamp : null;
        } catch {
          return null;
        }
      })()
      : new Date().toISOString());

  if (!isTrustedTimestamp(savedAt)) {
    return { ok: false, status: 'invalid-envelope', code: 'invalid-saved-at', key, error: 'Timestamp penyimpanan tidak valid.' };
  }

  const envelope = {
    app: APP_ID,
    schemaVersion: STORAGE_SCHEMA_VERSION,
    savedAt,
    data: clone(data),
  };

  const envelopeResult = validateStorageEnvelope(envelope);
  if (!envelopeResult.valid) {
    return { ok: false, status: 'invalid-envelope', code: envelopeResult.code, key, error: envelopeResult.errors.join(' ') };
  }

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

  return { ok: true, status: 'saved', code: 'saved', key, savedAt, error: null };
}

export function clearStoredJson(input) {
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

export function createJsonStorage(options = {}) {
  const base = normalizeOptions(options);
  return {
    key: resolveKey(base),
    load(overrides) {
      return loadStoredJson(mergeOptions(base, overrides));
    },
    save(data, overrides) {
      return saveStoredJson(data, mergeOptions(base, overrides));
    },
    clear(overrides) {
      return clearStoredJson(mergeOptions(base, overrides));
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