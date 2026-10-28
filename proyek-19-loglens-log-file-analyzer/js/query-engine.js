import { normalizeLevel } from './log-model.js';

export const DEFAULT_RESULT_LIMIT = 10_000;

function failure(message, limit) {
  return {
    ok: false,
    results: [],
    resultIndices: [],
    matchedIndices: [],
    totalMatches: 0,
    returnedCount: 0,
    truncated: false,
    excludedWithoutTimestamp: 0,
    limit,
    error: {
      code: 'invalid-input',
      message,
    },
  };
}

function normalizeLimit(value) {
  if (!Number.isInteger(value) || value < 1) {
    return DEFAULT_RESULT_LIMIT;
  }

  return Math.min(value, DEFAULT_RESULT_LIMIT);
}

function normalizeLevels(value) {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const selected = new Set();
  for (const level of value) {
    selected.add(normalizeLevel(level));
  }

  return selected;
}

function normalizeTimeBound(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Filter records without mutating the input array or its records.
 *
 * `results` contains at most `limit` matching records (default and hard maximum
 * 10,000). `totalMatches` is the full match count, and `truncated` indicates
 * that more matches exist than were returned. `resultIndices` maps each returned
 * result back to its position in the input array. `matchedIndices` contains the
 * positions of every match, including matches beyond the result cap, so callers
 * can compute complete filtered statistics or export all matches.
 */
export function queryLogs(records, options = {}) {
  const settings = options && typeof options === 'object' ? options : {};
  const limit = normalizeLimit(settings.limit);

  if (!Array.isArray(records)) {
    return failure('Records harus berupa array.', limit);
  }

  const query = settings.query === undefined || settings.query === null
    ? ''
    : String(settings.query);
  const queryLower = query.toLowerCase();
  const levels = normalizeLevels(settings.levels);
  const fromMs = normalizeTimeBound(settings.fromMs);
  const toMs = normalizeTimeBound(settings.toMs);
  const timeFilterActive = fromMs !== null || toMs !== null;
  const invalidTimeRange = fromMs !== null && toMs !== null && fromMs > toMs;

  const results = [];
  const resultIndices = [];
  const matchedIndices = [];
  let totalMatches = 0;
  let excludedWithoutTimestamp = 0;

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];

    if (timeFilterActive) {
      if (!Number.isFinite(record?.timestampMs)) {
        excludedWithoutTimestamp += 1;
        continue;
      }

      if (invalidTimeRange) {
        continue;
      }

      if (fromMs !== null && record.timestampMs < fromMs) {
        continue;
      }

      if (toMs !== null && record.timestampMs > toMs) {
        continue;
      }
    }

    if (levels && !levels.has(normalizeLevel(record?.level))) {
      continue;
    }

    if (queryLower !== '') {
      const raw = typeof record?.raw === 'string' ? record.raw : '';
      const message = typeof record?.message === 'string' ? record.message : '';
      if (!raw.toLowerCase().includes(queryLower) && !message.toLowerCase().includes(queryLower)) {
        continue;
      }
    }

    totalMatches += 1;
    matchedIndices.push(index);

    if (results.length < limit) {
      results.push(record);
      resultIndices.push(index);
    }
  }

  return {
    ok: true,
    results,
    resultIndices,
    matchedIndices,
    totalMatches,
    returnedCount: results.length,
    truncated: totalMatches > results.length,
    excludedWithoutTimestamp,
    limit,
    error: null,
  };
}

/**
 * Return the previous or next position in a result set, wrapping around.
 * A direction below zero navigates backwards.
 */
export function nextMatchPosition(currentPosition, matchCount, direction = 1) {
  const count = Number.isInteger(matchCount) && matchCount > 0 ? matchCount : 0;
  if (count === 0) {
    return -1;
  }

  const step = direction < 0 ? -1 : 1;
  const current = Number.isInteger(currentPosition) && currentPosition >= 0
    && currentPosition < count
    ? currentPosition
    : -1;

  if (current === -1) {
    return step < 0 ? count - 1 : 0;
  }

  return (current + step + count) % count;
}
