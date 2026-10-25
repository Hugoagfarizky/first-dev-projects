export const STATUSES = Object.freeze([
  Object.freeze({ id: 'todo', label: 'To Do' }),
  Object.freeze({ id: 'in-progress', label: 'In Progress' }),
  Object.freeze({ id: 'review', label: 'Review' }),
  Object.freeze({ id: 'done', label: 'Done' }),
]);

export const STATUS_IDS = Object.freeze(STATUSES.map(({ id }) => id));

export const STATUS_LABELS = Object.freeze(
  Object.fromEntries(STATUSES.map(({ id, label }) => [id, label])),
);

export const PRIORITIES = Object.freeze([
  Object.freeze({ id: 'low', label: 'Low' }),
  Object.freeze({ id: 'medium', label: 'Medium' }),
  Object.freeze({ id: 'high', label: 'High' }),
]);

export const PRIORITY_IDS = Object.freeze(PRIORITIES.map(({ id }) => id));

export const PRIORITY_LABELS = Object.freeze(
  Object.fromEntries(PRIORITIES.map(({ id, label }) => [id, label])),
);

export const LIMITS = Object.freeze({
  TITLE_MAX: 120,
  DESCRIPTION_MAX: 2000,
  TAG_MAX: 32,
  TAGS_MAX: 8,
  MAX_TASKS: 500,
  IMPORT_BYTES_MAX: 1_048_576,
  HISTORY_LIMIT: 50,
});

export const TASK_FIELDS = Object.freeze([
  'id',
  'title',
  'description',
  'tags',
  'priority',
  'status',
  'dueDate',
  'createdAt',
  'updatedAt',
]);

const TASK_FIELD_SET = new Set(TASK_FIELDS);
const STATUS_SET = new Set(STATUS_IDS);
const PRIORITY_SET = new Set(PRIORITY_IDS);
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}

function fail(message, field) {
  throw new ValidationError(message, field);
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalizeTimestamp(value, field, fallback = null) {
  if (value === undefined || value === null || value === '') {
    if (fallback !== null) return fallback;
    fail('Waktu harus diisi.', field);
  }
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    fail('Waktu tidak valid.', field);
  }
  return new Date(value).toISOString();
}

function toDate(value) {
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

export function normalizeId(value) {
  if (typeof value !== 'string' || !ID_PATTERN.test(value.trim())) {
    fail('ID harus berupa 1–64 karakter huruf, angka, tanda hubung, atau garis bawah.', 'id');
  }
  return value.trim();
}

export function normalizeTitle(value) {
  if (typeof value !== 'string') fail('Judul wajib berupa teks.', 'title');
  const title = value.normalize('NFC').trim();
  if (!title) fail('Judul wajib diisi dan tidak boleh hanya berisi spasi.', 'title');
  if (title.length > LIMITS.TITLE_MAX) {
    fail(`Judul maksimal ${LIMITS.TITLE_MAX} karakter.`, 'title');
  }
  return title;
}

export function normalizeDescription(value) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') fail('Deskripsi harus berupa teks.', 'description');
  const description = value.normalize('NFC').trim();
  if (description.length > LIMITS.DESCRIPTION_MAX) {
    fail(`Deskripsi maksimal ${LIMITS.DESCRIPTION_MAX} karakter.`, 'description');
  }
  return description;
}

export function normalizeTags(value) {
  if (value === undefined || value === null) return [];
  let source = value;
  if (typeof value === 'string') source = value.split(',');
  if (!Array.isArray(source)) fail('Tag harus berupa daftar atau teks dipisahkan koma.', 'tags');

  const tags = [];
  const seen = new Set();
  for (const rawTag of source) {
    if (typeof rawTag !== 'string') fail('Setiap tag harus berupa teks.', 'tags');
    const tag = rawTag.normalize('NFC').trim();
    if (!tag) continue;
    if (tag.length > LIMITS.TAG_MAX) {
      fail(`Setiap tag maksimal ${LIMITS.TAG_MAX} karakter.`, 'tags');
    }
    const key = tag.toLocaleLowerCase('id-ID');
    if (!seen.has(key)) {
      seen.add(key);
      tags.push(tag);
    }
  }
  if (tags.length > LIMITS.TAGS_MAX) {
    fail(`Maksimal ${LIMITS.TAGS_MAX} tag per tugas.`, 'tags');
  }
  return tags;
}

export function normalizePriority(value) {
  const priority = value === undefined || value === null || value === ''
    ? 'medium'
    : String(value).trim().toLowerCase();
  if (!PRIORITY_SET.has(priority)) fail('Prioritas harus Low, Medium, atau High.', 'priority');
  return priority;
}

export function normalizeStatus(value) {
  const status = value === undefined || value === null || value === ''
    ? 'todo'
    : String(value).trim().toLowerCase();
  if (!STATUS_SET.has(status)) {
    fail('Status harus To Do, In Progress, Review, atau Done.', 'status');
  }
  return status;
}

