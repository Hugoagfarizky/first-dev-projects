import { LOG_LEVELS, normalizeLevel } from './log-model.js';

function emptyLevelCounts() {
  return Object.fromEntries(LOG_LEVELS.map((level) => [level, 0]));
}

function emptyStatistics() {
  return {
    totalLines: 0,
    blankLines: 0,
    levelCounts: emptyLevelCounts(),
    withoutTimestamp: 0,
    timestampedLines: 0,
    firstTimestampMs: null,
    lastTimestampMs: null,
    firstTimestampIso: null,
    lastTimestampIso: null,
  };
}

function toIso(timestampMs) {
  try {
    return new Date(timestampMs).toISOString();
  } catch {
    return null;
  }
}

/**
 * Calculate statistics from canonical log records.
 *
 * `totalLines` is the number of physical records supplied, never a count
 * derived from message text or line breaks inside a message.
 */
export function computeStatistics(records) {
  if (!Array.isArray(records)) {
    return {
      ok: false,
      ...emptyStatistics(),
      error: 'Records harus berupa array.',
    };
  }

  const result = emptyStatistics();
  result.totalLines = records.length;

  for (const record of records) {
    if (record?.blank === true) {
      result.blankLines += 1;
    }

    const level = normalizeLevel(record?.level);
    result.levelCounts[level] += 1;

    if (!Number.isFinite(record?.timestampMs)) {
      result.withoutTimestamp += 1;
      continue;
    }

    if (result.firstTimestampMs === null || record.timestampMs < result.firstTimestampMs) {
      result.firstTimestampMs = record.timestampMs;
      result.firstTimestampIso = toIso(record.timestampMs);
    }

    if (result.lastTimestampMs === null || record.timestampMs > result.lastTimestampMs) {
      result.lastTimestampMs = record.timestampMs;
      result.lastTimestampIso = toIso(record.timestampMs);
    }
  }

  result.timestampedLines = result.totalLines - result.withoutTimestamp;

  return {
    ok: true,
    ...result,
    error: null,
  };
}

/**
 * Calculate dataset-wide and filtered statistics with explicit field names.
 * The caller should pass the complete filtered collection to `filteredRecords`,
 * not a paginated slice.
 */
export function compareStatistics(allRecords, filteredRecords) {
  const all = computeStatistics(allRecords);
  const filtered = computeStatistics(filteredRecords);

  return {
    ok: all.ok && filtered.ok,
    all,
    filtered,
    filteredCount: filtered.totalLines,
    error: all.ok && filtered.ok ? null : 'Statistik memerlukan array records.',
  };
}
