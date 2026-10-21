const byId = (id) => document.getElementById(id);

export const elements = {
  apiChip: byId("api-chip"),
  apiStatusText: byId("api-status-text"),
  newTaskButton: byId("new-task-button"),
  summaryTotal: byId("summary-total"),
  summaryTodo: byId("summary-todo"),
  summaryProgress: byId("summary-progress"),
  summaryDone: byId("summary-done"),
  workspace: byId("workspace"),
  resultSummary: byId("result-summary"),
  filtersForm: byId("filters-form"),
  searchInput: byId("search-input"),
  statusFilter: byId("status-filter"),
  priorityFilter: byId("priority-filter"),
  sortSelect: byId("sort-select"),
  resetFilters: byId("reset-filters"),
  loadingState: byId("loading-state"),
  errorState: byId("error-state"),
  errorMessage: byId("error-message"),
  retryButton: byId("retry-button"),
  emptyState: byId("empty-state"),
  emptyTitle: byId("empty-title"),
  emptyCopy: byId("empty-copy"),
  emptyAddButton: byId("empty-add-button"),
  emptyResetButton: byId("empty-reset-button"),
  taskList: byId("task-list"),
  pagination: byId("pagination"),
  paginationSummary: byId("pagination-summary"),
  paginationPrev: byId("pagination-prev"),
  paginationNext: byId("pagination-next"),
  pageButtons: byId("page-buttons"),
  taskDialog: byId("task-dialog"),
  taskForm: byId("task-form"),
  taskDialogEyebrow: byId("task-dialog-eyebrow"),
  taskDialogTitle: byId("task-dialog-title"),
  taskTitle: byId("task-title"),
  taskDescription: byId("task-description"),
  taskStatus: byId("task-status"),
  taskPriority: byId("task-priority"),
  taskDueDate: byId("task-due-date"),
  taskSubmit: byId("task-submit"),
  descriptionCount: byId("description-count"),
  taskFormError: byId("task-form-error"),
  deleteDialog: byId("delete-dialog"),
  deleteCopy: byId("delete-copy"),
  deleteError: byId("delete-error"),
  deleteCancel: byId("delete-cancel"),
  deleteConfirm: byId("delete-confirm"),
  toast: byId("toast"),
  toastMessage: byId("toast-message"),
  toastIconUse: byId("toast-icon-use"),
  toastClose: byId("toast-close"),
};

export const STATUS_LABELS = Object.freeze({
  todo: "Belum mulai",
  in_progress: "Dikerjakan",
  done: "Selesai",
});

export const PRIORITY_LABELS = Object.freeze({
  high: "Tinggi",
  medium: "Sedang",
  low: "Rendah",
});

const SHORT_DATE = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const DATE_TIME = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const NUMBER = new Intl.NumberFormat("id-ID");
const SVG_NS = "http://www.w3.org/2000/svg";
const XLINK_NS = "http://www.w3.org/1999/xlink";

let toastTimer = null;

function createIcon(name, className = "icon") {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", className);
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const use = document.createElementNS(SVG_NS, "use");
  use.setAttribute("href", `#icon-${name}`);
  use.setAttributeNS(XLINK_NS, "xlink:href", `#icon-${name}`);
  svg.append(use);
  return svg;
}

