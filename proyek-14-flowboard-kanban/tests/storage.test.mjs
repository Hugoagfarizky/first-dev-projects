import assert from 'node:assert/strict';
import test from 'node:test';

import { createEmptyBoard } from '../js/board.js';
import {
  STORAGE_KEY,
  loadBoard,
  saveBoard,
  serializeBoard,
} from '../js/storage.js';
import { LIMITS, TASK_FIELDS, createTask } from '../js/task-model.js';

const NOW = new Date('2026-10-23T10:00:00.000Z');

class MemoryStorage {
  constructor(entries = {}) {
    this.map = new Map(Object.entries(entries));
    this.failGet = false;
    this.failSet = false;
  }

  getItem(key) {
    if (this.failGet) throw new Error('get gagal');
    return this.map.has(key) ? this.map.get(key) : null;
  }

  setItem(key, value) {
    if (this.failSet) throw new Error('set gagal');
    this.map.set(key, String(value));
  }

  removeItem(key) {
    this.map.delete(key);
  }
}

function task(id, title, overrides = {}) {
  return createTask({
    title,
    status: overrides.status ?? 'todo',
    priority: overrides.priority ?? 'medium',
    description: overrides.description ?? '',
    tags: overrides.tags ?? [],
    dueDate: overrides.dueDate ?? null,
  }, {
    idFactory: () => id,
    now: NOW,
  });
}

function boardWithTwoTasks() {
  return {
    columns: {
      todo: [task('task-1', 'A'), task('task-2', 'B')],
      'in-progress': [],
      review: [],
      done: [],
    },
  };
}

function schemaOnePayload(board, extraRoot = {}) {
  return JSON.stringify({
    app: 'flowboard',
    schemaVersion: 1,
    savedAt: NOW.toISOString(),
    ...extraRoot,
    board,
  });
}

function emptyColumnsWith(todoTask, status = 'todo') {
  const board = createEmptyBoard();
  if (todoTask) board.columns[status].push(todoTask);
  return board;
}

test('loadBoard mengembalikan papan kosong saat storage belum berisi data', () => {
  const storage = new MemoryStorage();
  const result = loadBoard(storage);
  assert.equal(result.status, 'empty');
  assert.equal(result.canPersist, true);
  assert.equal(result.board.columns.todo.length, 0);
});

test('saveBoard dan loadBoard mempertahankan isi serta urutan kartu', () => {
  const storage = new MemoryStorage();
  const board = boardWithTwoTasks();
  const saved = saveBoard(storage, board, { now: NOW });
  assert.equal(saved.ok, true);

  const loaded = loadBoard(storage);
  assert.equal(loaded.status, 'loaded');
  assert.equal(loaded.canPersist, true);
  assert.deepEqual(
    loaded.board.columns.todo.map(({ id, title }) => ({ id, title })),
    [{ id: 'task-1', title: 'A' }, { id: 'task-2', title: 'B' }],
  );
});

test('JSON rusak dilaporkan tanpa menghapus sumber dan memblokir persistensi', () => {
  const raw = '{rusak';
  const storage = new MemoryStorage({ [STORAGE_KEY]: raw });
  const result = loadBoard(storage);
  assert.equal(result.status, 'error');
  assert.equal(result.canPersist, false);
  assert.equal(result.code, 'INVALID_JSON');
  assert.equal(storage.getItem(STORAGE_KEY), raw);
});

test('schema versi yang tidak dikenal tidak ditimpa', () => {
  const raw = JSON.stringify({ schemaVersion: 99, board: createEmptyBoard() });
  const storage = new MemoryStorage({ [STORAGE_KEY]: raw });
  const result = loadBoard(storage);
  assert.equal(result.status, 'error');
  assert.equal(result.code, 'UNSUPPORTED_VERSION');
  assert.equal(storage.getItem(STORAGE_KEY), raw);
});

test('board tidak valid pada schema versi 1 ditolak', () => {
  const raw = JSON.stringify({
    schemaVersion: 1,
    board: { columns: { todo: [{ id: 'rusak' }] } },
  });
  const storage = new MemoryStorage({ [STORAGE_KEY]: raw });
  const result = loadBoard(storage);
  assert.equal(result.status, 'error');
  assert.equal(result.code, 'INVALID_BOARD');
  assert.equal(result.canPersist, false);
});

