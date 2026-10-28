import test from 'node:test';
import assert from 'node:assert/strict';

import { createLogRecord } from '../js/log-model.js';
import {
  DEFAULT_RESULT_LIMIT,
  nextMatchPosition,
  queryLogs,
} from '../js/query-engine.js';

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

test('searches raw and message case-insensitively', () => {
  const records = [
    makeRecord(1, 'Alpha raw', { message: 'first' }),
    makeRecord(2, 'plain', { message: 'BETA message' }),
    makeRecord(3, 'nothing', { message: 'nothing' }),
  ];

  const rawResult = queryLogs(records, { query: 'alpha' });
  assert.equal(rawResult.totalMatches, 1);
  assert.equal(rawResult.results[0], records[0]);

  const messageResult = queryLogs(records, { query: 'beta' });
  assert.equal(messageResult.totalMatches, 1);
  assert.equal(messageResult.results[0], records[1]);
});

test('treats search characters literally instead of as regex', () => {
  const records = [
    makeRecord(1, 'a.*b'),
    makeRecord(2, 'axxb'),
    makeRecord(3, '[ERROR]'),
  ];

  const regexLike = queryLogs(records, { query: 'a.*b' });
  assert.equal(regexLike.totalMatches, 1);
  assert.equal(regexLike.results[0], records[0]);

  const bracket = queryLogs(records, { query: '[error]' });
  assert.equal(bracket.totalMatches, 1);
  assert.equal(bracket.results[0], records[2]);
});

test('filters one level and combines levels', () => {
  const records = [
    makeRecord(1, 'trace', { level: 'TRACE' }),
    makeRecord(2, 'debug', { level: 'DEBUG' }),
    makeRecord(3, 'info', { level: 'INFO' }),
    makeRecord(4, 'warn', { level: 'WARN' }),
    makeRecord(5, 'error', { level: 'ERROR' }),
    makeRecord(6, 'unknown', { level: 'UNKNOWN' }),
  ];

  assert.equal(queryLogs(records, { levels: ['ERROR'] }).totalMatches, 1);
  assert.deepEqual(
    queryLogs(records, { levels: ['WARN', 'ERROR'] }).results.map((record) => record.lineNumber),
    [4, 5],
  );
  assert.equal(queryLogs(records, { levels: ['UNKNOWN'] }).totalMatches, 1);
  assert.equal(queryLogs(records, { levels: [] }).totalMatches, 6);
});

test('filters an inclusive timestamp range', () => {
  const records = [
    makeRecord(1, 'before', { timestampMs: 99 }),
    makeRecord(2, 'from', { timestampMs: 100 }),
    makeRecord(3, 'middle', { timestampMs: 200 }),
    makeRecord(4, 'to', { timestampMs: 300 }),
    makeRecord(5, 'after', { timestampMs: 301 }),
  ];

  const result = queryLogs(records, { fromMs: 100, toMs: 300 });

  assert.equal(result.totalMatches, 3);
  assert.deepEqual(result.results.map((record) => record.lineNumber), [2, 3, 4]);
  assert.equal(result.excludedWithoutTimestamp, 0);
});

test('includes epoch zero as a valid timestamp', () => {
  const records = [
    makeRecord(1, 'epoch', { timestampMs: 0 }),
    makeRecord(2, 'missing'),
  ];

  const result = queryLogs(records, { fromMs: 0, toMs: 0 });

  assert.equal(result.totalMatches, 1);
  assert.equal(result.results[0].lineNumber, 1);
  assert.equal(result.excludedWithoutTimestamp, 1);
});

test('excludes and counts records without timestamps when time filtering is active', () => {
  const records = [
    makeRecord(1, 'with time', { timestampMs: 1000 }),
    makeRecord(2, 'no time'),
    makeRecord(3, 'also no time'),
  ];

  const result = queryLogs(records, { fromMs: 0 });

  assert.equal(result.totalMatches, 1);
  assert.equal(result.returnedCount, 1);
  assert.equal(result.excludedWithoutTimestamp, 2);
});

test('handles an invalid time range consistently', () => {
  const records = [
    makeRecord(1, 'with time', { timestampMs: 1000 }),
    makeRecord(2, 'no time'),
  ];

  const result = queryLogs(records, { fromMs: 2000, toMs: 1000 });

  assert.equal(result.ok, true);
  assert.equal(result.totalMatches, 0);
  assert.equal(result.excludedWithoutTimestamp, 1);
});

