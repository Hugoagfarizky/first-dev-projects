import { createDiagram } from './diagram-model.js';
import { DiagramHistory } from './history.js';
import { loadDiagram, saveDiagram } from './storage.js';
import { exportDiagramJson, importDiagramJson, IMPORT_SIZE_LIMIT } from './import-export.js';
import { exportDiagramSvg, exportDiagramPng, createExportFilename, downloadBlob } from './visual-export.js';
import { DiagramController } from './canvas-controller.js';

const AUTOSAVE_DELAY = 500;

let controller = null;
let autosaveTimer = null;
let autosaveToken = 0;
let pendingAutosaveDiagram = null;
let storageBlocked = false;
let storageAvailable = true;
let saveStatusText = 'Memuat...';

function clone(value) {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function deepEqual(a, b) {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

function statusElement() {
  return document.getElementById('app-status');
}

function setSaveStatus(text) {
  saveStatusText = text;
  if (controller) {
    controller.updateStatus();
  } else if (statusElement()) {
    statusElement().textContent = text;
  }
}

function cancelPendingAutosave() {
  autosaveToken += 1;
  if (autosaveTimer !== null) {
    clearTimeout(autosaveTimer);
    autosaveTimer = null;
  }
  pendingAutosaveDiagram = null;
}

function scheduleAutosave(diagram) {
  if (storageBlocked || !storageAvailable) {
    setSaveStatus(storageBlocked ? 'Penyimpanan rusak: autosave dinonaktifkan' : 'Penyimpanan tidak tersedia');
    return;
  }

  const payload = clone(diagram);
  cancelPendingAutosave();
  pendingAutosaveDiagram = payload;
  const token = ++autosaveToken;
  autosaveTimer = setTimeout(() => {
    if (token !== autosaveToken) {
      return;
    }
    const toSave = pendingAutosaveDiagram;
    pendingAutosaveDiagram = null;
    if (!toSave) {
      return;
    }
    setSaveStatus('Menyimpan...');
    const result = saveDiagram(toSave);
    if (result.ok) {
      setSaveStatus('Tersimpan');
    } else {
      setSaveStatus(`Gagal menyimpan: ${result.error}`);
    }
  }, AUTOSAVE_DELAY);

  setSaveStatus('Menyimpan...');
}

function attachHistory(targetController) {
  const history = targetController.history;
  const originalPush = history.push.bind(history);
  const originalUndo = history.undo.bind(history);
  const originalRedo = history.redo.bind(history);
  const originalSetViewport = targetController.setViewport.bind(targetController);

  history.push = (snapshot) => {
    const result = originalPush(snapshot);
    if (result) {
      scheduleAutosave(snapshot);
    }
    return result;
  };
  history.undo = () => {
    const result = originalUndo();
    if (result) {
      scheduleAutosave(result);
    }
    return result;
  };
  history.redo = () => {
    const result = originalRedo();
    if (result) {
      scheduleAutosave(result);
    }
    return result;
  };
  targetController.setViewport = (viewport) => {
    originalSetViewport(viewport);
    scheduleAutosave(targetController.diagram);
  };
}

function resetControllerState(targetController, diagram, statusText) {
  targetController.diagram = diagram;
  targetController.history = new DiagramHistory(diagram);
  attachHistory(targetController);
  targetController.selection = null;
  targetController.connectMode = false;
  targetController.connectSourceId = null;
  targetController.renderAll();
  setSaveStatus(statusText);
}

function loadStartup() {
  cancelPendingAutosave();
  const loaded = loadDiagram();

  if (loaded.status === 'loaded') {
    storageBlocked = false;
    storageAvailable = true;
    resetControllerState(controller, loaded.diagram, 'Tersimpan');
    return loaded;
  }

  if (loaded.status === 'empty') {
    storageBlocked = false;
    storageAvailable = true;
    const diagram = createDiagram();
    resetControllerState(controller, diagram, 'Belum tersimpan');
    return loaded;
  }

  storageAvailable = loaded.status !== 'unavailable';
  storageBlocked = loaded.status === 'invalid' || loaded.status === 'unavailable';
  const diagram = createDiagram();
  resetControllerState(controller, diagram, loaded.status === 'invalid'
    ? 'Penyimpanan rusak: autosave dinonaktifkan'
    : loaded.status === 'unavailable'
      ? 'Penyimpanan tidak tersedia'
      : `Gagal memuat: ${loaded.error}`);
  return loaded;
}

function createNewDiagram() {
  if (controller.diagram.nodes.length > 0 || controller.diagram.edges.length > 0) {
    if (!window.confirm('Buat diagram baru? Diagram saat ini akan diganti.')) {
      setSaveStatus('Pembuatan diagram baru dibatalkan.');
      return false;
    }
  }

  cancelPendingAutosave();
  storageBlocked = !storageAvailable;
  const diagram = createDiagram();
  resetControllerState(controller, diagram, storageAvailable ? 'Menyimpan...' : 'Penyimpanan tidak tersedia');

  if (storageAvailable) {
    const result = saveDiagram(diagram);
    setSaveStatus(result.ok ? 'Tersimpan' : `Gagal menyimpan: ${result.error}`);
  }
  return true;
}

function importDiagramText(text) {
  let imported;
  try {
    imported = importDiagramJson(text);
  } catch (error) {
    setSaveStatus(`Impor gagal: ${error?.message ?? 'kesalahan tidak diketahui'}.`);
    throw error;
  }

  if (controller.diagram.nodes.length > 0 || controller.diagram.edges.length > 0) {
    if (!window.confirm('Ganti diagram dengan file impor?')) {
      setSaveStatus('Impor dibatalkan.');
      return false;
    }
  }

  cancelPendingAutosave();
  storageBlocked = !storageAvailable;
  resetControllerState(controller, imported, storageAvailable ? 'Menyimpan...' : 'Penyimpanan tidak tersedia');

  if (storageAvailable) {
    const result = saveDiagram(imported);
    setSaveStatus(result.ok ? 'Tersimpan' : `Gagal menyimpan: ${result.error}`);
  }
  return true;
}

function handleImportFile(file) {
  if (!file) {
    return;
  }
  if (file.size > IMPORT_SIZE_LIMIT) {
    setSaveStatus(`Impor gagal: ukuran file melebihi ${IMPORT_SIZE_LIMIT} byte.`);
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    try {
      importDiagramText(reader.result);
    } catch (error) {
      setSaveStatus(`Impor gagal: ${error?.message ?? 'kesalahan tidak diketahui'}.`);
    }
  };
  reader.onerror = () => {
    setSaveStatus('Impor gagal: file tidak dapat dibaca.');
  };
  reader.readAsText(file);
}

function exportDiagramJsonFile() {
  try {
    const json = exportDiagramJson(controller.diagram);
    const blob = new Blob([json], { type: 'application/json' });
    if (!blob || blob.size === 0) {
      throw new Error('Blob ekspor tidak valid.');
    }

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `diagramforge-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);

    setSaveStatus('Ekspor JSON siap diunduh.');
  } catch (error) {
    setSaveStatus(`Ekspor gagal: ${error?.message ?? 'kesalahan tidak diketahui'}.`);
  }
}

function exportSvgFile() {
  try {
    const svg = exportDiagramSvg(controller.diagram);
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    if (!blob || blob.size === 0) {
      throw new Error('Blob SVG tidak valid.');
    }
    downloadBlob(blob, createExportFilename('svg'));
    setSaveStatus('Ekspor SVG siap diunduh.');
  } catch (error) {
    setSaveStatus(`Ekspor SVG gagal: ${error?.message ?? 'kesalahan tidak diketahui'}.`);
  }
}

async function exportPngFile() {
  try {
    setSaveStatus('Mengekspor PNG...');
    const blob = await exportDiagramPng(controller.diagram);
    if (!blob || blob.size === 0) {
      throw new Error('Blob PNG tidak valid.');
    }
    downloadBlob(blob, createExportFilename('png'));
    setSaveStatus('Ekspor PNG siap diunduh.');
  } catch (error) {
    setSaveStatus(`Ekspor PNG gagal: ${error?.message ?? 'kesalahan tidak diketahui'}.`);
  }
}

function initializeApp() {
  const svg = document.getElementById('diagram-canvas');
  const status = document.getElementById('app-status');
  const info = document.getElementById('diagram-info');
  const inspector = document.getElementById('inspector');
  const emptyState = document.getElementById('empty-state');

  const buttons = {
    addStartEnd: document.getElementById('add-startEnd'),
    addProcess: document.getElementById('add-process'),
    addDecision: document.getElementById('add-decision'),
    addInputOutput: document.getElementById('add-inputOutput'),
    connect: document.getElementById('connect-mode'),
    delete: document.getElementById('delete-selection'),
    undo: document.getElementById('undo'),
    redo: document.getElementById('redo'),
    zoomIn: document.getElementById('zoom-in'),
    zoomOut: document.getElementById('zoom-out'),
    fit: document.getElementById('fit-view'),
    resetZoom: document.getElementById('reset-zoom'),
    pan: document.getElementById('pan-mode'),
    newDiagram: document.getElementById('new-diagram'),
    importJson: document.getElementById('import-json'),
    exportJson: document.getElementById('export-json'),
    exportSvg: document.getElementById('export-svg'),
    exportPng: document.getElementById('export-png'),
  };

  const fileInput = document.getElementById('import-file');

  controller = new DiagramController({
    svg,
    statusEl: status,
    infoEl: info,
    inspectorEl: inspector,
    emptyStateEl: emptyState,
    buttons,
    keyTarget: document,
  });

  const originalUpdateStatus = controller.updateStatus.bind(controller);
  controller.updateStatus = (message = '') => {
    originalUpdateStatus(message);
    if (status) {
      const suffix = saveStatusText ? ` | ${saveStatusText}` : '';
      if (suffix && !status.textContent.endsWith(suffix)) {
        status.textContent += suffix;
      }
    }
  };

  attachHistory(controller);

  buttons.addStartEnd?.addEventListener('click', () => controller.addNode('startEnd'));
  buttons.addProcess?.addEventListener('click', () => controller.addNode('process'));
  buttons.addDecision?.addEventListener('click', () => controller.addNode('decision'));
  buttons.addInputOutput?.addEventListener('click', () => controller.addNode('inputOutput'));
  buttons.connect?.addEventListener('click', () => controller.toggleConnectMode());
  buttons.delete?.addEventListener('click', () => controller.deleteSelection());
  buttons.undo?.addEventListener('click', () => controller.undo());
  buttons.redo?.addEventListener('click', () => controller.redo());
  buttons.zoomIn?.addEventListener('click', () => controller.zoomIn());
  buttons.zoomOut?.addEventListener('click', () => controller.zoomOut());
  buttons.fit?.addEventListener('click', () => controller.fitToView());
  buttons.resetZoom?.addEventListener('click', () => controller.resetZoom());
  buttons.pan?.addEventListener('click', () => controller.togglePanMode());
  buttons.newDiagram?.addEventListener('click', createNewDiagram);
  buttons.exportJson?.addEventListener('click', exportDiagramJsonFile);
  buttons.exportSvg?.addEventListener('click', exportSvgFile);
  buttons.exportPng?.addEventListener('click', exportPngFile);
  buttons.importJson?.addEventListener('click', () => fileInput?.click());
  fileInput?.addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    handleImportFile(file);
    event.target.value = '';
  });

  window.addEventListener('pagehide', () => {
    cancelPendingAutosave();
  });

  loadStartup();

  if (typeof window !== 'undefined') {
    window.diagramController = controller;
  }
}

if (typeof document !== 'undefined') {
  initializeApp();
}

if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test') {
  globalThis.__diagramforgeTest = {
    createNewDiagram,
    importDiagramText,
    exportDiagramJson: () => (controller ? exportDiagramJson(controller.diagram) : null),
    loadStartup,
    getController: () => controller,
    getSaveStatus: () => saveStatusText,
    cancelPendingAutosave,
  };
}

export { initializeApp };
