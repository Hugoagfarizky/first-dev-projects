import assert from 'node:assert/strict';
import test from 'node:test';

import { createEmptyBoard } from '../js/board.js';
import {
  MAX_IMPORT_BYTES,
  createExportFilename,
  exportBoardJson,
  parseImportJson,
} from '../js/import-export.js';
import {
  LIMITS,
  TASK_FIELDS,
  createTask,
  isOverdue,
} from '../js/task-model.js';

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

function sampleBoard() {
  return {
    columns: {
      todo: [task('task-1', 'Tulis laporan', { tags: ['kerja'] })],
      'in-progress': [task('task-2', 'Rapat desain', { status: 'in-progress', priority: 'high' })],
      review: [],
      done: [task('task-3', 'Arsip', { status: 'done' })],
    },
  };
}

function payloadFor(board) {
  return JSON.stringify({
    app: 'flowboard',
    schemaVersion: 1,
    exportedAt: NOW.toISOString(),
    board,
  });
}

test('exportBoardJson menghasilkan payload v1 tanpa mengubah papan', () => {
  const board = sampleBoard();
  const before = JSON.stringify(board);
  const text = exportBoardJson(board, { now: NOW });
  const payload = JSON.parse(text);

  assert.equal(payload.app, 'flowboard');
  assert.equal(payload.schemaVersion, 1);
  assert.equal(payload.exportedAt, NOW.toISOString());
  assert.equal(payload.board.columns.todo[0].title, 'Tulis laporan');
  assert.equal(text.endsWith('\n'), true);
  assert.equal(JSON.stringify(board), before);
});

test('ekspor lalu impor memulihkan isi dan urutan kartu', () => {
  const text = exportBoardJson(sampleBoard(), { now: NOW });
  const result = parseImportJson(text);
  assert.equal(result.ok, true);
  assert.deepEqual(
    result.board.columns['in-progress'].map(({ id, priority }) => ({ id, priority })),
    [{ id: 'task-2', priority: 'high' }],
  );
  assert.deepEqual(result.board.columns.todo.map(({ id }) => id), ['task-1']);
  assert.deepEqual(result.board.columns.done.map(({ id }) => id), ['task-3']);
  assert.equal(result.meta.taskCount, 3);
});

test('JSON rusak ditolak dengan kode yang jelas', () => {
  const result = parseImportJson('{tidak valid');
  assert.equal(result.ok, false);
  assert.equal(result.code, 'INVALID_JSON');
});

test('versi skema dan aplikasi yang tidak dikenal ditolak', () => {
  const board = sampleBoard();
  const wrongVersion = parseImportJson(JSON.stringify({ schemaVersion: 2, board }));
  assert.equal(wrongVersion.code, 'UNSUPPORTED_VERSION');

  const wrongApp = parseImportJson(JSON.stringify({
    app: 'aplikasi-lain',
    schemaVersion: 1,
    board,
  }));
  assert.equal(wrongApp.code, 'UNKNOWN_APP');
});

test('ID duplikat ditolak oleh validasi board impor', () => {
  const duplicate = task('task-1', 'A');
  const board = {
    columns: {
      todo: [duplicate],
      'in-progress': [],
      review: [task('task-1', 'B', { status: 'review' })],
      done: [],
    },
  };
  const result = parseImportJson(payloadFor(board));
  assert.equal(result.ok, false);
  assert.equal(result.code, 'INVALID_BOARD');
  assert.match(result.message, /duplikat/i);
});

test('status yang tidak cocok dengan kolom ditolak', () => {
  const board = {
    columns: {
      todo: [task('task-1', 'A', { status: 'review' })],
      'in-progress': [],
      review: [],
      done: [],
    },
  };
  const result = parseImportJson(payloadFor(board));
  assert.equal(result.ok, false);
  assert.equal(result.code, 'INVALID_BOARD');
});

test('field dengan tipe atau panjang yang salah ditolak', () => {
  const valid = task('task-1', 'A');
  const board = {
    columns: {
      todo: [{ ...valid, title: '' }],
      'in-progress': [],
      review: [],
      done: [],
    },
  };
  const result = parseImportJson(payloadFor(board));
  assert.equal(result.ok, false);
  assert.equal(result.code, 'INVALID_BOARD');
  assert.match(result.message, /Judul/i);
});

test('jumlah tugas di atas batas ditolak', () => {
  const base = task('task-0', 'Tugas 0');
  const board = createEmptyBoard();
  for (let index = 0; index < 501; index += 1) {
    board.columns.todo.push({ ...base, id: `task-${index}`, title: `Tugas ${index}` });
  }
  const result = parseImportJson(payloadFor(board));
  assert.equal(result.ok, false);
  assert.equal(result.code, 'INVALID_BOARD');
  assert.match(result.message, /batas 500/);
});

test('file impor di atas 1 MiB ditolak sebelum parsing', () => {
  const result = parseImportJson(' '.repeat(MAX_IMPORT_BYTES + 1));
  assert.equal(result.ok, false);
  assert.equal(result.code, 'TOO_LARGE');
});

