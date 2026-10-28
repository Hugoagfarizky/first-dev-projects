import { buildRequest } from './request-builder.js';
import { sendRequest } from './http-client.js';
import { inspectResponse } from './response-inspector.js';
import { createHistoryStorage } from './history-storage.js';
import { createCollectionStorage } from './collection-storage.js';
import { createJsonStorage } from './storage.js';

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

function defaultRequest() {
  return {
    method: 'GET',
    url: '',
    queryParams: [],
    headers: [],
    body: '',
    timeoutMs: 10000,
  };
}

export function createWorkbenchController(options = {}) {
  if (!isPlainObject(options)) {
    throw new TypeError('Opsi workbench controller harus berupa objek.');
  }

  const now = typeof options.now === 'function' ? options.now : () => new Date().toISOString();
  const fetchImpl = options.fetchImpl;
  const httpSend = typeof options.sendRequest === 'function' ? options.sendRequest : sendRequest;
  const historyStorageOptions = {
    key: options.historyKey || 'devpanel.history',
    now,
    createId: options.createId,
  };
  if (options.historyStorageInput || options.storage) {
    historyStorageOptions.storage = options.historyStorageInput || options.storage;
  }
  const historyStorage = options.historyStorage || createHistoryStorage(historyStorageOptions);

  const collectionStorageOptions = {
    key: options.collectionKey || 'devpanel.collections',
    now,
  };
  if (options.collectionStorageInput || options.storage) {
    collectionStorageOptions.storage = options.collectionStorageInput || options.storage;
  }
  const collectionStorage = options.collectionStorage || createCollectionStorage(collectionStorageOptions);

  let request = defaultRequest();
  let sending = false;
  let abortController = null;
  let response = null;
  let error = null;
  let status = 'Ready';
  let lastBuiltRequest = null;
  let history = [];
  let collections = [];
  let selectedCollectionId = null;

  function refreshHistory() {
    const result = historyStorage.list();
    if (result.ok) {
      history = result.items || [];
    }
    return result;
  }

  function refreshCollections() {
    const result = collectionStorage.list();
    if (result.ok) {
      collections = result.collections || [];
    }
    return result;
  }

  refreshHistory();
  refreshCollections();

  function getRequest() {
    return clone(request);
  }

  function setRequest(next) {
    if (!isPlainObject(next)) {
      return { ok: false, error: 'Request harus berupa objek.' };
    }
    request = {
      method: typeof next.method === 'string' ? next.method.toUpperCase() : request.method,
      url: typeof next.url === 'string' ? next.url : request.url,
      queryParams: Array.isArray(next.queryParams) ? clone(next.queryParams) : request.queryParams,
      headers: Array.isArray(next.headers) ? clone(next.headers) : request.headers,
      body: typeof next.body === 'string' ? next.body : request.body,
      timeoutMs: Number.isInteger(next.timeoutMs) ? next.timeoutMs : request.timeoutMs,
    };
    return { ok: true, request: getRequest() };
  }

  function updateField(field, value) {
    if (field === 'method') return setRequest({ ...request, method: value });
    if (field === 'url') return setRequest({ ...request, url: value });
    if (field === 'body') return setRequest({ ...request, body: value });
    if (field === 'timeoutMs') return setRequest({ ...request, timeoutMs: value });
    return { ok: false, error: 'Field tidak didukung.' };
  }

  async function send() {
    if (sending) {
      return { ok: false, error: 'Request sedang berjalan.' };
    }
    const built = buildRequest(request);
    if (!built.ok) {
      status = 'Request invalid';
      error = { type: 'validation-error', error: built.errors.join(' '), errors: built.errors };
      response = null;
      return { ok: false, type: 'validation-error', errors: built.errors };
    }

    sending = true;
    status = 'Sending...';
    error = null;
    response = null;
    lastBuiltRequest = built.request;
    abortController = typeof AbortController === 'function' ? new AbortController() : null;

    const result = await httpSend(built.request, {
      fetchImpl,
      signal: abortController ? abortController.signal : undefined,
    });
    sending = false;
    const currentController = abortController;
    abortController = null;

    if (result.ok) {
      response = result;
      error = null;
      status = result.httpOk ? 'Response received' : `HTTP ${result.status}`;
      const summary = {
        status: result.status,
        statusText: result.statusText,
        httpOk: result.httpOk,
        durationMs: result.durationMs,
        bodySize: result.bodySize,
        truncated: result.truncated,
      };
      const historyResult = historyStorage.add(built.request, summary);
      if (!historyResult.ok) {
        status = `${status}; history save failed`;
      }
      refreshHistory();
    } else {
      response = null;
      error = result;
      if (result.type === 'aborted') {
        status = 'Request cancelled';
      } else if (result.type === 'timeout') {
        status = 'Request timed out';
      } else {
        status = result.error || 'Request failed';
      }
    }

    return result;
  }

  function cancel() {
    if (!sending || !abortController) {
      return { ok: false, error: 'Tidak ada request aktif.' };
    }
    try {
      abortController.abort();
    } catch {
      // Ignore abort errors.
    }
    sending = false;
    status = 'Request cancelled';
    return { ok: true };
  }

  function loadHistoryItem(id) {
    const item = history.find((entry) => entry.id === id);
    if (!item) {
      return { ok: false, error: 'History item tidak ditemukan.' };
    }
    setRequest(item.request);
    response = null;
    error = null;
    status = 'Loaded from history';
    return { ok: true, request: getRequest() };
  }

  function deleteHistoryItem(id) {
    const result = historyStorage.remove(id);
    refreshHistory();
    return result;
  }

  function clearHistory() {
    const result = historyStorage.clear();
    refreshHistory();
    return result;
  }

  function saveCollection(name) {
    const collection = {
      id: name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || `collection-${Date.now()}`,
      name: name.trim(),
      createdAt: now(),
      updatedAt: now(),
      requests: [clone(lastBuiltRequest || buildRequest(request).request)],
    };
    // lastBuiltRequest may be null if not sent; build validated request instead
    if (!lastBuiltRequest) {
      const built = buildRequest(request);
      if (!built.ok) {
        return { ok: false, error: built.errors.join(' ') };
      }
      collection.requests = [built.request];
    }
    const result = collectionStorage.save(collection);
    refreshCollections();
    return result;
  }

  function loadCollectionRequest(collectionId, index = 0) {
    const collection = collections.find((item) => item.id === collectionId);
    if (!collection || !Array.isArray(collection.requests) || !collection.requests[index]) {
      return { ok: false, error: 'Request collection tidak ditemukan.' };
    }
    setRequest(collection.requests[index]);
    response = null;
    error = null;
    status = 'Loaded from collection';
    return { ok: true, request: getRequest() };
  }

  function deleteCollection(id) {
    const result = collectionStorage.remove(id);
    refreshCollections();
    if (selectedCollectionId === id) {
      selectedCollectionId = null;
    }
    return result;
  }

  function importCollections(text) {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (parseError) {
      return { ok: false, error: `JSON import tidak valid: ${parseError.message}` };
    }
    const result = collectionStorage.importCollections(parsed);
    refreshCollections();
    return result;
  }

  function exportCollections() {
    return collectionStorage.exportCollections();
  }

  function inspectCurrentResponse() {
    return inspectResponse(response || error, {});
  }

  function getStatus() {
    return {
      sending,
      status,
      error: error ? clone(error) : null,
      response: response ? clone(response) : null,
      inspectedResponse: response || error ? inspectResponse(response || error, {}) : null,
      request: getRequest(),
      history: clone(history),
      collections: clone(collections),
      selectedCollectionId,
    };
  }

  return {
    getRequest,
    setRequest,
    updateField,
    send,
    cancel,
    loadHistoryItem,
    deleteHistoryItem,
    clearHistory,
    saveCollection,
    loadCollectionRequest,
    deleteCollection,
    importCollections,
    exportCollections,
    inspectCurrentResponse,
    getStatus,
    refreshHistory,
    refreshCollections,
  };
}