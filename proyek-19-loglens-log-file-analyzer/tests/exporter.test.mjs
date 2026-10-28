import test from 'node:test';
import assert from 'node:assert/strict';

import { buildExport, sanitizeExportFilename } from '../js/exporter.js';

const encoder = new TextEncoder();

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

function assertSafeFilename(filename) {
  assert.match(filename, /\.log$/);
  assert.ok(filename.length <= 255, `UTF-16 length ${filename.length}`);
  assert.ok(encoder.encode(filename).byteLength <= 255);
  assert.equal(hasUnpairedSurrogate(filename), false);
}

test('builds one LF-terminated output line per record', () => {
  const records = [
    { raw: '2026-10-27T10:20:30Z INFO started' },
    { raw: 'plain raw line' },
    { raw: '2026-10-27T10:20:31Z ERROR failed' },
  ];

  const result = buildExport(records);

  assert.equal(result.ok, true);
  assert.equal(
    result.content,
    '2026-10-27T10:20:30Z INFO started\nplain raw line\n2026-10-27T10:20:31Z ERROR failed\n',
  );
  assert.equal(result.lineCount, 3);
  assert.equal(result.mimeType, 'text/plain;charset=utf-8');
  assert.equal(result.lineEnding, '\n');
  assert.equal(result.content.includes('\r'), false);
});

test('preserves blank and raw lines', () => {
  const records = [
    { raw: '' },
    { raw: 'raw line' },
    { raw: '\t ' },
    { raw: '' },
  ];

  const result = buildExport(records);

  assert.equal(result.content, '\nraw line\n\t \n\n');
  assert.equal(result.lineCount, 4);
});

test('returns empty content for an empty result set', () => {
  const result = buildExport([]);

  assert.equal(result.ok, true);
  assert.equal(result.content, '');
  assert.equal(result.lineCount, 0);
  assert.equal(result.byteLength, 0);
});

test('reports UTF-8 byte length', () => {
  const result = buildExport([{ raw: 'é' }]);

  assert.equal(result.content, 'é\n');
  assert.equal(result.byteLength, 3);
});

test('uses the default filename when none is provided', () => {
  assert.equal(buildExport([]).filename, 'loglens-filtered.log');
  assert.equal(sanitizeExportFilename('loglens-filtered.log'), 'loglens-filtered.log');
});

test('sanitizes path traversal and path separators', () => {
  assert.equal(sanitizeExportFilename('../../etc/passwd'), 'passwd.log');
  assert.equal(sanitizeExportFilename('C:\\secret\\app.log'), 'app.log');
  assert.equal(sanitizeExportFilename('C:evil.log'), 'C-evil.log');
  assert.equal(sanitizeExportFilename('\\\\server\\share\\file.log'), 'file.log');
  assert.equal(sanitizeExportFilename('..\\..\\'), 'loglens-filtered.log');
  assert.equal(sanitizeExportFilename('/'), 'loglens-filtered.log');
});

test('sanitizes invalid filename characters and trailing dots or spaces', () => {
  assert.equal(sanitizeExportFilename('my<log>?.log'), 'my-log.log');
  assert.equal(sanitizeExportFilename('my log.txt'), 'my-log.txt.log');
  assert.equal(sanitizeExportFilename('.hidden'), 'hidden.log');
  assert.equal(sanitizeExportFilename('APP.LOG'), 'APP.log');
  assert.equal(sanitizeExportFilename('foo.log.'), 'foo.log');
  assert.equal(sanitizeExportFilename('foo...   '), 'foo.log');
  assert.equal(sanitizeExportFilename('file\u0000name.log'), 'file-name.log');
  assert.equal(sanitizeExportFilename('file\u007fname.log'), 'file-name.log');
});

test('avoids Windows reserved device names with extensions and multiple dots', () => {
  assert.equal(sanitizeExportFilename('CON'), 'log-CON.log');
  assert.equal(sanitizeExportFilename('CON.txt'), 'log-CON.txt.log');
  assert.equal(sanitizeExportFilename('PRN.txt'), 'log-PRN.txt.log');
  assert.equal(sanitizeExportFilename('NUL.tar.gz'), 'log-NUL.tar.gz.log');
  assert.equal(sanitizeExportFilename('COM1.foo'), 'log-COM1.foo.log');
  assert.equal(sanitizeExportFilename('LPT1.log'), 'log-LPT1.log');
  assert.equal(sanitizeExportFilename('con.txt'), 'log-con.txt.log');
  assert.equal(sanitizeExportFilename('AuX.backup.2026.log'), 'log-AuX.backup.2026.log');
  assert.equal(sanitizeExportFilename('CON...'), 'log-CON.log');
});

