import {
  EditorHistory,
  createDefaultState,
  getOutputDimensions,
  normalizeEditorState,
  resetEditorState,
  resetFilters,
  rotateLeft,
  rotateRight,
  toggleFlipX,
  toggleFlipY,
  updateFilter,
} from './editor-state.js';
import { createEditorControls } from './editor-controls.js';
import {
  createExportFilename,
  canvasToBlob,
  getExportFormat,
  revokeObjectUrlLater,
} from './exporter.js';
import {
  decodeImageFile,
  formatBytes,
  renderToCanvas,
} from './image-engine.js';

const PREVIEW_MAX_DIMENSION = 1600;
const ZOOM_MIN = 0.1;
const ZOOM_MAX = 4;
const ZOOM_FACTOR = 1.25;
const HISTORY_DEBOUNCE_MS = 260;

const controls = createEditorControls(document);
const objectUrls = new Set();

let sourceBitmap = null;
let sourceInfo = null;
let state = createDefaultState();
let history = null;
let showOriginal = false;
let zoomMode = 'fit';
let zoom = 1;
let currentPlan = null;
let previewFrame = null;
let historyTimer = null;
let busy = false;
let dragDepth = 0;

function hasImage() {
  return Boolean(sourceBitmap && sourceInfo);
}

function typeLabel(type) {
  if (type === 'image/png') return 'PNG';
  if (type === 'image/jpeg') return 'JPEG';
  if (type === 'image/webp') return 'WebP';
  return type || 'Tidak diketahui';
}

function setStatus(message, tone = 'info') {
  controls.setStatus(message, tone);
}

function showError(message) {
  controls.showError(message);
  setStatus('Terjadi kesalahan. Lihat pesan.', 'error');
}

function setLastAction(message) {
  controls.setLastAction(message);
}

function cancelPendingHistory() {
  if (historyTimer) {
    clearTimeout(historyTimer);
    historyTimer = null;
  }
}

function flushPendingHistory() {
  cancelPendingHistory();
  if (!history) return false;
  const added = history.record(state);
  if (added) {
    controls.renderHistory(history);
    setLastAction('Perubahan filter dicatat dalam riwayat.');
  }
  return added;
}

function scheduleHistoryCommit() {
  if (!history) return;
  cancelPendingHistory();
  historyTimer = setTimeout(() => {
    historyTimer = null;
    if (history.record(state)) {
      controls.renderHistory(history);
      setLastAction('Perubahan filter dicatat dalam riwayat.');
    }
  }, HISTORY_DEBOUNCE_MS);
}

function exitBeforeComparison() {
  if (!showOriginal) return;
  showOriginal = false;
  controls.setBeforeActive(false);
}

function updateHistoryControls() {
  controls.renderHistory(history);
}

function applyZoom(plan = currentPlan) {
  if (!hasImage() || !plan) return;
  const canvas = controls.elements.previewCanvas;
  if (zoomMode === 'fit') {
    canvas.style.width = '';
    canvas.style.height = '';
    controls.setZoom('fit');
    return;
  }

  canvas.style.width = `${Math.max(1, Math.round(plan.renderWidth * zoom))}px`;
  canvas.style.height = `${Math.max(1, Math.round(plan.renderHeight * zoom))}px`;
  controls.setZoom('manual', zoom);
}

function renderPreview() {
  if (!hasImage()) return;

  try {
    const renderState = showOriginal ? createDefaultState() : state;
    const plan = renderToCanvas(sourceBitmap, renderState, controls.elements.previewCanvas, {
      maxDimension: PREVIEW_MAX_DIMENSION,
      background: null,
    });
    currentPlan = plan;
    const output = getOutputDimensions(sourceInfo.width, sourceInfo.height, state.rotation);
    controls.renderOutputDimensions(output.width, output.height);
    controls.renderExportSettings(controls.getExportFormat().value, controls.getJpegQuality());

    const canvas = controls.elements.previewCanvas;
    if (showOriginal) {
      controls.setCanvasCaption(`Gambar asli • ${sourceInfo.width} × ${sourceInfo.height} px`);
      controls.setPreviewSize('Menampilkan gambar asli tanpa filter atau transformasi.');
      canvas.setAttribute('aria-label', 'Pratinjau gambar asli');
    } else {
      controls.setCanvasCaption(`Hasil edit • pratinjau ${plan.renderWidth} × ${plan.renderHeight} px`);
      controls.setPreviewSize(
        `Pratinjau ${plan.renderWidth} × ${plan.renderHeight} px dari hasil ${output.width} × ${output.height} px.`,
      );
      canvas.setAttribute('aria-label', `Pratinjau hasil edit ${output.width} kali ${output.height} piksel`);
    }
    applyZoom(plan);
  } catch (error) {
    showError(`Gagal merender pratinjau: ${error.message}`);
  }
}