function createElement(tag, className = "", text = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function createButton(className, label, iconName, attributes = {}) {
  const button = createElement("button", className);
  button.type = "button";
  for (const [name, value] of Object.entries(attributes)) {
    button.setAttribute(name, value);
  }
  if (iconName) button.append(createIcon(iconName));
  if (label) {
    const span = createElement("span", "", label);
    button.append(span);
  }
  return button;
}

function localDateFromKey(dateKey) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function todayKey() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

export function formatCount(value) {
  return NUMBER.format(Number.isFinite(value) ? value : 0);
}

export function formatDateOnly(dateKey) {
  const date = localDateFromKey(dateKey);
  return date ? SHORT_DATE.format(date) : "";
}

export function formatDateTime(isoTimestamp) {
  const date = new Date(isoTimestamp);
  return Number.isNaN(date.getTime()) ? "" : DATE_TIME.format(date);
}

export function isOverdue(task) {
  return Boolean(
    task.due_date &&
      task.status !== "done" &&
      task.due_date < todayKey(),
  );
}

export function setApiStatus(state, text) {
  elements.apiChip.dataset.state = state;
  elements.apiStatusText.textContent = text;
}

export function renderSummary(summary) {
  elements.summaryTotal.textContent = formatCount(summary.total);
  elements.summaryTodo.textContent = formatCount(summary.todo);
  elements.summaryProgress.textContent = formatCount(summary.in_progress);
  elements.summaryDone.textContent = formatCount(summary.done);
}

export function setSummaryLoading() {
  elements.summaryTotal.textContent = "—";
  elements.summaryTodo.textContent = "—";
  elements.summaryProgress.textContent = "—";
  elements.summaryDone.textContent = "—";
}

export function setResultSummary(text) {
  elements.resultSummary.textContent = text;
}

export function setFiltersActive(active) {
  elements.resetFilters.hidden = !active;
  elements.emptyResetButton.hidden = !active;
}

export function showLoading() {
  elements.loadingState.hidden = false;
  elements.errorState.hidden = true;
  elements.emptyState.hidden = true;
  elements.taskList.hidden = true;
  elements.pagination.hidden = true;
}

export function showError(message) {
  elements.loadingState.hidden = true;
  elements.errorState.hidden = false;
  elements.emptyState.hidden = true;
  elements.taskList.hidden = true;
  elements.pagination.hidden = true;
  elements.errorMessage.textContent = message;
}

export function showEmpty(hasFilters) {
  elements.loadingState.hidden = true;
  elements.errorState.hidden = true;
  elements.emptyState.hidden = false;
  elements.taskList.hidden = true;
  elements.pagination.hidden = true;
  elements.emptyTitle.textContent = hasFilters ? "Tidak ada tugas yang cocok" : "Belum ada tugas";
  elements.emptyCopy.textContent = hasFilters
    ? "Coba kata kunci atau filter lain, atau reset filter untuk melihat semua tugas."
    : "Tambahkan tugas pertama untuk mulai mengatur pekerjaan.";
  elements.emptyAddButton.hidden = false;
  elements.emptyResetButton.hidden = !hasFilters;
}

export function setListBusy(busy) {
  elements.taskList.setAttribute("aria-busy", String(busy));
  elements.taskList.classList.toggle("is-busy", busy);
}

function buildMetaItem(iconName, text, { overdue = false, title = "" } = {}) {
  const item = createElement(
    "span",
    `task-meta-item${overdue ? " is-overdue" : ""}`,
  );
  item.append(createIcon(iconName));
  const copy = createElement("span", "", text);
  item.append(copy);
  if (title) item.title = title;
  return item;
}

function buildTaskCard(task) {
  const card = createElement(
    "article",
    `task-card task-priority-${task.priority}`,
  );
  card.dataset.id = task.id;
  card.setAttribute("role", "listitem");
  card.setAttribute("aria-labelledby", `task-title-${task.id}`);

  const top = createElement("div", "task-card-top");
  const priority = createElement(
    "span",
    `priority-badge priority-${task.priority}`,
    PRIORITY_LABELS[task.priority] || task.priority,
  );
  top.append(priority);

  const actions = createElement("div", "task-actions");
  const edit = createButton("icon-button", "", "edit", {
    "data-action": "edit",
    "data-id": task.id,
    "aria-label": `Edit tugas ${task.title}`,
    title: "Edit tugas",
  });
  const remove = createButton("icon-button delete-button", "", "trash", {
    "data-action": "delete",
    "data-id": task.id,
    "aria-label": `Hapus tugas ${task.title}`,
    title: "Hapus tugas",
  });
  actions.append(edit, remove);
  top.append(actions);
  card.append(top);

  const title = createElement(
    "h3",
    `task-title${task.status === "done" ? " is-done" : ""}`,
    task.title,
  );
  title.id = `task-title-${task.id}`;
  card.append(title);

  const description = createElement(
    "p",
    `task-description${task.description ? "" : " is-empty"}`,
    task.description || "Tidak ada deskripsi.",
  );
  card.append(description);

  const meta = createElement("div", "task-meta");
  const created = formatDateTime(task.created_at);
  if (created) {
    meta.append(buildMetaItem("clock", `Dibuat ${created}`, { title: task.created_at }));
  }
  if (task.due_date) {
    const overdue = isOverdue(task);
    const dueText = `${overdue ? "Lewat tenggat" : "Tenggat"} ${formatDateOnly(task.due_date)}`;
    meta.append(
      buildMetaItem("calendar", dueText, {
        overdue,
        title: `Tenggat ${task.due_date}`,
      }),
    );
  }
  card.append(meta);

  const footer = createElement("div", "task-footer");
  const statusField = createElement("div", "status-field");
  statusField.append(createElement("span", "", "Status"));
  const control = createElement("span", "status-control");
  control.dataset.status = task.status;
  const select = document.createElement("select");
  select.className = "status-select";
  select.dataset.action = "status";
  select.dataset.id = task.id;
  select.dataset.current = task.status;
  select.setAttribute("aria-label", `Ubah status tugas ${task.title}`);
  for (const [value, label] of Object.entries(STATUS_LABELS)) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    option.selected = value === task.status;
    select.append(option);
  }
  control.append(select);
  statusField.append(control);
  footer.append(statusField);

  const idLabel = createElement(
    "span",
    "task-id",
    `#${task.id.slice(0, 8)}`,
  );
  idLabel.title = task.id;
  footer.append(idLabel);
  card.append(footer);

  return card;
}

