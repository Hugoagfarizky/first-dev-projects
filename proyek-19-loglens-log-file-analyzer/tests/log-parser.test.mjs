import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createLogRecord,
  DEFAULT_MAX_LINE_LENGTH,
  normalizeLevel,
  truncateLine,
  utf8ByteLength,
} from '../js/log-model.js';
import { parseLogLine, parseLogText } from '../js/log-parser.js';

function hasUnpairedSurrogate(value) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        return true;
      }
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return true;
    }
  }

  return false;
}

function localEpoch(year, month, day, hour, minute, second, millisecond = 0) {
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(hour, minute, second, millisecond);
  return date.getTime();
}

test('parseLogText returns an empty result for empty input', () => {
  assert.deepEqual(parseLogText(''), {
    ok: true,
    records: [],
    totalLines: 0,
    truncatedLines: 0,
    error: null,
  });
});

test('keeps a plain line as a raw record', () => {
  const record = parseLogLine('hello world', 4);

  assert.equal(record.lineNumber, 4);
  assert.equal(record.raw, 'hello world');
  assert.equal(record.timestampMs, null);
  assert.equal(record.timestampIso, null);
  assert.equal(record.timestampSource, 'none');
  assert.equal(record.level, 'UNKNOWN');
  assert.equal(record.message, 'hello world');
  assert.equal(record.format, 'plain');
  assert.equal(record.blank, false);
  assert.equal(record.lineTruncated, false);
});

test('parses structured text with an ISO timestamp and level', () => {
  const record = parseLogLine('2026-10-27T10:20:30.123Z INFO server started');

  assert.equal(record.lineNumber, 1);
  assert.equal(record.timestampMs, Date.UTC(2026, 9, 27, 10, 20, 30, 123));
  assert.equal(record.timestampIso, '2026-10-27T10:20:30.123Z');
  assert.equal(record.timestampSource, 'iso');
  assert.equal(record.level, 'INFO');
  assert.equal(record.message, 'server started');
  assert.equal(record.format, 'structured-text');
  assert.equal(record.blank, false);
});

test('parses structured text with local time and normalizes WARNING', () => {
  const record = parseLogLine('2026-10-27 10:20:30 [WARNING] disk space low');

  assert.equal(record.timestampMs, localEpoch(2026, 10, 27, 10, 20, 30));
  assert.equal(record.timestampSource, 'local');
  assert.equal(record.level, 'WARN');
  assert.equal(record.message, 'disk space low');
  assert.equal(record.format, 'structured-text');
});

test('parses bracketed timestamps and normalizes CRITICAL', () => {
  const record = parseLogLine('[2026-10-27 10:20:30] CRITICAL fatal error');

  assert.equal(record.timestampMs, localEpoch(2026, 10, 27, 10, 20, 30));
  assert.equal(record.level, 'FATAL');
  assert.equal(record.message, 'fatal error');
  assert.equal(record.format, 'structured-text');
});

test('supports common level separators and leading whitespace', () => {
  const colon = parseLogLine('  2026-10-27T10:20:30Z ERROR: failed');
  assert.equal(colon.level, 'ERROR');
  assert.equal(colon.message, 'failed');
  assert.equal(colon.raw, '  2026-10-27T10:20:30Z ERROR: failed');

  const dash = parseLogLine('2026-10-27T10:20:30Z - WARN - slow');
  assert.equal(dash.level, 'WARN');
  assert.equal(dash.message, 'slow');
});

test('keeps an unknown structured level as UNKNOWN', () => {
  const record = parseLogLine('2026-10-27T10:20:30Z NOTICE maintenance window');

  assert.equal(record.format, 'structured-text');
  assert.equal(record.level, 'UNKNOWN');
  assert.equal(record.message, 'NOTICE maintenance window');
});

test('does not treat text without a timestamp as a structured line', () => {
  const record = parseLogLine('ERROR not a structured line');

  assert.equal(record.format, 'plain');
  assert.equal(record.level, 'UNKNOWN');
  assert.equal(record.message, 'ERROR not a structured line');
});

test('falls back to plain text for an impossible structured timestamp', () => {
  const record = parseLogLine('2026-02-30 10:20:30 ERROR impossible date');

  assert.equal(record.format, 'plain');
  assert.equal(record.level, 'UNKNOWN');
  assert.equal(record.timestampMs, null);
  assert.equal(record.message, '2026-02-30 10:20:30 ERROR impossible date');
});

test('parses JSON Lines with timestamp, level, and message', () => {
  const record = parseLogLine('{"timestamp":"2026-10-27T10:20:30Z","level":"ERROR","message":"boom"}');

  assert.equal(record.format, 'jsonl');
  assert.equal(record.timestampMs, Date.UTC(2026, 9, 27, 10, 20, 30));
  assert.equal(record.timestampSource, 'iso');
  assert.equal(record.level, 'ERROR');
  assert.equal(record.message, 'boom');
});

