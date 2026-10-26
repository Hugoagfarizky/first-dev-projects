import assert from 'node:assert/strict';
import test from 'node:test';

process.env.NODE_ENV = 'test';

const requiredIds = [
  'app-status', 'diagram-info', 'inspector', 'empty-state', 'diagram-canvas', 'import-file',
  'add-startEnd', 'add-process', 'add-decision', 'add-inputOutput', 'connect-mode',
  'delete-selection', 'undo', 'redo', 'zoom-in', 'zoom-out', 'fit-view', 'reset-zoom',
  'pan-mode', 'new-diagram', 'import-json', 'export-json',
];

const elements = new Map();

function makeContext() {
  return {
    filter: '',
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
    attributes: {},
    children: [],
    parentNode: null,
    setAttribute(name, value) { this.attributes[name] = String(value); },
    getAttribute(name) { return this.attributes[name] ?? null; },
    addEventListener() {},
    removeEventListener() {},
    appendChild(child) { this.children.push(child); child.parentNode = this; return child; },
    removeChild(child) {
      const index = this.children.indexOf(child);
      if (index >= 0) this.children.splice(index, 1);
      child.parentNode = null;
      return child;
    },
    remove() { if (this.parentNode) this.parentNode.removeChild(this); },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    focus() {},
    blur() {},
    click() {},
    getScreenCTM() {
      return {
        a: 1, b: 0, c: 0, d: 1, e: 0, f: 0,
        inverse() { return this; },
      };
    },
    createSVGPoint() {
      return {
        x: 0,
        y: 0,
        matrixTransform(matrix) {
          return {
            x: (this.x - matrix.e) / matrix.a,
            y: (this.y - matrix.f) / matrix.d,
          };
        },
      };
    },
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 800, height: 450 };
    },
    classList: {
      add() {},
      remove() {},
      toggle() { return false; },
      contains() { return false; },
    },
  };

  if (tag === 'canvas') {
    element.getContext = () => makeContext();
  }
  if (tag === 'svg') {
    element.setAttribute('viewBox', '0 0 1600 900');
  }
  if (id === 'import-file') {
    element.files = [];
    element.click = () => {};
  }
  return element;
}

function getElementById(id) {
  if (!elements.has(id)) elements.set(id, makeElement('div', id));
  return elements.get(id);
}

globalThis.document = {
  getElementById,
  createElement(tag) { return makeElement(tag); },
  createElementNS(ns, tag) { return makeElement(tag); },
  querySelector() { return null; },
  querySelectorAll() { return []; },
  body: { appendChild(child) { return child; } },
  documentElement: { scrollWidth: 0, clientWidth: 1000 },
  activeElement: null,
};

globalThis.window = {
  confirm: () => true,
  addEventListener() {},
  removeEventListener() {},
  setTimeout,
  clearTimeout,
  location: { href: 'http://localhost/' },
};

globalThis.URL = {
  createObjectURL() { return 'blob:test'; },
  revokeObjectURL() {},
};

globalThis.Blob = class Blob {
  constructor(parts = [], options = {}) {
    this.parts = parts;
    this.type = options.type ?? '';
    this.size = parts.reduce((sum, part) => sum + String(part).length, 0);
  }
};

class MockFileReader {
  constructor() {
    this.result = '';
    this.onload = null;
    this.onerror = null;
  }
  readAsText(file) {
    this.result = file.text ?? '';
    if (typeof this.onload === 'function') {
      this.onload({ target: this });
    }
  }
}

globalThis.FileReader = MockFileReader;

class MockStorage {
  constructor() {
    this.data = new Map();
  }
  getItem(key) {
    return this.data.has(key) ? this.data.get(key) : null;
  }
  setItem(key, value) {
    this.data.set(key, value);
  }
  removeItem(key) {
    this.data.delete(key);
  }
}

const storage = new MockStorage();
Object.defineProperty(globalThis, 'localStorage', {
  value: storage,
  writable: true,
  configurable: true,
});

await import('../js/app.js');

