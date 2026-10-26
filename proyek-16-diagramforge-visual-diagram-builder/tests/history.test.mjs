import assert from 'node:assert/strict';
import test from 'node:test';

import { DiagramHistory, createHistory } from '../js/history.js';

test('history awal dapat undo/redo sesuai kondisi', () => {
  const history = new DiagramHistory({ value: 1 });

  assert.equal(history.canUndo(), false);
  assert.equal(history.canRedo(), false);
  assert.deepEqual(history.current(), { value: 1 });
  assert.equal(history.undo(), null);
  assert.equal(history.redo(), null);
});

test('push, undo, dan redo bekerja', () => {
  const history = new DiagramHistory({ value: 1 });

  assert.equal(history.push({ value: 2 }), true);
  assert.equal(history.push({ value: 3 }), true);
  assert.equal(history.canUndo(), true);
  assert.deepEqual(history.current(), { value: 3 });

  assert.deepEqual(history.undo(), { value: 2 });
  assert.deepEqual(history.current(), { value: 2 });
  assert.deepEqual(history.undo(), { value: 1 });
  assert.equal(history.canUndo(), false);

  assert.deepEqual(history.redo(), { value: 2 });
  assert.deepEqual(history.redo(), { value: 3 });
  assert.equal(history.canRedo(), false);
});

test('aksi baru setelah undo membuang cabang redo', () => {
  const history = new DiagramHistory({ value: 1 });
  history.push({ value: 2 });
  history.push({ value: 3 });
  history.undo();

  assert.equal(history.push({ value: 4 }), true);
  assert.equal(history.canRedo(), false);
  assert.deepEqual(history.current(), { value: 4 });
  assert.deepEqual(history.undo(), { value: 2 });
});

test('batas 50 snapshot termasuk kondisi awal', () => {
  const history = new DiagramHistory({ value: 0 }, 50);

  for (let i = 1; i <= 50; i += 1) {
    history.push({ value: i });
  }

  assert.equal(history.size, 50);
  assert.deepEqual(history.current(), { value: 50 });
  assert.equal(history.canUndo(), true);

  for (let i = 0; i < 49; i += 1) {
    history.undo();
  }
  assert.deepEqual(history.current(), { value: 1 });
  assert.equal(history.undo(), null);
});

test('push state yang sama tidak menambah snapshot', () => {
  const history = new DiagramHistory({ value: 1 });

  assert.equal(history.push({ value: 1 }), false);
  assert.equal(history.size, 1);
  assert.equal(history.canUndo(), false);
});

test('snapshot tetap immutable setelah sumber dimutasi', () => {
  const source = { value: { nested: 1 } };
  const history = new DiagramHistory(source);

  source.value.nested = 999;
  const current = history.current();
  current.value.nested = 777;

  assert.deepEqual(history.current(), { value: { nested: 1 } });
});

test('undo dan redo tidak menambah snapshot baru', () => {
  const history = new DiagramHistory({ value: 1 });
  history.push({ value: 2 });

  const sizeBefore = history.size;
  history.undo();
  history.redo();

  assert.equal(history.size, sizeBefore);
});

test('history kosong ditangani dengan aman', () => {
  const history = new DiagramHistory(null, 3);

  assert.equal(history.current(), null);
  assert.equal(history.canUndo(), false);
  assert.equal(history.canRedo(), false);
  assert.equal(history.push({ value: 1 }), true);
  assert.deepEqual(history.current(), { value: 1 });
  assert.equal(history.size, 1);
});

test('createHistory menghasilkan instance yang dapat dipakai', () => {
  const history = createHistory({ value: 1 }, 2);

  history.push({ value: 2 });
  history.push({ value: 3 });
  history.push({ value: 4 });

  assert.equal(history.size, 2);
  assert.deepEqual(history.current(), { value: 4 });
  assert.equal(history.canUndo(), true);
});
