import { validateRequest } from './request-model.js';
import { createJsonStorage } from './storage.js';
const MAX_COLLECTIONS = 50;
const MAX_REQUESTS_PER_COLLECTION = 50;
const MAX_NAME_LENGTH = 80;
const SENSITIVE_HEADERS = new Set(['authorization', 'proxy-authorization', 'cookie', 'set-cookie', 'x-api-key']);
const SENSITIVE_QUERY_KEYS = new Set(['token', 'access_token', 'api_key', 'password', 'secret']);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function clone(value) {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function sanitizeUrl(url) {
  try {
    const parsed = new URL(url);
    for (const key of [...parsed.searchParams.keys()]) {
      if (SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) {
        parsed.searchParams.delete(key);
      }
    }
    return parsed.href;
  } catch {
    return url;
  }
}

function sanitizeHeaders(headers) {
  if (!isPlainObject(headers)) {
    return {};
  }
  const result = {};
  for (const [key, value] of Object.entries(headers)) {
    if (!SENSITIVE_HEADERS.has(key.toLowerCase())) {
      result[key] = value;
    }
  }
  return result;
}

function sanitizeRequest(request) {
  const validated = validateRequest(request);
  if (!validated.ok) {
    return null;
  }
  const sanitized = clone(validated.request);
  sanitized.headers = sanitizeHeaders(sanitized.headers || {});
  sanitized.url = sanitizeUrl(sanitized.url);
  return sanitized;
}

function normalizeTimestamp(value, now) {
  if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) {
    return value;
  }
  return now();
}

function validateCollection(collection, now) {
  if (!isPlainObject(collection)) {
    return { ok: false, error: 'Collection harus berupa objek.' };
  }
  if (typeof collection.id !== 'string' || collection.id.trim() === '') {
    return { ok: false, error: 'Collection ID tidak valid.' };
  }
  if (typeof collection.name !== 'string' || collection.name.trim() === '' || collection.name.length > MAX_NAME_LENGTH) {
    return { ok: false, error: 'Nama collection tidak valid.' };
  }
  if (!Array.isArray(collection.requests)) {
    return { ok: false, error: 'Daftar request collection harus berupa larik.' };
  }
  if (collection.requests.length > MAX_REQUESTS_PER_COLLECTION) {
    return { ok: false, error: `Collection melebihi batas ${MAX_REQUESTS_PER_COLLECTION} request.` };
  }

  const requests = [];
  for (const request of collection.requests) {
    const sanitized = sanitizeRequest(request);
    if (!sanitized) {
      return { ok: false, error: 'Collection mengandung request yang tidak valid.' };
    }
    requests.push(sanitized);
  }

  return {
    ok: true,
    collection: {
      id: collection.id.trim(),
      name: collection.name.trim(),
      createdAt: normalizeTimestamp(collection.createdAt, now),
      updatedAt: normalizeTimestamp(collection.updatedAt, now),
      requests,
    },
  };
}

