import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_PATCH_CHARS,
  MAX_PATCH_LINES,
  classifyPatchLine,
  parsePatch,
} from '../js/patch-viewer.js';

test('classifies addition, deletion, context, hunk, and metadata lines', () => {
  assert.equal(classifyPatchLine('+added'), 'addition');
  assert.equal(classifyPatchLine('-removed'), 'deletion');
  assert.equal(classifyPatchLine(' context'), 'context');
  assert.equal(classifyPatchLine(''), 'context');
  assert.equal(classifyPatchLine('@@ -1 +1 @@'), 'hunk');
  assert.equal(classifyPatchLine('+++ b/file.js'), 'meta');
  assert.equal(classifyPatchLine('--- a/file.js'), 'meta');
  assert.equal(classifyPatchLine('diff --git a/file b/file'), 'meta');
  assert.equal(classifyPatchLine('\\ No newline at end of file'), 'meta');
});

test('parses a unified diff into line records', () => {
  const patch = [
    'diff --git a/README.md b/README.md',
    'index 111..222 100644',
    '--- a/README.md',
    '+++ b/README.md',
    '@@ -1,2 +1,2 @@',
    '-old line',
    '+new line',
    ' context line',
  ].join('\n');

  const result = parsePatch(patch);

  assert.equal(result.available, true);
  assert.equal(result.truncated, false);
  assert.equal(result.lines.length, 8);
  assert.equal(result.lines[5].text, '-old line');
  assert.equal(result.lines[5].type, 'deletion');
  assert.equal(result.lines[6].type, 'addition');
  assert.equal(result.lines[7].type, 'context');
});

test('returns unavailable for empty or non-string patches', () => {
  for (const value of [null, undefined, '', 42, {}]) {
    const result = parsePatch(value);
    assert.equal(result.available, false);
    assert.deepEqual(result.lines, []);
    assert.equal(result.truncated, false);
  }
});

test('truncates by characters before creating line records', () => {
  const result = parsePatch(`+${'a'.repeat(40)}`, { maxChars: 10 });

  assert.equal(result.truncated, true);
  assert.equal(result.truncatedChars, true);
  assert.equal(result.truncatedLines, false);
  assert.equal(result.lines.length, 1);
  assert.equal(result.lines[0].text.length, 10);
});

test('truncates by line count and keeps the configured maximum', () => {
  const patch = Array.from({ length: 10 }, (_, index) => `+line ${index}`).join('\n');
  const result = parsePatch(patch, { maxLines: 3 });

  assert.equal(result.truncated, true);
  assert.equal(result.truncatedLines, true);
  assert.equal(result.lines.length, 3);
  assert.equal(result.totalLines, 10);
});

test('exposes documented default limits', () => {
  assert.equal(MAX_PATCH_CHARS, 100000);
  assert.equal(MAX_PATCH_LINES, 2000);
});

test('normalizes CRLF and keeps API text as plain text', () => {
  const result = parsePatch('+<script>alert(1)</script>\r\n context\r\n');

  assert.equal(result.lines.length, 2);
  assert.equal(result.lines[0].text, '+<script>alert(1)</script>');
  assert.equal(result.lines[0].type, 'addition');
  assert.equal(result.lines[1].text, ' context');
  assert.equal(result.lines[1].type, 'context');
});
