import { validateRequest } from './request-model.js';
import { createJsonStorage } from './storage.js';

const MAX_HISTORY_ITEMS = 100;
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

function sanitizeSummary(summary) {
  if (!isPlainObject(summary)) {
    return null;
  }
  const allowed = ['status', 'statusText', 'httpOk', 'durationMs', 'bodySize', 'truncated'];
  const result = {};
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(summary, key)) {
      result[key] = summary[key];
    }
  }
  return result;
}

let historyIdCounter = 0;

function defaultCreateId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  historyIdCounter += 1;
  return `history-${Date.now()}-${historyIdCounter}`;
}

function normalizeTimestamp(value, now) {
  if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) {
    return value;
  }
  return now();
}

function validateHistoryItem(item, now) {
  if (!isPlainObject(item)) {
    return null;
  }
  if (typeof item.id !== 'string' || item.id.trim() === '') {
    return null;
  }
  if (typeof item.createdAt !== 'string' || Number.isNaN(Date.parse(item.createdAt))) {
    return null;
  }
  const sanitized = sanitizeRequest(item.request);
  if (!sanitized) {
    return null;
  }
  return {
    id: item.id,
    createdAt: item.createdAt,
    request: sanitized,
    responseSummary: sanitizeSummary(item.responseSummary),
  };
}

export function createHistoryStorage(options = {}) {
  const baseStorage = options.storage && typeof options.storage.load === 'function'
    ? options.storage
    : createJsonStorage({
      storage: options.storage || options.storageInput,
      key: options.key || 'devpanel.history',
      now: options.now,
    });
  const now = typeof options.now === 'function' ? options.now : () => new Date().toISOString();
  const createId = typeof options.createId === 'function' ? options.createId : defaultCreateId;
  const maxItems = Number.isInteger(options.maxItems) && options.maxItems > 0 ? options.maxItems : MAX_HISTORY_ITEMS;

  function loadRaw() {
    return baseStorage.load();
  }

  function list() {
    const result = loadRaw();
    if (!result.ok) {
      return result;
    }
    if (result.status === 'empty') {
      return { ok: true, status: 'empty', code: 'empty', items: [], droppedCount: 0 };
    }
    const rawItems = Array.isArray(result.data) ? result.data : [];
    const items = [];
    let droppedCount = 0;
    for (const item of rawItems) {
      const validated = validateHistoryItem(item, now);
      if (validated) {
        items.push(validated);
      } else {
        droppedCount += 1;
      }
    }
    return { ok: true, status: 'loaded', code: 'loaded', items: clone(items), droppedCount };
  }

  function add(request, responseSummary, overrides) {
    const sanitized = sanitizeRequest(request);
    if (!sanitized) {
      return { ok: false, status: 'invalid-request', code: 'invalid-request', error: 'Request history tidak valid.' };
    }

    const current = list();
    if (!current.ok) {
      return current;
    }

    const item = {
      id: createId(),
      createdAt: normalizeTimestamp(overrides?.createdAt, now),
      request: sanitized,
      responseSummary: sanitizeSummary(responseSummary),
    };

    const items = [item, ...current.items].slice(0, maxItems);
    const saveResult = baseStorage.save(items, overrides);
    if (!saveResult.ok) {
      return saveResult;
    }
    return { ok: true, status: 'saved', code: 'saved', item: clone(item), items: clone(items) };
  }

  function remove(id, overrides) {
    if (typeof id !== 'string' || id.trim() === '') {
      return { ok: false, status: 'invalid-id', code: 'invalid-id', error: 'ID history tidak valid.' };
    }
    const current = list();
    if (!current.ok) {
      return current;
    }
    const items = current.items.filter((item) => item.id !== id);
    const saveResult = baseStorage.save(items, overrides);
    if (!saveResult.ok) {
      return saveResult;
    }
    return { ok: true, status: 'saved', code: 'saved', removed: items.length !== current.items.length };
  }

  function clear(overrides) {
    return baseStorage.clear(overrides);
  }

  return {
    list,
    add,
    remove,
    clear,
    sanitizeRequest,
  };
}
