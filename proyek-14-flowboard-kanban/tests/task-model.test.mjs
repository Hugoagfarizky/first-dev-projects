import assert from 'node:assert/strict';
import test from 'node:test';

import {
  LIMITS,
  TASK_FIELDS,
  ValidationError,
  canonicalizeTask,
  createTask,
  isOverdue,
  normalizeDueDate,
  normalizeTags,
  updateTask,
  validateTask,
} from '../js/task-model.js';

const NOW = new Date('2026-10-23T10:00:00.000Z');

function makeTask(overrides = {}) {
  return createTask({
    title: 'Tulis laporan',
    description: '  Ringkasan progres  ',
    tags: [' kerja ', 'KERJA', 'prioritas'],
    priority: 'high',
    status: 'review',
    dueDate: '2026-10-30',
    ...overrides,
  }, {
    idFactory: () => 'task-1',
    now: NOW,
  });
}

test('createTask menormalkan field dan memakai ID stabil yang diberikan', () => {
  const task = makeTask();
  assert.equal(task.id, 'task-1');
  assert.equal(task.title, 'Tulis laporan');
  assert.equal(task.description, 'Ringkasan progres');
  assert.deepEqual(task.tags, ['kerja', 'prioritas']);
  assert.equal(task.priority, 'high');
  assert.equal(task.status, 'review');
  assert.equal(task.dueDate, '2026-10-30');
  assert.equal(task.createdAt, NOW.toISOString());
  assert.equal(task.updatedAt, NOW.toISOString());
});

test('judul whitespace dan judul terlalu panjang ditolak', () => {
  assert.throws(
    () => createTask({ title: '   ' }, { idFactory: () => 'task-1', now: NOW }),
    (error) => error instanceof ValidationError && error.field === 'title',
  );
  assert.throws(
    () => createTask({ title: 'x'.repeat(LIMITS.TITLE_MAX + 1) }, {
      idFactory: () => 'task-1',
      now: NOW,
    }),
    /Judul maksimal/,
  );
});

test('deskripsi, tag, dan tanggal divalidasi terhadap batas dan tipe', () => {
  assert.throws(
    () => createTask({ title: 'Valid', description: 'x'.repeat(LIMITS.DESCRIPTION_MAX + 1) }, {
      idFactory: () => 'task-1',
      now: NOW,
    }),
    /Deskripsi maksimal/,
  );
  assert.throws(() => normalizeTags(Array.from({ length: 9 }, (_, i) => `tag-${i}`)), /Maksimal 8/);
  assert.throws(() => normalizeTags(['x'.repeat(LIMITS.TAG_MAX + 1)]), /maksimal 32/);
  assert.throws(() => normalizeDueDate('2026-02-30'), /bukan tanggal/);
  assert.throws(() => normalizeDueDate('30-10-2026'), /format YYYY-MM-DD/);
  assert.equal(normalizeDueDate(''), null);
});

test('prioritas dan status di luar daftar ditolak', () => {
  assert.throws(
    () => createTask({ title: 'Valid', priority: 'urgent' }, {
      idFactory: () => 'task-1',
      now: NOW,
    }),
    /Prioritas/,
  );
  assert.throws(
    () => createTask({ title: 'Valid', status: 'blocked' }, {
      idFactory: () => 'task-1',
      now: NOW,
    }),
    /Status/,
  );
});

test('ID harus memakai pola yang aman dan unik untuk pembuatan berikutnya', () => {
  assert.throws(
    () => createTask({ id: 'bad id!', title: 'Valid' }, { now: NOW }),
    (error) => error instanceof ValidationError && error.field === 'id',
  );
  const first = createTask({ title: 'Judul sama' }, {
    idFactory: () => 'task-a',
    now: NOW,
  });
  const second = createTask({ title: 'Judul sama' }, {
    idFactory: () => 'task-b',
    now: NOW,
  });
  assert.notEqual(first.id, second.id);
});

test('updateTask mempertahankan ID dan createdAt serta memperbarui updatedAt', () => {
  const task = makeTask();
  const updated = updateTask(task, {
    title: '  Tulis laporan final ',
    description: 'Versi final',
    priority: 'medium',
  }, { now: new Date('2026-10-24T08:00:00.000Z') });

  assert.equal(updated.id, task.id);
  assert.equal(updated.createdAt, task.createdAt);
  assert.equal(updated.updatedAt, '2026-10-24T08:00:00.000Z');
  assert.equal(updated.title, 'Tulis laporan final');
  assert.equal(updated.description, 'Versi final');
  assert.equal(updated.priority, 'medium');
  assert.equal(task.title, 'Tulis laporan');
});

