import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_EXPORT_FILENAME,
  PAGE_SIZE,
  createAppController,
} from '../js/app-controller.js';
import { LOG_LEVELS, createLogRecord } from '../js/log-model.js';

function makeRecord(lineNumber, raw, options = {}) {
  return createLogRecord({
    lineNumber,
    raw,
    message: options.message ?? raw,
    level: options.level ?? 'UNKNOWN',
    timestampMs: options.timestampMs ?? null,
    timestampSource: options.timestampSource
      ?? (options.timestampMs === undefined || options.timestampMs === null ? 'none' : 'iso'),
    format: options.format ?? 'plain',
    blank: options.blank ?? false,
  });
}

function makeFile(name = 'app.log', size = 120) {
  return { name, size };
}

function successResult(records, file = makeFile(), overrides = {}) {
  return {
    ok: true,
    records,
    totalLines: records.length,
    truncatedLines: overrides.truncatedLines ?? 0,
    bytesRead: overrides.bytesRead ?? file.size ?? 0,
    fileSize: overrides.fileSize === undefined ? file.size : overrides.fileSize,
    error: null,
  };
}

function failureResult(code, details = {}) {
  return {
    ok: false,
    records: [],
    totalLines: 0,
    truncatedLines: 0,
    bytesRead: details.bytesRead ?? 0,
    fileSize: details.fileSize ?? null,
    error: {
      code,
      message: details.message ?? code,
      ...details,
    },
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

test('starts with an empty, filterable state', () => {
  const controller = createAppController({
    readFile: async () => {
      throw new Error('should not read');
    },
  });

  const state = controller.getState();

  assert.equal(state.hasDataset, false);
  assert.equal(state.dataset, null);
  assert.equal(state.load.status, 'idle');
  assert.equal(state.load.error, null);
  assert.equal(state.filters.query, '');
  assert.deepEqual(state.filters.levels, LOG_LEVELS);
  assert.equal(state.filters.fromMs, null);
  assert.equal(state.filters.toMs, null);
  assert.equal(state.query.totalMatches, 0);
  assert.equal(state.stats, null);
  assert.deepEqual(state.page.records, []);
  assert.equal(state.page.count, 0);
  assert.equal(state.canExport, false);
  assert.equal(state.status.kind, 'idle');
});

test('loads a valid file and publishes complete statistics', async () => {
  const records = [
    makeRecord(1, 'alpha', { level: 'INFO', timestampMs: 100 }),
    makeRecord(2, 'beta', { level: 'ERROR', timestampMs: 200 }),
    makeRecord(3, '', { blank: true }),
  ];
  const progressStates = [];
  const controller = createAppController({
    readFile: async (file, options) => {
      options.onProgress({ bytesRead: 4, fileSize: file.size, lines: 0, progress: 0.25 });
      progressStates.push(options.signal.aborted);
      return successResult(records, file, { bytesRead: file.size });
    },
  });

  const state = await controller.loadFile(makeFile('service.log', 120));

  assert.equal(state.hasDataset, true);
  assert.equal(state.dataset.fileName, 'service.log');
  assert.equal(state.dataset.totalLines, 3);
  assert.equal(state.dataset.revision, 1);
  assert.equal(state.load.status, 'success');
  assert.equal(state.load.progress, 1);
  assert.equal(state.query.totalMatches, 3);
  assert.equal(state.query.returnedCount, 3);
  assert.equal(state.stats.all.totalLines, 3);
  assert.equal(state.stats.filtered.totalLines, 3);
  assert.equal(state.stats.all.levelCounts.INFO, 1);
  assert.equal(state.stats.all.levelCounts.ERROR, 1);
  assert.equal(state.page.records.length, 3);
  assert.deepEqual(state.page.resultIndices, [0, 1, 2]);
  assert.equal(state.canExport, true);
  assert.equal(state.status.kind, 'success');
  assert.deepEqual(progressStates, [false]);
});

test('a failed load does not replace or corrupt the existing dataset', async () => {
  const firstRecords = [
    makeRecord(1, 'alpha', { level: 'INFO' }),
    makeRecord(2, 'beta', { level: 'ERROR' }),
  ];
  let nextRead = async (file) => successResult(firstRecords, file);
  const controller = createAppController({
    readFile: (file, options) => nextRead(file, options),
  });

  await controller.loadFile(makeFile('first.log', 60));
  controller.updateFilters({ query: 'alpha' });
  const before = controller.getState();

  nextRead = async (file) => failureResult('too-many-lines', {
    fileSize: file.size,
    bytesRead: 20,
    maxLines: 200_000,
  });
  const after = await controller.loadFile(makeFile('broken.log', 80));

  assert.equal(after.hasDataset, true);
  assert.equal(after.dataset.fileName, 'first.log');
  assert.equal(after.dataset.totalLines, 2);
  assert.equal(after.load.status, 'error');
  assert.equal(after.load.error.code, 'too-many-lines');
  assert.equal(after.status.kind, 'error');
  assert.match(after.status.message, /Dataset sebelumnya tetap aktif/);
  assert.deepEqual(after.filters, before.filters);
  assert.equal(after.query.totalMatches, 1);
  assert.deepEqual(after.page.records, before.page.records);
  assert.equal(after.stats.all.totalLines, 2);
  assert.equal(after.stats.filtered.totalLines, 1);
});

test('cancelling a load preserves the previous dataset and ignores the late result', async () => {
  const firstRecords = [makeRecord(1, 'first')];
  const secondRecords = [makeRecord(1, 'second')];
  let nextRead = async (file) => successResult(firstRecords, file);
  const controller = createAppController({
    readFile: (file, options) => nextRead(file, options),
  });

  await controller.loadFile(makeFile('first.log', 10));

  const pending = deferred();
  nextRead = () => pending.promise;
  const loadPromise = controller.loadFile(makeFile('second.log', 20));

  const loading = controller.getState();
  assert.equal(loading.load.status, 'loading');
  assert.equal(loading.dataset.fileName, 'first.log');

  const cancelled = controller.cancelLoad();
  assert.equal(cancelled.load.status, 'cancelled');
  assert.equal(cancelled.dataset.fileName, 'first.log');
  assert.equal(cancelled.status.kind, 'warning');

  pending.resolve(successResult(secondRecords, makeFile('second.log', 20)));
  const settled = await loadPromise;

  assert.equal(settled.dataset.fileName, 'first.log');
  assert.equal(settled.load.status, 'cancelled');
  assert.equal(settled.stats.all.totalLines, 1);
});

test('a new successful load replaces the dataset, and stale requests are ignored', async () => {
  const first = deferred();
  const second = deferred();
  const reads = [first, second];
  let readIndex = 0;
  const controller = createAppController({
    readFile: () => reads[readIndex++].promise,
  });

  const firstLoad = controller.loadFile(makeFile('first.log', 10));
  const secondLoad = controller.loadFile(makeFile('second.log', 20));

  second.resolve(successResult([makeRecord(1, 'second')], makeFile('second.log', 20)));
  const secondState = await secondLoad;
  assert.equal(secondState.dataset.fileName, 'second.log');
  assert.equal(secondState.dataset.totalLines, 1);

  first.resolve(successResult([makeRecord(1, 'first')], makeFile('first.log', 10)));
  const finalState = await firstLoad;

  assert.equal(finalState.dataset.fileName, 'second.log');
  assert.equal(finalState.dataset.totalLines, 1);
  assert.equal(finalState.stats.all.totalLines, 1);
});

test('search, level, and time filters combine without mutating source records', async () => {
  const records = [
    makeRecord(1, '2026-10-27 ERROR database timeout', {
      level: 'ERROR',
      timestampMs: 1000,
    }),
    makeRecord(2, '2026-10-27 INFO database started', {
      level: 'INFO',
      timestampMs: 1500,
    }),
    makeRecord(3, '2026-10-27 WARN disk almost full', {
      level: 'WARN',
      timestampMs: 2000,
    }),
    makeRecord(4, 'database without timestamp', { level: 'ERROR' }),
    makeRecord(5, '', { blank: true }),
  ];
  const snapshot = structuredClone(records);
  const controller = createAppController({
    readFile: async (file) => successResult(records, file),
  });

  await controller.loadFile(makeFile('mixed.log', 400));

  controller.updateFilters({ query: 'database', levels: ['ERROR'] });
  let state = controller.getState();
  assert.equal(state.query.totalMatches, 2);
  assert.deepEqual(state.page.resultIndices, [0, 3]);
  assert.equal(state.stats.filtered.totalLines, 2);

  controller.updateFilters({ fromMs: 900, toMs: 1500 });
  state = controller.getState();
  assert.equal(state.query.totalMatches, 1);
  assert.deepEqual(state.page.resultIndices, [0]);
  assert.equal(state.query.excludedWithoutTimestamp, 2);
  assert.equal(state.filters.timeFilterActive, true);
  assert.equal(state.stats.filtered.totalLines, 1);

  controller.resetFilters();
  state = controller.getState();
  assert.equal(state.query.totalMatches, 5);
  assert.equal(state.stats.filtered.totalLines, 5);
  assert.equal(state.page.index, 0);
  assert.deepEqual(records, snapshot);
});

test('statistics cover all filtered matches beyond the 10,000 result cap', async () => {
  const records = Array.from({ length: 10_005 }, (_, index) => (
    makeRecord(index + 1, `match ${index + 1}`, {
      level: 'ERROR',
      timestampMs: index,
    })
  ));
  const controller = createAppController({
    readFile: async (file) => successResult(records, file),
  });

  await controller.loadFile(makeFile('large.log', 500_000));
  const state = controller.getState();

  assert.equal(state.query.totalMatches, 10_005);
  assert.equal(state.query.returnedCount, 10_000);
  assert.equal(state.query.truncated, true);
  assert.equal(state.stats.all.totalLines, 10_005);
  assert.equal(state.stats.filtered.totalLines, 10_005);
  assert.equal(state.stats.filtered.levelCounts.ERROR, 10_005);
  assert.equal(state.page.count, 100);
  assert.equal(state.canExport, true);

  const navigated = controller.nextMatch(-1);
  assert.equal(navigated.activeMatch.position, 9_999);
  assert.equal(navigated.activeMatch.pageIndex, 99);
  assert.equal(navigated.page.index, 99);
});

test('pagination exposes stable source indices and clears match selection', async () => {
  const records = Array.from({ length: 250 }, (_, index) => (
    makeRecord(index + 1, `match ${index + 1}`)
  ));
  const controller = createAppController({
    readFile: async (file) => successResult(records, file),
  });

  await controller.loadFile(makeFile('pages.log', 5_000));
  let state = controller.getState();
  assert.equal(state.page.size, PAGE_SIZE);
  assert.equal(state.page.count, 3);
  assert.deepEqual(state.page.resultIndices.slice(0, 2), [0, 1]);

  state = controller.nextMatch(1);
  assert.equal(state.activeMatch.position, 0);
  assert.equal(state.page.index, 0);

  state = controller.nextMatch(-1);
  assert.equal(state.activeMatch.position, 249);
  assert.equal(state.page.index, 2);
  assert.equal(state.page.start, 201);
  assert.equal(state.page.end, 250);

  state = controller.setPage(1);
  assert.equal(state.page.index, 1);
  assert.equal(state.activeMatch, null);
  assert.equal(state.page.resultIndices[0], 100);
  assert.equal(state.page.resultIndices[99], 199);
});

test('exports every filtered record, including blank raw lines, with a safe name', async () => {
  const records = [
    makeRecord(1, 'alpha first'),
    makeRecord(2, '', { blank: true }),
    makeRecord(3, 'beta'),
    makeRecord(4, 'alpha second'),
  ];
  const snapshot = structuredClone(records);
  const controller = createAppController({
    readFile: async (file) => successResult(records, file),
  });

  await controller.loadFile(makeFile('export.log', 100));
  controller.updateFilters({ query: 'alpha' });
  const exported = controller.exportFilteredResults({
    filename: '../my<export>.log',
  });

  assert.equal(exported.ok, true);
  assert.equal(exported.filename, 'my-export.log');
  assert.equal(exported.content, 'alpha first\nalpha second\n');
  assert.equal(exported.lineCount, 2);
  assert.equal(exported.content.includes('\r'), false);
  assert.deepEqual(records, snapshot);
});

test('clear removes the dataset, filters, statistics, and export state', async () => {
  const records = [makeRecord(1, 'alpha'), makeRecord(2, 'beta')];
  const controller = createAppController({
    readFile: async (file) => successResult(records, file),
  });

  await controller.loadFile(makeFile('clear.log', 50));
  controller.updateFilters({ query: 'alpha' });
  const state = controller.clearDataset();

  assert.equal(state.hasDataset, false);
  assert.equal(state.dataset, null);
  assert.equal(state.load.status, 'idle');
  assert.equal(state.load.error, null);
  assert.equal(state.filters.query, '');
  assert.deepEqual(state.filters.levels, LOG_LEVELS);
  assert.equal(state.query.totalMatches, 0);
  assert.equal(state.stats, null);
  assert.deepEqual(state.page.records, []);
  assert.equal(state.canExport, false);
  assert.equal(state.status.kind, 'idle');
});

test('returns a structured error when loading without an existing dataset', async () => {
  const controller = createAppController({
    readFile: async () => failureResult('invalid-file'),
  });

  const state = await controller.loadFile(makeFile('invalid.log', 10));

  assert.equal(state.hasDataset, false);
  assert.equal(state.load.status, 'error');
  assert.equal(state.load.error.code, 'invalid-file');
  assert.equal(state.stats, null);
  assert.equal(state.status.kind, 'error');
  assert.match(state.status.message, /tidak valid/);
});

test('default export name is stable and sanitized', () => {
  assert.equal(DEFAULT_EXPORT_FILENAME, 'loglens-filtered.log');
});

test('invalid time range is reported separately from a valid empty range', async () => {
  const records = [
    makeRecord(1, '2026-10-27 ERROR database timeout', {
      level: 'ERROR',
      timestampMs: 1000,
    }),
    makeRecord(2, '2026-10-27 INFO database started', {
      level: 'INFO',
      timestampMs: 1500,
    }),
    makeRecord(3, '2026-10-27 WARN disk almost full', {
      level: 'WARN',
      timestampMs: 2000,
    }),
    makeRecord(4, 'database without timestamp', { level: 'ERROR' }),
  ];
  const controller = createAppController({
    readFile: async (file) => successResult(records, file),
  });

  await controller.loadFile(makeFile('mixed.log', 400));
  const baseline = controller.getState();
  const baselineAll = structuredClone(baseline.stats.all);

  assert.equal(baseline.filters.timeRangeInvalid, false);
  assert.equal(baseline.query.totalMatches, 4);

  controller.updateFilters({ fromMs: 2000, toMs: 1000 });
  let state = controller.getState();

  assert.equal(state.filters.timeRangeInvalid, true);
  assert.equal(state.filters.timeFilterActive, true);
  assert.equal(state.query.totalMatches, 0);
  assert.equal(state.stats.filtered.totalLines, 0);
  assert.equal(state.stats.all.totalLines, 4);
  assert.deepEqual(state.stats.all, baselineAll);
  assert.equal(state.page.index, 0);

  controller.updateFilters({ fromMs: 1000, toMs: 2000 });
  state = controller.getState();

  assert.equal(state.filters.timeRangeInvalid, false);
  assert.equal(state.query.totalMatches, 3);
  assert.deepEqual(state.stats.all, baselineAll);

  controller.updateFilters({ fromMs: 3000, toMs: 3500 });
  state = controller.getState();

  assert.equal(state.filters.timeRangeInvalid, false);
  assert.equal(state.query.totalMatches, 0);
  assert.equal(state.stats.filtered.totalLines, 0);
  assert.deepEqual(state.stats.all, baselineAll);

  controller.resetFilters();
  state = controller.getState();

  assert.equal(state.filters.timeRangeInvalid, false);
  assert.equal(state.query.totalMatches, 4);
  assert.deepEqual(state.stats.all, baselineAll);
});
