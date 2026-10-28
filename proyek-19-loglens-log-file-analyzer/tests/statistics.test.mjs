import test from 'node:test';
import assert from 'node:assert/strict';

import { createLogRecord, LOG_LEVELS } from '../js/log-model.js';
import { compareStatistics, computeStatistics } from '../js/statistics.js';

function makeRecord(lineNumber, raw, options = {}) {
  return createLogRecord({
    lineNumber,
    raw,
    message: options.message ?? raw,
    level: options.level ?? 'UNKNOWN',
    timestampMs: options.timestampMs ?? null,
    timestampSource: options.timestampMs === undefined || options.timestampMs === null
      ? 'none'
      : 'iso',
    format: options.format ?? 'plain',
    blank: options.blank ?? false,
  });
}

test('counts every log level, including UNKNOWN', () => {
  const records = LOG_LEVELS.map((level, index) => (
    makeRecord(index + 1, `line ${level}`, { level })
  ));

  const stats = computeStatistics(records);

  assert.equal(stats.ok, true);
  assert.equal(stats.totalLines, LOG_LEVELS.length);
  assert.deepEqual(stats.levelCounts, {
    TRACE: 1,
    DEBUG: 1,
    INFO: 1,
    WARN: 1,
    ERROR: 1,
    FATAL: 1,
    UNKNOWN: 1,
  });
});

test('counts total lines, blank lines, and records without timestamps', () => {
  const records = [
    makeRecord(1, 'first', { timestampMs: 100 }),
    makeRecord(2, '', { blank: true }),
    makeRecord(3, 'third'),
    makeRecord(4, 'fourth', { timestampMs: 200 }),
  ];

  const stats = computeStatistics(records);

  assert.equal(stats.totalLines, 4);
  assert.equal(stats.blankLines, 1);
  assert.equal(stats.withoutTimestamp, 2);
  assert.equal(stats.timestampedLines, 2);
});

test('does not infer blank lines from an empty message', () => {
  const records = [
    makeRecord(1, 'raw text', { message: '', blank: false }),
    makeRecord(2, '', { message: '', blank: true }),
  ];

  const stats = computeStatistics(records);

  assert.equal(stats.totalLines, 2);
  assert.equal(stats.blankLines, 1);
});

test('does not derive total lines from message newlines', () => {
  const records = [
    makeRecord(1, 'one physical line', { message: 'line one\nline two\nline three' }),
  ];

  const stats = computeStatistics(records);

  assert.equal(stats.totalLines, 1);
});

test('treats a non-numeric timestamp as invalid', () => {
  const stats = computeStatistics([
    { raw: 'invalid time', level: 'INFO', timestampMs: 'not-a-number', blank: false },
  ]);

  assert.equal(stats.totalLines, 1);
  assert.equal(stats.withoutTimestamp, 1);
  assert.equal(stats.timestampedLines, 0);
  assert.equal(stats.firstTimestampMs, null);
  assert.equal(stats.lastTimestampMs, null);
});

test('finds the earliest and latest valid timestamps', () => {
  const records = [
    makeRecord(1, 'middle', { timestampMs: 200 }),
    makeRecord(2, 'latest', { timestampMs: 300 }),
    makeRecord(3, 'earliest', { timestampMs: 100 }),
  ];

  const stats = computeStatistics(records);

  assert.equal(stats.firstTimestampMs, 100);
  assert.equal(stats.lastTimestampMs, 300);
  assert.equal(stats.firstTimestampIso, '1970-01-01T00:00:00.100Z');
  assert.equal(stats.lastTimestampIso, '1970-01-01T00:00:00.300Z');
  assert.equal(stats.withoutTimestamp, 0);
  assert.equal(stats.timestampedLines, 3);
});

test('treats epoch zero as a valid timestamp', () => {
  const stats = computeStatistics([makeRecord(1, 'epoch', { timestampMs: 0 })]);

  assert.equal(stats.firstTimestampMs, 0);
  assert.equal(stats.lastTimestampMs, 0);
  assert.equal(stats.firstTimestampIso, '1970-01-01T00:00:00.000Z');
  assert.equal(stats.withoutTimestamp, 0);
});

test('returns zeroed statistics for an empty dataset', () => {
  const stats = computeStatistics([]);

  assert.equal(stats.ok, true);
  assert.equal(stats.totalLines, 0);
  assert.equal(stats.blankLines, 0);
  assert.equal(stats.withoutTimestamp, 0);
  assert.equal(stats.timestampedLines, 0);
  assert.equal(stats.firstTimestampMs, null);
  assert.equal(stats.lastTimestampMs, null);
  assert.equal(stats.firstTimestampIso, null);
  assert.equal(stats.lastTimestampIso, null);
  assert.deepEqual(stats.levelCounts, {
    TRACE: 0,
    DEBUG: 0,
    INFO: 0,
    WARN: 0,
    ERROR: 0,
    FATAL: 0,
    UNKNOWN: 0,
  });
});

test('normalizes unknown levels while counting', () => {
  const stats = computeStatistics([
    makeRecord(1, 'notice', { level: 'NOTICE' }),
    makeRecord(2, 'warning', { level: 'WARNING' }),
    makeRecord(3, 'critical', { level: 'CRITICAL' }),
  ]);

  assert.equal(stats.levelCounts.UNKNOWN, 1);
  assert.equal(stats.levelCounts.WARN, 1);
  assert.equal(stats.levelCounts.FATAL, 1);
});

test('compares full dataset statistics with filtered statistics', () => {
  const allRecords = [
    makeRecord(1, 'error', { level: 'ERROR', timestampMs: 100 }),
    makeRecord(2, 'info', { level: 'INFO', timestampMs: 200 }),
    makeRecord(3, 'warn', { level: 'WARN', timestampMs: 300 }),
  ];
  const filteredRecords = [allRecords[0], allRecords[2]];

  const comparison = compareStatistics(allRecords, filteredRecords);

  assert.equal(comparison.ok, true);
  assert.equal(comparison.all.totalLines, 3);
  assert.equal(comparison.filtered.totalLines, 2);
  assert.equal(comparison.filteredCount, 2);
  assert.equal(comparison.all.levelCounts.ERROR, 1);
  assert.equal(comparison.filtered.levelCounts.ERROR, 1);
});

test('handles invalid statistics input without crashing', () => {
  const stats = computeStatistics(null);

  assert.equal(stats.ok, false);
  assert.equal(stats.totalLines, 0);
  assert.equal(stats.error, 'Records harus berupa array.');

  const comparison = compareStatistics(null, []);
  assert.equal(comparison.ok, false);
  assert.equal(comparison.filteredCount, 0);
});

test('does not mutate input records or the array', () => {
  const records = [
    makeRecord(1, 'error', { level: 'ERROR', timestampMs: 100 }),
    makeRecord(2, 'info', { level: 'INFO', timestampMs: 200 }),
  ];
  const snapshot = structuredClone(records);
  Object.freeze(records[0]);
  Object.freeze(records[1]);
  Object.freeze(records);

  const stats = computeStatistics(records);

  assert.equal(stats.ok, true);
  assert.deepEqual(records, snapshot);
});
