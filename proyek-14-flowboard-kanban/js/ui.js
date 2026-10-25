import {
  PRIORITY_LABELS,
  STATUSES,
  STATUS_LABELS,
  isOverdue,
} from './task-model.js';

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

const dateTimeFormatter = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

let toastTimer = null;
let errorTimer = null;

const FIELD_IDS = Object.freeze({
  title: 'task-title',
  description: 'task-description',
  tags: 'task-tags',
  priority: 'task-priority',
  status: 'task-status',
  dueDate: 'task-due-date',
});

function element(tagName, className, text) {
  const node = document.createElement(tagName);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function formatDateOnly(value) {
  if (!value) return 'Tanpa tenggat';
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? value : dateFormatter.format(parsed);
}

export function formatDateTime(value) {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : dateTimeFormatter.format(parsed);
}

function statusSelect(task) {
  const wrapper = element('div', 'status-control');
  const label = element('label', 'sr-only', `Pindah status untuk ${task.title}`);
  const id = `task-status-${task.id}`;
  label.htmlFor = id;
  const select = document.createElement('select');
  select.id = id;
  select.dataset.action = 'move';
  select.setAttribute('aria-label', `Pindah status untuk ${task.title}`);
  for (const status of STATUSES) {
    const option = document.createElement('option');
    option.value = status.id;
    option.textContent = status.label;
    option.selected = status.id === task.status;
    select.append(option);
  }
  select.value = task.status;
  wrapper.append(label, select);
  return wrapper;
}

function createTaskCard(task, options) {
  const { today, filtersActive } = options;
  const card = element('li', 'task-card');
  card.dataset.taskId = task.id;
  card.draggable = !filtersActive;
  card.setAttribute('aria-label', `${task.title}, prioritas ${PRIORITY_LABELS[task.priority]}, status ${STATUS_LABELS[task.status]}`);

  const header = element('div', 'task-card-header');
  const priority = element('span', `priority-badge priority-${task.priority}`, PRIORITY_LABELS[task.priority]);
  const dragHandle = element('span', 'drag-handle', '⋮⋮');
  dragHandle.setAttribute('aria-hidden', 'true');
  dragHandle.title = filtersActive ? 'Drag nonaktif saat filter aktif' : 'Seret untuk memindahkan';
  header.append(priority, dragHandle);

  const title = element('h3', 'task-title', task.title);

  const summary = task.description
    ? element('p', 'task-summary', task.description)
    : null;

  const meta = element('div', 'task-meta');
  if (task.dueDate) {
    const dueWrap = element('span', 'due-wrap');
    const due = document.createElement('time');
    due.dateTime = task.dueDate;
    due.className = 'due-date';
    due.textContent = `Tenggat ${formatDateOnly(task.dueDate)}`;
    dueWrap.append(due);
    if (isOverdue(task, today)) {
      dueWrap.append(element('span', 'overdue-badge', 'Terlambat'));
    }
    meta.append(dueWrap);
  } else {
    meta.append(element('span', 'due-date due-empty', 'Tanpa tenggat'));
  }

  if (task.tags.length) {
    const tags = element('ul', 'tag-list');
    for (const tag of task.tags) {
      tags.append(element('li', 'tag', tag));
    }
    meta.append(tags);
  }

  const actions = element('div', 'task-actions');
  const detailButton = element('button', 'text-button', 'Detail');
  detailButton.type = 'button';
  detailButton.dataset.action = 'detail';
  const editButton = element('button', 'text-button', 'Edit');
  editButton.type = 'button';
  editButton.dataset.action = 'edit';
  const deleteButton = element('button', 'text-button text-button-danger', 'Hapus');
  deleteButton.type = 'button';
  deleteButton.dataset.action = 'delete';
  actions.append(detailButton, editButton, deleteButton);

  card.append(header, title);
  if (summary) card.append(summary);
  card.append(meta, statusSelect(task), actions);
  return card;
}

export function renderBoard(view, options) {
  const { board, filtersActive, today } = options;
  for (const status of STATUSES) {
    const list = document.getElementById(`list-${status.id}`);
    const count = document.getElementById(`count-${status.id}`);
    const visible = view.columns[status.id];
    const total = board.columns[status.id].length;
    list.replaceChildren();

    count.textContent = filtersActive ? `${visible.length}/${total}` : String(total);
    count.setAttribute(
      'aria-label',
      filtersActive
        ? `${visible.length} dari ${total} tugas terlihat`
        : `${total} tugas`,
    );

    if (!visible.length) {
      const empty = element('li', 'empty-state');
      empty.append(
        element('strong', '', filtersActive && total ? 'Tidak ada hasil' : 'Belum ada tugas'),
        element(
          'span',
          '',
          filtersActive && total
            ? 'Tidak ada tugas di kolom ini yang cocok dengan filter.'
            : 'Tambahkan tugas untuk memulai alur kerja.',
        ),
      );
      list.append(empty);
      continue;
    }

    for (const task of visible) {
      list.append(createTaskCard(task, { today, filtersActive }));
    }
  }
}

export function updateBoardStats(counts) {
  document.getElementById('total-count').textContent = String(counts.total);
  document.getElementById('overdue-count').textContent = String(counts.overdue);
}

export function updateFilterUi(view) {
  document.getElementById('results-count').textContent = view.active
    ? `Menampilkan ${view.visibleCount} dari ${view.totalCount} tugas.`
    : `${view.totalCount} tugas di papan.`;
  document.getElementById('filter-notice').hidden = !view.active;
  document.getElementById('reset-filters').disabled = !view.active;
}

export function updateHistoryUi(history) {
  const undoButton = document.getElementById('undo-button');
  const redoButton = document.getElementById('redo-button');
  undoButton.disabled = !history.canUndo;
  redoButton.disabled = !history.canRedo;

  const parts = [];
  if (history.undoCount) parts.push(`${history.undoCount} undo`);
  if (history.redoCount) parts.push(`${history.redoCount} redo`);
  document.getElementById('history-status').textContent = parts.length
    ? `Riwayat ${history.size}/${history.limit} · ${parts.join(' · ')}`
    : 'Riwayat kosong';
}

export function setStorageStatus(state, text) {
  const chip = document.getElementById('storage-status');
  chip.dataset.state = state;
  chip.textContent = text;
}

export function showToast(message) {
  const toast = document.getElementById('toast');
  const errorToast = document.getElementById('error-toast');
  if (errorToast) errorToast.hidden = true;
  if (errorTimer) clearTimeout(errorTimer);
  toast.textContent = message;
  toast.hidden = false;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 3800);
}

