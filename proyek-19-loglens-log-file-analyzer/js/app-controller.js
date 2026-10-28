import { LOG_LEVELS, normalizeLevel } from './log-model.js';
import { MAX_FILE_BYTES, MAX_LINES, readLogFile } from './file-reader.js';
import { DEFAULT_RESULT_LIMIT, nextMatchPosition, queryLogs } from './query-engine.js';
import { compareStatistics } from './statistics.js';
import { buildExport } from './exporter.js';

export const PAGE_SIZE = 100;
export const DEFAULT_EXPORT_FILENAME = 'loglens-filtered.log';

function positiveInteger(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function normalizeFileSize(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function normalizeFileName(file) {
  const name = typeof file?.name === 'string' ? file.name.trim() : '';
  return name === '' ? 'File tanpa nama' : name.slice(0, 240);
}

function normalizeTimeBound(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeLevels(value) {
  if (!Array.isArray(value)) {
    return null;
  }

  const selected = [];
  for (const level of value) {
    const normalized = normalizeLevel(level);
    if (!selected.includes(normalized)) {
      selected.push(normalized);
    }
  }

  return selected;
}

function defaultFilters() {
  return {
    query: '',
    levels: [...LOG_LEVELS],
    fromMs: null,
    toMs: null,
  };
}

function idleLoad() {
  return {
    status: 'idle',
    fileName: null,
    fileSize: null,
    bytesRead: 0,
    lines: 0,
    progress: null,
    error: null,
  };
}

function cloneError(error) {
  return error && typeof error === 'object' ? { ...error } : null;
}

function cloneStatistics(statistics) {
  if (!statistics) {
    return null;
  }

  return {
    ok: statistics.ok,
    all: cloneSingleStatistics(statistics.all),
    filtered: cloneSingleStatistics(statistics.filtered),
    filteredCount: statistics.filteredCount,
    error: statistics.error,
  };
}

function cloneSingleStatistics(statistics) {
  if (!statistics) {
    return null;
  }

  return {
    ...statistics,
    levelCounts: { ...statistics.levelCounts },
  };
}

function friendlyReadError(error) {
  switch (error?.code) {
    case 'invalid-file':
      return 'File tidak valid atau tidak dapat dibaca.';
    case 'file-too-large':
      return 'File melebihi batas 20 MiB.';
    case 'too-many-lines':
      return 'File melebihi batas 200.000 baris.';
    case 'aborted':
      return 'Pemuatan file dibatalkan.';
    case 'read-error':
      return 'Terjadi kesalahan saat membaca file.';
    default:
      return 'File log gagal dimuat.';
  }
}

/**
 * Create the LogLens state controller. This module has no DOM access and is
 * testable in Node by injecting a File-like reader.
 */
export function createAppController(options = {}) {
  const settings = options && typeof options === 'object' ? options : {};
  const readFile = typeof settings.readFile === 'function' ? settings.readFile : readLogFile;
  const pageSize = positiveInteger(settings.pageSize, PAGE_SIZE);
  const onChange = typeof settings.onChange === 'function' ? settings.onChange : null;

  let dataset = null;
  let load = idleLoad();
  let filters = defaultFilters();
  let queryResult = queryLogs([], { limit: DEFAULT_RESULT_LIMIT });
  let matchedRecords = [];
  let statistics = null;
  let pageIndex = 0;
  let activeMatchPosition = -1;
  let datasetRevision = 0;
  let loadGeneration = 0;
  let activeAbortController = null;
  let status = {
    kind: 'idle',
    message: 'LogLens siap. Pilih atau jatuhkan file log untuk mulai menganalisis.',
  };

  function notify() {
    if (!onChange) {
      return;
    }

    try {
      onChange(getState());
    } catch {
      // A UI listener must not break controller state transitions.
    }
  }

  function pageCount() {
    return queryResult.returnedCount === 0
      ? 0
      : Math.ceil(queryResult.returnedCount / pageSize);
  }

  function clampPage(index) {
    const count = pageCount();
    if (count === 0) {
      return 0;
    }

    const numeric = Number.isInteger(index) ? index : 0;
    return Math.min(Math.max(numeric, 0), count - 1);
  }

  function recompute({ resetPage = true } = {}) {
    if (!dataset) {
      queryResult = queryLogs([], { limit: DEFAULT_RESULT_LIMIT });
      matchedRecords = [];
      statistics = null;
      pageIndex = 0;
      activeMatchPosition = -1;
      return;
    }

    queryResult = queryLogs(dataset.records, {
      query: filters.query,
      levels: filters.levels,
      fromMs: filters.fromMs,
      toMs: filters.toMs,
      limit: DEFAULT_RESULT_LIMIT,
    });
    matchedRecords = queryResult.matchedIndices.map((index) => dataset.records[index]);
    statistics = compareStatistics(dataset.records, matchedRecords);

    if (resetPage) {
      pageIndex = 0;
      activeMatchPosition = -1;
    } else {
      pageIndex = clampPage(pageIndex);
      if (activeMatchPosition >= queryResult.returnedCount) {
        activeMatchPosition = -1;
      }
    }
  }

  function getState() {
    const count = pageCount();
    const offset = pageIndex * pageSize;
    const pageRecords = queryResult.results.slice(offset, offset + pageSize);
    const pageResultIndices = queryResult.resultIndices.slice(offset, offset + pageSize);
    const activeRecord = activeMatchPosition >= 0
      ? queryResult.results[activeMatchPosition] ?? null
      : null;

    return {
      hasDataset: Boolean(dataset),
      dataset: dataset
        ? {
            fileName: dataset.fileName,
            revision: dataset.revision,
            fileSize: dataset.fileSize,
            totalLines: dataset.totalLines,
            truncatedLines: dataset.truncatedLines,
            bytesRead: dataset.bytesRead,
            recordsCount: dataset.records.length,
          }
        : null,
      load: {
        ...load,
        error: cloneError(load.error),
      },
      filters: {
        ...filters,
        levels: [...filters.levels],
        timeFilterActive: filters.fromMs !== null || filters.toMs !== null,
        timeRangeInvalid: filters.fromMs !== null
          && filters.toMs !== null
          && filters.fromMs > filters.toMs,
      },
      query: {
        ok: queryResult.ok,
        totalMatches: queryResult.totalMatches,
        returnedCount: queryResult.returnedCount,
        truncated: queryResult.truncated,
        limit: queryResult.limit,
        excludedWithoutTimestamp: queryResult.excludedWithoutTimestamp,
        error: cloneError(queryResult.error),
      },
      stats: cloneStatistics(statistics),
      page: {
        index: pageIndex,
        size: pageSize,
        count,
        start: queryResult.returnedCount === 0 ? 0 : offset + 1,
        end: Math.min(offset + pageSize, queryResult.returnedCount),
        records: pageRecords,
        resultIndices: pageResultIndices,
      },
      activeMatch: activeRecord
        ? {
            position: activeMatchPosition,
            resultIndex: queryResult.resultIndices[activeMatchPosition],
            record: activeRecord,
            pageIndex: Math.floor(activeMatchPosition / pageSize),
          }
        : null,
      canExport: Boolean(dataset && matchedRecords.length > 0),
      status: { ...status },
    };
  }

  async function loadFile(file) {
    const generation = ++loadGeneration;
    if (activeAbortController) {
      try {
        activeAbortController.abort();
      } catch {
        // The previous reader is being replaced.
      }
    }

    const abortController = typeof AbortController === 'function'
      ? new AbortController()
      : null;
    activeAbortController = abortController;

    const fileName = normalizeFileName(file);
    const fileSize = normalizeFileSize(file?.size);
    load = {
      status: 'loading',
      fileName,
      fileSize,
      bytesRead: 0,
      lines: 0,
      progress: fileSize === null || fileSize === 0 ? null : 0,
      error: null,
    };
    status = {
      kind: 'loading',
      message: `Membaca "${fileName}"...`,
    };
    notify();

    try {
      const result = await readFile(file, {
        signal: abortController?.signal,
        onProgress: (progress) => {
          if (generation !== loadGeneration) {
            return;
          }

          load = {
            ...load,
            bytesRead: progress?.bytesRead ?? load.bytesRead,
            lines: progress?.lines ?? load.lines,
            fileSize: progress?.fileSize ?? load.fileSize,
            progress: progress?.progress ?? load.progress,
          };
          notify();
        },
      });

      if (generation !== loadGeneration) {
        return getState();
      }

      if (result?.ok) {
        datasetRevision += 1;
        dataset = {
          fileName,
          revision: datasetRevision,
          fileSize: result.fileSize ?? fileSize,
          records: Array.isArray(result.records) ? result.records : [],
          totalLines: result.totalLines,
          truncatedLines: result.truncatedLines,
          bytesRead: result.bytesRead,
        };
        filters = defaultFilters();
        recompute({ resetPage: true });
        load = {
          status: 'success',
          fileName,
          fileSize: dataset.fileSize,
          bytesRead: dataset.bytesRead,
          lines: dataset.totalLines,
          progress: dataset.fileSize === null ? null : 1,
          error: null,
        };
        status = {
          kind: 'success',
          message: `Berhasil memuat ${dataset.totalLines} baris dari "${fileName}".`,
        };
      } else {
        const error = {
          ...(result?.error && typeof result.error === 'object' ? result.error : {}),
          code: result?.error?.code ?? 'read-error',
          message: friendlyReadError(result?.error),
        };
        load = {
          ...load,
          status: 'error',
          fileSize: result?.fileSize ?? load.fileSize,
          bytesRead: result?.bytesRead ?? load.bytesRead,
          error,
        };
        status = {
          kind: 'error',
          message: `${error.message}${dataset ? ' Dataset sebelumnya tetap aktif.' : ''}`,
        };
      }
    } catch {
      if (generation !== loadGeneration) {
        return getState();
      }

      const error = {
        code: 'read-error',
        message: friendlyReadError({ code: 'read-error' }),
      };
      load = {
        ...load,
        status: 'error',
        error,
      };
      status = {
        kind: 'error',
        message: `${error.message}${dataset ? ' Dataset sebelumnya tetap aktif.' : ''}`,
      };
    } finally {
      if (generation === loadGeneration) {
        activeAbortController = null;
      }
    }

    notify();
    return getState();
  }

  function cancelLoad() {
    if (load.status !== 'loading') {
      return getState();
    }

    loadGeneration += 1;
    if (activeAbortController) {
      try {
        activeAbortController.abort();
      } catch {
        // Cancellation is best-effort.
      }
      activeAbortController = null;
    }

    load = {
      ...load,
      status: 'cancelled',
      error: null,
    };
    status = {
      kind: 'warning',
      message: `Pemuatan "${load.fileName}" dibatalkan.${dataset ? ' Dataset sebelumnya tetap aktif.' : ''}`,
    };
    notify();
    return getState();
  }

  function clearDataset() {
    loadGeneration += 1;
    if (activeAbortController) {
      try {
        activeAbortController.abort();
      } catch {
        // Clearing also cancels an in-flight read.
      }
      activeAbortController = null;
    }

    dataset = null;
    filters = defaultFilters();
    load = idleLoad();
    recompute({ resetPage: true });
    status = {
      kind: 'idle',
      message: 'Dataset dan filter log dibersihkan.',
    };
    notify();
    return getState();
  }

  function updateFilters(patch) {
    const changes = patch && typeof patch === 'object' ? patch : {};
    const next = {
      ...filters,
      levels: [...filters.levels],
    };

    if (Object.prototype.hasOwnProperty.call(changes, 'query')) {
      next.query = changes.query === undefined || changes.query === null
        ? ''
        : String(changes.query);
    }

    if (Object.prototype.hasOwnProperty.call(changes, 'levels')) {
      const levels = normalizeLevels(changes.levels);
      if (levels !== null) {
        next.levels = levels;
      }
    }

    if (Object.prototype.hasOwnProperty.call(changes, 'fromMs')) {
      next.fromMs = normalizeTimeBound(changes.fromMs);
    }

    if (Object.prototype.hasOwnProperty.call(changes, 'toMs')) {
      next.toMs = normalizeTimeBound(changes.toMs);
    }

    filters = next;
    recompute({ resetPage: true });
    notify();
    return getState();
  }

  function resetFilters() {
    filters = defaultFilters();
    recompute({ resetPage: true });
    status = {
      kind: 'idle',
      message: 'Filter direset. Seluruh dataset kembali ditampilkan.',
    };
    notify();
    return getState();
  }

  function setPage(index) {
    pageIndex = clampPage(index);
    activeMatchPosition = -1;
    notify();
    return getState();
  }

  function nextMatch(direction = 1) {
    if (queryResult.returnedCount === 0) {
      activeMatchPosition = -1;
      notify();
      return getState();
    }

    activeMatchPosition = nextMatchPosition(
      activeMatchPosition,
      queryResult.returnedCount,
      direction,
    );
    pageIndex = Math.floor(activeMatchPosition / pageSize);
    notify();
    return getState();
  }

  function exportFilteredResults(exportOptions = {}) {
    const exportSettings = exportOptions && typeof exportOptions === 'object'
      ? exportOptions
      : {};
    const filename = typeof exportSettings.filename === 'string'
      ? exportSettings.filename
      : DEFAULT_EXPORT_FILENAME;

    if (!dataset) {
      status = {
        kind: 'error',
        message: 'Tidak ada dataset untuk diekspor.',
      };
      notify();
      return {
        ok: false,
        content: '',
        filename,
        lineCount: 0,
        byteLength: 0,
        mimeType: 'text/plain;charset=utf-8',
        lineEnding: '\n',
        error: {
          code: 'no-dataset',
          message: 'Tidak ada dataset untuk diekspor.',
        },
      };
    }

    const result = buildExport(matchedRecords, { filename });
    status = result.ok
      ? {
          kind: 'success',
          message: `Ekspor ${result.lineCount} baris disiapkan sebagai "${result.filename}".`,
        }
      : {
          kind: 'error',
          message: 'Ekspor gagal disiapkan.',
        };
    notify();
    return result;
  }

  return {
    getState,
    loadFile,
    cancelLoad,
    clearDataset,
    updateFilters,
    resetFilters,
    setPage,
    nextMatch,
    exportFilteredResults,
  };
}