test('parses JSON Lines field variants and normalizes levels', () => {
  const warning = parseLogLine('{"time":"2026-10-27T10:20:30Z","severity":"warning","msg":"slow"}');
  assert.equal(warning.level, 'WARN');
  assert.equal(warning.message, 'slow');

  const critical = parseLogLine('{"ts":"2026-10-27T10:20:30Z","lvl":"critical","event":"fatal"}');
  assert.equal(critical.level, 'FATAL');
  assert.equal(critical.message, 'fatal');

  const nested = parseLogLine('{"@timestamp":"2026-10-27T10:20:30Z","log":{"level":"info"},"message":"nested"}');
  assert.equal(nested.level, 'INFO');
  assert.equal(nested.message, 'nested');

  const nestedTimestamp = parseLogLine('{"log":{"timestamp":"2026-10-27T10:20:30Z","level":"debug"},"msg":"nested"}');
  assert.equal(nestedTimestamp.timestampMs, Date.UTC(2026, 9, 27, 10, 20, 30));
  assert.equal(nestedTimestamp.level, 'DEBUG');
});

test('uses the trimmed JSON text when no message field is available', () => {
  const record = parseLogLine('  {"timestamp":"2026-10-27T10:20:30Z","level":"INFO"}  ');

  assert.equal(record.format, 'jsonl');
  assert.equal(record.message, '{"timestamp":"2026-10-27T10:20:30Z","level":"INFO"}');
});

test('keeps invalid JSON as a raw line', () => {
  const line = '{"timestamp":"2026-10-27T10:20:30Z","level":"ERROR"';
  const record = parseLogLine(line);

  assert.equal(record.format, 'plain');
  assert.equal(record.level, 'UNKNOWN');
  assert.equal(record.message, line);
});

test('rejects JSON arrays and primitive JSON values as JSON Lines', () => {
  assert.equal(parseLogLine('[1,2,3]').format, 'plain');
  assert.equal(parseLogLine('"just a string"').format, 'plain');
  assert.equal(parseLogLine('42').format, 'plain');
});

test('does not guess numeric JSON timestamps', () => {
  const record = parseLogLine('{"ts":1793096430000,"level":"INFO","message":"numeric"}');

  assert.equal(record.format, 'jsonl');
  assert.equal(record.timestampMs, null);
  assert.equal(record.timestampSource, 'none');
  assert.equal(record.level, 'INFO');
});

test('keeps JSON Lines with invalid timestamps usable', () => {
  const record = parseLogLine('{"timestamp":"2026-13-40T99:99:99Z","level":"INFO","message":"bad time"}');

  assert.equal(record.format, 'jsonl');
  assert.equal(record.timestampMs, null);
  assert.equal(record.level, 'INFO');
  assert.equal(record.message, 'bad time');
});

test('supports safe non-string JSON message values', () => {
  const objectMessage = parseLogLine('{"level":"INFO","message":{"code":42}}');
  assert.equal(objectMessage.message, '{"code":42}');

  const numericMessage = parseLogLine('{"level":"INFO","message":42}');
  assert.equal(numericMessage.message, '42');

  const emptyMessage = parseLogLine('{"level":"INFO","message":""}');
  assert.equal(emptyMessage.message, '');
});

test('removes only the BOM at the start of the full input', () => {
  const result = parseLogText('\uFEFF2026-10-27T10:20:30Z INFO ready\na\n\uFEFFb');

  assert.equal(result.records[0].raw, '2026-10-27T10:20:30Z INFO ready');
  assert.equal(result.records[0].format, 'structured-text');
  assert.equal(result.records[1].raw, 'a');
  assert.equal(result.records[2].raw, '\uFEFFb');
  assert.equal(result.records[2].format, 'plain');
});

test('handles LF, CRLF, and CR line endings', () => {
  const result = parseLogText('a\r\nb\nc\r');

  assert.equal(result.totalLines, 3);
  assert.deepEqual(result.records.map((record) => record.raw), ['a', 'b', 'c']);
  assert.deepEqual(result.records.map((record) => record.lineNumber), [1, 2, 3]);
});

test('does not create a phantom line for a trailing newline', () => {
  const result = parseLogText('a\n');

  assert.equal(result.totalLines, 1);
  assert.equal(result.records[0].raw, 'a');
});

test('preserves blank lines and their line numbers', () => {
  const result = parseLogText('a\n\n\t \nb');

  assert.equal(result.totalLines, 4);
  assert.deepEqual(result.records.map((record) => record.lineNumber), [1, 2, 3, 4]);
  assert.equal(result.records[1].blank, true);
  assert.equal(result.records[1].raw, '');
  assert.equal(result.records[1].message, '');
  assert.equal(result.records[2].blank, true);
  assert.equal(result.records[2].raw, '\t ');
  assert.equal(result.records[3].raw, 'b');
});

test('does not group multi-line stack traces in this phase', () => {
  const result = parseLogText('2026-10-27T10:20:30Z ERROR boom\n    at handler (app.js:10:2)');

  assert.equal(result.totalLines, 2);
  assert.equal(result.records[0].format, 'structured-text');
  assert.equal(result.records[0].level, 'ERROR');
  assert.equal(result.records[1].format, 'plain');
  assert.equal(result.records[1].lineNumber, 2);
});