test('updateTask menolak perubahan ID dan createdAt', () => {
  const task = makeTask();
  assert.throws(() => updateTask(task, { id: 'task-2' }, { now: NOW }), /ID tugas/);
  assert.throws(() => updateTask(task, { createdAt: '2020-01-01T00:00:00.000Z' }, { now: NOW }), /Waktu pembuatan/);
});

test('isOverdue mengabaikan Done, hari ini, masa depan, dan tanpa tenggat', () => {
  const base = { dueDate: '2026-10-22', status: 'todo' };
  assert.equal(isOverdue(base, new Date('2026-10-23T12:00:00')), true);
  assert.equal(isOverdue({ ...base, status: 'done' }, new Date('2026-10-23T12:00:00')), false);
  assert.equal(isOverdue({ ...base, dueDate: '2026-10-23' }, new Date('2026-10-23T12:00:00')), false);
  assert.equal(isOverdue({ ...base, dueDate: '2026-10-24' }, new Date('2026-10-23T12:00:00')), false);
  assert.equal(isOverdue({ ...base, dueDate: null }, new Date('2026-10-23T12:00:00')), false);
});

test('validateTask mengumpulkan field yang tidak valid tanpa melempar', () => {
  const result = validateTask({
    id: 'bad id!',
    title: '',
    description: 42,
    tags: 'bukan larik',
    priority: 'urgent',
    status: 'blocked',
    dueDate: '2026-02-30',
    createdAt: 'bukan waktu',
    updatedAt: null,
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.length >= 8);
  const fields = new Set(result.errors.map(({ field }) => field));
  for (const field of ['id', 'title', 'description', 'tags', 'priority', 'status', 'dueDate', 'createdAt']) {
    assert.equal(fields.has(field), true, `field ${field} harus muncul`);
  }
});

test('canonicalizeTask menormalkan ID, teks, enum, tanggal, dan tag', () => {
  const task = canonicalizeTask({
    ...makeTask(),
    id: ' task-1 ',
    title: '  Tulis laporan  ',
    description: '  Ringkasan progres  ',
    tags: [' Kerja ', 'kerja', '  ', 'Prioritas'],
    priority: 'HIGH',
    status: ' REVIEW ',
    dueDate: ' 2026-10-30 ',
  });

  assert.equal(task.id, 'task-1');
  assert.equal(task.title, 'Tulis laporan');
  assert.equal(task.description, 'Ringkasan progres');
  assert.deepEqual(task.tags, ['Kerja', 'Prioritas']);
  assert.equal(task.priority, 'high');
  assert.equal(task.status, 'review');
  assert.equal(task.dueDate, '2026-10-30');
  assert.equal(
    isOverdue(task, new Date('2026-10-26T12:00:00')),
    false,
    'tenggat 30 Oktober belum terlambat pada 26 Oktober',
  );
});

test('canonicalizeTask menolak setiap field wajib yang hilang satu per satu', () => {
  for (const field of TASK_FIELDS) {
    const candidate = { ...makeTask() };
    delete candidate[field];
    assert.throws(
      () => canonicalizeTask(candidate),
      (error) => error instanceof ValidationError && error.field === field,
      `field ${field} harus ditolak saat hilang`,
    );
  }
});

test('batas panjang diterapkan setelah trim, bukan sebelum normalisasi', () => {
  const exactTitle = canonicalizeTask({
    ...makeTask(),
    title: `  ${'x'.repeat(LIMITS.TITLE_MAX)}  `,
  });
  assert.equal(exactTitle.title.length, LIMITS.TITLE_MAX);

  assert.throws(
    () => canonicalizeTask({ ...makeTask(), title: `  ${'x'.repeat(LIMITS.TITLE_MAX + 1)}  ` }),
    /Judul maksimal/,
  );
  assert.throws(
    () => canonicalizeTask({
      ...makeTask(),
      description: `  ${'x'.repeat(LIMITS.DESCRIPTION_MAX + 1)}  `,
    }),
    /Deskripsi maksimal/,
  );
  assert.throws(
    () => canonicalizeTask({
      ...makeTask(),
      tags: [`  ${'x'.repeat(LIMITS.TAG_MAX + 1)}  `],
    }),
    /maksimal 32/,
  );
});

test('field tugas asing ditolak dan tidak dipertahankan', () => {
  const task = { ...makeTask(), extraField: 'tidak boleh lolos' };
  assert.throws(() => canonicalizeTask(task), /Field tugas tidak dikenal/);
  const result = validateTask(task);
  assert.equal(result.ok, false);
  assert.match(result.errors.map(({ message }) => message).join(' '), /extraField/);
});
