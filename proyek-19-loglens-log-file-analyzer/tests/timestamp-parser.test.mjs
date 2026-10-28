import test from 'node:test';
import assert from 'node:assert/strict';

import { parseTimestamp } from '../js/timestamp-parser.js';

function assertInvalid(value) {
  const result = parseTimestamp(value);
  assert.equal(result.ok, false, `expected invalid timestamp: ${String(value)}`);
  assert.equal(result.timestampMs, null);
  assert.equal(result.timestampIso, null);
  assert.equal(result.timestampSource, 'none');
  assert.equal(typeof result.error, 'string');
  assert.notEqual(result.error, '');
}

test('parses ISO 8601 with Z', () => {
  const result = parseTimestamp('2026-10-27T10:20:30Z');

  assert.equal(result.ok, true);
  assert.equal(result.timestampMs, Date.UTC(2026, 9, 27, 10, 20, 30));
  assert.equal(result.timestampIso, '2026-10-27T10:20:30.000Z');
  assert.equal(result.timestampSource, 'iso');
  assert.equal(result.error, null);
});

test('parses ISO 8601 with a positive offset', () => {
  const result = parseTimestamp('2026-10-27T10:20:30+07:00');

  assert.equal(result.ok, true);
  assert.equal(result.timestampMs, Date.UTC(2026, 9, 27, 3, 20, 30));
  assert.equal(result.timestampIso, '2026-10-27T03:20:30.000Z');
  assert.equal(result.timestampSource, 'iso');
});

test('parses ISO 8601 with a negative offset without a colon', () => {
  const result = parseTimestamp('2026-10-27T10:20:30-0530');

  assert.equal(result.ok, true);
  assert.equal(result.timestampMs, Date.UTC(2026, 9, 27, 15, 50, 30));
  assert.equal(result.timestampIso, '2026-10-27T15:50:30.000Z');
  assert.equal(result.timestampSource, 'iso');
});

test('accepts the maximum civil timezone offsets with zero minutes', () => {
  const positive = parseTimestamp('2026-10-27T10:20:30+14:00');
  const negative = parseTimestamp('2026-10-27T10:20:30-14:00');
  const positiveCompact = parseTimestamp('2026-10-27T10:20:30+1400');
  const negativeCompact = parseTimestamp('2026-10-27T10:20:30-1400');

  assert.equal(positive.ok, true);
  assert.equal(positive.timestampMs, Date.UTC(2026, 9, 26, 20, 20, 30));
  assert.equal(positive.timestampIso, '2026-10-26T20:20:30.000Z');
  assert.equal(positive.timestampSource, 'iso');

  assert.equal(negative.ok, true);
  assert.equal(negative.timestampMs, Date.UTC(2026, 9, 28, 0, 20, 30));
  assert.equal(negative.timestampIso, '2026-10-28T00:20:30.000Z');
  assert.equal(negative.timestampSource, 'iso');

  assert.equal(positiveCompact.ok, true);
  assert.equal(positiveCompact.timestampMs, positive.timestampMs);
  assert.equal(negativeCompact.ok, true);
  assert.equal(negativeCompact.timestampMs, negative.timestampMs);
});

test('rejects timezone offsets beyond the civil range', () => {
  assertInvalid('2026-10-27T10:20:30+14:01');
  assertInvalid('2026-10-27T10:20:30-14:01');
  assertInvalid('2026-10-27T10:20:30+14:30');
  assertInvalid('2026-10-27T10:20:30-14:30');
  assertInvalid('2026-10-27T10:20:30+15:00');
  assertInvalid('2026-10-27T10:20:30-15:00');
  assertInvalid('2026-10-27T10:20:30+23:59');
  assertInvalid('2026-10-27T10:20:30-23:59');
  assertInvalid('2026-10-27T10:20:30+24:00');
  assertInvalid('2026-10-27T10:20:30-2400');
  assertInvalid('2026-10-27T10:20:30+1401');
  assertInvalid('2026-10-27T10:20:30-1401');
  assertInvalid('2026-10-27T10:20:30+1500');
  assertInvalid('2026-10-27T10:20:30+2359');
});

test('parses local timestamp without timezone', () => {
  const result = parseTimestamp('2026-10-27 10:20:30');
  const expected = new Date(0);
  expected.setFullYear(2026, 9, 27);
  expected.setHours(10, 20, 30, 0);

  assert.equal(result.ok, true);
  assert.equal(result.timestampMs, expected.getTime());
  assert.equal(result.timestampIso, new Date(expected.getTime()).toISOString());
  assert.equal(result.timestampSource, 'local');
});

test('parses milliseconds for local timestamps', () => {
  const result = parseTimestamp('2026-10-27T10:20:30.123');
  const expected = new Date(0);
  expected.setFullYear(2026, 9, 27);
  expected.setHours(10, 20, 30, 123);

  assert.equal(result.ok, true);
  assert.equal(result.timestampMs, expected.getTime());
  assert.equal(result.timestampSource, 'local');
});

test('parses a fraction longer than three digits by truncating to milliseconds', () => {
  const result = parseTimestamp('2026-10-27T10:20:30.123456789Z');

  assert.equal(result.ok, true);
  assert.equal(result.timestampMs, Date.UTC(2026, 9, 27, 10, 20, 30, 123));
  assert.equal(result.timestampIso, '2026-10-27T10:20:30.123Z');
});

test('accepts lowercase z and space separator', () => {
  const result = parseTimestamp('2026-10-27 10:20:30z');

  assert.equal(result.ok, true);
  assert.equal(result.timestampMs, Date.UTC(2026, 9, 27, 10, 20, 30));
  assert.equal(result.timestampSource, 'iso');
});

test('validates leap days', () => {
  const leap = parseTimestamp('2024-02-29T00:00:00Z');
  assert.equal(leap.ok, true);

  assertInvalid('2026-02-29T00:00:00Z');
  assertInvalid('2026-02-30T00:00:00Z');
});

test('rejects impossible calendar parts', () => {
  assertInvalid('2026-13-01T00:00:00Z');
  assertInvalid('2026-04-31T00:00:00Z');
  assertInvalid('2026-00-10T00:00:00Z');
  assertInvalid('2026-01-00T00:00:00Z');
});

test('rejects impossible time parts', () => {
  assertInvalid('2026-10-27T24:00:00Z');
  assertInvalid('2026-10-27T10:60:00Z');
  assertInvalid('2026-10-27T10:20:60Z');
  assertInvalid('2026-10-27T10:20:30+24:00');
  assertInvalid('2026-10-27T10:20:30+07:60');
});

test('rejects empty, non-string, and non-timestamp input', () => {
  assertInvalid('');
  assertInvalid('   ');
  assertInvalid(null);
  assertInvalid(undefined);
  assertInvalid(1793096430000);
  assertInvalid({});
  assertInvalid('2026-10-27');
  assertInvalid('2026-10-27T10:20Z');
  assertInvalid('2026-10-27T10:20:30 extra');
  assertInvalid('prefix 2026-10-27T10:20:30Z');
});

test('does not guess a timestamp from a numeric substring', () => {
  assertInvalid('1793096430000');
  assertInvalid('id=2026-10-27T10:20:30Z');
});

test('returns a deterministic result for repeated calls', () => {
  const first = parseTimestamp('2026-10-27T10:20:30.123+07:00');
  const second = parseTimestamp('2026-10-27T10:20:30.123+07:00');

  assert.deepEqual(first, second);
});