export function renderTasks(tasks) {
  elements.loadingState.hidden = true;
  elements.errorState.hidden = true;
  elements.emptyState.hidden = true;
  elements.taskList.replaceChildren();
  for (const task of tasks) {
    elements.taskList.append(buildTaskCard(task));
  }
  elements.taskList.hidden = false;
  setListBusy(false);
}

function pageSequence(current, total) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const pages = new Set([1, total, current - 1, current, current + 1]);
  if (current <= 3) {
    pages.add(2);
    pages.add(3);
    pages.add(4);
  }
  if (current >= total - 2) {
    pages.add(total - 1);
    pages.add(total - 2);
    pages.add(total - 3);
  }

  const sorted = [...pages]
    .filter((page) => page >= 1 && page <= total)
    .sort((left, right) => left - right);
  const result = [];
  for (const page of sorted) {
    if (result.length && page - result[result.length - 1] > 1) {
      result.push("ellipsis");
    }
    result.push(page);
  }
  return result;
}

export function renderPagination(pagination, visibleCount) {
  if (!pagination || pagination.total_pages <= 1) {
    elements.pagination.hidden = true;
    return;
  }

  const start = (pagination.page - 1) * pagination.limit + 1;
  const end = Math.min(
    pagination.page * pagination.limit,
    pagination.total,
  );
  elements.paginationSummary.textContent =
    visibleCount === 0
      ? "Tidak ada tugas pada halaman ini."
      : `Menampilkan ${formatCount(start)}–${formatCount(end)} dari ${formatCount(pagination.total)} tugas`;

  elements.pageButtons.replaceChildren();
  for (const entry of pageSequence(pagination.page, pagination.total_pages)) {
    if (entry === "ellipsis") {
      elements.pageButtons.append(createElement("span", "page-ellipsis", "…"));
      continue;
    }
    const pageButton = createButton("page-button", String(entry), "", {
      "data-page": String(entry),
      "aria-label": `Halaman ${entry}`,
    });
    if (entry === pagination.page) {
      pageButton.setAttribute("aria-current", "page");
      pageButton.setAttribute("aria-label", `Halaman ${entry}, halaman aktif`);
    }
    elements.pageButtons.append(pageButton);
  }

  elements.paginationPrev.disabled = pagination.page <= 1;
  elements.paginationNext.disabled = pagination.page >= pagination.total_pages;
  elements.pagination.hidden = false;
}

export function setTaskDialogMode(editing) {
  elements.taskDialogEyebrow.textContent = editing ? "Edit tugas" : "Tugas baru";
  elements.taskDialogTitle.textContent = editing ? "Perbarui tugas" : "Tambah tugas";
  elements.taskSubmit.textContent = editing ? "Simpan perubahan" : "Simpan tugas";
}

