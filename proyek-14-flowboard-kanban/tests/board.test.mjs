import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addTask,
  allTasks,
  boardFromTasks,
  canonicalizeBoard,
  countTasks,
  createEmptyBoard,
  deleteTaskFromBoard,
  filterBoard,
  findTask,
  getBoardCounts,
  moveTask,
  updateTaskInBoard,
  validateBoard,
} from '../js/board.js';
import { createTask } from '../js/task-model.js';

const NOW = new Date('2026-10-23T10:00:00.000Z');

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

test('createEmptyBoard memiliki empat kolom dengan urutan tetap', () => {
  const board = createEmptyBoard();
  assert.deepEqual(Object.keys(board.columns), ['todo', 'in-progress', 'review', 'done']);
  assert.equal(countTasks(board), 0);
  assert.deepEqual(validateBoard(board), { ok: true, errors: [] });
});

test('addTask menambahkan ke awal kolom tanpa mengubah papan sumber', () => {
  const base = createEmptyBoard();
  const first = task('task-1', 'Pertama');
  const second = task('task-2', 'Kedua');
  const one = addTask(base, first);
  const two = addTask(one, second);

  assert.equal(countTasks(base), 0);
  assert.deepEqual(two.columns.todo.map(({ id }) => id), ['task-2', 'task-1']);
  assert.deepEqual(findTask(two, 'task-1').task.title, 'Pertama');
});

test('addTask menolak ID duplikat', () => {
  const board = addTask(createEmptyBoard(), task('task-1', 'Pertama'));
  assert.throws(
    () => addTask(board, task('task-1', 'Judul berbeda')),
    /ID tugas sudah digunakan/,
  );
});

test('updateTaskInBoard mengubah data di tempat dan memindahkan status ke kolom tujuan', () => {
  let board = boardFromTasks([task('task-1', 'A'), task('task-2', 'B')]);
  board = updateTaskInBoard(board, 'task-2', { title: 'B final', status: 'review' }, { now: NOW });
  assert.deepEqual(board.columns.todo.map(({ id }) => id), ['task-1']);
  assert.deepEqual(board.columns.review.map(({ id }) => id), ['task-2']);
  assert.equal(board.columns.review[0].title, 'B final');
});

test('deleteTaskFromBoard menghapus tepat satu tugas dan mempertahankan sisanya', () => {
  let board = boardFromTasks([task('task-1', 'A'), task('task-2', 'B')]);
  board = deleteTaskFromBoard(board, 'task-1');
  assert.deepEqual(allTasks(board).map(({ id }) => id), ['task-2']);
  assert.throws(() => deleteTaskFromBoard(board, 'task-1'), /tidak ditemukan/);
});

test('moveTask memindahkan antarkolom tanpa duplikasi atau kehilangan tugas', () => {
  let board = boardFromTasks([
    task('task-1', 'A'),
    task('task-2', 'B'),
    task('task-3', 'C', { status: 'review' }),
  ]);
  board = moveTask(board, 'task-1', 'review', 1);
  assert.deepEqual(board.columns.todo.map(({ id }) => id), ['task-2']);
  assert.deepEqual(board.columns.review.map(({ id }) => id), ['task-3', 'task-1']);
  assert.deepEqual(allTasks(board).map(({ id }) => id).sort(), ['task-1', 'task-2', 'task-3']);
});

test('moveTask dapat mengurutkan ulang dalam kolom yang sama', () => {
  let board = boardFromTasks([
    task('task-1', 'A'),
    task('task-2', 'B'),
    task('task-3', 'C'),
  ]);
  board = moveTask(board, 'task-3', 'todo', 0);
  assert.deepEqual(board.columns.todo.map(({ id }) => id), ['task-3', 'task-1', 'task-2']);
});

test('operasi berurutan tetap konsisten dan tidak menciptakan duplikat', () => {
  let board = createEmptyBoard();
  board = addTask(board, task('task-1', 'A'));
  board = addTask(board, task('task-2', 'B'));
  board = moveTask(board, 'task-1', 'in-progress', 0);
  board = updateTaskInBoard(board, 'task-2', { title: 'B final', status: 'done' });
  board = addTask(board, task('task-3', 'A', { status: 'review' }));
  board = deleteTaskFromBoard(board, 'task-1');

  assert.deepEqual(board.columns.todo, []);
  assert.deepEqual(board.columns['in-progress'], []);
  assert.deepEqual(board.columns.review.map(({ id }) => id), ['task-3']);
  assert.deepEqual(board.columns.done.map(({ id }) => id), ['task-2']);
  assert.equal(new Set(allTasks(board).map(({ id }) => id)).size, 2);
});

test('tugas dengan judul sama tetap dibedakan oleh ID', () => {
  const board = boardFromTasks([
    task('task-1', 'Judul sama'),
    task('task-2', 'Judul sama'),
  ]);
  assert.equal(board.columns.todo.length, 2);
  assert.notEqual(board.columns.todo[0].id, board.columns.todo[1].id);
});

