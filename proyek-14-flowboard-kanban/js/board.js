import {
  LIMITS,
  STATUS_IDS,
  ValidationError,
  canonicalizeTask,
  isOverdue,
  updateTask,
} from './task-model.js';

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function cloneTask(task) {
  return { ...task, tags: [...task.tags] };
}

export function createEmptyBoard() {
  return {
    columns: {
      todo: [],
      'in-progress': [],
      review: [],
      done: [],
    },
  };
}

export function cloneBoard(board) {
  const columns = {};
  for (const status of STATUS_IDS) {
    columns[status] = (board.columns?.[status] ?? []).map(cloneTask);
  }
  return { columns };
}

export function allTasks(board) {
  return STATUS_IDS.flatMap((status) => board.columns?.[status] ?? []);
}

export function countTasks(board) {
  return allTasks(board).length;
}

export class BoardValidationError extends Error {
  constructor(errors) {
    super(`Papan tidak valid: ${errors[0]}`);
    this.name = 'BoardValidationError';
    this.errors = errors;
  }
}

export function canonicalizeBoard(board) {
  const errors = [];
  if (!isPlainObject(board)) {
    throw new BoardValidationError(['Papan harus berupa objek.']);
  }

  const unknownBoardFields = Object.keys(board).filter((key) => key !== 'columns');
  if (unknownBoardFields.length) {
    errors.push(`Field papan tidak dikenal: ${unknownBoardFields.join(', ')}.`);
  }
  if (!isPlainObject(board.columns)) {
    throw new BoardValidationError([...errors, 'Kolom papan harus berupa objek.']);
  }

  const keys = Object.keys(board.columns);
  const missing = STATUS_IDS.filter((status) => !keys.includes(status));
  const extra = keys.filter((status) => !STATUS_IDS.includes(status));
  if (missing.length) errors.push(`Kolom hilang: ${missing.join(', ')}.`);
  if (extra.length) errors.push(`Kolom tidak dikenal: ${extra.join(', ')}.`);

  const canonical = createEmptyBoard();
  let total = 0;
  const seenIds = new Set();
  for (const status of STATUS_IDS) {
    const column = board.columns[status];
    if (!Array.isArray(column)) {
      if (!missing.includes(status)) errors.push(`Kolom ${status} harus berupa larik.`);
      continue;
    }
    total += column.length;
    column.forEach((task, index) => {
      const label = `${status}[${index}]`;
      let canonicalTask;
      try {
        canonicalTask = canonicalizeTask(task);
      } catch (error) {
        if (error instanceof ValidationError) {
          errors.push(`${label}: ${error.message}`);
          return;
        }
        throw error;
      }
      if (canonicalTask.status !== status) {
        errors.push(`${label}: status tugas harus sama dengan kolomnya.`);
      }
      if (seenIds.has(canonicalTask.id)) {
        errors.push(`ID tugas duplikat: ${canonicalTask.id}.`);
      } else {
        seenIds.add(canonicalTask.id);
        canonical.columns[status].push(canonicalTask);
      }
    });
  }

  if (total > LIMITS.MAX_TASKS) {
    errors.push(`Jumlah tugas melebihi batas ${LIMITS.MAX_TASKS}.`);
  }
  if (errors.length) throw new BoardValidationError(errors);
  return canonical;
}

export function validateBoard(board) {
  try {
    canonicalizeBoard(board);
    return { ok: true, errors: [] };
  } catch (error) {
    if (error instanceof BoardValidationError) {
      return { ok: false, errors: error.errors };
    }
    throw error;
  }
}

export function assertValidBoard(board) {
  return canonicalizeBoard(board);
}

export function boardFromTasks(tasks) {
  if (!Array.isArray(tasks)) throw new Error('Daftar tugas harus berupa larik.');
  if (tasks.length > LIMITS.MAX_TASKS) {
    throw new Error(`Jumlah tugas melebihi batas ${LIMITS.MAX_TASKS}.`);
  }
  const board = createEmptyBoard();
  const ids = new Set();
  for (const task of tasks) {
    const canonicalTask = canonicalizeTask(task);
    if (ids.has(canonicalTask.id)) throw new Error(`ID tugas duplikat: ${canonicalTask.id}.`);
    ids.add(canonicalTask.id);
    board.columns[canonicalTask.status].push(canonicalTask);
  }
  return canonicalizeBoard(board);
}

