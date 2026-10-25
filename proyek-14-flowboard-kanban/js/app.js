import {
  addTask,
  createEmptyBoard,
  deleteTaskFromBoard,
  filterBoard,
  findTask,
  getBoardCounts,
  getTask,
  moveTask,
  updateTaskInBoard,
} from './board.js';
import { History } from './history.js';
import {
  MAX_IMPORT_BYTES,
  createExportFilename,
  exportBoardJson,
  parseImportJson,
} from './import-export.js';
import { loadBoard, saveBoard } from './storage.js';
import {
  LIMITS,
  STATUS_LABELS,
  ValidationError,
  createTask,
} from './task-model.js';
import {
  announce,
  closeDialog,
  focusFallback,
  focusTaskControl,
  getFocusedTaskControl,
  prepareTaskForm,
  readTaskForm,
  renderBoard,
  setStorageStatus,
  showDeleteConfirmation,
  showErrorToast,
  showFormError,
  showImportConfirmation,
  showTaskDetail,
  showToast,
  updateBoardStats,
  updateFilterUi,
  updateHistoryUi,
} from './ui.js';

const filters = {
  query: '',
  priority: 'all',
  due: 'all',
};

let board = createEmptyBoard();
let history = null;
let storage = null;
let storageBlocked = false;
let pendingImport = null;
let dragState = null;
let lastDeletedTaskId = null;

const timeFormatter = new Intl.DateTimeFormat('id-ID', {
  hour: '2-digit',
  minute: '2-digit',
});

function getStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const random = globalThis.crypto?.getRandomValues
    ? Array.from(globalThis.crypto.getRandomValues(new Uint8Array(8)), (byte) => byte.toString(16).padStart(2, '0')).join('')
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `task-${random}`;
}

function render() {
  const today = new Date();
  const view = filterBoard(board, filters, { today });
  renderBoard(view, {
    board,
    filtersActive: view.active,
    today,
  });
  updateBoardStats(getBoardCounts(board, today));
  updateFilterUi(view);
  updateHistoryUi(history);
}

function persistBoard() {
  if (storageBlocked) {
    setStorageStatus('error', 'Tidak tersimpan · perubahan hanya di memori');
    return {
      ok: false,
      message: 'Penyimpanan sedang diblokir; data lama tidak ditimpa.',
    };
  }

  const result = saveBoard(storage, board);
  if (!result.ok) {
    storageBlocked = true;
    setStorageStatus('error', 'Gagal menyimpan · perubahan hanya di memori');
    return {
      ok: false,
      message: `${result.message} Ekspor JSON untuk menjaga cadangan.`,
    };
  }

  setStorageStatus('saved', `Tersimpan ${timeFormatter.format(new Date())}`);
  return { ok: true, message: '' };
}

function commit(nextBoard, label, options = {}) {
  const recorded = history.record(nextBoard, label);
  if (!recorded) {
    showToast('Tidak ada perubahan yang perlu disimpan.');
    return { applied: false, recorded: false, saved: false };
  }

  board = nextBoard;
  render();
  const persistence = persistBoard();
  const successMessage = options.successMessage ?? `${label} · tersimpan.`;
  const failureBase = options.failureMessage
    ?? `${label} diterapkan di memori, tetapi belum tersimpan.`;
  const failureMessage = `${failureBase} ${persistence.message}`.trim();

  if (persistence.ok) {
    showToast(successMessage);
    announce(options.successAnnounce ?? successMessage);
  } else {
    showErrorToast(failureMessage);
    announce(options.failureAnnounce ?? failureMessage);
  }

  return {
    applied: true,
    recorded: true,
    saved: persistence.ok,
    message: persistence.ok ? successMessage : failureMessage,
  };
}

function focusHistoryFallback() {
  if (getBoardCounts(board).total === 0) {
    document.getElementById('new-task-button').focus();
    return;
  }
  const undoButton = document.getElementById('undo-button');
  if (!undoButton.disabled) {
    undoButton.focus();
    return;
  }
  const redoButton = document.getElementById('redo-button');
  if (!redoButton.disabled) redoButton.focus();
}

function restoreFocusAfterHistory(priorFocus, previousDeleted) {
  const candidates = [];
  if (priorFocus) candidates.push(priorFocus);
  if (previousDeleted) candidates.push({ taskId: previousDeleted, control: 'edit' });
  for (const candidate of candidates) {
    if (!getTask(board, candidate.taskId)) continue;
    if (focusTaskControl(candidate.taskId, candidate.control)) {
      lastDeletedTaskId = null;
      return;
    }
  }
  if (candidates.some((candidate) => getTask(board, candidate.taskId))) {
    focusFallback();
  } else if (priorFocus) {
    focusHistoryFallback();
  }
}

