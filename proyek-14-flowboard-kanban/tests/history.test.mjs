import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addTask,
  boardFromTasks,
  createEmptyBoard,
  deleteTaskFromBoard,
  moveTask,
  updateTaskInBoard,
} from '../js/board.js';
import { History } from '../js/history.js';
import { createTask } from '../js/task-model.js';

const NOW = new Date('2026-10-23T10:00:00.000Z');

function state(value) {
  return { value, items: [value] };
}

function task(id, title, overrides = {}) {
  return createTask({
    title,
    description: overrides.description ?? '',
    tags: overrides.tags ?? [],
    priority: overrides.priority ?? 'medium',
    status: overrides.status ?? 'todo',
    dueDate: overrides.dueDate ?? null,
  }, {
    idFactory: () => id,
    now: NOW,
  });
}

function assertUndoRedo(initialBoard, nextBoard, label) {
  const history = new History(initialBoard, { limit: 10 });
  assert.equal(history.record(nextBoard, label), true);
  assert.deepEqual(history.undo(), { state: initialBoard, label });
  assert.deepEqual(history.redo(), { state: nextBoard, label });
}

test('history awal tidak memiliki undo atau redo', () => {
  const history = new History(state(1), { limit: 3 });
  assert.equal(history.canUndo, false);
  assert.equal(history.canRedo, false);
  assert.equal(history.size, 0);
  assert.deepEqual(history.current, state(1));
});

test('record, undo, dan redo memulihkan state berurutan', () => {
  const history = new History(state(1), { limit: 5 });
  assert.equal(history.record(state(2), 'Tambah'), true);
  assert.equal(history.record(state(3), 'Edit'), true);

  assert.deepEqual(history.undo(), { state: state(2), label: 'Edit' });
  assert.equal(history.canUndo, true);
  assert.equal(history.canRedo, true);

  assert.deepEqual(history.undo(), { state: state(1), label: 'Tambah' });
  assert.equal(history.canUndo, false);

  assert.deepEqual(history.redo(), { state: state(2), label: 'Tambah' });
  assert.deepEqual(history.redo(), { state: state(3), label: 'Edit' });
  assert.equal(history.canRedo, false);
});

test('record baru setelah undo menghapus cabang redo', () => {
  const history = new History(state('awal'), { limit: 5 });
  history.record(state('satu'), 'Satu');
  history.record(state('dua'), 'Dua');
  history.undo();
  history.record(state('tiga'), 'Tiga');

  assert.equal(history.canRedo, false);
  assert.deepEqual(history.undo(), { state: state('satu'), label: 'Tiga' });
  assert.deepEqual(history.undo(), { state: state('awal'), label: 'Satu' });
});

test('batas riwayat membuang state paling lama', () => {
  const history = new History(state(0), { limit: 2 });
  history.record(state(1), 'Satu');
  history.record(state(2), 'Dua');
  history.record(state(3), 'Tiga');

  assert.equal(history.size, 2);
  assert.equal(history.undoCount, 2);
  assert.deepEqual(history.undo(), { state: state(2), label: 'Tiga' });
  assert.deepEqual(history.undo(), { state: state(1), label: 'Dua' });
  assert.equal(history.canUndo, false);
  assert.deepEqual(history.current, state(1));
});

test('undo dan redo tidak membuat entri riwayat baru', () => {
  const history = new History(state(0), { limit: 5 });
  history.record(state(1), 'Satu');
  history.record(state(2), 'Dua');
  history.undo();
  history.redo();
  history.undo();

  assert.equal(history.size, 2);
  assert.equal(history.undoCount, 1);
  assert.equal(history.redoCount, 1);
});

test('state yang sama tidak dicatat sebagai perubahan', () => {
  const history = new History(state(1), { limit: 5 });
  assert.equal(history.record(state(1), 'Tidak berubah'), false);
  assert.equal(history.size, 0);
  assert.equal(history.canUndo, false);
});

test('state yang disimpan tidak berbagi referensi dengan pemanggil', () => {
  const initial = state('awal');
  const history = new History(initial, { limit: 5 });
  initial.items.push('mutasi luar');
  assert.deepEqual(history.current, state('awal'));

  const next = state('baru');
  history.record(next, 'Baru');
  next.items.push('mutasi setelah record');
  const undone = history.undo();
  assert.deepEqual(undone.state, state('awal'));
  assert.deepEqual(history.redo().state, state('baru'));
});

test('undo dan redo memulihkan operasi pembuatan tugas', () => {
  const initial = createEmptyBoard();
  const created = addTask(initial, task('task-1', 'Tugas baru'));
  assertUndoRedo(initial, created, 'Tambah tugas');
  assert.deepEqual(created.columns.todo.map(({ id }) => id), ['task-1']);
});

test('undo dan redo memulihkan operasi pengeditan tugas', () => {
  const initial = boardFromTasks([task('task-1', 'Judul awal')]);
  const edited = updateTaskInBoard(initial, 'task-1', {
    title: 'Judul final',
    priority: 'high',
  }, { now: NOW });
  assertUndoRedo(initial, edited, 'Edit tugas');
  assert.equal(edited.columns.todo[0].title, 'Judul final');
});

test('undo dan redo memulihkan operasi penghapusan tugas', () => {
  const initial = boardFromTasks([task('task-1', 'A'), task('task-2', 'B')]);
  const deleted = deleteTaskFromBoard(initial, 'task-1');
  assertUndoRedo(initial, deleted, 'Hapus tugas');
  assert.deepEqual(deleted.columns.todo.map(({ id }) => id), ['task-2']);
});

test('undo dan redo memulihkan operasi perpindahan status', () => {
  const initial = boardFromTasks([
    task('task-1', 'A'),
    task('task-2', 'B', { status: 'review' }),
  ]);
  const moved = moveTask(initial, 'task-1', 'review', 1);
  assertUndoRedo(initial, moved, 'Pindah status');
  assert.deepEqual(moved.columns.review.map(({ id }) => id), ['task-2', 'task-1']);
});

test('undo dan redo memulihkan operasi pengurutan ulang kartu', () => {
  const initial = boardFromTasks([
    task('task-1', 'A'),
    task('task-2', 'B'),
    task('task-3', 'C'),
  ]);
  const reordered = moveTask(initial, 'task-3', 'todo', 0);
  assertUndoRedo(initial, reordered, 'Urutkan ulang');
  assert.deepEqual(reordered.columns.todo.map(({ id }) => id), ['task-3', 'task-1', 'task-2']);
});