export function createCollectionStorage(options = {}) {
  const baseStorage = options.storage && typeof options.storage.load === 'function'
    ? options.storage
    : createJsonStorage({
      storage: options.storage || options.storageInput,
      key: options.key || 'devpanel.collections',
      now: options.now,
    });
  const now = typeof options.now === 'function' ? options.now : () => new Date().toISOString();
  const maxCollections = Number.isInteger(options.maxCollections) && options.maxCollections > 0 ? options.maxCollections : MAX_COLLECTIONS;

  function loadCollections() {
    const result = baseStorage.load();
    if (!result.ok) {
      return result;
    }
    if (result.status === 'empty') {
      return { ok: true, status: 'empty', code: 'empty', collections: [], droppedCount: 0 };
    }
    const raw = Array.isArray(result.data) ? result.data : [];
    const collections = [];
    let droppedCount = 0;
    for (const item of raw) {
      const validated = validateCollection(item, now);
      if (validated.ok) {
        collections.push(validated.collection);
      } else {
        droppedCount += 1;
      }
    }
    return { ok: true, status: 'loaded', code: 'loaded', collections: clone(collections), droppedCount };
  }

  function list() {
    return loadCollections();
  }

  function get(id) {
    if (typeof id !== 'string' || id.trim() === '') {
      return { ok: false, status: 'invalid-id', code: 'invalid-id', error: 'Collection ID tidak valid.' };
    }
    const current = loadCollections();
    if (!current.ok) {
      return current;
    }
    const collection = current.collections.find((item) => item.id === id.trim());
    if (!collection) {
      return { ok: false, status: 'not-found', code: 'not-found', error: 'Collection tidak ditemukan.' };
    }
    return { ok: true, status: 'loaded', code: 'loaded', collection: clone(collection) };
  }

  function save(collection, overrides) {
    const validated = validateCollection(collection, now);
    if (!validated.ok) {
      return { ok: false, status: 'invalid-collection', code: 'invalid-collection', error: validated.error };
    }

    const current = loadCollections();
    if (!current.ok) {
      return current;
    }

    const collections = clone(current.collections);
    const existingIndex = collections.findIndex((item) => item.id === validated.collection.id);
    const duplicateName = collections.some((item, index) => item.name.toLowerCase() === validated.collection.name.toLowerCase() && index !== existingIndex);
    if (duplicateName) {
      return { ok: false, status: 'duplicate-name', code: 'duplicate-name', error: 'Nama collection duplikat.' };
    }

    if (existingIndex >= 0) {
      validated.collection.createdAt = collections[existingIndex].createdAt;
      validated.collection.updatedAt = normalizeTimestamp(collection.updatedAt, now);
      collections[existingIndex] = validated.collection;
    } else {
      if (collections.length >= maxCollections) {
        return { ok: false, status: 'limit-exceeded', code: 'limit-exceeded', error: `Jumlah collection melebihi batas ${maxCollections}.` };
      }
      collections.push(validated.collection);
    }

    const saveResult = baseStorage.save(collections, overrides);
    if (!saveResult.ok) {
      return saveResult;
    }
    return { ok: true, status: 'saved', code: 'saved', collection: clone(validated.collection) };
  }

  function remove(id, overrides) {
    if (typeof id !== 'string' || id.trim() === '') {
      return { ok: false, status: 'invalid-id', code: 'invalid-id', error: 'Collection ID tidak valid.' };
    }
    const current = loadCollections();
    if (!current.ok) {
      return current;
    }
    const collections = current.collections.filter((item) => item.id !== id.trim());
    const removed = collections.length !== current.collections.length;
    const saveResult = baseStorage.save(collections, overrides);
    if (!saveResult.ok) {
      return saveResult;
    }
    return { ok: true, status: 'saved', code: 'saved', removed };
  }

  function importCollections(collections, overrides) {
    if (!Array.isArray(collections)) {
      return { ok: false, status: 'invalid-input', code: 'invalid-input', error: 'Import collections harus berupa larik.' };
    }
    if (collections.length > maxCollections) {
      return { ok: false, status: 'limit-exceeded', code: 'limit-exceeded', error: `Jumlah collection melebihi batas ${maxCollections}.` };
    }

    const validatedCollections = [];
    const ids = new Set();
    const names = new Set();
    for (const collection of collections) {
      const validated = validateCollection(collection, now);
      if (!validated.ok) {
        return { ok: false, status: 'invalid-collection', code: 'invalid-collection', error: validated.error };
      }
      if (ids.has(validated.collection.id.toLowerCase())) {
        return { ok: false, status: 'duplicate-id', code: 'duplicate-id', error: 'Collection ID duplikat.' };
      }
      if (names.has(validated.collection.name.toLowerCase())) {
        return { ok: false, status: 'duplicate-name', code: 'duplicate-name', error: 'Nama collection duplikat.' };
      }
      ids.add(validated.collection.id.toLowerCase());
      names.add(validated.collection.name.toLowerCase());
      validatedCollections.push(validated.collection);
    }

    const saveResult = baseStorage.save(validatedCollections, overrides);
    if (!saveResult.ok) {
      return saveResult;
    }
    return { ok: true, status: 'saved', code: 'saved', collections: clone(validatedCollections) };
  }

  function exportCollections() {
    const current = loadCollections();
    if (!current.ok) {
      return current;
    }
    return { ok: true, status: 'loaded', code: 'loaded', collections: clone(current.collections) };
  }

  function clear(overrides) {
    return baseStorage.clear(overrides);
  }

  return {
    list: loadCollections,
    get,
    save,
    remove,
    importCollections,
    exportCollections,
    clear,
  };
}
