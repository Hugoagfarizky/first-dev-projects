import { renderKeyValueTable, renderResponse, renderStatus } from './ui.js';
import { createWorkbenchController } from './workbench-controller.js';

const state = {
  activeView: 'request',
  queryRows: [{ id: 1, key: '', value: '', enabled: true }],
  headerRows: [{ id: 1, key: '', value: '' }],
  rowCounter: 2,
};

let controller = null;

const elements = {};

function $(id) {
  return document.getElementById(id);
}

function renderQueryRows() {
  renderKeyValueTable(elements.queryBody, state.queryRows, {
    showEnabled: true,
    onKeyChange: (id, value) => { const row = state.queryRows.find((item) => item.id === id); if (row) row.key = value; collectRows(); },
    onValueChange: (id, value) => { const row = state.queryRows.find((item) => item.id === id); if (row) row.value = value; collectRows(); },
    onEnabledChange: (id, value) => { const row = state.queryRows.find((item) => item.id === id); if (row) row.enabled = value; collectRows(); },
    onRemove: (id) => { state.queryRows = state.queryRows.filter((item) => item.id !== id); renderQueryRows(); collectRows(); },
  });
}

function renderHeaderRows() {
  renderKeyValueTable(elements.headerBody, state.headerRows, {
    showEnabled: false,
    onKeyChange: (id, value) => { const row = state.headerRows.find((item) => item.id === id); if (row) row.key = value; collectRows(); },
    onValueChange: (id, value) => { const row = state.headerRows.find((item) => item.id === id); if (row) row.value = value; collectRows(); },
    onRemove: (id) => { state.headerRows = state.headerRows.filter((item) => item.id !== id); renderHeaderRows(); collectRows(); },
  });
}

function renderResponsePanel() {
  const status = controller.getStatus();
  renderResponseView(status);
}

function renderResponseView(status) {
  const container = elements.responseContainer;
  if (!container) return;
  container.replaceChildren();
  if (status.sending) {
    const loading = document.createElement('p');
    loading.textContent = 'Mengirim request...';
    container.appendChild(loading);
    return;
  }
  if (status.error) {
    const error = document.createElement('p');
    error.className = 'error';
    error.textContent = status.error.error || status.status;
    container.appendChild(error);
    return;
  }
  if (!status.response) {
    const empty = document.createElement('p');
    empty.textContent = 'Belum ada respons.';
    container.appendChild(empty);
    return;
  }
  const inspected = status.inspectedResponse;
  const meta = document.createElement('div');
  meta.className = 'response-meta';
  const statusText = document.createElement('strong');
  statusText.textContent = `${inspected.status} ${inspected.statusText}`;
  const duration = document.createElement('span');
  duration.textContent = `${inspected.durationMs} ms`;
  const size = document.createElement('span');
  size.textContent = `${inspected.body.size} bytes`;
  meta.append(statusText, duration, size);
  container.appendChild(meta);

  if (inspected.body.truncated) {
    const warning = document.createElement('p');
    warning.className = 'warning';
    warning.textContent = 'Respons terpotong karena melebihi batas ukuran.';
    container.appendChild(warning);
  }

  const headersTitle = document.createElement('h3');
  headersTitle.textContent = 'Response headers';
  container.appendChild(headersTitle);
  const headers = document.createElement('pre');
  headers.textContent = inspected.headerEntries.map((entry) => `${entry.name}: ${entry.value}`).join('\n');
  container.appendChild(headers);

  const bodyTitle = document.createElement('h3');
  bodyTitle.textContent = 'Response body';
  container.appendChild(bodyTitle);
  const body = document.createElement('pre');
  body.textContent = inspected.body.formatted || inspected.body.raw || '';
  container.appendChild(body);
}

function renderHistory() {
  const container = elements.historyContainer;
  if (!container) return;
  container.replaceChildren();
  const status = controller.getStatus();
  for (const item of status.history) {
    const article = document.createElement('article');
    const title = document.createElement('strong');
    title.textContent = `${item.request.method} ${item.request.url}`;
    const loadButton = document.createElement('button');
    loadButton.type = 'button';
    loadButton.textContent = 'Muat';
    loadButton.addEventListener('click', () => {
      controller.loadHistoryItem(item.id);
      syncFormFromRequest();
      setActiveView('request');
      renderAll();
    });
    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'secondary';
    deleteButton.textContent = 'Hapus';
    deleteButton.addEventListener('click', () => {
      controller.deleteHistoryItem(item.id);
      renderAll();
    });
    article.append(title, loadButton, deleteButton);
    container.appendChild(article);
  }
}

function renderCollections() {
  const container = elements.collectionContainer;
  if (!container) return;
  container.replaceChildren();
  const status = controller.getStatus();
  for (const collection of status.collections) {
    const article = document.createElement('article');
    const title = document.createElement('strong');
    title.textContent = collection.name;
    article.appendChild(title);
    for (const [index, request] of collection.requests.entries()) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'secondary';
      button.textContent = `${request.method} ${request.url}`;
      button.addEventListener('click', () => {
        controller.loadCollectionRequest(collection.id, index);
        syncFormFromRequest();
        setActiveView('request');
        renderAll();
      });
      article.appendChild(button);
    }
    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'secondary';
    deleteButton.textContent = 'Hapus collection';
    deleteButton.addEventListener('click', () => {
      controller.deleteCollection(collection.id);
      renderAll();
    });
    article.appendChild(deleteButton);
    container.appendChild(article);
  }
}