function schedulePreview() {
  if (previewFrame) return;
  previewFrame = requestAnimationFrame(() => {
    previewFrame = null;
    renderPreview();
  });
}

function syncStateAndPreview() {
  controls.renderState(state);
  updateHistoryControls();
  schedulePreview();
}

async function handleFiles(files) {
  const file = files?.[0];
  if (!file || busy) return;

  const snapshot = {
    sourceBitmap,
    sourceInfo,
    state,
    history,
    showOriginal,
    zoomMode,
    zoom,
    currentPlan,
  };
  busy = true;
  controls.setBusy(true, 'Membaca gambar…');
  setStatus('Membaca dan memvalidasi gambar…', 'loading');

  let decoded = null;
  let committed = false;
  try {
    decoded = await decodeImageFile(file);

    // Prepare and validate the replacement in a temporary canvas before
    // replacing any part of the active session.
    const preparationCanvas = document.createElement('canvas');
    renderToCanvas(decoded.bitmap, createDefaultState(), preparationCanvas, {
      maxDimension: PREVIEW_MAX_DIMENSION,
      background: null,
    });

    const newInfo = {
      name: file.name || 'gambar',
      type: file.type || '',
      size: file.size,
      width: decoded.width,
      height: decoded.height,
      sizeLabel: formatBytes(file.size),
    };

    // Commit session state only after decoding and render preparation succeed.
    sourceBitmap = decoded.bitmap;
    sourceInfo = newInfo;
    state = createDefaultState();
    history = new EditorHistory(state);
    showOriginal = false;
    zoomMode = 'fit';
    zoom = 1;
    currentPlan = null;
    cancelPendingHistory();

    controls.renderImage({
      loaded: true,
      name: newInfo.name,
      type: typeLabel(newInfo.type),
      width: newInfo.width,
      height: newInfo.height,
      sizeLabel: newInfo.sizeLabel,
      outputWidth: newInfo.width,
      outputHeight: newInfo.height,
      caption: `Gambar asli • ${newInfo.width} × ${newInfo.height} px`,
    });
    controls.setBeforeActive(false);
    controls.renderState(state);
    controls.renderExportSettings(controls.getExportFormat().value, controls.getJpegQuality());
    updateHistoryControls();
    controls.setLastAction('Sesi edit baru dimulai.');
    setStatus(`Gambar "${newInfo.name}" dimuat.`, 'ok');
    renderPreview();

    // Release the previous bitmap only after the new session is fully rendered.
    snapshot.sourceBitmap?.close?.();
    committed = true;
    decoded = null;
  } catch (error) {
    if (decoded?.bitmap) {
      if (sourceBitmap === decoded.bitmap) {
        sourceBitmap = snapshot.sourceBitmap;
        sourceInfo = snapshot.sourceInfo;
        state = snapshot.state;
        history = snapshot.history;
        showOriginal = snapshot.showOriginal;
        zoomMode = snapshot.zoomMode;
        zoom = snapshot.zoom;
        currentPlan = snapshot.currentPlan;
      }
      decoded.bitmap.close?.();
    }

    controls.setBeforeActive(showOriginal);
    controls.renderState(state);
    updateHistoryControls();
    if (sourceBitmap) {
      renderPreview();
    } else {
      controls.renderImage({ loaded: false });
      controls.setZoom('fit');
    }
    showError(error.message || 'Gambar tidak dapat dimuat.');
  } finally {
    if (!committed && decoded?.bitmap && sourceBitmap === decoded.bitmap) {
      // Defensive cleanup if an unexpected path leaves the temporary bitmap assigned.
      sourceBitmap = snapshot.sourceBitmap;
      sourceInfo = snapshot.sourceInfo;
      decoded.bitmap.close?.();
    }
    busy = false;
    controls.setBusy(false);
  }
}