test('migrasi schema 0 memindahkan tugas ke kolom sesuai status', () => {
  const legacy = {
    schemaVersion: 0,
    tasks: [
      task('task-1', 'A'),
      task('task-2', 'B', { status: 'done' }),
      task('task-3', 'C'),
    ],
  };
  const storage = new MemoryStorage({ [STORAGE_KEY]: JSON.stringify(legacy) });
  const result = loadBoard(storage, { now: NOW });
  assert.equal(result.status, 'migrated');
  assert.equal(result.canPersist, true);
  assert.deepEqual(result.board.columns.todo.map(({ id }) => id), ['task-1', 'task-3']);
  assert.deepEqual(result.board.columns.done.map(({ id }) => id), ['task-2']);
});

test('migrasi schema 0 yang tidak valid gagal tanpa menghapus data', () => {
  const raw = JSON.stringify({
    schemaVersion: 0,
    tasks: [{ id: 'task-1', title: '', status: 'todo' }],
  });
  const storage = new MemoryStorage({ [STORAGE_KEY]: raw });
  const result = loadBoard(storage);
  assert.equal(result.status, 'error');
  assert.equal(result.code, 'INVALID_LEGACY_DATA');
  assert.equal(storage.getItem(STORAGE_KEY), raw);
});

test('storage get yang melempar dilaporkan tidak tersedia', () => {
  const storage = new MemoryStorage();
  storage.failGet = true;
  const result = loadBoard(storage);
  assert.equal(result.status, 'unavailable');
  assert.equal(result.canPersist, false);
});

test('kegagalan setItem tidak dilaporkan sebagai berhasil', () => {
  const storage = new MemoryStorage();
  storage.failSet = true;
  const result = saveBoard(storage, createEmptyBoard(), { now: NOW });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'WRITE_FAILED');
  assert.equal(storage.getItem(STORAGE_KEY), null);
});

test('tulisan yang tidak dapat diverifikasi dianggap gagal', () => {
  const storage = {
    getItem() {
      return null;
    },
    setItem() {},
  };
  const result = saveBoard(storage, createEmptyBoard(), { now: NOW });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'WRITE_VERIFY_FAILED');
});

test('saveBoard menolak papan yang tidak valid', () => {
  const storage = new MemoryStorage();
  const result = saveBoard(storage, { columns: {} }, { now: NOW });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'INVALID_BOARD');
});

test('payload serialisasi memuat versi skema dan aplikasi', () => {
  const payload = JSON.parse(serializeBoard(createEmptyBoard(), NOW));
  assert.equal(payload.app, 'flowboard');
  assert.equal(payload.schemaVersion, 1);
  assert.equal(payload.savedAt, NOW.toISOString());
  assert.deepEqual(Object.keys(payload.board.columns), ['todo', 'in-progress', 'review', 'done']);
});

test('schema 1 memuat tugas mentah sebagai data kanonik tanpa menulis ulang storage', () => {
  const rawTask = {
    ...task('task-1', 'A'),
    id: ' task-1 ',
    title: '  Tugas  ',
    tags: [' Kerja ', 'kerja', '  '],
    priority: 'HIGH',
    dueDate: ' 2026-10-30 ',
  };
  const raw = schemaOnePayload(emptyColumnsWith(rawTask));
  const storage = new MemoryStorage({ [STORAGE_KEY]: raw });

  const result = loadBoard(storage, { now: NOW });
  assert.equal(result.status, 'loaded');
  assert.equal(result.canPersist, true);
  const loaded = result.board.columns.todo[0];
  assert.equal(loaded.id, 'task-1');
  assert.equal(loaded.title, 'Tugas');
  assert.deepEqual(loaded.tags, ['Kerja']);
  assert.equal(loaded.priority, 'high');
  assert.equal(loaded.dueDate, '2026-10-30');
  assert.equal(storage.getItem(STORAGE_KEY), raw);
});

test('schema 1 menolak setiap field tugas wajib yang hilang tanpa menimpa payload lama', () => {
  for (const field of TASK_FIELDS) {
    const candidate = { ...task('task-1', 'A') };
    delete candidate[field];
    const raw = schemaOnePayload(emptyColumnsWith(candidate));
    const storage = new MemoryStorage({ [STORAGE_KEY]: raw });

    const result = loadBoard(storage, { now: NOW });
    assert.equal(result.status, 'error', `field ${field} harus ditolak`);
    assert.equal(result.code, 'INVALID_BOARD');
    assert.equal(result.canPersist, false);
    assert.equal(storage.getItem(STORAGE_KEY), raw, `payload harus utuh setelah ${field} hilang`);
  }
});