function syncFormFromRequest() {
  const request = controller.getRequest();
  if (elements.method) elements.method.value = request.method;
  if (elements.url) elements.url.value = request.url;
  if (elements.timeout) elements.timeout.value = String(request.timeoutMs);
  if (elements.body) elements.body.value = request.body || '';
  state.queryRows = request.queryParams.map((item, index) => ({ id: index + 1, ...item }));
  state.headerRows = request.headers.map((item, index) => ({ id: index + 1, ...item }));
  if (state.queryRows.length === 0) state.queryRows = [{ id: 1, key: '', value: '', enabled: true }];
  if (state.headerRows.length === 0) state.headerRows = [{ id: 1, key: '', value: '' }];
  state.rowCounter = Math.max(state.queryRows.length, state.headerRows.length) + 1;
  renderQueryRows();
  renderHeaderRows();
}

function collectRows() {
  controller.setRequest({
    method: elements.method?.value || 'GET',
    url: elements.url?.value || '',
    timeoutMs: Number.parseInt(elements.timeout?.value || '10000', 10),
    queryParams: state.queryRows
      .filter((row) => String(row.key || '').trim() !== '')
      .map((row) => ({ key: row.key, value: row.value, enabled: row.enabled })),
    headers: state.headerRows
      .filter((row) => String(row.key || '').trim() !== '')
      .map((row) => ({ key: row.key, value: row.value })),
    body: elements.body?.value || '',
  });
}

function renderAll() {
  renderResponseView(controller.getStatus());
  renderHistory();
  renderCollections();
  const status = controller.getStatus();
  if (elements.appStatus) {
    elements.appStatus.textContent = status.status;
  }
}

function setActiveView(viewName) {
  state.activeView = viewName;
  for (const [name, element] of Object.entries(elements.views)) {
    if (element) element.hidden = name !== viewName;
  }
  for (const button of elements.tabs) {
    button.setAttribute('aria-selected', String(button.dataset.view === viewName));
  }
  renderAll();
}

function initializeElements() {
  elements.appStatus = document.getElementById('app-status');
  elements.method = document.getElementById('request-method');
  elements.url = document.getElementById('request-url');
  elements.timeout = document.getElementById('request-timeout');
  elements.body = document.getElementById('request-body');
  elements.queryBody = document.getElementById('query-body');
  elements.headerBody = document.getElementById('header-body');
  elements.responseContainer = document.getElementById('response-container');
  elements.historyContainer = document.getElementById('history-container');
  elements.collectionContainer = document.getElementById('collection-container');
  elements.validationMessage = document.getElementById('validation-message');
  elements.tabs = Array.from(document.querySelectorAll('.tab-button'));
  elements.views = {
    request: document.getElementById('view-request'),
    history: document.getElementById('view-history'),
    collections: document.getElementById('view-collections'),
  };
  elements.sendButton = document.getElementById('send-button');
  elements.cancelButton = document.getElementById('cancel-button');
  elements.addButtonQuery = document.getElementById('add-query');
  elements.addButtonHeader = document.getElementById('add-header');
  elements.clearHistory = document.getElementById('clear-history');
  elements.saveCollection = document.getElementById('save-collection');
  elements.exportCollections = document.getElementById('export-collections');
  elements.importCollections = document.getElementById('import-collections');
  elements.collectionName = document.getElementById('collection-name');
}

function initializeEvents() {
  elements.method?.addEventListener('change', collectRows);
  elements.url?.addEventListener('input', collectRows);
  elements.timeout?.addEventListener('input', collectRows);
  elements.body?.addEventListener('input', collectRows);

  elements.addButtonQuery?.addEventListener('click', () => {
    state.queryRows.push({ id: state.rowCounter++, key: '', value: '', enabled: true });
    renderQueryRows();
    collectRows();
  });
  elements.addButtonHeader?.addEventListener('click', () => {
    state.headerRows.push({ id: state.rowCounter++, key: '', value: '' });
    renderHeaderRows();
    collectRows();
  });

  elements.sendButton?.addEventListener('click', async () => {
    collectRows();
    const result = await controller.send();
    if (elements.validationMessage) {
      elements.validationMessage.textContent = result.ok
        ? 'Request selesai.'
        : (Array.isArray(result.errors) ? result.errors.join(' ') : (result.error || 'Request gagal.'));
    }
    renderAll();
  });
  elements.cancelButton?.addEventListener('click', () => {
    controller.cancel();
    renderAll();
  });

  elements.clearHistory?.addEventListener('click', () => {
    controller.clearHistory();
    renderAll();
  });

  elements.saveCollection?.addEventListener('click', () => {
    const name = elements.collectionName?.value || '';
    const result = controller.saveCollection(name);
    if (elements.validationMessage) {
      elements.validationMessage.textContent = result.ok ? 'Collection disimpan.' : result.error;
    }
    renderAll();
  });

  elements.exportCollections?.addEventListener('click', () => {
    const result = controller.exportCollections();
    if (result.ok) {
      const blob = new Blob([JSON.stringify(result.collections, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'devpanel-collections.json';
      link.click();
      URL.revokeObjectURL(url);
    }
  });

  elements.importCollections?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const result = controller.importCollections(text);
    if (elements.validationMessage) {
      elements.validationMessage.textContent = result.ok ? 'Import berhasil.' : result.error;
    }
    renderAll();
    event.target.value = '';
  });

  for (const button of elements.tabs) {
    button.dataset.view = button.id.replace('tab-', '');
    button.addEventListener('click', () => setActiveView(button.dataset.view));
  }
}

async function initializeApp() {
  controller = createWorkbenchController();
  initializeElements();
  initializeEvents();
  renderQueryRows();
  renderHeaderRows();
  collectRows();
  setActiveView('request');
  renderAll();
}

if (typeof document !== 'undefined') {
  void initializeApp();
}

export { initializeApp, createWorkbenchController, controller };