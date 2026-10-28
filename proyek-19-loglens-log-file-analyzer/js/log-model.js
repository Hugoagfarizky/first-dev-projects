export const LOG_LEVELS = Object.freeze([
  'TRACE',
  'DEBUG',
  'INFO',
  'WARN',
  'ERROR',
  'FATAL',
  'UNKNOWN',
]);

export const LOG_FORMATS = Object.freeze(['plain', 'jsonl', 'structured-text']);

export const TIMESTAMP_SOURCES = Object.freeze(['iso', 'local', 'none']);

export const DEFAULT_MAX_LINE_LENGTH = 64 * 1024;

function codePointByteLength(codePoint) {
  if (codePoint <= 0x7f) {
    return 1;
  }
  if (codePoint <= 0x7ff) {
    return 2;
  }
  if (codePoint <= 0xffff) {
    return 3;
  }
  return 4;
}

export function utf8ByteLength(value) {
  const text = typeof value === 'string' ? value : String(value ?? '');
  let bytes = 0;

  for (const character of text) {
    bytes += codePointByteLength(character.codePointAt(0));
  }

  return bytes;
}

const LEVEL_ALIASES = new Map([
  ['TRACE', 'TRACE'],
  ['DEBUG', 'DEBUG'],
  ['INFO', 'INFO'],
  ['WARN', 'WARN'],
  ['WARNING', 'WARN'],
  ['ERROR', 'ERROR'],
  ['FATAL', 'FATAL'],
  ['CRITICAL', 'FATAL'],
]);

export function normalizeLevel(value) {
  if (typeof value !== 'string') {
    return 'UNKNOWN';
  }

  return LEVEL_ALIASES.get(value.trim().toUpperCase()) || 'UNKNOWN';
}

/**
 * Truncate text to at most `maxLineLength` UTF-8 bytes without splitting a
 * Unicode code point. If the next character cannot fit, it is excluded
 * entirely and the result is marked as truncated.
 */
export function truncateLine(raw, maxLineLength = DEFAULT_MAX_LINE_LENGTH) {
  const text = typeof raw === 'string' ? raw : String(raw ?? '');
  const limit = Number.isInteger(maxLineLength) && maxLineLength > 0
    ? maxLineLength
    : DEFAULT_MAX_LINE_LENGTH;

  let bytes = 0;
  let end = 0;

  for (const character of text) {
    const characterBytes = codePointByteLength(character.codePointAt(0));
    if (bytes + characterBytes > limit) {
      return { raw: text.slice(0, end), lineTruncated: true };
    }

    bytes += characterBytes;
    end += character.length;
  }

  return { raw: text, lineTruncated: false };
}

export function createLogRecord(input = {}) {
  const raw = typeof input.raw === 'string' ? input.raw : String(input.raw ?? '');
  const lineNumber = Number.isInteger(input.lineNumber) && input.lineNumber > 0
    ? input.lineNumber
    : 1;

  let timestampMs = Number.isFinite(input.timestampMs) ? input.timestampMs : null;
  let timestampIso = null;
  let timestampSource = 'none';

  if (timestampMs !== null) {
    try {
      const date = new Date(timestampMs);
      timestampIso = date.toISOString();
      timestampSource = input.timestampSource === 'iso' || input.timestampSource === 'local'
        ? input.timestampSource
        : 'none';
    } catch {
      timestampMs = null;
      timestampIso = null;
      timestampSource = 'none';
    }
  }

  return {
    lineNumber,
    raw,
    timestampMs,
    timestampIso,
    timestampSource,
    level: normalizeLevel(input.level),
    message: typeof input.message === 'string' ? input.message : String(input.message ?? ''),
    format: LOG_FORMATS.includes(input.format) ? input.format : 'plain',
    blank: Boolean(input.blank),
    lineTruncated: Boolean(input.lineTruncated),
  };
}