export function normalizeDueDate(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') fail('Tenggat harus berupa tanggal.', 'dueDate');
  const match = DATE_PATTERN.exec(value.trim());
  if (!match) fail('Tenggat harus memakai format YYYY-MM-DD.', 'dueDate');
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    year < 1900
    || date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    fail('Tenggat bukan tanggal yang valid.', 'dueDate');
  }
  return value.trim();
}

function defaultIdFactory() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  fail('Browser tidak menyediakan generator ID yang aman.', 'id');
}

function buildTask(input, identity, nowIso) {
  return {
    id: normalizeId(identity.id),
    title: normalizeTitle(input.title),
    description: normalizeDescription(input.description),
    tags: normalizeTags(input.tags),
    priority: normalizePriority(input.priority),
    status: normalizeStatus(input.status),
    dueDate: normalizeDueDate(input.dueDate),
    createdAt: normalizeTimestamp(identity.createdAt, 'createdAt', nowIso),
    updatedAt: normalizeTimestamp(identity.updatedAt, 'updatedAt', nowIso),
  };
}

function assertKnownTaskFields(task) {
  if (!isPlainObject(task)) fail('Data tugas harus berupa objek.', 'task');
  const unknown = Object.keys(task).filter((key) => !TASK_FIELD_SET.has(key));
  if (unknown.length) {
    fail(`Field tugas tidak dikenal: ${unknown.join(', ')}.`, 'task');
  }
}

function missingTaskFields(task) {
  return TASK_FIELDS.filter((field) => !Object.hasOwn(task, field));
}

export function canonicalizeTask(task) {
  assertKnownTaskFields(task);
  const missing = missingTaskFields(task);
  if (missing.length) {
    fail(`Field tugas wajib hilang: ${missing.join(', ')}.`, missing[0]);
  }
  return buildTask(
    task,
    { id: task.id, createdAt: task.createdAt, updatedAt: task.updatedAt },
    null,
  );
}


export function createTask(input = {}, options = {}) {
  if (!isPlainObject(input)) fail('Data tugas harus berupa objek.', 'task');
  const now = toDate(options.now);
  const nowIso = now.toISOString();
  const id = input.id === undefined
    ? (options.idFactory ?? defaultIdFactory)()
    : input.id;
  return buildTask(input, { id, createdAt: nowIso, updatedAt: nowIso }, nowIso);
}

export function updateTask(task, patch = {}, options = {}) {
  if (!isPlainObject(task)) fail('Tugas lama tidak valid.', 'task');
  if (!isPlainObject(patch)) fail('Perubahan tugas harus berupa objek.', 'task');
  if (patch.id !== undefined && patch.id !== task.id) {
    fail('ID tugas tidak boleh diubah.', 'id');
  }
  if (patch.createdAt !== undefined && patch.createdAt !== task.createdAt) {
    fail('Waktu pembuatan tugas tidak boleh diubah.', 'createdAt');
  }
  const nowIso = toDate(options.now).toISOString();
  return buildTask(
    { ...task, ...patch },
    { id: task.id, createdAt: task.createdAt, updatedAt: nowIso },
    nowIso,
  );
}

export function validateTask(task) {
  const errors = [];
  const check = (callback) => {
    try {
      callback();
    } catch (error) {
      if (error instanceof ValidationError) {
        errors.push({ field: error.field, message: error.message });
      } else {
        throw error;
      }
    }
  };

  if (!isPlainObject(task)) {
    return {
      ok: false,
      errors: [{ field: 'task', message: 'Tugas harus berupa objek.' }],
    };
  }

  for (const key of Object.keys(task)) {
    if (!TASK_FIELD_SET.has(key)) {
      errors.push({ field: 'task', message: `Field tugas tidak dikenal: ${key}.` });
    }
  }
  for (const field of missingTaskFields(task)) {
    errors.push({ field, message: `Field ${field} wajib ada.` });
  }

  check(() => normalizeId(task.id));
  check(() => normalizeTitle(task.title));
  check(() => normalizeDescription(task.description));
  check(() => {
    if (!Array.isArray(task.tags)) fail('Tag harus berupa larik.', 'tags');
    normalizeTags(task.tags);
  });
  check(() => normalizePriority(task.priority));
  check(() => normalizeStatus(task.status));
  check(() => normalizeDueDate(task.dueDate));
  check(() => normalizeTimestamp(task.createdAt, 'createdAt'));
  check(() => normalizeTimestamp(task.updatedAt, 'updatedAt'));

  return { ok: errors.length === 0, errors };
}

export function assertValidTask(task) {
  return canonicalizeTask(task);
}

export function todayDateString(value = new Date()) {
  const date = toDate(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isOverdue(task, today = new Date()) {
  if (!task?.dueDate || task.status === 'done') return false;
  return task.dueDate < todayDateString(today);
}