function handleFilterInput(name, value) {
  if (!hasImage()) return;
  exitBeforeComparison();
  state = updateFilter(state, name, value);
  controls.renderState(state);
  scheduleHistoryCommit();
  schedulePreview();
}

function handleFilterCommit() {
  if (!hasImage()) return;
  flushPendingHistory();
  setStatus('Perubahan filter diterapkan.', 'ok');
}

function handleTransform(action) {
  if (!hasImage()) return;
  flushPendingHistory();
  const transforms = {
    'rotate-left': rotateLeft,
    'rotate-right': rotateRight,
    'flip-x': toggleFlipX,
    'flip-y': toggleFlipY,
  };
  const transform = transforms[action];
  if (!transform) return;

  exitBeforeComparison();
  state = transform(state);
  history.record(state);
  controls.renderState(state);
  updateHistoryControls();
  schedulePreview();

  const messages = {
    'rotate-left': 'Gambar diputar 90° ke kiri.',
    'rotate-right': 'Gambar diputar 90° ke kanan.',
    'flip-x': 'Gambar dicerminkan horizontal.',
    'flip-y': 'Gambar dicerminkan vertikal.',
  };
  setStatus(messages[action], 'ok');
  setLastAction(messages[action]);
}

function handleResetFilters() {
  if (!hasImage()) return;
  flushPendingHistory();
  exitBeforeComparison();
  state = resetFilters(state);
  history.record(state);
  controls.renderState(state);
  updateHistoryControls();
  schedulePreview();
  setStatus('Semua filter dikembalikan ke nilai default.', 'ok');
  setLastAction('Filter direset.');
}

function handleResetAll() {
  if (!hasImage()) return;
  flushPendingHistory();
  exitBeforeComparison();
  state = resetEditorState();
  history.record(state);
  zoomMode = 'fit';
  zoom = 1;
  controls.renderState(state);
  updateHistoryControls();
  schedulePreview();
  setStatus('Semua pengaturan dikembalikan ke kondisi awal gambar.', 'ok');
  setLastAction('Reset semua diterapkan.');
}

function handleUndo() {
  if (!hasImage() || !history) return;
  flushPendingHistory();
  const next = history.undo();
  if (!next) return;
  exitBeforeComparison();
  state = normalizeEditorState(next);
  controls.renderState(state);
  updateHistoryControls();
  schedulePreview();
  setStatus('Perubahan terakhir dibatalkan.', 'ok');
  setLastAction('Undo diterapkan.');
}

function handleRedo() {
  if (!hasImage() || !history) return;
  flushPendingHistory();
  const next = history.redo();
  if (!next) return;
  cancelPendingHistory();
  exitBeforeComparison();
  state = normalizeEditorState(next);
  controls.renderState(state);
  updateHistoryControls();
  schedulePreview();
  setStatus('Perubahan yang dibatalkan diterapkan kembali.', 'ok');
  setLastAction('Redo diterapkan.');
}

function handleToggleBefore() {
  if (!hasImage()) return;
  showOriginal = !showOriginal;
  controls.setBeforeActive(showOriginal);
  renderPreview();
  setStatus(
    showOriginal ? 'Menampilkan gambar asli tanpa edit.' : 'Menampilkan hasil edit saat ini.',
    'info',
  );
}

function handleZoomIn() {
  if (!hasImage()) return;
  zoomMode = 'manual';
  zoom = Math.min(ZOOM_MAX, zoom * ZOOM_FACTOR);
  applyZoom();
}

function handleZoomOut() {
  if (!hasImage()) return;
  zoomMode = 'manual';
  zoom = Math.max(ZOOM_MIN, zoom / ZOOM_FACTOR);
  applyZoom();
}

function handleZoomFit() {
  if (!hasImage()) return;
  zoomMode = 'fit';
  zoom = 1;
  applyZoom();
}

function handleExportSettingsChange(format, quality) {
  controls.renderExportSettings(format, quality);
}

