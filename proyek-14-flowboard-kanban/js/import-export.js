import { canonicalizeBoard } from './board.js';
import { LIMITS } from './task-model.js';

export const EXPORT_SCHEMA_VERSION = 1;
export const MAX_IMPORT_BYTES = LIMITS.IMPORT_BYTES_MAX;

const IMPORT_ROOT_FIELDS = new Set(['app', 'schemaVersion', 'exportedAt', 'board']);

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function error(code, message) {
  return { ok: false, code, message };
}

function byteLength(text) {
  return new TextEncoder().encode(text).length;
}

export function exportBoardJson(board, options = {}) {
  const canonical = canonicalizeBoard(board);
  const now = options.now instanceof Date ? options.now : new Date();
  return `${JSON.stringify({
    app: 'flowboard',
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    board: canonical,
  }, null, 2)}\n`;
}

export function createExportFilename(now = new Date()) {
  const date = now instanceof Date ? now : new Date(now);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `flowboard-${year}-${month}-${day}.json`;
}

export function parseImportJson(text) {
  if (typeof text !== 'string') {
    return error('INVALID_TEXT', 'Isi impor harus berupa teks.');
  }

  const bytes = byteLength(text);
  if (bytes > MAX_IMPORT_BYTES) {
    return error(
      'TOO_LARGE',
      `File impor ${bytes} byte melebihi batas ${MAX_IMPORT_BYTES} byte.`,
    );
  }
  if (!text.trim()) {
    return error('EMPTY_FILE', 'File impor kosong.');
  }

  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    return error('INVALID_JSON', 'File impor bukan JSON yang valid.');
  }
  if (!isPlainObject(payload)) {
    return error('INVALID_PAYLOAD', 'Isi impor harus berupa objek JSON.');
  }
  if (payload.schemaVersion !== EXPORT_SCHEMA_VERSION) {
    return error(
      'UNSUPPORTED_VERSION',
      `Versi skema impor harus ${EXPORT_SCHEMA_VERSION}.`,
    );
  }
  const unknownRoot = Object.keys(payload).filter((key) => !IMPORT_ROOT_FIELDS.has(key));
  if (unknownRoot.length) {
    return error(
      'UNKNOWN_FIELD',
      `Field impor tidak dikenal: ${unknownRoot.join(', ')}.`,
    );
  }
  if (payload.app !== undefined && payload.app !== 'flowboard') {
    return error('UNKNOWN_APP', 'File impor bukan ekspor Flowboard.');
  }

  let board;
  try {
    board = canonicalizeBoard(payload.board);
  } catch (validationError) {
    const details = Array.isArray(validationError.errors)
      ? validationError.errors.slice(0, 5).join(' ')
      : validationError.message;
    return error('INVALID_BOARD', `Struktur papan tidak valid. ${details}`);
  }

  return {
    ok: true,
    board,
    meta: {
      exportedAt: typeof payload.exportedAt === 'string' ? payload.exportedAt : null,
      taskCount: Object.values(board.columns)
        .reduce((total, column) => total + column.length, 0),
      bytes,
    },
  };
}
