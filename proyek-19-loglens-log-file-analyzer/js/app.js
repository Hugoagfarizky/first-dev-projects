import { createAppController } from './app-controller.js';
import { LOG_LEVELS } from './log-model.js';
import {
  announceStatus,
  formatNumber,
  renderFileMeta,
  renderLevelFilters,
  renderLoadError,
  renderLoadProgress,
  renderLogRows,
  renderStatistics,
  setDisabled,
  setHidden,
  setText,
  syncLevelFilters,
} from './ui.js';

let controller;
let searchTimer = null;
let dragDepth = 0;
let lastRowsKey = '';
let previousLoadStatus = 'idle';
let lastDatasetFileName = null;

const elements = {};

function collectElements() {
  elements.appStatus = document.querySelector('[data-app-status]');
  elements.chooseFile = document.querySelector('[data-choose-file]');
  elements.fileInput = document.querySelector('[data-file-input]');
  elements.dropzone = document.querySelector('[data-dropzone]');
  elements.cancelLoad = document.querySelector('[data-cancel-load]');
  elements.clearDataset = document.querySelector('[data-clear-dataset]');
  elements.fileName = document.querySelector('[data-file-name]');
  elements.fileSize = document.querySelector('[data-file-size]');
  elements.fileLines = document.querySelector('[data-file-lines]');
  elements.fileTruncated = document.querySelector('[data-file-truncated]');
  elements.progressWrap = document.querySelector('[data-progress-wrap]');
  elements.loadProgress = document.querySelector('[data-load-progress]');
  elements.progressText = document.querySelector('[data-progress-text]');
  elements.loadError = document.querySelector('[data-load-error]');
  elements.searchInput = document.querySelector('[data-search-input]');
  elements.levelFieldset = document.querySelector('[data-level-fieldset]');
  elements.levelFilters = document.querySelector('[data-level-filters]');
  elements.fromTime = document.querySelector('[data-from-time]');
  elements.toTime = document.querySelector('[data-to-time]');
  elements.timeRangeError = document.querySelector('[data-time-range-error]');
  elements.resetFilters = document.querySelector('[data-reset-filters]');
  elements.exportButton = document.querySelector('[data-export]');
  elements.fullStats = document.querySelector('[data-stats-panel="full"]');
  elements.filteredStats = document.querySelector('[data-stats-panel="filtered"]');
  elements.filteredNote = document.querySelector('[data-filtered-note]');
  elements.resultsSummary = document.querySelector('[data-results-summary]');
  elements.matchWarning = document.querySelector('[data-match-warning]');
  elements.matchPosition = document.querySelector('[data-match-position]');
  elements.matchPrevious = document.querySelector('[data-prev-match]');
  elements.matchNext = document.querySelector('[data-next-match]');
  elements.logRows = document.querySelector('[data-log-rows]');
  elements.pageTag = document.querySelector('[data-page-tag]');
  elements.pageStatus = document.querySelector('[data-page-status]');
  elements.pagePrevious = document.querySelector('[data-prev-page]');
  elements.pageNext = document.querySelector('[data-next-page]');
}