const api = globalThis.__diagramforgeTest;
assert.ok(api, 'Test seam __diagramforgeTest harus tersedia');

test('startup dengan storage kosong membuat diagram baru', () => {
  const controller = api.getController();
  assert.equal(controller.diagram.nodes.length, 0);
  assert.equal(controller.diagram.edges.length, 0);
  assert.match(api.getSaveStatus(), /Belum tersimpan/);
});

test('createNewDiagram mereset state dan menyimpan diagram', () => {
  const controller = api.getController();
  controller.addNode('process');
  assert.equal(controller.diagram.nodes.length, 1);

  const result = api.createNewDiagram();
  assert.equal(result, true);
  assert.equal(controller.diagram.nodes.length, 0);
  assert.equal(controller.diagram.edges.length, 0);
  assert.equal(controller.history.canUndo(), false);
  assert.match(api.getSaveStatus(), /Tersimpan/);
});

test('importDiagramText mengganti diagram hanya setelah validasi', async () => {
  const controller = api.getController();
  const { createDiagram, createNode, addNode } = await import('../js/diagram-model.js');
  const { exportDiagramJson } = await import('../js/import-export.js');

  const source = addNode(createDiagram({ name: 'Diagram impor' }), createNode('process', 10, 20, { text: 'Node impor' }));
  const json = exportDiagramJson(source);

  const result = api.importDiagramText(json);
  assert.equal(result, true);
  assert.equal(controller.diagram.name, 'Diagram impor');
  assert.equal(controller.diagram.nodes.length, 1);
  assert.equal(controller.diagram.nodes[0].text, 'Node impor');
  assert.equal(controller.history.canUndo(), false);
  assert.match(api.getSaveStatus(), /Tersimpan/);
});

test('importDiagramText menolak JSON invalid tanpa mengubah diagram aktif', () => {
  const controller = api.getController();
  const before = JSON.stringify(controller.diagram);

  assert.throws(() => api.importDiagramText('{bukan json'));
  assert.equal(JSON.stringify(controller.diagram), before);
  assert.match(api.getSaveStatus(), /Impor gagal/);
});

