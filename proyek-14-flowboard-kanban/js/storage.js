import {
  boardFromTasks,
  canonicalizeBoard,
  createEmptyBoard,
  validateBoard,
} from './board.js';
import { LIMITS, TASK_FIELDS } from './task-model.js';

export const STORAGE_KEY = 'flowboard.board';
export const STORAGE_SCHEMA_VERSION = 1;

const STORAGE_ROOT_FIELDS = new Set(['app', 'schemaVersion', 'savedAt', 'board']);
const LEGACY_ROOT_FIELDS = new Set(['schemaVersion', 'tasks']);
const LEGACY_TASK_FIELDS = new Set(TASK_FIELDS);

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function failure(code, message) {
  return { ok: false, code, message };
}

function normalizeLegacyTask(raw, fallbackTime) {
  if (!isPlainObject(raw)) throw new Error('Setiap tugas lama harus berupa objek.');
  const unknown = Object.keys(raw).filter((key) => !LEGACY_TASK_FIELDS.has(key));
  if (unknown.length) {
    throw new Error(`Field tugas lama tidak dikenal: ${unknown.join(', ')}.`);
  }
  return {
    id: raw.id,
    title: raw.title,
    description: raw.description ?? '',
    tags: raw.tags ?? [],
    priority: raw.priority ?? 'medium',
    status: raw.status ?? 'todo',
    dueDate: raw.dueDate ?? null,
    createdAt: raw.createdAt ?? fallbackTime,
    updatedAt: raw.updatedAt ?? raw.createdAt ?? fallbackTime,
  };
}

function migrateLegacyV0(payload, now) {
  const unknownRoot = Object.keys(payload).filter((key) => !LEGACY_ROOT_FIELDS.has(key));
  if (unknownRoot.length) {
    return failure(
      'INVALID_LEGACY_SCHEMA',
      `Field skema lama tidak dikenal: ${unknownRoot.join(', ')}.`,
    );
  }
  if (!Array.isArray(payload.tasks)) {
    return failure('INVALID_LEGACY_SCHEMA', 'Skema lama tidak memiliki larik tugas.');
  }
  if (payload.tasks.length > LIMITS.MAX_TASKS) {
    return failure('TOO_MANY_TASKS', `Jumlah tugas melebihi batas ${LIMITS.MAX_TASKS}.`);
  }
  try {
    const fallbackTime = now.toISOString();
    const tasks = payload.tasks.map((task) => normalizeLegacyTask(task, fallbackTime));
    const board = boardFromTasks(tasks);
    return { ok: true, board, migrated: true, sourceVersion: 0 };
  } catch (error) {
    return failure('INVALID_LEGACY_DATA', `Migrasi skema lama gagal: ${error.message}`);
  }
}

export function createStoragePayload(board, now = new Date()) {
  const canonical = canonicalizeBoard(board);
  return {
    app: 'flowboard',
    schemaVersion: STORAGE_SCHEMA_VERSION,
    savedAt: now.toISOString(),
    board: canonical,
  };
}

export function serializeBoard(board, now = new Date()) {
  return JSON.stringify(createStoragePayload(board, now));
}

export function parseStoredPayload(raw, options = {}) {
  if (typeof raw !== 'string' || !raw.trim()) {
    return failure('INVALID_JSON', 'Data lokal kosong atau bukan teks JSON.');
  }
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return failure('INVALID_JSON', 'Data lokal bukan JSON yang valid.');
  }
  if (!isPlainObject(payload)) {
    return failure('INVALID_PAYLOAD', 'Data lokal harus berupa objek JSON.');
  }

  const now = options.now instanceof Date ? options.now : new Date();
  if (payload.schemaVersion === STORAGE_SCHEMA_VERSION) {
    const unknownRoot = Object.keys(payload).filter((key) => !STORAGE_ROOT_FIELDS.has(key));
    if (unknownRoot.length) {
      return failure(
        'UNKNOWN_FIELD',
        `Field data lokal tidak dikenal: ${unknownRoot.join(', ')}.`,
      );
    }
    if (payload.app !== undefined && payload.app !== 'flowboard') {
      return failure('UNKNOWN_APP', 'Data lokal bukan milik aplikasi Flowboard.');
    }
    try {
      const board = canonicalizeBoard(payload.board);
      return {
        ok: true,
        board,
        migrated: false,
        sourceVersion: STORAGE_SCHEMA_VERSION,
      };
    } catch (error) {
      const detail = Array.isArray(error.errors) ? error.errors[0] : error.message;
      return failure('INVALID_BOARD', `Data papan tidak valid: ${detail}`);
    }
  }
  if (payload.schemaVersion === 0) {
    return migrateLegacyV0(payload, now);
  }
  return failure(
    'UNSUPPORTED_VERSION',
    `Versi skema data lokal tidak didukung: ${String(payload.schemaVersion ?? 'tidak ada')}.`,
  );
}

export function loadBoard(storage, options = {}) {
  if (!storage || typeof storage.getItem !== 'function') {
    return {
      status: 'unavailable',
      board: createEmptyBoard(),
      canPersist: false,
      message: 'Penyimpanan browser tidak tersedia. Data hanya berada di memori tab.',
    };
  }

  let raw;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return {
      status: 'unavailable',
      board: createEmptyBoard(),
      canPersist: false,
      message: 'Akses penyimpanan browser ditolak. Data hanya berada di memori tab.',
    };
  }

  if (raw === null) {
    return {
      status: 'empty',
      board: createEmptyBoard(),
      canPersist: true,
      message: 'Belum ada papan tersimpan. Mulai dengan menambahkan tugas.',
    };
  }

  const parsed = parseStoredPayload(raw, options);
  if (!parsed.ok) {
    return {
      status: 'error',
      board: createEmptyBoard(),
      canPersist: false,
      code: parsed.code,
      message: `${parsed.message} Data lama tidak ditimpa.`,
    };
  }

  return {
    status: parsed.migrated ? 'migrated' : 'loaded',
    board: parsed.board,
    canPersist: true,
    message: parsed.migrated
      ? 'Data lokal versi lama berhasil dimigrasikan.'
      : 'Data lokal berhasil dimuat.',
  };
}

export function saveBoard(storage, board, options = {}) {
  if (!storage || typeof storage.setItem !== 'function') {
    return failure('STORAGE_UNAVAILABLE', 'Penyimpanan browser tidak tersedia.');
  }
  const validation = validateBoard(board);
  if (!validation.ok) {
    return failure('INVALID_BOARD', `Papan tidak valid: ${validation.errors[0]}`);
  }

  const now = options.now instanceof Date ? options.now : new Date();
  let serialized;
  try {
    serialized = serializeBoard(board, now);
  } catch (error) {
    return failure('SERIALIZE_FAILED', `Data gagal diserialisasi: ${error.message}`);
  }

  try {
    storage.setItem(STORAGE_KEY, serialized);
    if (storage.getItem(STORAGE_KEY) !== serialized) {
      return failure('WRITE_VERIFY_FAILED', 'Tulisan penyimpanan tidak dapat diverifikasi.');
    }
  } catch {
    return failure(
      'WRITE_FAILED',
      'Penyimpanan browser menolak penulisan, mungkin karena kuota atau izin.',
    );
  }

  return { ok: true, bytes: serialized.length };
}

export function clearStoredBoard(storage) {
  if (!storage || typeof storage.removeItem !== 'function') return false;
  try {
    storage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