test('combines query, level, and time filters', () => {
  const records = [
    makeRecord(1, '2026-10-27 ERROR database timeout', {
      level: 'ERROR',
      timestampMs: 1000,
    }),
    makeRecord(2, '2026-10-27 ERROR database timeout', {
      level: 'WARN',
      timestampMs: 1000,
    }),
    makeRecord(3, '2026-10-27 INFO cache warm', {
      level: 'ERROR',
      timestampMs: 1000,
    }),
    makeRecord(4, '2026-10-27 ERROR cache miss', {
      level: 'ERROR',
      timestampMs: 1000,
    }),
    makeRecord(5, '2026-10-27 ERROR database timeout', {
      level: 'ERROR',
      timestampMs: 500,
    }),
  ];

  const result = queryLogs(records, {
    query: 'database',
    levels: ['ERROR'],
    fromMs: 900,
    toMs: 1100,
  });

  assert.equal(result.totalMatches, 1);
  assert.equal(result.results[0].lineNumber, 1);
});

test('returns an empty result when nothing matches', () => {
  const result = queryLogs([makeRecord(1, 'hello')], { query: 'missing' });

  assert.equal(result.ok, true);
  assert.deepEqual(result.results, []);
  assert.deepEqual(result.resultIndices, []);
  assert.equal(result.totalMatches, 0);
  assert.equal(result.truncated, false);
});

test('caps results at 10,000 while reporting the full match count', () => {
  const records = Array.from({ length: DEFAULT_RESULT_LIMIT + 5 }, (_, index) => (
    makeRecord(index + 1, `line ${index + 1}`)
  ));

  const result = queryLogs(records, { query: 'line' });

  assert.equal(result.results.length, DEFAULT_RESULT_LIMIT);
  assert.equal(result.returnedCount, DEFAULT_RESULT_LIMIT);
  assert.equal(result.totalMatches, DEFAULT_RESULT_LIMIT + 5);
  assert.equal(result.truncated, true);
  assert.equal(result.limit, DEFAULT_RESULT_LIMIT);
  assert.equal(result.resultIndices[0], 0);
  assert.equal(result.resultIndices[DEFAULT_RESULT_LIMIT - 1], DEFAULT_RESULT_LIMIT - 1);
  assert.equal(result.matchedIndices.length, DEFAULT_RESULT_LIMIT + 5);
  assert.equal(result.matchedIndices[0], 0);
  assert.equal(result.matchedIndices[DEFAULT_RESULT_LIMIT + 4], DEFAULT_RESULT_LIMIT + 4);
});

test('supports a smaller result limit', () => {
  const records = Array.from({ length: 5 }, (_, index) => makeRecord(index + 1, 'match'));
  const result = queryLogs(records, { limit: 2 });

  assert.equal(result.results.length, 2);
  assert.equal(result.totalMatches, 5);
  assert.equal(result.truncated, true);
  assert.deepEqual(result.resultIndices, [0, 1]);
});

test('clamps an oversized limit to 10,000', () => {
  const result = queryLogs([], { limit: 50_000 });
  assert.equal(result.limit, DEFAULT_RESULT_LIMIT);
});

test('navigates result positions forward and backward with wraparound', () => {
  assert.equal(nextMatchPosition(-1, 3, 1), 0);
  assert.equal(nextMatchPosition(-1, 3, -1), 2);
  assert.equal(nextMatchPosition(0, 3, 1), 1);
  assert.equal(nextMatchPosition(2, 3, 1), 0);
  assert.equal(nextMatchPosition(0, 3, -1), 2);
  assert.equal(nextMatchPosition(1, 3, -1), 0);
  assert.equal(nextMatchPosition(0, 0, 1), -1);
  assert.equal(nextMatchPosition(99, 3, 1), 0);
});

test('handles invalid input without crashing', () => {
  const invalid = queryLogs(null);
  assert.equal(invalid.ok, false);
  assert.equal(invalid.error.code, 'invalid-input');
  assert.deepEqual(invalid.results, []);

  const defaulted = queryLogs([makeRecord(1, 'a')], null);
  assert.equal(defaulted.ok, true);

  const nullQuery = queryLogs([makeRecord(1, 'a')], { query: null });
  assert.equal(nullQuery.totalMatches, 1);

  const invalidLevels = queryLogs([makeRecord(1, 'a')], { levels: 'ERROR' });
  assert.equal(invalidLevels.totalMatches, 1);

  const invalidTime = queryLogs([makeRecord(1, 'a')], { fromMs: 'bad' });
  assert.equal(invalidTime.totalMatches, 1);
});

test('does not mutate the input records or array', () => {
  const records = [
    makeRecord(1, 'alpha', { level: 'INFO', timestampMs: 100 }),
    makeRecord(2, 'beta', { level: 'ERROR', timestampMs: 200 }),
  ];
  const snapshot = structuredClone(records);
  Object.freeze(records[0]);
  Object.freeze(records[1]);
  Object.freeze(records);

  const result = queryLogs(records, {
    query: 'a',
    levels: ['INFO', 'ERROR'],
    fromMs: 0,
  });

  assert.equal(result.ok, true);
  assert.deepEqual(records, snapshot);
  assert.deepEqual(result.resultIndices, [0, 1]);
});