test('exportDiagramJson menghasilkan payload yang dapat diimpor kembali', async () => {
  const controller = api.getController();
  controller.addNode('process');
  const json = api.exportDiagramJson();
  const { importDiagramJson } = await import('../js/import-export.js');
  const imported = importDiagramJson(json);

  assert.equal(imported.nodes.length, controller.diagram.nodes.length);
  assert.equal(imported.nodes[0].type, 'process');
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test('autosave memulihkan node setelah reload', async () => {
  const api = globalThis.__diagramforgeTest;
  const controller = api.getController();
  api.cancelPendingAutosave();
  api.createNewDiagram();

  controller.addNode('process');
  const nodeId = controller.diagram.nodes[0].id;
  const { updateNode } = await import('../js/diagram-model.js');
  const next = updateNode(controller.diagram, nodeId, { text: 'Node uji', x: 120, y: 80, fill: '#ff0000' });
  controller.commitDiagram(next);

  await sleep(650);
  assert.match(api.getSaveStatus(), /Tersimpan/);

  api.loadStartup();
  const reloaded = api.getController();
  assert.equal(reloaded.diagram.nodes.length, 1);
  assert.equal(reloaded.diagram.nodes[0].text, 'Node uji');
  assert.equal(reloaded.diagram.nodes[0].x, 120);
  assert.equal(reloaded.diagram.nodes[0].y, 80);
  assert.equal(reloaded.diagram.nodes[0].fill, '#ff0000');
  assert.equal(reloaded.emptyStateEl.hidden, true);
});

test('autosave menyimpan perubahan edge, undo, redo, dan penghapusan', async () => {
  const api = globalThis.__diagramforgeTest;
  const controller = api.getController();
  api.cancelPendingAutosave();
  api.createNewDiagram();

  controller.addNode('process');
  controller.addNode('process');
  const [first, second] = controller.diagram.nodes;

  controller.startConnectMode();
  controller.handlePointerDown({ target: { dataset: { nodeId: first.id }, closest: () => ({ dataset: { nodeId: first.id } }) }, clientX: 0, clientY: 0, pointerId: 1 });
  controller.handlePointerDown({ target: { dataset: { nodeId: second.id }, closest: () => ({ dataset: { nodeId: second.id } }) }, clientX: 0, clientY: 0, pointerId: 1 });
  assert.equal(controller.diagram.edges.length, 1);

  controller.deleteSelection();
  assert.equal(controller.diagram.edges.length, 0);

  controller.undo();
  assert.equal(controller.diagram.edges.length, 1);

  controller.redo();
  assert.equal(controller.diagram.edges.length, 0);

  await sleep(650);
  assert.match(api.getSaveStatus(), /Tersimpan/);

  api.loadStartup();
  const reloaded = api.getController();
  assert.equal(reloaded.diagram.edges.length, 0);
  assert.equal(reloaded.diagram.nodes.length, 2);
});

test('empty state mengikuti jumlah node', () => {
  const api = globalThis.__diagramforgeTest;
  const controller = api.getController();
  api.cancelPendingAutosave();
  api.createNewDiagram();

  assert.equal(controller.emptyStateEl.hidden, false);
  controller.addNode('process');
  assert.equal(controller.emptyStateEl.hidden, true);
  controller.deleteSelection();
  assert.equal(controller.emptyStateEl.hidden, false);
});

test('storage rusak tidak ditimpa autosave', async () => {
  const api = globalThis.__diagramforgeTest;
  const controller = api.getController();
  const originalStorage = globalThis.localStorage;
  const invalidStorage = new MockStorage();
  invalidStorage.data.set('diagramforge.diagram', '{rusak');

  try {
    globalThis.localStorage = invalidStorage;
    api.cancelPendingAutosave();
    api.loadStartup();

    assert.match(api.getSaveStatus(), /Penyimpanan rusak/);
    const beforeRaw = invalidStorage.data.get('diagramforge.diagram');

    controller.addNode('process');
    await sleep(650);

    assert.equal(invalidStorage.data.get('diagramforge.diagram'), beforeRaw);
    assert.match(api.getSaveStatus(), /Penyimpanan rusak/);
  } finally {
    globalThis.localStorage = originalStorage;
    api.cancelPendingAutosave();
    api.loadStartup();
  }
});

test('timer autosave lama tidak menimpa diagram hasil impor', async () => {
  const api = globalThis.__diagramforgeTest;
  const controller = api.getController();
  api.cancelPendingAutosave();
  api.createNewDiagram();

  controller.addNode('process');

  const { createDiagram, createNode, addNode } = await import('../js/diagram-model.js');
  const { exportDiagramJson } = await import('../js/import-export.js');
  const source = addNode(createDiagram({ name: 'Diagram impor' }), createNode('process', 10, 20, { text: 'Node impor' }));
  const json = exportDiagramJson(source);

  const result = api.importDiagramText(json);
  assert.equal(result, true);

  await sleep(650);
  assert.equal(controller.diagram.name, 'Diagram impor');
  assert.equal(controller.diagram.nodes.length, 1);
  assert.equal(controller.diagram.nodes[0].text, 'Node impor');
  assert.match(api.getSaveStatus(), /Tersimpan/);
});

test('kegagalan baca storage sementara tidak memblokir save berikutnya', async () => {
  const api = globalThis.__diagramforgeTest;
  const originalStorage = globalThis.localStorage;
  const failingStorage = {
    getItem() {
      throw new Error('getItem sementara gagal');
    },
    setItem(key, value) {
      this.data.set(key, value);
    },
    removeItem(key) {
      this.data.delete(key);
    },
    data: new Map(),
  };

  try {
    globalThis.localStorage = failingStorage;
    api.loadStartup();

    assert.match(api.getSaveStatus(), /Gagal memuat/);

    globalThis.localStorage = originalStorage;
    const result = api.createNewDiagram();

    assert.equal(result, true);
    assert.match(api.getSaveStatus(), /Tersimpan/);
  } finally {
    globalThis.localStorage = originalStorage;
  }
});