test('judul duplikat tetap sah dan teks HTML disimpan sebagai teks biasa', () => {
  const board = {
    columns: {
      todo: [
        task('task-1', 'Judul sama'),
        task('task-2', 'Judul sama'),
        task('task-3', '<img src=x onerror=alert(1)>'),
      ],
      'in-progress': [],
      review: [],
      done: [],
    },
  };
  const result = parseImportJson(payloadFor(board));
  assert.equal(result.ok, true);
  assert.equal(result.board.columns.todo.length, 3);
  assert.equal(result.board.columns.todo[2].title, '<img src=x onerror=alert(1)>');
});

test('hasil impor tidak berbagi referensi dengan payload', () => {
  const board = sampleBoard();
  const result = parseImportJson(payloadFor(board));
  result.board.columns.todo[0].title = 'Diubah setelah impor';
  assert.equal(board.columns.todo[0].title, 'Tulis laporan');
});

test('nama file ekspor memakai tanggal UTC', () => {
  assert.equal(createExportFilename(new Date('2026-10-23T23:30:00.000Z')), 'flowboard-2026-10-23.json');
});

test('impor menormalkan ID, prioritas, tanggal, dan tag sebelum dipakai', () => {
  const rawTask = {
    ...task('task-1', 'Tulis laporan'),
    id: ' task-1 ',
    title: '  Tulis laporan  ',
    tags: [' Kerja ', 'kerja', '  '],
    priority: 'HIGH',
    dueDate: ' 2026-10-30 ',
  };
  const board = createEmptyBoard();
  board.columns.todo.push(rawTask);

  const result = parseImportJson(payloadFor(board));
  assert.equal(result.ok, true);
  const imported = result.board.columns.todo[0];
  assert.equal(imported.id, 'task-1');
  assert.equal(imported.title, 'Tulis laporan');
  assert.deepEqual(imported.tags, ['Kerja']);
  assert.equal(imported.priority, 'high');
  assert.equal(imported.dueDate, '2026-10-30');
  assert.equal(isOverdue(imported, new Date('2026-10-26T12:00:00')), false);
});

test('impor menolak ID yang bertabrakan setelah trim', () => {
  const board = createEmptyBoard();
  board.columns.todo.push(task('task-1', 'A'));
  board.columns.todo.push({ ...task('task-2', 'B'), id: ' task-1 ' });

  const result = parseImportJson(payloadFor(board));
  assert.equal(result.ok, false);
  assert.equal(result.code, 'INVALID_BOARD');
  assert.match(result.message, /duplikat/i);
});

test('impor menolak setiap field tugas wajib yang hilang satu per satu', () => {
  for (const field of TASK_FIELDS) {
    const candidate = { ...task('task-1', 'A') };
    delete candidate[field];
    const board = createEmptyBoard();
    board.columns.todo.push(candidate);

    const result = parseImportJson(payloadFor(board));
    assert.equal(result.ok, false, `field ${field} harus ditolak`);
    assert.equal(result.code, 'INVALID_BOARD');
  }
});

test('impor menolak panjang melebihi batas setelah trim', () => {
  const cases = [
    { field: 'title', value: `  ${'x'.repeat(LIMITS.TITLE_MAX + 1)}  `, pattern: /Judul maksimal/ },
    {
      field: 'description',
      value: `  ${'x'.repeat(LIMITS.DESCRIPTION_MAX + 1)}  `,
      pattern: /Deskripsi maksimal/,
    },
    { field: 'tags', value: [`  ${'x'.repeat(LIMITS.TAG_MAX + 1)}  `], pattern: /maksimal 32/ },
  ];

  for (const { field, value, pattern } of cases) {
    const board = createEmptyBoard();
    board.columns.todo.push({ ...task('task-1', 'A'), [field]: value });
    const result = parseImportJson(payloadFor(board));
    assert.equal(result.ok, false, `${field} harus ditolak`);
    assert.equal(result.code, 'INVALID_BOARD');
    assert.match(result.message, pattern);
  }
});

test('impor menolak field asing pada root dan tugas tanpa mengubah papan sumber', () => {
  const board = sampleBoard();
  const payload = JSON.parse(payloadFor(board));
  payload.meta = { versi: 1 };
  const rootResult = parseImportJson(JSON.stringify(payload));
  assert.equal(rootResult.ok, false);
  assert.equal(rootResult.code, 'UNKNOWN_FIELD');
  assert.match(rootResult.message, /meta/);

  const before = JSON.stringify(board);
  const taskPayload = JSON.parse(payloadFor(board));
  taskPayload.board.columns.todo[0].extraField = 'tidak boleh lolos';
  const taskResult = parseImportJson(JSON.stringify(taskPayload));
  assert.equal(taskResult.ok, false);
  assert.equal(taskResult.code, 'INVALID_BOARD');
  assert.match(taskResult.message, /extraField/);
  assert.equal(JSON.stringify(board), before, 'papan sumber tidak boleh berubah');
});

test('round-trip ekspor, impor, lalu ekspor mempertahankan seluruh field sah', () => {
  const first = exportBoardJson(sampleBoard(), { now: NOW });
  const imported = parseImportJson(first);
  assert.equal(imported.ok, true);
  const second = exportBoardJson(imported.board, { now: NOW });
  assert.equal(second, first);
  assert.deepEqual(imported.board, JSON.parse(first).board);
});