function undo() {
  const priorFocus = getFocusedTaskControl();
  const previousDeleted = lastDeletedTaskId;
  const result = history.undo();
  if (!result) return;
  board = result.state;
  render();

  const persistence = persistBoard();
  const successMessage = `Undo: ${result.label}.`;
  const failureMessage = `Undo diterapkan di memori, tetapi belum tersimpan. ${persistence.message}`.trim();
  if (persistence.ok) {
    showToast(successMessage);
    announce(`Undo diterapkan untuk ${result.label}.`);
  } else {
    showErrorToast(failureMessage);
    announce(failureMessage);
  }
  restoreFocusAfterHistory(priorFocus, previousDeleted);
}

function redo() {
  const priorFocus = getFocusedTaskControl();
  const result = history.redo();
  if (!result) return;
  board = result.state;
  render();

  const persistence = persistBoard();
  const successMessage = `Redo: ${result.label}.`;
  const failureMessage = `Redo diterapkan di memori, tetapi belum tersimpan. ${persistence.message}`.trim();
  if (persistence.ok) {
    showToast(successMessage);
    announce(`Redo diterapkan untuk ${result.label}.`);
  } else {
    showErrorToast(failureMessage);
    announce(failureMessage);
  }
  restoreFocusAfterHistory(priorFocus, null);
}

function resetFilters() {
  filters.query = '';
  filters.priority = 'all';
  filters.due = 'all';
  document.getElementById('search-input').value = '';
  document.getElementById('priority-filter').value = 'all';
  document.getElementById('due-filter').value = 'all';
  render();
}

function updateFiltersFromControls() {
  filters.query = document.getElementById('search-input').value;
  filters.priority = document.getElementById('priority-filter').value;
  filters.due = document.getElementById('due-filter').value;
  render();
}

function handleTaskSubmit(event) {
  event.preventDefault();
  const values = readTaskForm();
  const dialog = document.getElementById('task-dialog');
  try {
    if (values.id) {
      const existing = getTask(board, values.id);
      if (!existing) throw new Error('Tugas yang akan diedit tidak ditemukan.');
      const next = updateTaskInBoard(board, values.id, values);
      const result = commit(next, 'Edit tugas');
      if (result.applied) {
        closeDialog(dialog);
        if (!focusTaskControl(values.id, 'edit')) focusFallback();
      }
    } else {
      const task = createTask(
        { ...values, id: undefined },
        { idFactory: createId },
      );
      const next = addTask(board, task);
      const result = commit(next, 'Tambah tugas');
      if (result.applied) closeDialog(dialog);
    }
  } catch (error) {
    if (error instanceof ValidationError) showFormError(error.message, error.field);
    else showFormError(error.message || 'Tugas gagal disimpan.');
  }
}

function handleConfirmDelete() {
  const dialog = document.getElementById('delete-dialog');
  const taskId = dialog.dataset.taskId;
  const task = getTask(board, taskId);
  if (!task) {
    closeDialog(dialog);
    showErrorToast('Tugas tidak ditemukan.');
    return;
  }
  const found = findTask(board, taskId);
  const columnTasks = found ? board.columns[found.status] : [];
  const neighborId = found
    ? (columnTasks[found.index + 1]?.id ?? columnTasks[found.index - 1]?.id ?? null)
    : null;
  try {
    const next = deleteTaskFromBoard(board, taskId);
    const result = commit(next, 'Hapus tugas');
    if (!result.applied) return;
    closeDialog(dialog);
    lastDeletedTaskId = taskId;
    if (neighborId && focusTaskControl(neighborId, 'edit')) return;
    if (getBoardCounts(board).total === 0) {
      document.getElementById('new-task-button').focus();
    } else {
      document.getElementById('undo-button').focus();
    }
  } catch (error) {
    closeDialog(dialog);
    showErrorToast(error.message);
  }
}

async function handleImportFile(event) {
  const input = event.currentTarget;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;

  if (file.size > MAX_IMPORT_BYTES) {
    showErrorToast(`File ${file.size} byte melebihi batas ${MAX_IMPORT_BYTES} byte.`);
    announce('Impor dibatalkan karena ukuran file terlalu besar.');
    return;
  }

  let text;
  try {
    text = await file.text();
  } catch {
    showErrorToast('File tidak dapat dibaca.');
    return;
  }

  const parsed = parseImportJson(text);
  if (!parsed.ok) {
    showErrorToast(parsed.message);
    announce('Impor dibatalkan karena file tidak valid.');
    return;
  }

  pendingImport = { fileName: file.name, board: parsed.board, meta: parsed.meta };
  showImportConfirmation(file.name, parsed.meta, storageBlocked);
}