export function setDescriptionCount() {
  elements.descriptionCount.textContent = `${elements.taskDescription.value.length}/2000`;
}

export function resetTaskForm() {
  elements.taskForm.reset();
  elements.taskTitle.value = "";
  elements.taskDescription.value = "";
  elements.taskStatus.value = "todo";
  elements.taskPriority.value = "medium";
  elements.taskDueDate.value = "";
  setDescriptionCount();
  clearTaskFormErrors();
  elements.taskSubmit.disabled = false;
  elements.taskSubmit.textContent = "Simpan tugas";
}

export function fillTaskForm(task) {
  elements.taskForm.reset();
  elements.taskTitle.value = task.title;
  elements.taskDescription.value = task.description || "";
  elements.taskStatus.value = task.status;
  elements.taskPriority.value = task.priority;
  elements.taskDueDate.value = task.due_date || "";
  setDescriptionCount();
  clearTaskFormErrors();
  elements.taskSubmit.disabled = false;
  elements.taskSubmit.textContent = "Simpan perubahan";
}

export function clearTaskFormErrors() {
  for (const field of elements.taskForm.querySelectorAll("input, textarea, select")) {
    field.removeAttribute("aria-invalid");
  }
  for (const node of elements.taskForm.querySelectorAll("[data-error-for]")) {
    node.textContent = "";
  }
  elements.taskFormError.textContent = "";
  elements.taskFormError.hidden = true;
}

export function showTaskFormErrors(fieldErrors = {}, generalMessage = "") {
  clearTaskFormErrors();
  let firstField = null;

  for (const node of elements.taskForm.querySelectorAll("[data-error-for]")) {
    const field = node.dataset.errorFor;
    const message = fieldErrors[field];
    if (!message) continue;
    node.textContent = message;
    const control = elements.taskForm.querySelector(`[name="${field}"]`);
    control?.setAttribute("aria-invalid", "true");
    if (!firstField && control) firstField = control;
  }

  if (generalMessage) {
    elements.taskFormError.textContent = generalMessage;
    elements.taskFormError.hidden = false;
  }

  if (firstField) {
    firstField.focus();
  } else if (generalMessage) {
    elements.taskFormError.focus();
  }
}

export function setTaskFormBusy(busy, editing) {
  elements.taskSubmit.disabled = busy;
  elements.taskSubmit.textContent = busy
    ? "Menyimpan…"
    : editing
      ? "Simpan perubahan"
      : "Simpan tugas";
  elements.taskForm.setAttribute("aria-busy", String(busy));
  for (const closeButton of elements.taskDialog.querySelectorAll("[data-close-dialog]")) {
    closeButton.disabled = busy;
  }
}

export function setDeleteTarget(task) {
  elements.deleteCopy.textContent = `"${task.title}" akan dihapus permanen dari database. Tindakan ini tidak dapat dibatalkan.`;
  elements.deleteError.textContent = "";
  elements.deleteError.hidden = true;
  elements.deleteConfirm.disabled = false;
  elements.deleteConfirm.textContent = "Hapus tugas";
}

export function showDeleteError(message) {
  elements.deleteError.textContent = message;
  elements.deleteError.hidden = false;
}

export function setDeleteBusy(busy) {
  elements.deleteConfirm.disabled = busy;
  elements.deleteConfirm.textContent = busy ? "Menghapus…" : "Hapus tugas";
  elements.deleteCancel.disabled = busy;
}

export function showToast(message, tone = "success") {
  if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }
  elements.toastMessage.textContent = message;
  elements.toast.dataset.tone = tone;
  elements.toastIconUse.setAttribute(
    "href",
    tone === "error" ? "#icon-alert" : "#icon-check",
  );
  elements.toast.hidden = false;
  toastTimer = setTimeout(() => {
    hideToast();
  }, 4_500);
}

export function hideToast() {
  elements.toast.hidden = true;
  if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }
}

export function closeDialog(dialog) {
  if (dialog?.open) dialog.close();
}

export { createIcon };