export function showErrorToast(message) {
  const toast = document.getElementById('error-toast');
  const successToast = document.getElementById('toast');
  if (successToast) successToast.hidden = true;
  if (toastTimer) clearTimeout(toastTimer);
  toast.textContent = message;
  toast.hidden = false;
  if (errorTimer) clearTimeout(errorTimer);
  errorTimer = setTimeout(() => {
    toast.hidden = true;
  }, 7000);
}

export function announce(message) {
  const region = document.getElementById('live-region');
  region.textContent = '';
  requestAnimationFrame(() => {
    region.textContent = message;
  });
}

function dialogIsOpen() {
  return Boolean(document.querySelector('dialog[open]'));
}

function findTaskCard(taskId) {
  return Array.from(document.querySelectorAll('.task-card'))
    .find((card) => card.dataset.taskId === taskId) ?? null;
}

export function getFocusedTaskControl() {
  const active = document.activeElement;
  const card = active?.closest?.('.task-card');
  if (!card) return null;
  const taskId = card.dataset.taskId;
  if (active.matches('select[data-action="move"]')) {
    return { taskId, control: 'status' };
  }
  const action = active.closest('[data-action]')?.dataset.action;
  return {
    taskId,
    control: ['detail', 'edit', 'delete'].includes(action) ? action : 'edit',
  };
}

export function focusTaskControl(taskId, control = 'edit') {
  if (dialogIsOpen()) return false;
  const card = findTaskCard(taskId);
  if (!card) return false;
  const target = control === 'status'
    ? card.querySelector('select[data-action="move"]')
    : card.querySelector(`button[data-action="${control}"]`)
      ?? card.querySelector('button[data-action="edit"]');
  if (!target) return false;
  target.focus();
  return document.activeElement === target;
}

