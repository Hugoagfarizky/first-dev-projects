import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const style = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');

test('the hidden attribute always suppresses display', () => {
  assert.match(
    style,
    /(?:^|\n)\[hidden\]\s*\{\s*display:\s*none\s*!important;\s*\}/,
  );
});

test('the cancel button starts hidden and follows the loading state', () => {
  assert.match(html, /<button[^>]*\bdata-cancel-load\b[^>]*\bhidden\b[^>]*>/);
  assert.match(
    app,
    /setHidden\(elements\.cancelLoad,\s*state\.load\.status\s*!==\s*'loading'\)/,
  );
});

test('time range errors use an accessible live region and are wired to state', () => {
  assert.match(
    html,
    /<p[^>]*\bid="time-range-error"[^>]*data-time-range-error[^>]*role="alert"[^>]*hidden[^>]*>/,
  );
  assert.match(
    app,
    /elements\.timeRangeError = document\.querySelector\('\[data-time-range-error\]'\)/,
  );
  assert.match(app, /setHidden\(elements\.timeRangeError,\s*!invalid\)/);
  assert.match(app, /aria-invalid/);
});

test('unhandled file drops do not navigate the browser', () => {
  assert.match(app, /document\.addEventListener\('dragover'/);
  assert.match(app, /document\.addEventListener\('drop'/);
  assert.match(app, /isFileDrag/);
  assert.match(app, /elements\.dropzone\.contains\(event\.target\)/);
});

test('export cleanup uses try/finally', () => {
  assert.match(app, /try\s*\{[\s\S]*link\.click\(\);[\s\S]*\}\s*finally\s*\{[\s\S]*URL\.revokeObjectURL\(url\)/);
});