test('filterBoard mencari judul, deskripsi, dan tag tanpa mengubah sumber', () => {
  const board = boardFromTasks([
    task('task-1', 'Laporan mingguan', { tags: ['kerja'] }),
    task('task-2', 'Rapat desain', { description: 'Bahasa laporan perlu diperbaiki', status: 'review' }),
    task('task-3', 'Belanja', { tags: ['pribadi'], status: 'done' }),
  ]);
  const original = JSON.stringify(board);

  const byTitle = filterBoard(board, { query: 'laporan' }, { today: NOW });
  assert.deepEqual(allTasks(byTitle).map(({ id }) => id).sort(), ['task-1', 'task-2']);
  assert.equal(byTitle.active, true);

  const byTag = filterBoard(board, { query: 'pribadi' }, { today: NOW });
  assert.deepEqual(allTasks(byTag).map(({ id }) => id), ['task-3']);
  assert.equal(JSON.stringify(board), original);
});

test('filter prioritas dan tenggat memakai data sumber yang sama', () => {
  const board = boardFromTasks([
    task('task-1', 'Terlambat', { priority: 'high', dueDate: '2026-10-20' }),
    task('task-2', 'Tanpa tenggat', { priority: 'low' }),
    task('task-3', 'Selesai terlambat', { priority: 'high', dueDate: '2026-10-01', status: 'done' }),
  ]);
  const high = filterBoard(board, { priority: 'high' }, { today: NOW });
  assert.deepEqual(allTasks(high).map(({ id }) => id).sort(), ['task-1', 'task-3']);

  const overdue = filterBoard(board, { due: 'overdue' }, { today: NOW });
  assert.deepEqual(allTasks(overdue).map(({ id }) => id), ['task-1']);

  const noDue = filterBoard(board, { due: 'none' }, { today: NOW });
  assert.deepEqual(allTasks(noDue).map(({ id }) => id), ['task-2']);
  assert.equal(allTasks(board).length, 3);
});

test('getBoardCounts menghitung total, overdue, dan jumlah per kolom', () => {
  const board = boardFromTasks([
    task('task-1', 'A', { dueDate: '2026-10-01' }),
    task('task-2', 'B', { dueDate: '2026-10-30' }),
    task('task-3', 'C', { dueDate: '2026-10-01', status: 'done' }),
    task('task-4', 'D', { status: 'review' }),
  ]);
  const counts = getBoardCounts(board, NOW);
  assert.equal(counts.total, 4);
  assert.equal(counts.overdue, 1);
  assert.deepEqual(counts.byStatus, { todo: 2, 'in-progress': 0, review: 1, done: 1 });
});

test('validateBoard menolak ID duplikat, status kolom yang salah, dan kolom ekstra', () => {
  const duplicate = createEmptyBoard();
  duplicate.columns.todo.push(task('task-1', 'A'));
  duplicate.columns.review.push(task('task-1', 'B', { status: 'review' }));
  assert.equal(validateBoard(duplicate).ok, false);

  const mismatch = createEmptyBoard();
  mismatch.columns.todo.push(task('task-2', 'B', { status: 'review' }));
  assert.equal(validateBoard(mismatch).ok, false);

  const extra = createEmptyBoard();
  extra.columns.archive = [];
  assert.equal(validateBoard(extra).ok, false);
});

test('validateBoard menolak jumlah tugas di atas batas', () => {
  const board = createEmptyBoard();
  const base = task('task-0', 'Tugas 0');
  for (let index = 0; index < 501; index += 1) {
    board.columns.todo.push({ ...base, id: `task-${index}`, title: `Tugas ${index}` });
  }
  const result = validateBoard(board);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /melebihi batas 500/);
});

test('canonicalizeBoard mengembalikan tugas kanonik dari payload mentah', () => {
  const rawTask = {
    ...task('task-1', 'Tulis laporan'),
    id: ' task-1 ',
    title: '  Tulis laporan  ',
    tags: [' Kerja ', 'kerja', '  '],
    priority: 'HIGH',
    status: ' todo ',
    dueDate: ' 2026-10-30 ',
  };
  const board = canonicalizeBoard({
    columns: {
      todo: [rawTask],
      'in-progress': [],
      review: [],
      done: [],
    },
  });

  const canonicalTask = board.columns.todo[0];
  assert.equal(canonicalTask.id, 'task-1');
  assert.equal(canonicalTask.title, 'Tulis laporan');
  assert.deepEqual(canonicalTask.tags, ['Kerja']);
  assert.equal(canonicalTask.priority, 'high');
  assert.equal(canonicalTask.status, 'todo');
  assert.equal(canonicalTask.dueDate, '2026-10-30');
  assert.equal(rawTask.id, ' task-1 ', 'payload sumber tidak diubah');
});

test('validateBoard menolak ID yang bertabrakan setelah trim', () => {
  const board = createEmptyBoard();
  board.columns.todo.push(task('task-1', 'A'));
  board.columns.todo.push({ ...task('task-2', 'B'), id: ' task-1 ' });

  const result = validateBoard(board);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /ID tugas duplikat: task-1/);
});

test('validateBoard menolak field asing pada papan dan tugas', () => {
  const board = createEmptyBoard();
  board.meta = { versi: 1 };
  assert.match(validateBoard(board).errors.join(' '), /Field papan tidak dikenal: meta/);

  const taskWithExtra = createEmptyBoard();
  taskWithExtra.columns.todo.push({
    ...task('task-1', 'A'),
    extraField: 'tidak boleh dipertahankan',
  });
  const result = validateBoard(taskWithExtra);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /Field tugas tidak dikenal: extraField/);
});