test('schema 1 menolak judul terlalu panjang setelah trim', () => {
  const candidate = {
    ...task('task-1', 'A'),
    title: `  ${'x'.repeat(LIMITS.TITLE_MAX + 1)}  `,
  };
  const raw = schemaOnePayload(emptyColumnsWith(candidate));
  const storage = new MemoryStorage({ [STORAGE_KEY]: raw });

  const result = loadBoard(storage, { now: NOW });
  assert.equal(result.status, 'error');
  assert.equal(result.code, 'INVALID_BOARD');
  assert.equal(storage.getItem(STORAGE_KEY), raw);
});

test('schema 1 menolak field asing pada root dan tugas tanpa menimpa payload', () => {
  const rootRaw = schemaOnePayload(boardWithTwoTasks(), { meta: { versi: 1 } });
  const rootStorage = new MemoryStorage({ [STORAGE_KEY]: rootRaw });
  const rootResult = loadBoard(rootStorage, { now: NOW });
  assert.equal(rootResult.status, 'error');
  assert.equal(rootResult.code, 'UNKNOWN_FIELD');
  assert.equal(rootStorage.getItem(STORAGE_KEY), rootRaw);

  const taskRaw = schemaOnePayload(emptyColumnsWith({
    ...task('task-1', 'A'),
    extraField: 'tidak boleh lolos',
  }));
  const taskStorage = new MemoryStorage({ [STORAGE_KEY]: taskRaw });
  const taskResult = loadBoard(taskStorage, { now: NOW });
  assert.equal(taskResult.status, 'error');
  assert.equal(taskResult.code, 'INVALID_BOARD');
  assert.equal(taskStorage.getItem(STORAGE_KEY), taskRaw);
});

test('migrasi schema 0 menghasilkan nilai kanonik dan default yang eksplisit', () => {
  const raw = JSON.stringify({
    schemaVersion: 0,
    tasks: [{
      id: ' task-1 ',
      title: '  Tugas lama  ',
      tags: [' Kerja ', 'kerja', '  '],
      priority: 'HIGH',
      status: ' REVIEW ',
      dueDate: ' 2026-10-30 ',
    }],
  });
  const storage = new MemoryStorage({ [STORAGE_KEY]: raw });

  const result = loadBoard(storage, { now: NOW });
  assert.equal(result.status, 'migrated');
  assert.equal(result.canPersist, true);
  const migrated = result.board.columns.review[0];
  assert.equal(migrated.id, 'task-1');
  assert.equal(migrated.title, 'Tugas lama');
  assert.deepEqual(migrated.tags, ['Kerja']);
  assert.equal(migrated.priority, 'high');
  assert.equal(migrated.status, 'review');
  assert.equal(migrated.dueDate, '2026-10-30');
  assert.equal(migrated.description, '');
  assert.equal(migrated.createdAt, NOW.toISOString());
  assert.equal(storage.getItem(STORAGE_KEY), raw);
});

test('migrasi schema 0 menolak ID yang bertabrakan setelah trim', () => {
  const raw = JSON.stringify({
    schemaVersion: 0,
    tasks: [
      task('task-1', 'A'),
      { ...task('task-2', 'B'), id: ' task-1 ' },
    ],
  });
  const storage = new MemoryStorage({ [STORAGE_KEY]: raw });

  const result = loadBoard(storage, { now: NOW });
  assert.equal(result.status, 'error');
  assert.equal(result.code, 'INVALID_LEGACY_DATA');
  assert.match(result.message, /duplikat/i);
  assert.equal(storage.getItem(STORAGE_KEY), raw);
});

test('migrasi schema 0 menolak judul terlalu panjang dan field asing', () => {
  const tooLongRaw = JSON.stringify({
    schemaVersion: 0,
    tasks: [{
      ...task('task-1', 'A'),
      title: `  ${'x'.repeat(LIMITS.TITLE_MAX + 1)}  `,
    }],
  });
  const tooLongStorage = new MemoryStorage({ [STORAGE_KEY]: tooLongRaw });
  const tooLongResult = loadBoard(tooLongStorage, { now: NOW });
  assert.equal(tooLongResult.status, 'error');
  assert.equal(tooLongResult.code, 'INVALID_LEGACY_DATA');
  assert.equal(tooLongStorage.getItem(STORAGE_KEY), tooLongRaw);

  const unknownRaw = JSON.stringify({
    schemaVersion: 0,
    tasks: [{ ...task('task-1', 'A'), extraField: 'tidak boleh lolos' }],
  });
  const unknownStorage = new MemoryStorage({ [STORAGE_KEY]: unknownRaw });
  const unknownResult = loadBoard(unknownStorage, { now: NOW });
  assert.equal(unknownResult.status, 'error');
  assert.equal(unknownResult.code, 'INVALID_LEGACY_DATA');
  assert.equal(unknownStorage.getItem(STORAGE_KEY), unknownRaw);
});