export function findTask(board, taskId) {
  for (const status of STATUS_IDS) {
    const index = board.columns[status].findIndex((task) => task.id === taskId);
    if (index !== -1) {
      return { task: board.columns[status][index], status, index };
    }
  }
  return null;
}

export function getTask(board, taskId) {
  return findTask(board, taskId)?.task ?? null;
}

export function addTask(board, task, options = {}) {
  const current = canonicalizeBoard(board);
  const canonicalTask = canonicalizeTask(task);
  if (findTask(current, canonicalTask.id)) {
    throw new Error(`ID tugas sudah digunakan: ${canonicalTask.id}.`);
  }
  if (countTasks(current) >= LIMITS.MAX_TASKS) {
    throw new Error(`Jumlah tugas sudah mencapai batas ${LIMITS.MAX_TASKS}.`);
  }
  const next = cloneBoard(current);
  if (options.position === 'end') next.columns[canonicalTask.status].push(canonicalTask);
  else next.columns[canonicalTask.status].unshift(canonicalTask);
  return canonicalizeBoard(next);
}

export function updateTaskInBoard(board, taskId, patch, options = {}) {
  const current = canonicalizeBoard(board);
  const found = findTask(current, taskId);
  if (!found) throw new Error('Tugas tidak ditemukan.');
  const updated = updateTask(found.task, patch, options);
  const next = cloneBoard(current);
  next.columns[found.status].splice(found.index, 1);
  if (updated.status === found.status) {
    next.columns[found.status].splice(found.index, 0, updated);
  } else {
    next.columns[updated.status].unshift(updated);
  }
  return canonicalizeBoard(next);
}

export function deleteTaskFromBoard(board, taskId) {
  const current = canonicalizeBoard(board);
  const found = findTask(current, taskId);
  if (!found) throw new Error('Tugas tidak ditemukan.');
  const next = cloneBoard(current);
  next.columns[found.status].splice(found.index, 1);
  return canonicalizeBoard(next);
}

export function moveTask(board, taskId, toStatus, toIndex = 0) {
  const current = canonicalizeBoard(board);
  if (!STATUS_IDS.includes(toStatus)) throw new Error('Status tujuan tidak valid.');
  const found = findTask(current, taskId);
  if (!found) throw new Error('Tugas tidak ditemukan.');
  const next = cloneBoard(current);
  const [task] = next.columns[found.status].splice(found.index, 1);
  task.status = toStatus;
  const target = next.columns[toStatus];
  const requestedIndex = Number.isInteger(toIndex) ? toIndex : 0;
  const index = Math.max(0, Math.min(requestedIndex, target.length));
  target.splice(index, 0, task);
  return canonicalizeBoard(next);
}

export function filterBoard(board, filters = {}, options = {}) {
  const current = canonicalizeBoard(board);
  const query = String(filters.query ?? '').trim().toLocaleLowerCase('id-ID');
  const priority = filters.priority ?? 'all';
  const due = filters.due ?? 'all';
  const active = Boolean(query) || priority !== 'all' || due !== 'all';
  const today = options.today ?? new Date();

  const columns = {};
  let visibleCount = 0;
  for (const status of STATUS_IDS) {
    columns[status] = current.columns[status].filter((task) => {
      if (query) {
        const haystack = [
          task.title,
          task.description,
          ...task.tags,
        ].join('\n').toLocaleLowerCase('id-ID');
        if (!haystack.includes(query)) return false;
      }
      if (priority !== 'all' && task.priority !== priority) return false;
      if (due === 'overdue' && !isOverdue(task, today)) return false;
      if (due === 'none' && task.dueDate) return false;
      return true;
    });
    visibleCount += columns[status].length;
  }

  return {
    columns,
    active,
    totalCount: countTasks(current),
    visibleCount,
    filters: { query, priority, due },
  };
}

export function getBoardCounts(board, today = new Date()) {
  const tasks = allTasks(board);
  return {
    total: tasks.length,
    overdue: tasks.filter((task) => isOverdue(task, today)).length,
    byStatus: Object.fromEntries(
      STATUS_IDS.map((status) => [status, board.columns[status].length]),
    ),
  };
}