function toDateTimeLocal(timestampMs) {
  if (!Number.isFinite(timestampMs)) {
    return '';
  }

  const date = new Date(timestampMs);
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function fromDateTimeLocal(value) {
  if (typeof value !== 'string' || value === '') {
    return null;
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function syncFilterInputs(state) {
  elements.searchInput.value = state.filters.query;
  elements.fromTime.value = toDateTimeLocal(state.filters.fromMs);
  elements.toTime.value = toDateTimeLocal(state.filters.toMs);
  syncLevelFilters(elements.levelFilters, state.filters.levels);
}

function selectedLevels() {
  return [...elements.levelFilters.querySelectorAll('input[data-level-filter]:checked')]
    .map((checkbox) => checkbox.value);
}

function emptyStateFor(state) {
  if (!state.hasDataset) {
    return {
      title: 'Belum ada log yang dimuat.',
      description: 'Pilih atau jatuhkan file log lokal untuk mulai membaca dan menganalisis.',
    };
  }

  if (state.filters.timeRangeInvalid) {
    return {
      title: 'Rentang waktu tidak valid.',
      description: 'Waktu mulai tidak boleh melewati waktu selesai. Perbaiki rentang atau reset filter.',
    };
  }

  return {
    title: 'Tidak ada baris yang cocok.',
    description: 'Ubah pencarian, level, atau rentang waktu, lalu coba lagi.',
  };
}

function renderFilteredNote(state) {
  if (!state.stats) {
    setText(elements.filteredNote, 'Belum ada data untuk difilter.');
    return;
  }

  if (state.filters.timeRangeInvalid) {
    setText(
      elements.filteredNote,
      'Rentang waktu tidak valid. Statistik hasil filter tidak dapat dihitung sampai batas waktu diperbaiki.',
    );
    return;
  }

  if (state.filters.timeFilterActive) {
    setText(
      elements.filteredNote,
      `${formatNumber(state.query.excludedWithoutTimestamp)} record tanpa timestamp valid dikecualikan karena filter waktu aktif.`,
    );
    return;
  }

  setText(
    elements.filteredNote,
    'Statistik dihitung dari seluruh record yang cocok, bukan hanya halaman yang terlihat.',
  );
}

const TIME_RANGE_ERROR_MESSAGE = 'Rentang waktu tidak valid: waktu mulai melewati waktu selesai. Perbaiki rentang atau reset filter.';

function renderTimeRangeError(state) {
  const invalid = Boolean(state.filters.timeRangeInvalid);
  setHidden(elements.timeRangeError, !invalid);
  setText(elements.timeRangeError, invalid ? TIME_RANGE_ERROR_MESSAGE : '');

  for (const input of [elements.fromTime, elements.toTime]) {
    if (!input) {
      continue;
    }

    if (invalid) {
      input.setAttribute('aria-invalid', 'true');
    } else {
      input.removeAttribute('aria-invalid');
    }
  }
}

function renderRows(state) {
  const rowsKey = [
    state.dataset?.fileName ?? '',
    state.dataset?.revision ?? 0,
    state.page.index,
    state.page.count,
    state.query.totalMatches,
    state.query.returnedCount,
    state.activeMatch?.position ?? -1,
    state.filters.query,
    state.filters.levels.join(','),
    state.filters.fromMs ?? '',
    state.filters.toMs ?? '',
  ].join('|');

  if (rowsKey === lastRowsKey) {
    return;
  }

  lastRowsKey = rowsKey;
  renderLogRows(
    elements.logRows,
    state.page.records,
    state.page.resultIndices,
    state.activeMatch?.resultIndex ?? -1,
    emptyStateFor(state),
  );
}

function render(state) {
  announceStatus(elements.appStatus, state.status.message, state.status.kind);

  if (state.load.status === 'success' && previousLoadStatus !== 'success') {
    syncFilterInputs(state);
  }

  if (state.hasDataset && state.dataset.fileName !== lastDatasetFileName) {
    syncFilterInputs(state);
  }
  previousLoadStatus = state.load.status;
  lastDatasetFileName = state.dataset?.fileName ?? null;

  document.body.dataset.hasDataset = String(state.hasDataset);
  document.body.dataset.loadStatus = state.load.status;
  document.body.dataset.totalMatches = String(state.query.totalMatches);
  document.body.dataset.returnedCount = String(state.query.returnedCount);
  document.body.dataset.excludedWithoutTimestamp = String(state.query.excludedWithoutTimestamp);

  renderFileMeta({
    fileName: elements.fileName,
    fileSize: elements.fileSize,
    fileLines: elements.fileLines,
    fileTruncated: elements.fileTruncated,
  }, state);
  renderLoadProgress({
    wrap: elements.progressWrap,
    progress: elements.loadProgress,
    text: elements.progressText,
  }, state.load);
  renderLoadError(elements.loadError, state.load);

  setDisabled(
    [
      elements.searchInput,
      elements.fromTime,
      elements.toTime,
      elements.resetFilters,
    ],
    !state.hasDataset,
  );
  elements.levelFieldset.disabled = !state.hasDataset;
  setDisabled(elements.exportButton, !state.canExport);
  setDisabled(elements.clearDataset, !state.hasDataset && state.load.status !== 'loading');
  setHidden(elements.cancelLoad, state.load.status !== 'loading');

  renderStatistics(elements.fullStats, state.stats?.all ?? null);
  renderStatistics(elements.filteredStats, state.stats?.filtered ?? null);
  renderFilteredNote(state);
  renderTimeRangeError(state);

  if (!state.hasDataset) {
    setText(elements.resultsSummary, 'Belum ada log yang dimuat.');
    setText(elements.pageTag, '0 baris');
    setText(elements.pageStatus, 'Halaman 0 dari 0');
    setText(elements.matchPosition, '0 / 0');
    setHidden(elements.matchWarning, true);
  } else if (state.filters.timeRangeInvalid) {
    setText(elements.resultsSummary, 'Rentang waktu tidak valid. Tidak ada hasil yang ditampilkan.');
    setText(elements.pageTag, '0 cocok');
    setText(elements.pageStatus, 'Halaman 0 dari 0');
    setText(elements.matchPosition, '0 / 0');
    setHidden(elements.matchWarning, true);
  } else if (state.query.totalMatches === 0) {
    setText(elements.resultsSummary, 'Tidak ada baris yang cocok dengan filter saat ini.');
    setText(elements.pageTag, '0 cocok');
    setText(elements.pageStatus, 'Halaman 0 dari 0');
    setText(elements.matchPosition, '0 / 0');
    setHidden(elements.matchWarning, true);
  } else {
    const capped = state.query.truncated
      ? ` · ${formatNumber(state.query.totalMatches)} total kecocokan`
      : '';
    setText(
      elements.resultsSummary,
      `Menampilkan baris ${formatNumber(state.page.start)}–${formatNumber(state.page.end)} dari ${formatNumber(state.query.returnedCount)} hit${capped}.`,
    );
    setText(
      elements.pageTag,
      `${formatNumber(state.query.totalMatches)} cocok · ${formatNumber(state.page.count)} halaman`,
    );
    setText(
      elements.pageStatus,
      `Halaman ${formatNumber(state.page.index + 1)} dari ${formatNumber(state.page.count)} · baris ${formatNumber(state.page.start)}–${formatNumber(state.page.end)}`,
    );

    if (state.activeMatch) {
      setText(
        elements.matchPosition,
        `Match ${formatNumber(state.activeMatch.position + 1)} / ${formatNumber(state.query.returnedCount)}`,
      );
    } else {
      setText(elements.matchPosition, `${formatNumber(state.query.returnedCount)} hit`);
    }

    setHidden(elements.matchWarning, !state.query.truncated);
    if (state.query.truncated) {
      setText(
        elements.matchWarning,
        `Navigasi match dibatasi ${formatNumber(state.query.limit)} hit pertama. Statistik dan ekspor tetap mencakup seluruh ${formatNumber(state.query.totalMatches)} hasil filter.`,
      );
    }
  }

  setDisabled(elements.matchPrevious, state.query.returnedCount < 2);
  setDisabled(elements.matchNext, state.query.returnedCount < 2);
  setDisabled(elements.pagePrevious, state.page.count <= 1 || state.page.index <= 0);
  setDisabled(
    elements.pageNext,
    state.page.count <= 1 || state.page.index >= state.page.count - 1,
  );

  renderRows(state);
}

function scrollToActiveMatch() {
  const row = elements.logRows?.querySelector('tr.is-active');
  if (!row) {
    return;
  }

  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  row.scrollIntoView({
    block: 'nearest',
    inline: 'nearest',
    behavior: reduceMotion ? 'auto' : 'smooth',
  });
}

function scheduleSearch() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    controller.updateFilters({ query: elements.searchInput.value });
  }, 180);
}

