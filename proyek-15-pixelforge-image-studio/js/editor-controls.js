import {
  FILTER_DEFINITIONS,
  FILTER_NAMES,
  formatFilterValue,
  isDefaultState,
} from './editor-state.js';
import { getExportFormat, normalizeJpegQuality } from './exporter.js';

function requiredElement(root, id) {
  const element = root?.getElementById ? root.getElementById(id) : root?.querySelector?.(`#${id}`);
  if (!element) throw new Error(`Elemen kontrol tidak ditemukan: #${id}`);
  return element;
}

export function createEditorControls(root = document) {
  const elements = {
    appStatus: requiredElement(root, 'app-status'),
    errorRegion: requiredElement(root, 'error-region'),
    errorMessage: requiredElement(root, 'error-message'),
    errorDismiss: requiredElement(root, 'error-dismiss'),
    fileInput: requiredElement(root, 'file-input'),
    importButton: requiredElement(root, 'import-button'),
    emptyImportButton: requiredElement(root, 'empty-import-button'),
    replaceButton: requiredElement(root, 'replace-button'),
    exportButton: requiredElement(root, 'export-button'),
    emptyState: requiredElement(root, 'empty-state'),
    canvasShell: requiredElement(root, 'canvas-shell'),
    canvasScroll: requiredElement(root, 'canvas-scroll'),
    canvasFrame: requiredElement(root, 'canvas-frame'),
    previewCanvas: requiredElement(root, 'preview-canvas'),
    processingOverlay: requiredElement(root, 'processing-overlay'),
    processingText: requiredElement(root, 'processing-text'),
    dropIndicator: requiredElement(root, 'drop-indicator'),
    imageBadge: requiredElement(root, 'image-badge'),
    sourceEmpty: requiredElement(root, 'source-empty'),
    imageMeta: requiredElement(root, 'image-meta'),
    metaName: requiredElement(root, 'meta-name'),
    metaType: requiredElement(root, 'meta-type'),
    metaDimensions: requiredElement(root, 'meta-dimensions'),
    metaSize: requiredElement(root, 'meta-size'),
    metaOutput: requiredElement(root, 'meta-output'),
    resetFiltersButton: requiredElement(root, 'reset-filters'),
    resetButton: requiredElement(root, 'reset-button'),
    undoButton: requiredElement(root, 'undo-button'),
    redoButton: requiredElement(root, 'redo-button'),
    beforeButton: requiredElement(root, 'before-button'),
    compareStatus: requiredElement(root, 'compare-status'),
    zoomOutButton: requiredElement(root, 'zoom-out'),
    zoomInButton: requiredElement(root, 'zoom-in'),
    zoomFitButton: requiredElement(root, 'zoom-fit'),
    zoomValue: requiredElement(root, 'zoom-value'),
    formatSelect: requiredElement(root, 'format-select'),
    jpegQualityControl: requiredElement(root, 'jpeg-quality-control'),
    jpegQuality: requiredElement(root, 'jpeg-quality'),
    jpegQualityValue: requiredElement(root, 'jpeg-quality-value'),
    exportNote: requiredElement(root, 'export-note'),
    exportDimensions: requiredElement(root, 'export-dimensions'),
    previewSize: requiredElement(root, 'preview-size'),
    lastAction: requiredElement(root, 'last-action'),
    canvasCaption: requiredElement(root, 'canvas-caption'),
    workspaceStage: requiredElement(root, 'workspace-stage'),
  };

  const filterInputs = new Map();
  const filterOutputs = new Map();
  for (const name of FILTER_NAMES) {
    filterInputs.set(name, requiredElement(root, `filter-${name}`));
    filterOutputs.set(name, requiredElement(root, `value-${name}`));
  }

  let hasImage = false;
  let errorTimer = null;

  const controls = {
    elements,

    bind(handlers) {
      for (const name of FILTER_NAMES) {
        const input = filterInputs.get(name);
        input.addEventListener('input', () => handlers.onFilterInput(name, input.value));
        input.addEventListener('change', () => handlers.onFilterCommit());
      }

      for (const button of root.querySelectorAll('[data-transform]')) {
        button.addEventListener('click', () => handlers.onTransform(button.dataset.transform));
      }

      elements.resetFiltersButton.addEventListener('click', () => handlers.onResetFilters());
      elements.resetButton.addEventListener('click', () => handlers.onResetAll());
      elements.undoButton.addEventListener('click', () => handlers.onUndo());
      elements.redoButton.addEventListener('click', () => handlers.onRedo());
      elements.beforeButton.addEventListener('click', () => handlers.onToggleBefore());
      elements.zoomInButton.addEventListener('click', () => handlers.onZoomIn());
      elements.zoomOutButton.addEventListener('click', () => handlers.onZoomOut());
      elements.zoomFitButton.addEventListener('click', () => handlers.onZoomFit());

      for (const button of [elements.importButton, elements.emptyImportButton, elements.replaceButton]) {
        button.addEventListener('click', () => elements.fileInput.click());
      }

      elements.fileInput.addEventListener('change', () => {
        const files = [...elements.fileInput.files ?? []];
        if (files.length) handlers.onFiles(files);
        elements.fileInput.value = '';
      });

      elements.exportButton.addEventListener('click', () => handlers.onExport());
      elements.formatSelect.addEventListener('change', () => {
        handlers.onExportSettingsChange(elements.formatSelect.value, controls.getJpegQuality());
      });
      elements.jpegQuality.addEventListener('input', () => {
        handlers.onExportSettingsChange(elements.formatSelect.value, controls.getJpegQuality());
      });

      elements.errorDismiss.addEventListener('click', () => controls.clearError());
    },

    getJpegQuality() {
      return normalizeJpegQuality(Number(elements.jpegQuality.value) / 100);
    },

    getExportFormat() {
      return getExportFormat(elements.formatSelect.value);
    },

    renderState(state) {
      for (const name of FILTER_NAMES) {
        const definition = FILTER_DEFINITIONS[name];
        const input = filterInputs.get(name);
        input.min = String(definition.min);
        input.max = String(definition.max);
        input.step = String(definition.step);
        input.value = String(state.filters[name]);
        input.disabled = !hasImage;
        filterOutputs.get(name).textContent = formatFilterValue(name, state.filters[name]);
      }
      elements.resetFiltersButton.disabled = !hasImage || isDefaultState(state);
    },

    renderHistory(history) {
      elements.undoButton.disabled = !hasImage || !history?.canUndo;
      elements.redoButton.disabled = !hasImage || !history?.canRedo;
    },

    renderImage(info) {
      hasImage = Boolean(info?.loaded);
      elements.emptyState.hidden = hasImage;
      elements.canvasShell.hidden = !hasImage;
      elements.sourceEmpty.hidden = hasImage;
      elements.imageMeta.hidden = !hasImage;
      elements.replaceButton.hidden = !hasImage;
      elements.exportButton.disabled = !hasImage;
      elements.resetButton.disabled = !hasImage;
      elements.beforeButton.disabled = !hasImage;
      elements.importButton.textContent = hasImage ? 'Ganti gambar' : 'Impor gambar';

      for (const name of FILTER_NAMES) filterInputs.get(name).disabled = !hasImage;
      for (const button of root.querySelectorAll('[data-transform]')) button.disabled = !hasImage;
      elements.zoomOutButton.disabled = !hasImage;
      elements.zoomInButton.disabled = !hasImage;
      elements.zoomFitButton.disabled = !hasImage;

      if (hasImage) {
        elements.imageBadge.textContent = 'Siap diedit';
        elements.metaName.textContent = info.name || 'Tanpa nama';
        elements.metaType.textContent = info.type || 'Tidak diketahui';
        elements.metaDimensions.textContent = `${info.width} × ${info.height} px`;
        elements.metaSize.textContent = info.sizeLabel;
        elements.metaOutput.textContent = `${info.outputWidth} × ${info.outputHeight} px`;
        elements.canvasCaption.textContent = info.caption;
      } else {
        elements.imageBadge.textContent = 'Kosong';
        elements.metaName.textContent = '';
        elements.metaType.textContent = '';
        elements.metaDimensions.textContent = '';
        elements.metaSize.textContent = '';
        elements.metaOutput.textContent = '';
        elements.canvasCaption.textContent = '';
      }
    },

    renderOutputDimensions(outputWidth, outputHeight) {
      if (!hasImage) {
        elements.metaOutput.textContent = '';
        elements.exportDimensions.textContent = 'Impor gambar untuk melihat dimensi hasil.';
        return;
      }
      elements.metaOutput.textContent = `${outputWidth} × ${outputHeight} px`;
      elements.exportDimensions.textContent = `Hasil ${outputWidth} × ${outputHeight} px`;
    },

    renderExportSettings(format, quality) {
      const normalizedFormat = format === 'jpeg' ? 'jpeg' : 'png';
      elements.formatSelect.value = normalizedFormat;
      elements.jpegQualityControl.hidden = normalizedFormat !== 'jpeg';
      elements.jpegQualityValue.textContent = `${Math.round(normalizeJpegQuality(quality) * 100)}%`;
      elements.exportNote.textContent = normalizedFormat === 'jpeg'
        ? 'JPEG tidak menyimpan transparansi; area transparan diekspor dengan latar putih.'
        : 'PNG mempertahankan transparansi dan cocok untuk hasil tanpa kehilangan kualitas.';
    },

    setBeforeActive(active) {
      elements.beforeButton.setAttribute('aria-pressed', String(Boolean(active)));
      elements.beforeButton.textContent = active ? 'Kembali ke hasil' : 'Lihat asli';
      elements.compareStatus.textContent = active ? 'Menampilkan gambar asli' : 'Menampilkan hasil edit';
      elements.canvasShell.dataset.before = active ? 'true' : 'false';
    },

    setBusy(busy, message = 'Memproses gambar…') {
      elements.processingOverlay.hidden = !busy;
      elements.processingText.textContent = message;
      elements.workspaceStage.setAttribute('aria-busy', String(Boolean(busy)));
    },

    setStatus(message, tone = 'info') {
      elements.appStatus.textContent = message;
      elements.appStatus.dataset.tone = tone;
    },

    showError(message) {
      elements.errorMessage.textContent = String(message || 'Terjadi kesalahan.');
      elements.errorRegion.hidden = false;
      clearTimeout(errorTimer);
      errorTimer = setTimeout(() => controls.clearError(), 9000);
    },

    clearError() {
      clearTimeout(errorTimer);
      errorTimer = null;
      elements.errorRegion.hidden = true;
      elements.errorMessage.textContent = '';
    },

    setDropActive(active) {
      elements.dropIndicator.hidden = !active;
      elements.workspaceStage.dataset.dropping = active ? 'true' : 'false';
    },

    setZoom(mode, percent = 1) {
      elements.canvasShell.classList.toggle('is-fit', mode === 'fit');
      elements.canvasShell.classList.toggle('is-manual', mode !== 'fit');
      elements.zoomValue.textContent = mode === 'fit' ? 'Fit' : `${Math.round(percent * 100)}%`;
    },

    setPreviewSize(text) {
      elements.previewSize.textContent = text;
    },

    setLastAction(text) {
      elements.lastAction.textContent = text;
    },

    setCanvasCaption(text) {
      elements.canvasCaption.textContent = text;
    },
  };

  return controls;
}