export function focusFallback() {
  if (dialogIsOpen()) return false;
  const reset = document.getElementById('reset-filters');
  if (reset && !reset.disabled) {
    reset.focus();
    return document.activeElement === reset;
  }
  const search = document.getElementById('search-input');
  if (search) {
    search.focus();
    return document.activeElement === search;
  }
  return false;
}

export function openDialog(dialog) {
  if (!dialog.open) dialog.showModal();
}

export function closeDialog(dialog) {
  if (dialog.open) dialog.close();
}

export function clearFormErrors() {
  const titleError = document.getElementById('title-error');
  const formError = document.getElementById('task-form-error');
  titleError.textContent = '';
  formError.textContent = '';
  formError.hidden = true;
  for (const id of Object.values(FIELD_IDS)) {
    document.getElementById(id)?.removeAttribute('aria-invalid');
  }
}

export function showFormError(message, field) {
  clearFormErrors();
  const formError = document.getElementById('task-form-error');
  formError.textContent = message;
  formError.hidden = false;
  const fieldId = FIELD_IDS[field];
  const control = fieldId ? document.getElementById(fieldId) : null;
  if (control) {
    control.setAttribute('aria-invalid', 'true');
    control.focus();
  }
  if (field === 'title') {
    document.getElementById('title-error').textContent = message;
  }
}

export function prepareTaskForm(task, defaultStatus = 'todo') {
  clearFormErrors();
  const dialog = document.getElementById('task-dialog');
  document.getElementById('task-dialog-title').textContent = task ? 'Edit tugas' : 'Tambah tugas';
  document.getElementById('task-id').value = task?.id ?? '';
  document.getElementById('task-title').value = task?.title ?? '';
  document.getElementById('task-description').value = task?.description ?? '';
  document.getElementById('task-tags').value = task?.tags?.join(', ') ?? '';
  document.getElementById('task-priority').value = task?.priority ?? 'medium';
  document.getElementById('task-status').value = task?.status ?? defaultStatus;
  document.getElementById('task-due-date').value = task?.dueDate ?? '';
  openDialog(dialog);
  requestAnimationFrame(() => document.getElementById('task-title').focus());
}

export function readTaskForm() {
  return {
    id: document.getElementById('task-id').value,
    title: document.getElementById('task-title').value,
    description: document.getElementById('task-description').value,
    tags: document.getElementById('task-tags').value.split(','),
    priority: document.getElementById('task-priority').value,
    status: document.getElementById('task-status').value,
    dueDate: document.getElementById('task-due-date').value,
  };
}

export function showTaskDetail(task) {
  document.getElementById('detail-title').textContent = task.title;
  document.getElementById('detail-description').textContent = task.description || 'Tidak ada deskripsi.';
  document.getElementById('detail-status').textContent = STATUS_LABELS[task.status];
  document.getElementById('detail-priority').textContent = PRIORITY_LABELS[task.priority];
  document.getElementById('detail-due').textContent = formatDateOnly(task.dueDate);
  document.getElementById('detail-tags').textContent = task.tags.length ? task.tags.join(', ') : 'Tidak ada tag';
  document.getElementById('detail-created').textContent = formatDateTime(task.createdAt);
  document.getElementById('detail-updated').textContent = formatDateTime(task.updatedAt);
  document.getElementById('detail-dialog').dataset.taskId = task.id;
  openDialog(document.getElementById('detail-dialog'));
}

export function showDeleteConfirmation(task) {
  document.getElementById('delete-task-title').textContent = task.title;
  document.getElementById('delete-dialog').dataset.taskId = task.id;
  openDialog(document.getElementById('delete-dialog'));
}

export function showImportConfirmation(fileName, meta, storageBlocked) {
  document.getElementById('import-filename').textContent = fileName;
  document.getElementById('import-task-count').textContent = String(meta.taskCount);
  const note = document.getElementById('import-note');
  note.textContent = storageBlocked
    ? 'Penyimpanan lokal sedang diblokir. Impor hanya akan berlaku di memori dan tidak akan menimpa data lama di storage.'
    : 'Data lama akan diganti setelah Anda mengonfirmasi.';
  document.getElementById('import-dialog').dataset.fileName = fileName;
  openDialog(document.getElementById('import-dialog'));
}