function startLoad(file) {
  clearTimeout(searchTimer);
  controller.loadFile(file).then((state) => {
    if (state.load.status === 'success') {
      syncFilterInputs(state);
      render(state);
    }
  });
}

function clearPendingSearch() {
  clearTimeout(searchTimer);
  searchTimer = null;
}

function updateTimeRange() {
  controller.updateFilters({
    fromMs: fromDateTimeLocal(elements.fromTime.value),
    toMs: fromDateTimeLocal(elements.toTime.value),
  });
}

function downloadExport(result) {
  if (!result.ok || result.content === '') {
    return;
  }

  const blob = new Blob([result.content], { type: result.mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = result.filename;
  link.rel = 'noopener';
  link.hidden = true;

  try {
    document.body.append(link);
    link.click();
  } catch (error) {
    announceStatus(
      elements.appStatus,
      `Ekspor gagal: ${error?.message ?? 'download tidak dapat dimulai.'}`,
      'error',
    );
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

function wireEvents() {
  elements.chooseFile.addEventListener('click', () => {
    elements.fileInput.click();
  });

  elements.fileInput.addEventListener('change', () => {
    const file = elements.fileInput.files?.[0];
    elements.fileInput.value = '';
    if (file) {
      startLoad(file);
    }
  });

  elements.cancelLoad.addEventListener('click', () => {
    controller.cancelLoad();
  });

  elements.clearDataset.addEventListener('click', () => {
    clearPendingSearch();
    const state = controller.clearDataset();
    syncFilterInputs(state);
    render(state);
  });

  elements.dropzone.addEventListener('dragenter', (event) => {
    event.preventDefault();
    dragDepth += 1;
    elements.dropzone.classList.add('is-dragging');
  });

  elements.dropzone.addEventListener('dragover', (event) => {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  });

  elements.dropzone.addEventListener('dragleave', (event) => {
    event.preventDefault();
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) {
      elements.dropzone.classList.remove('is-dragging');
    }
  });

  elements.dropzone.addEventListener('drop', (event) => {
    event.preventDefault();
    dragDepth = 0;
    elements.dropzone.classList.remove('is-dragging');
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      startLoad(file);
    }
  });

  const isFileDrag = (event) => Array.from(event.dataTransfer?.types ?? []).includes('Files');
  document.addEventListener('dragover', (event) => {
    if (isFileDrag(event) && !elements.dropzone.contains(event.target)) {
      event.preventDefault();
    }
  }, true);
  document.addEventListener('drop', (event) => {
    if (isFileDrag(event) && !elements.dropzone.contains(event.target)) {
      event.preventDefault();
    }
  }, true);

  elements.searchInput.addEventListener('input', scheduleSearch);

  elements.levelFilters.addEventListener('change', () => {
    controller.updateFilters({ levels: selectedLevels() });
  });

  elements.fromTime.addEventListener('change', updateTimeRange);
  elements.toTime.addEventListener('change', updateTimeRange);

  elements.resetFilters.addEventListener('click', () => {
    clearPendingSearch();
    const state = controller.resetFilters();
    syncFilterInputs(state);
    render(state);
  });

  elements.matchPrevious.addEventListener('click', () => {
    controller.nextMatch(-1);
    requestAnimationFrame(scrollToActiveMatch);
  });

  elements.matchNext.addEventListener('click', () => {
    controller.nextMatch(1);
    requestAnimationFrame(scrollToActiveMatch);
  });

  elements.pagePrevious.addEventListener('click', () => {
    const state = controller.getState();
    controller.setPage(state.page.index - 1);
    elements.logRows.closest('.table-wrap')?.scrollTo({ top: 0 });
  });

  elements.pageNext.addEventListener('click', () => {
    const state = controller.getState();
    controller.setPage(state.page.index + 1);
    elements.logRows.closest('.table-wrap')?.scrollTo({ top: 0 });
  });

  elements.exportButton.addEventListener('click', () => {
    const result = controller.exportFilteredResults();
    downloadExport(result);
  });

  window.addEventListener('pagehide', () => {
    clearPendingSearch();
    controller.cancelLoad();
  });
}

function initialize() {
  collectElements();
  renderLevelFilters(elements.levelFilters, LOG_LEVELS);
  controller = createAppController({ onChange: render });
  wireEvents();
  syncFilterInputs(controller.getState());
  render(controller.getState());
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize, { once: true });
} else {
  initialize();
}