test('returns a safe failure result for non-string input', () => {
  assert.deepEqual(parseLogText(null), {
    ok: false,
    records: [],
    totalLines: 0,
    truncatedLines: 0,
    error: 'Input log harus berupa string.',
  });
  assert.equal(parseLogText(42).ok, false);
});

test('parseLogLine does not crash on non-string input or invalid line numbers', () => {
  const record = parseLogLine(null, 0);

  assert.equal(record.lineNumber, 1);
  assert.equal(record.raw, '');
  assert.equal(record.message, '');
  assert.equal(record.blank, true);
});

test('truncates long lines and marks them', () => {
  const record = parseLogLine('abcdefghij', 1, { maxLineLength: 5 });

  assert.equal(record.raw, 'abcde');
  assert.equal(record.message, 'abcde');
  assert.equal(record.lineTruncated, true);
});

test('counts truncated lines in parseLogText', () => {
  const result = parseLogText('abcdef\nghijkl', { maxLineLength: 3 });

  assert.equal(result.totalLines, 2);
  assert.equal(result.truncatedLines, 2);
  assert.deepEqual(result.records.map((record) => record.raw), ['abc', 'ghi']);
  assert.deepEqual(result.records.map((record) => record.lineTruncated), [true, true]);
});

test('normalizes model levels', () => {
  assert.equal(normalizeLevel('warning'), 'WARN');
  assert.equal(normalizeLevel('CRITICAL'), 'FATAL');
  assert.equal(normalizeLevel(' info '), 'INFO');
  assert.equal(normalizeLevel('notice'), 'UNKNOWN');
  assert.equal(normalizeLevel(null), 'UNKNOWN');
});

test('truncateLine preserves short lines and handles invalid limits', () => {
  assert.deepEqual(truncateLine('abc', 10), { raw: 'abc', lineTruncated: false });
  assert.deepEqual(truncateLine('abcdef', 3), { raw: 'abc', lineTruncated: true });
  assert.deepEqual(truncateLine('abcdef', 0), { raw: 'abcdef', lineTruncated: false });
});

test('truncateLine uses UTF-8 byte limits and preserves supplementary characters', () => {
  assert.equal(utf8ByteLength('a🙂é'), 7);

  assert.deepEqual(truncateLine('a🙂', 5), { raw: 'a🙂', lineTruncated: false });
  assert.deepEqual(truncateLine('a🙂b', 5), { raw: 'a🙂', lineTruncated: true });
  assert.deepEqual(truncateLine('🙂', 3), { raw: '', lineTruncated: true });
  assert.deepEqual(truncateLine('éé', 3), { raw: 'é', lineTruncated: true });
  assert.equal(hasUnpairedSurrogate(truncateLine('a🙂b', 5).raw), false);
});

test('truncateLine accepts exactly 64 KiB of UTF-8 and truncates beyond it', () => {
  const exact = '🙂'.repeat(DEFAULT_MAX_LINE_LENGTH / 4);

  assert.equal(utf8ByteLength(exact), DEFAULT_MAX_LINE_LENGTH);
  assert.deepEqual(truncateLine(exact), { raw: exact, lineTruncated: false });

  const overAscii = truncateLine(`${exact}a`);
  assert.equal(overAscii.raw, exact);
  assert.equal(overAscii.lineTruncated, true);

  const overEmoji = truncateLine(`${exact}🙂`);
  assert.equal(overEmoji.raw, exact);
  assert.equal(overEmoji.lineTruncated, true);
  assert.equal(hasUnpairedSurrogate(overEmoji.raw), false);
});

test('keeps lineTruncated when a structured record is parsed from a cut line', () => {
  const prefix = '2026-10-27T10:20:30Z INFO ';
  const maxLineLength = utf8ByteLength(prefix) + 4;
  const record = parseLogLine(`${prefix}🙂🙂`, 1, { maxLineLength });

  assert.equal(record.raw, `${prefix}🙂`);
  assert.equal(record.message, '🙂');
  assert.equal(record.level, 'INFO');
  assert.equal(record.lineTruncated, true);
  assert.equal(hasUnpairedSurrogate(record.raw), false);
});

test('createLogRecord fills canonical defaults', () => {
  const record = createLogRecord({
    raw: 'x',
    lineNumber: 2,
    timestampMs: Number.NaN,
    timestampSource: 'local',
    level: 'warning',
    message: 42,
    format: 'unknown',
  });

  assert.equal(record.lineNumber, 2);
  assert.equal(record.timestampMs, null);
  assert.equal(record.timestampIso, null);
  assert.equal(record.timestampSource, 'none');
  assert.equal(record.level, 'WARN');
  assert.equal(record.message, '42');
  assert.equal(record.format, 'plain');
  assert.equal(record.blank, false);
  assert.equal(record.lineTruncated, false);
});