function handleConfirmImport() {
  if (!pendingImport) {
    closeDialog(document.getElementById('import-dialog'));
    return;
  }
  const next = pendingImport.board;
  const fileName = pendingImport.fileName;
  pendingImport = null;
  lastDeletedTaskId = null;
  closeDialog(document.getElementById('import-dialog'));
  resetFilters();
  commit(next, 'Impor papan', {
    successMessage: `Papan dari ${fileName} berhasil diimpor.`,
    failureMessage: `Papan dari ${fileName} diimpor ke memori, tetapi belum tersimpan.`,
  });
}

function handleExport() {
  try {
    const text = exportBoardJson(board);
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = createExportFilename();
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    showToast('Ekspor JSON dimulai. File dibuat di browser.');
    announce('Ekspor JSON dimulai.');
  } catch (error) {
    showErrorToast(`Ekspor gagal: ${error.message}`);
  }
}

function handleBoardClick(event) {
  const action = event.target.closest('[data-action]');
  if (!action) return;
  const type = action.dataset.action;

  if (type === 'add') {
    prepareTaskForm(null, action.dataset.status);
    return;
  }

  const card = action.closest('.task-card');
  const taskId = card?.dataset.taskId;
  const task = taskId ? getTask(board, taskId) : null;
  if (!task) {
    showErrorToast('Tugas tidak ditemukan.');
    return;
  }

  if (type === 'detail') {
    showTaskDetail(task);
  } else if (type === 'edit') {
    prepareTaskForm(task);
  } else if (type === 'delete') {
    showDeleteConfirmation(task);
  }
}

function handleStatusChange(event) {
  const select = event.target.closest('select[data-action="move"]');
  if (!select) return;
  const card = select.closest('.task-card');
  const task = card ? getTask(board, card.dataset.taskId) : null;
  if (!task || task.status === select.value) return;

  try {
    const next = moveTask(board, task.id, select.value, 0);
    const result = commit(next, `Pindah ke ${STATUS_LABELS[select.value]}`);
    if (result.applied && !focusTaskControl(task.id, 'status')) focusFallback();
  } catch (error) {
    showErrorToast(error.message);
    render();
  }
}

function clearDropIndicators() {
  document.querySelectorAll('.board-column.is-drop-target').forEach((column) => {
    column.classList.remove('is-drop-target');
  });
  document.querySelectorAll('.drop-marker').forEach((marker) => marker.remove());
}

function finishDrag() {
  clearDropIndicators();
  document.querySelectorAll('.task-card.is-dragging').forEach((card) => {
    card.classList.remove('is-dragging');
  });
  dragState = null;
}

function handleDragStart(event) {
  if (filterBoard(board, filters).active) {
    event.preventDefault();
    return;
  }
  const card = event.target.closest('.task-card');
  if (!card) return;
  dragState = {
    taskId: card.dataset.taskId,
    targetStatus: null,
    targetIndex: null,
  };
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', card.dataset.taskId);
  card.classList.add('is-dragging');
}

function handleDragOver(event) {
  if (!dragState) return;
  const column = event.target.closest('.board-column');
  if (!column) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';

  const list = column.querySelector('.task-list');
  const cards = Array.from(list.querySelectorAll('.task-card:not(.is-dragging)'));
  const after = cards.find((card) => {
    const rect = card.getBoundingClientRect();
    return event.clientY < rect.top + rect.height / 2;
  }) ?? null;

  clearDropIndicators();
  column.classList.add('is-drop-target');
  const marker = document.createElement('li');
  marker.className = 'drop-marker';
  marker.setAttribute('aria-hidden', 'true');
  if (after) list.insertBefore(marker, after);
  else list.append(marker);

  dragState.targetStatus = column.dataset.status;
  dragState.targetIndex = after ? cards.indexOf(after) : cards.length;
}

function handleDrop(event) {
  if (!dragState) return;
  event.preventDefault();
  const { taskId, targetStatus, targetIndex } = dragState;
  finishDrag();
  if (!targetStatus || targetIndex === null) return;
  try {
    const next = moveTask(board, taskId, targetStatus, targetIndex);
    commit(next, 'Pindah atau urutkan tugas');
  } catch (error) {
    showErrorToast(error.message);
  }
}

function handleKeyboardShortcut(event) {
  if (!(event.ctrlKey || event.metaKey)) return;
  const editable = event.target.closest('input, textarea, select, [contenteditable="true"]');
  if (editable) return;
  if (document.querySelector('dialog[open]')) return;

  const key = event.key.toLowerCase();
  if (key === 'z') {
    event.preventDefault();
    if (event.shiftKey) redo();
    else undo();
  } else if (key === 'y') {
    event.preventDefault();
    redo();
  }
}