test('avoids every COM1-COM9 and LPT1-LPT9 reserved device name', () => {
  for (const device of ['COM', 'LPT']) {
    for (let number = 1; number <= 9; number += 1) {
      const name = `${device}${number}`;
      const lower = name.toLowerCase();

      assert.equal(sanitizeExportFilename(name), `log-${name}.log`);
      assert.equal(sanitizeExportFilename(`${lower}.txt`), `log-${lower}.txt.log`);
      assert.equal(sanitizeExportFilename(`${name}.foo.bar`), `log-${name}.foo.bar.log`);
    }
  }

  assert.equal(sanitizeExportFilename('COM0.log'), 'COM0.log');
  assert.equal(sanitizeExportFilename('LPT10.log'), 'LPT10.log');
});

test('removes Unicode bidi controls and unpaired surrogates', () => {
  const bidiControls = [
    '\u061c',
    '\u200e',
    '\u200f',
    '\u202a',
    '\u202b',
    '\u202c',
    '\u202d',
    '\u202e',
    '\u2066',
    '\u2067',
    '\u2068',
    '\u2069',
  ];

  for (const control of bidiControls) {
    const filename = sanitizeExportFilename(`alpha${control}beta.log`);
    assert.equal(filename, 'alpha-beta.log');
    assert.equal(filename.includes(control), false);
    assertSafeFilename(filename);
  }

  assert.equal(sanitizeExportFilename('\u202e'), 'loglens-filtered.log');
  assert.equal(sanitizeExportFilename('a\u202e\u2066b'), 'a-b.log');
  assert.equal(sanitizeExportFilename('bad\ud800name.log'), 'bad-name.log');
  assert.equal(hasUnpairedSurrogate(sanitizeExportFilename('bad\ud800name.log')), false);
});

test('normalizes Unicode without damaging valid characters', () => {
  assert.equal(sanitizeExportFilename('cafe\u0301.log'), 'café.log');
  assert.equal(sanitizeExportFilename('日本語.log'), '日本語.log');
  assert.equal(sanitizeExportFilename('emoji-🙂.log'), 'emoji-🙂.log');
});

test('falls back to a deterministic safe name for empty or wholly invalid input', () => {
  const inputs = [
    '',
    '   ',
    null,
    undefined,
    42,
    {},
    [],
    '...',
    '---',
    '<>:"|?*',
    '\u0000\u001f\u007f\u009f',
    '\u202a\u202e\u2066\u2069',
    '/',
    '\\',
  ];

  for (const input of inputs) {
    assert.equal(sanitizeExportFilename(input), 'loglens-filtered.log');
  }
});

test('limits ASCII names to 255 bytes and 255 UTF-16 code units including .log', () => {
  const exact = `${'a'.repeat(251)}.log`;
  const filename = sanitizeExportFilename('a'.repeat(300));

  assert.equal(filename, exact);
  assert.equal(filename.length, 255);
  assert.equal(encoder.encode(filename).byteLength, 255);
  assertSafeFilename(filename);
});

test('limits long multibyte names at a valid Unicode boundary', () => {
  const cjk = sanitizeExportFilename('界'.repeat(200));
  assert.equal(cjk, `${'界'.repeat(83)}.log`);
  assertSafeFilename(cjk);

  const emoji = sanitizeExportFilename('🙂'.repeat(100));
  assert.equal(emoji, `${'🙂'.repeat(62)}.log`);
  assertSafeFilename(emoji);
});

test('handles supplementary characters exactly at the byte limit', () => {
  const exactStem = `${'a'.repeat(247)}🙂`;
  const exact = `${exactStem}.log`;

  assert.equal(encoder.encode(exact).byteLength, 255);
  assert.equal(sanitizeExportFilename(exactStem), exact);
  assertSafeFilename(exact);

  const over = sanitizeExportFilename(`${exactStem}🙂`);
  assert.equal(over, exact);
  assertSafeFilename(over);
});

test('uses a sanitized custom filename without changing exported content', () => {
  const result = buildExport([{ raw: 'line' }], { filename: '../../my<log>.log' });

  assert.equal(result.filename, 'my-log.log');
  assert.equal(result.content, 'line\n');
});

test('handles invalid records input without crashing', () => {
  const result = buildExport(null);

  assert.equal(result.ok, false);
  assert.equal(result.content, '');
  assert.equal(result.lineCount, 0);
  assert.equal(result.error.code, 'invalid-records');
});

test('does not mutate records or the array', () => {
  const records = [{ raw: 'a' }, { raw: '' }];
  const snapshot = structuredClone(records);
  Object.freeze(records[0]);
  Object.freeze(records[1]);
  Object.freeze(records);

  const result = buildExport(records);

  assert.equal(result.ok, true);
  assert.deepEqual(records, snapshot);
});

test('keeps one output line even if a raw record contains embedded newlines', () => {
  const result = buildExport([{ raw: 'first\nsecond\r\nthird' }]);

  assert.equal(result.content, 'firstsecondthird\n');
  assert.equal(result.lineCount, 1);
});