async function handleExport() {
  if (!hasImage() || busy) return;
  const format = controls.getExportFormat();
  const quality = controls.getJpegQuality();
  const exportCanvas = document.createElement('canvas');
  busy = true;
  controls.setBusy(true, `Membuat ${format.label}…`);
  setStatus(`Menyiapkan ekspor ${format.label}…`, 'loading');

  try {
    renderToCanvas(sourceBitmap, state, exportCanvas, {
      maxDimension: Infinity,
      background: format.value === 'jpeg' ? '#ffffff' : null,
    });
    const { blob } = await canvasToBlob(exportCanvas, {
      format: format.value,
      quality,
    });
    if (!blob) throw new Error('Blob gambar tidak tersedia.');

    const filename = createExportFilename(sourceInfo.name, format.value);
    const url = URL.createObjectURL(blob);
    objectUrls.add(url);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    document.body.append(link);
    link.click();
    link.remove();
    revokeObjectUrlLater(url, 1500);
    setTimeout(() => objectUrls.delete(url), 1600);

    setStatus(`Ekspor ${format.label} siap: ${filename}`, 'ok');
    setLastAction(`Ekspor ${format.label} dibuat dengan ${exportCanvas.width} × ${exportCanvas.height} px.`);
  } catch (error) {
    showError(`Ekspor gagal: ${error.message}`);
  } finally {
    exportCanvas.width = 0;
    exportCanvas.height = 0;
    busy = false;
    controls.setBusy(false);
  }
}

function hasFilePayload(event) {
  return [...(event.dataTransfer?.types ?? [])].includes('Files');
}

function bindDragAndDrop() {
  const stage = controls.elements.workspaceStage;

  window.addEventListener('dragover', (event) => {
    if (hasFilePayload(event)) event.preventDefault();
  });
  window.addEventListener('drop', (event) => {
    if (hasFilePayload(event)) event.preventDefault();
  });

  stage.addEventListener('dragenter', (event) => {
    if (!hasFilePayload(event)) return;
    event.preventDefault();
    dragDepth += 1;
    controls.setDropActive(true);
  });
  stage.addEventListener('dragover', (event) => {
    if (!hasFilePayload(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  });
  stage.addEventListener('dragleave', (event) => {
    if (!hasFilePayload(event)) return;
    event.preventDefault();
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) controls.setDropActive(false);
  });
  stage.addEventListener('drop', (event) => {
    if (!hasFilePayload(event)) return;
    event.preventDefault();
    dragDepth = 0;
    controls.setDropActive(false);
    const files = [...(event.dataTransfer?.files ?? [])];
    if (files.length) handleFiles(files);
  });
}

function bindShortcuts() {
  window.addEventListener('keydown', (event) => {
    if (!event.ctrlKey && !event.metaKey) return;
    const key = event.key.toLowerCase();
    if (key === 'z' && !event.shiftKey) {
      event.preventDefault();
      handleUndo();
    } else if ((key === 'z' && event.shiftKey) || key === 'y') {
      event.preventDefault();
      handleRedo();
    }
  });
}

function initialize() {
  controls.bind({
    onFiles: handleFiles,
    onFilterInput: handleFilterInput,
    onFilterCommit: handleFilterCommit,
    onTransform: handleTransform,
    onResetFilters: handleResetFilters,
    onResetAll: handleResetAll,
    onUndo: handleUndo,
    onRedo: handleRedo,
    onToggleBefore: handleToggleBefore,
    onZoomIn: handleZoomIn,
    onZoomOut: handleZoomOut,
    onZoomFit: handleZoomFit,
    onExport: handleExport,
    onExportSettingsChange: handleExportSettingsChange,
  });

  controls.renderImage({ loaded: false });
  controls.renderState(state);
  controls.renderHistory(null);
  controls.renderExportSettings('png', controls.getJpegQuality());
  controls.renderOutputDimensions(0, 0);
  controls.setBeforeActive(false);
  controls.setZoom('fit');

  bindDragAndDrop();
  bindShortcuts();

  window.addEventListener('pagehide', (event) => {
    if (event.persisted) return;
    sourceBitmap?.close?.();
    sourceBitmap = null;
    for (const url of objectUrls) URL.revokeObjectURL(url);
    objectUrls.clear();
  });
}

initialize();

if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test') {
  globalThis.__pixelforgeTest = {
    handleFiles,
    getState: () => state,
    getSource: () => sourceBitmap,
    getHistory: () => history,
    getShowOriginal: () => showOriginal,
    getZoomMode: () => zoomMode,
  };
}