function bindEvents() {
  document.getElementById('new-task-button').addEventListener('click', () => {
    prepareTaskForm(null, 'todo');
  });
  document.getElementById('undo-button').addEventListener('click', undo);
  document.getElementById('redo-button').addEventListener('click', redo);
  document.getElementById('reset-filters').addEventListener('click', resetFilters);
  document.getElementById('search-input').addEventListener('input', updateFiltersFromControls);
  document.getElementById('priority-filter').addEventListener('change', updateFiltersFromControls);
  document.getElementById('due-filter').addEventListener('change', updateFiltersFromControls);
  document.getElementById('export-button').addEventListener('click', handleExport);
  document.getElementById('import-button').addEventListener('click', () => {
    document.getElementById('import-input').click();
  });
  document.getElementById('import-input').addEventListener('change', handleImportFile);
  document.getElementById('confirm-import-button').addEventListener('click', handleConfirmImport);
  document.getElementById('confirm-delete-button').addEventListener('click', handleConfirmDelete);
  document.getElementById('edit-from-detail').addEventListener('click', () => {
    const taskId = document.getElementById('detail-dialog').dataset.taskId;
    const task = getTask(board, taskId);
    closeDialog(document.getElementById('detail-dialog'));
    if (task) prepareTaskForm(task);
    else showErrorToast('Tugas tidak ditemukan.');
  });

  document.getElementById('task-form').addEventListener('submit', handleTaskSubmit);
  const handleTaskFieldEdit = (event) => {
    const formError = document.getElementById('task-form-error');
    formError.textContent = '';
    formError.hidden = true;
    event.target.removeAttribute('aria-invalid');
    if (event.target.id === 'task-title') {
      document.getElementById('title-error').textContent = '';
    }
  };
  document.getElementById('task-form').addEventListener('input', handleTaskFieldEdit);
  document.getElementById('task-form').addEventListener('change', handleTaskFieldEdit);

  document.getElementById('board').addEventListener('click', handleBoardClick);
  document.getElementById('board').addEventListener('change', handleStatusChange);
  document.getElementById('board').addEventListener('dragstart', handleDragStart);
  document.getElementById('board').addEventListener('dragover', handleDragOver);
  document.getElementById('board').addEventListener('drop', handleDrop);
  document.getElementById('board').addEventListener('dragend', finishDrag);
  document.getElementById('board').addEventListener('dragleave', (event) => {
    if (!dragState) return;
    const column = event.target.closest('.board-column');
    if (column && !column.contains(event.relatedTarget)) {
      column.classList.remove('is-drop-target');
    }
  });

  document.addEventListener('click', (event) => {
    const closeButton = event.target.closest('[data-close-dialog]');
    if (!closeButton) return;
    const dialog = document.getElementById(closeButton.dataset.closeDialog);
    if (dialog) closeDialog(dialog);
  });
  document.addEventListener('keydown', handleKeyboardShortcut);
  document.getElementById('import-dialog').addEventListener('close', () => {
    pendingImport = null;
  });
  document.getElementById('delete-dialog').addEventListener('close', () => {
    document.getElementById('delete-dialog').dataset.taskId = '';
  });
}

function initialize() {
  storage = getStorage();
  const result = loadBoard(storage);
  board = result.board;
  storageBlocked = !result.canPersist;
  history = new History(board, { limit: LIMITS.HISTORY_LIMIT });

  bindEvents();
  render();

  if (result.status === 'error' || result.status === 'unavailable') {
    setStorageStatus('error', result.status === 'error'
      ? 'Data lokal tidak dapat dibaca · tidak ditimpa'
      : 'Penyimpanan tidak tersedia · memori saja');
    showErrorToast(result.message);
    announce(result.message);
  } else if (result.status === 'loaded') {
    setStorageStatus('saved', 'Data lokal dimuat');
    announce('Data lokal berhasil dimuat.');
  } else if (result.status === 'empty') {
    setStorageStatus('ready', 'Siap · belum ada data tersimpan');
    announce(result.message);
  } else if (result.status === 'migrated') {
    const saved = saveBoard(storage, board);
    if (saved.ok) {
      setStorageStatus('saved', 'Data lama dimigrasikan');
      announce('Data lokal versi lama berhasil dimigrasikan.');
    } else {
      storageBlocked = true;
      setStorageStatus('error', 'Migrasi gagal disimpan · memori saja');
      showErrorToast(`${saved.message} Data lama tidak ditimpa.`);
      announce('Migrasi berhasil di memori tetapi gagal disimpan.');
    }
  }
}

initialize();
