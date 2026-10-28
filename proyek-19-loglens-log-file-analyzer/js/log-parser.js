import {
  createLogRecord,
  normalizeLevel,
  truncateLine,
} from './log-model.js';
import { parseTimestamp } from './timestamp-parser.js';

const TIMESTAMP_CANDIDATE = String.raw`\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:[Zz]|[+-]\d{2}:?\d{2})?`;
const BRACKETED_TIMESTAMP_PATTERN = new RegExp(`^\\[\\s*(${TIMESTAMP_CANDIDATE})\\s*\\]`);
const PLAIN_TIMESTAMP_PATTERN = new RegExp(`^(${TIMESTAMP_CANDIDATE})(?=[ \\t]|$)`);
const LEVEL_TOKEN_PATTERN = /^(?:[-|:]\s*)?\[?\s*(WARNING|TRACE|DEBUG|INFO|WARN|ERROR|FATAL|CRITICAL)(?![A-Za-z0-9_])(?:\s*\])?/i;

function trimJsonWhitespace(value) {
  return value.replace(/^[ \t]+|[ \t]+$/g, '');
}

function trimLeadingSpaces(value) {
  return value.replace(/^[ \t]+/, '');
}

function splitPhysicalLines(text) {
  if (text === '') {
    return [];
  }

  const lines = text.split(/\r\n|\n|\r/);
  if (lines[lines.length - 1] === '') {
    lines.pop();
  }

  return lines;
}

function firstPresent(values) {
  for (const value of values) {
    if (value !== undefined && value !== null) {
      return value;
    }
  }

  return undefined;
}

function nestedValue(object, parentKey, childKey) {
  const parent = object[parentKey];
  if (parent && typeof parent === 'object' && !Array.isArray(parent)) {
    return parent[childKey];
  }

  return undefined;
}

function safeMessage(value, fallback) {
  if (typeof value === 'string') {
    return value;
  }

  if (value === undefined || value === null) {
    return fallback;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  try {
    const serialized = JSON.stringify(value);
    return typeof serialized === 'string' ? serialized : fallback;
  } catch {
    return fallback;
  }
}

function parseJsonLine(raw, lineNumber, lineTruncated) {
  const trimmed = trimJsonWhitespace(raw);
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
    return null;
  }

  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }

  const timestampValue = firstPresent([
    parsed.timestamp,
    parsed.time,
    parsed.ts,
    parsed['@timestamp'],
    parsed.date,
    nestedValue(parsed, 'log', 'timestamp'),
  ]);
  const levelValue = firstPresent([
    parsed.level,
    parsed.severity,
    parsed.lvl,
    nestedValue(parsed, 'log', 'level'),
  ]);
  const messageValue = firstPresent([
    parsed.message,
    parsed.msg,
    parsed.event,
  ]);

  let timestamp = null;
  if (typeof timestampValue === 'string') {
    const parsedTimestamp = parseTimestamp(timestampValue);
    if (parsedTimestamp.ok) {
      timestamp = parsedTimestamp;
    }
  }

  return createLogRecord({
    lineNumber,
    raw,
    timestampMs: timestamp?.timestampMs ?? null,
    timestampSource: timestamp?.timestampSource ?? 'none',
    level: normalizeLevel(levelValue),
    message: safeMessage(messageValue, trimmed),
    format: 'jsonl',
    blank: false,
    lineTruncated,
  });
}

function parseStructuredLine(raw, lineNumber, lineTruncated) {
  const content = trimLeadingSpaces(raw);

  const bracketedMatch = BRACKETED_TIMESTAMP_PATTERN.exec(content);
  const plainMatch = bracketedMatch ? null : PLAIN_TIMESTAMP_PATTERN.exec(content);
  const match = bracketedMatch || plainMatch;

  if (!match) {
    return null;
  }

  const parsedTimestamp = parseTimestamp(match[1]);
  if (!parsedTimestamp.ok) {
    return null;
  }

  let remainder = content.slice(match[0].length);
  remainder = trimLeadingSpaces(remainder);

  let level = 'UNKNOWN';
  const levelMatch = LEVEL_TOKEN_PATTERN.exec(remainder);
  if (levelMatch) {
    level = normalizeLevel(levelMatch[1]);
    remainder = remainder.slice(levelMatch[0].length);
    remainder = remainder.replace(/^[ \t]*(?:[:\-|])?[ \t]*/, '');
  }

  return createLogRecord({
    lineNumber,
    raw,
    timestampMs: parsedTimestamp.timestampMs,
    timestampSource: parsedTimestamp.timestampSource,
    level,
    message: remainder,
    format: 'structured-text',
    blank: false,
    lineTruncated,
  });
}

/**
 * Parse one physical line. The line must not include a trailing newline.
 * `options.maxLineLength` is a UTF-8 byte limit; truncation is reflected in
 * the returned record's `lineTruncated` flag.
 */
export function parseLogLine(line, lineNumber = 1, options = {}) {
  const settings = options && typeof options === 'object' ? options : {};
  const source = typeof line === 'string' ? line : String(line ?? '');
  const truncated = truncateLine(source, settings.maxLineLength);
  const number = Number.isInteger(lineNumber) && lineNumber > 0 ? lineNumber : 1;

  if (truncated.raw.trim() === '') {
    return createLogRecord({
      lineNumber: number,
      raw: truncated.raw,
      level: 'UNKNOWN',
      message: '',
      format: 'plain',
      blank: true,
      lineTruncated: truncated.lineTruncated,
    });
  }

  const jsonRecord = parseJsonLine(truncated.raw, number, truncated.lineTruncated);
  if (jsonRecord) {
    return jsonRecord;
  }

  const structuredRecord = parseStructuredLine(truncated.raw, number, truncated.lineTruncated);
  if (structuredRecord) {
    return structuredRecord;
  }

  return createLogRecord({
    lineNumber: number,
    raw: truncated.raw,
    level: 'UNKNOWN',
    message: truncated.raw,
    format: 'plain',
    blank: false,
    lineTruncated: truncated.lineTruncated,
  });
}

/**
 * Parse a complete log text into canonical records.
 *
 * `text` may use LF, CRLF, or CR line endings. A BOM at the very start of
 * the input is removed once; BOM characters elsewhere are preserved.
 */
export function parseLogText(text, options = {}) {
  if (typeof text !== 'string') {
    return {
      ok: false,
      records: [],
      totalLines: 0,
      truncatedLines: 0,
      error: 'Input log harus berupa string.',
    };
  }

  let source = text;
  if (source.startsWith('\uFEFF')) {
    source = source.slice(1);
  }

  const settings = options && typeof options === 'object' ? options : {};
  const lines = splitPhysicalLines(source);
  const records = [];
  let truncatedLines = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const record = parseLogLine(lines[index], index + 1, settings);
    if (record.lineTruncated) {
      truncatedLines += 1;
    }
    records.push(record);
  }

  return {
    ok: true,
    records,
    totalLines: records.length,
    truncatedLines,
    error: null,
  };
}
