import assert from 'node:assert/strict';
import test from 'node:test';

process.env.NODE_ENV = 'test';

const requiredIds = [
  'app-status', 'error-region', 'error-message', 'error-dismiss', 'file-input', 'import-button',
  'empty-import-button', 'replace-button', 'export-button', 'empty-state', 'canvas-shell',
  'canvas-scroll', 'canvas-frame', 'preview-canvas', 'processing-overlay', 'processing-text',
  'drop-indicator', 'image-badge', 'source-empty', 'image-meta', 'meta-name', 'meta-type',
  'meta-dimensions', 'meta-size', 'meta-output', 'reset-filters', 'reset-button', 'undo-button',
  'redo-button', 'before-button', 'compare-status', 'zoom-out', 'zoom-in', 'zoom-fit', 'zoom-value',
  'format-select', 'jpeg-quality-control', 'jpeg-quality', 'jpeg-quality-value', 'export-note',
  'export-dimensions', 'preview-size', 'last-action', 'canvas-caption', 'workspace-stage',
];

const elements = new Map();

function makeContext() {
  return {
    filter: '',
    imageSmoothingEnabled: false,
    imageSmoothingQuality: '',
    fillStyle: '',
    save() {},
    restore() {},
    clearRect() {},
    fillRect() {},
    translate() {},
    rotate() {},
    scale() {},
    drawImage() {},
  };
}

function makeElement(tag = 'div', id = '') {
  const element = {
    tagName: String(tag).toUpperCase(),
    id,
    hidden: false,
    disabled: false,
    value: '',
    textContent: '',
    className: '',
    dataset: {},
    style: {},
    classList: {
      toggle() {},
      add() {},
      remove() {},
      contains() { return false; },
    },
    attributes: {},
    setAttribute(name, value) { this.attributes[name] = String(value); },
    getAttribute(name) { return this.attributes[name] ?? null; },
    addEventListener() {},
    removeEventListener() {},
    appendChild() {},
    append() {},
    remove() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    focus() {},
    blur() {},
    click() {},
  };

  if (tag === 'canvas') {
    element.getContext = () => makeContext();
  }
  if (id === 'format-select') element.value = 'png';
  if (id === 'jpeg-quality') element.value = '92';
  if (id === 'file-input') element.files = [];
  return element;
}

function getElementById(id) {
  if (!elements.has(id)) elements.set(id, makeElement('div', id));
  return elements.get(id);
}

globalThis.document = {
  getElementById,
  createElement(tag) { return makeElement(tag); },
  querySelector(selector) { return null; },
  querySelectorAll() { return []; },
  body: { append() {} },
  documentElement: { scrollWidth: 0, clientWidth: 1000 },
};

globalThis.window = {
  addEventListener() {},
  requestAnimationFrame(callback) { return setTimeout(() => callback(), 0); },
  matchMedia() { return { matches: false }; },
  location: { href: 'http://localhost/' },
};

globalThis.URL = {
  createObjectURL() { return 'blob:test'; },
  revokeObjectURL() {},
};

let closeCount = 0;
let createImageBitmapImpl = () => ({ width: 4, height: 3, close() { closeCount += 1; } });

globalThis.createImageBitmap = (file, options) => createImageBitmapImpl(file, options);

// Import app after the DOM shim is installed.
await import('../js/app.js');
const api = globalThis.__pixelforgeTest;
assert.ok(api, 'Test seam __pixelforgeTest harus tersedia');

function makePngFile(name = 'image.png') {
  return {
    name,
    type: 'image/png',
    size: 10,
  };
}

function makeBitmap(width = 4, height = 3) {
  return { width, height, close() { closeCount += 1; } };
}

test('PF-006: decode gambar baru gagal mempertahankan sesi lama', async () => {
  closeCount = 0;
  createImageBitmapImpl = () => makeBitmap(4, 3);
  await api.handleFiles([makePngFile('old.png')]);
  assert.equal(api.getState().filters.brightness, 100);
  assert.equal(api.getHistory().canUndo, false);

  createImageBitmapImpl = () => { throw new Error('decode failed'); };
  await api.handleFiles([makePngFile('new.png')]);

  assert.equal(api.getSource().width, 4);
  assert.equal(api.getSource().height, 3);
  assert.equal(api.getHistory().canUndo, false);
  assert.equal(api.getShowOriginal(), false);
});

test('PF-006: render gambar baru gagal mempertahankan sesi lama dan membersihkan bitmap sementara', async () => {
  closeCount = 0;
  createImageBitmapImpl = () => makeBitmap(4, 3);
  await api.handleFiles([makePngFile('old.png')]);
  const oldCloseCount = closeCount;

  createImageBitmapImpl = () => makeBitmap(5, 4);
  const originalCreateElement = document.createElement;
  document.createElement = (tag) => {
    const element = originalCreateElement(tag);
    if (tag === 'canvas') {
      element.getContext = () => null;
    }
    return element;
  };

  await api.handleFiles([makePngFile('new.png')]);
  document.createElement = originalCreateElement;

  assert.equal(api.getSource().width, 4);
  assert.equal(api.getSource().height, 3);
  assert.equal(api.getHistory().canUndo, false);
  assert.equal(closeCount, oldCloseCount + 1);
});

test('PF-006: import berhasil mengaktifkan sesi baru dan melepas bitmap lama', async () => {
  closeCount = 0;
  createImageBitmapImpl = () => makeBitmap(4, 3);
  await api.handleFiles([makePngFile('old.png')]);
  const oldCloseCount = closeCount;

  createImageBitmapImpl = () => makeBitmap(6, 5);
  await api.handleFiles([makePngFile('new.png')]);

  assert.equal(api.getSource().width, 6);
  assert.equal(api.getSource().height, 5);
  assert.equal(api.getHistory().canUndo, false);
  assert.equal(closeCount, oldCloseCount + 1);
});