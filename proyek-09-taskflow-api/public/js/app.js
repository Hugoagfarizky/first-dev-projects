import { api, ApiError } from "./api.js";
import {
  elements as el,
  closeDialog,
  fillTaskForm,
  formatCount,
  hideToast,
  renderPagination,
  renderSummary,
  renderTasks,
  resetTaskForm,
  setApiStatus,
  setDeleteBusy,
  setDeleteTarget,
  setDescriptionCount,
  setFiltersActive,
  setListBusy,
  setResultSummary,
  setSummaryLoading,
  setTaskDialogMode,
  setTaskFormBusy,
  showDeleteError,
  showEmpty,
  showError,
  showLoading,
  showTaskFormErrors,
  showToast,
  STATUS_LABELS,
  PRIORITY_LABELS,
} from "./ui.js";

const PAGE_SIZE = 8;
const DEFAULT_SORT = "created_at";
const DEFAULT_ORDER = "desc";
const DEFAULT_SORT_VALUE = `${DEFAULT_SORT}:${DEFAULT_ORDER}`;
const DEFAULT_FILTERS = Object.freeze({
  q: "",
  status: "",
  priority: "",
  sort: DEFAULT_SORT,
  order: DEFAULT_ORDER,
});

const state = {
  filters: { ...DEFAULT_FILTERS },
  page: 1,
  limit: PAGE_SIZE,
  tasks: [],
  pagination: null,
  summary: { total: 0, todo: 0, in_progress: 0, done: 0 },
  loading: false,
  controller: null,
  searchTimer: null,
  editingId: null,
  taskDialogTrigger: null,
  deleteTarget: null,
  deleteDialogTrigger: null,
  saving: false,
  deleting: false,
};

function hasActiveFilters() {
  return (
    Boolean(state.filters.q.trim()) ||
    Boolean(state.filters.status) ||
    Boolean(state.filters.priority) ||
    state.filters.sort !== DEFAULT_SORT ||
    state.filters.order !== DEFAULT_ORDER
  );
}

function queryParams() {
  return {
    q: state.filters.q.trim(),
    status: state.filters.status,
    priority: state.filters.priority,
    sort: state.filters.sort,
    order: state.filters.order,
    page: state.page,
    limit: state.limit,
  };
}

function refreshFilterControls() {
  const active = hasActiveFilters();
  setFiltersActive(active);
  el.resetFilters.hidden = !active;
  el.emptyResetButton.hidden = !active;
}

function resultCountText(total) {
  const filtered = hasActiveFilters();
  if (total === 0) {
    return filtered ? "Tidak ada tugas yang cocok dengan filter." : "Belum ada tugas tersimpan.";
  }
  return filtered
    ? `${formatCount(total)} tugas cocok dengan filter aktif.`
    : `${formatCount(total)} tugas tersimpan di database.`;
}

function focusAfterDialog(trigger, fallback) {
  if (trigger instanceof HTMLElement && trigger.isConnected) {
    trigger.focus();
    return;
  }
  if (fallback instanceof HTMLElement) fallback.focus();
}

async function loadTasks({ showLoader = true } = {}) {
  state.controller?.abort();
  const controller = new AbortController();
  state.controller = controller;
  state.loading = true;

  if (showLoader) {
    showLoading();
    setResultSummary("Memuat tugas…");
  } else {
    setListBusy(true);
  }

  try {
    const result = await api.listTasks(queryParams(), controller.signal);
    if (state.controller !== controller) return;

    if (result.pagination.total === 0 && state.page !== 1) {
      state.page = 1;
      state.loading = false;
      await loadTasks({ showLoader });
      return;
    }

    if (
      result.pagination.total_pages > 0 &&
      state.page > result.pagination.total_pages
    ) {
      state.page = result.pagination.total_pages;
      state.loading = false;
      await loadTasks({ showLoader });
      return;
    }

    state.tasks = result.data;
    state.pagination = result.pagination;
    state.summary = result.summary;

    renderSummary(result.summary);
    refreshFilterControls();
    setResultSummary(resultCountText(result.pagination.total));
    setApiStatus("online", "API terhubung");

    if (result.data.length === 0) {
      showEmpty(hasActiveFilters());
    } else {
      renderTasks(result.data);
      renderPagination(result.pagination, result.data.length);
    }
  } catch (error) {
    if (error?.name === "AbortError") return;
    if (state.controller !== controller) return;

    const message =
      error instanceof ApiError
        ? error.message
        : "Terjadi kesalahan yang tidak terduga saat memuat tugas.";
    setApiStatus("offline", "API terputus");
    setResultSummary("Gagal memuat tugas.");
    showError(message);
    if (!showLoader) showToast(message, "error");
  } finally {
    if (state.controller === controller) {
      state.loading = false;
      setListBusy(false);
    }
  }
}

async function refreshHealth() {
  try {
    const result = await api.health();
    if (result?.data?.database === "connected") {
      setApiStatus("online", "API terhubung");
    } else {
      setApiStatus("offline", "API terputus");
    }
  } catch {
    setApiStatus("offline", "API terputus");
  }
}

function scheduleSearch() {
  if (state.searchTimer) clearTimeout(state.searchTimer);
  state.page = 1;
  refreshFilterControls();
  state.searchTimer = setTimeout(() => {
    state.searchTimer = null;
    loadTasks();
  }, 280);
}

function cancelPendingSearch() {
  if (state.searchTimer) {
    clearTimeout(state.searchTimer);
    state.searchTimer = null;
  }
}

function parseSort(value) {
  const [sort, order] = value.split(":");
  if (!["created_at", "priority", "due_date"].includes(sort)) {
    return { sort: "created_at", order: "desc" };
  }
  return { sort, order: order === "asc" ? "asc" : "desc" };
}

function setSortFilter(value) {
  const parsed = parseSort(value);
  state.filters.sort = parsed.sort;
  state.filters.order = parsed.order;
}

function resetFilters() {
  cancelPendingSearch();
  state.filters = { ...DEFAULT_FILTERS };
  state.page = 1;
  el.filtersForm.reset();
  el.searchInput.value = "";
  el.statusFilter.value = "";
  el.priorityFilter.value = "";
  el.sortSelect.value = DEFAULT_SORT_VALUE;
  refreshFilterControls();
  loadTasks();
}

function openCreateDialog(trigger) {
  if (el.taskDialog.open) return;
  state.editingId = null;
  state.taskDialogTrigger = trigger;
  resetTaskForm();
  setTaskDialogMode(false);
  el.taskDialog.showModal();
  el.taskTitle.focus();
}

function openEditDialog(task, trigger) {
  if (!task || el.taskDialog.open) return;
  state.editingId = task.id;
  state.taskDialogTrigger = trigger;
  fillTaskForm(task);
  setTaskDialogMode(true);
  el.taskDialog.showModal();
  el.taskTitle.focus();
  el.taskTitle.select();
}

function openDeleteDialog(task, trigger) {
  if (!task || el.deleteDialog.open) return;
  state.deleteTarget = task;
  state.deleteDialogTrigger = trigger;
  setDeleteTarget(task);
  el.deleteDialog.showModal();
  el.deleteCancel.focus();
}

function isValidDateKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1900 || year > 2200 || month < 1 || month > 12) return false;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day >= 1 && day <= daysInMonth;
}

function collectTaskForm() {
  return {
    title: el.taskTitle.value.trim().replace(/\s+/g, " "),
    description: el.taskDescription.value.trim(),
    status: el.taskStatus.value,
    priority: el.taskPriority.value,
    due_date: el.taskDueDate.value || null,
  };
}

function validateTaskForm(values) {
  const errors = {};
  if (!values.title) {
    errors.title = "Judul wajib diisi.";
  } else if (values.title.length > 200) {
    errors.title = "Judul maksimal 200 karakter.";
  }
  if (values.description.length > 2_000) {
    errors.description = "Deskripsi maksimal 2.000 karakter.";
  }
  if (!(values.status in STATUS_LABELS)) {
    errors.status = "Pilih status yang valid.";
  }
  if (!(values.priority in PRIORITY_LABELS)) {
    errors.priority = "Pilih prioritas yang valid.";
  }
  if (values.due_date && !isValidDateKey(values.due_date)) {
    errors.due_date = "Tenggat harus berupa tanggal yang valid.";
  }
  return errors;
}

function fieldErrorsFromApi(error) {
  const fields = {};
  for (const detail of error?.details || []) {
    if (detail?.field && detail.field !== "body" && !fields[detail.field]) {
      fields[detail.field] = detail.message || "Nilai tidak valid.";
    }
  }
  return fields;
}

async function submitTaskForm(event) {
  event.preventDefault();
  if (state.saving) return;

  const values = collectTaskForm();
  const errors = validateTaskForm(values);
  if (Object.keys(errors).length) {
    showTaskFormErrors(errors);
    return;
  }

  const editingId = state.editingId;
  state.saving = true;
  setTaskFormBusy(true, Boolean(editingId));

  try {
    if (editingId) {
      await api.updateTask(editingId, values);
    } else {
      await api.createTask(values);
      state.page = 1;
    }

    state.saving = false;
    setTaskFormBusy(false, Boolean(editingId));
    closeDialog(el.taskDialog);
    showToast(editingId ? "Perubahan tugas disimpan." : "Tugas baru berhasil dibuat.");
    await loadTasks({ showLoader: false });
  } catch (error) {
    const message =
      error instanceof ApiError
        ? error.message
        : "Tugas gagal disimpan karena kesalahan yang tidak terduga.";
    showTaskFormErrors(fieldErrorsFromApi(error), message);
    if (error instanceof ApiError && error.code === "NETWORK_ERROR") {
      setApiStatus("offline", "API terputus");
    }
  } finally {
    if (el.taskDialog.open) {
      state.saving = false;
      setTaskFormBusy(false, Boolean(state.editingId));
    }
  }
}

async function changeTaskStatus(select) {
  const id = select.dataset.id;
  const nextStatus = select.value;
  const previousStatus = select.dataset.current;
  if (!id || nextStatus === previousStatus) return;

  const control = select.closest(".status-control");
  select.disabled = true;
  control.dataset.status = nextStatus;

  try {
    await api.updateTask(id, { status: nextStatus });
    select.dataset.current = nextStatus;
    showToast(`Status diubah menjadi ${STATUS_LABELS[nextStatus]}.`);
    await loadTasks({ showLoader: false });
  } catch (error) {
    select.value = previousStatus;
    control.dataset.status = previousStatus;
    const message =
      error instanceof ApiError
        ? error.message
        : "Status tugas gagal diubah.";
    showToast(message, "error");
    if (error instanceof ApiError && error.code === "NETWORK_ERROR") {
      setApiStatus("offline", "API terputus");
    }
  } finally {
    if (select.isConnected) select.disabled = false;
  }
}

async function confirmDelete() {
  if (!state.deleteTarget || state.deleting) return;
  const task = state.deleteTarget;
  state.deleting = true;
  setDeleteBusy(true);

  try {
    await api.deleteTask(task.id);
    state.deleting = false;
    setDeleteBusy(false);
    closeDialog(el.deleteDialog);
    if (state.tasks.length === 1 && state.page > 1) {
      state.page -= 1;
    }
    showToast(`Tugas "${task.title}" dihapus.`);
    await loadTasks({ showLoader: false });
  } catch (error) {
    const message =
      error instanceof ApiError ? error.message : "Tugas gagal dihapus.";
    showDeleteError(message);
    if (error instanceof ApiError && error.code === "NETWORK_ERROR") {
      setApiStatus("offline", "API terputus");
    }
  } finally {
    if (el.deleteDialog.open) {
      state.deleting = false;
      setDeleteBusy(false);
    }
  }
}

function goToPage(page) {
  if (!state.pagination) return;
  const next = Math.max(1, Math.min(page, state.pagination.total_pages || 1));
  if (next === state.page) return;
  state.page = next;
  loadTasks();
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.workspace.scrollIntoView({
    behavior: reduceMotion ? "auto" : "smooth",
    block: "start",
  });
}

function closeTaskDialog() {
  if (state.saving) return;
  closeDialog(el.taskDialog);
}

function closeDeleteDialog() {
  if (state.deleting) return;
  closeDialog(el.deleteDialog);
}

function bindEvents() {
  el.newTaskButton.addEventListener("click", () => openCreateDialog(el.newTaskButton));
  el.emptyAddButton.addEventListener("click", () => openCreateDialog(el.emptyAddButton));
  el.retryButton.addEventListener("click", () => loadTasks());

  el.searchInput.addEventListener("input", () => {
    state.filters.q = el.searchInput.value;
    scheduleSearch();
  });

  el.statusFilter.addEventListener("change", () => {
    cancelPendingSearch();
    state.filters.status = el.statusFilter.value;
    state.page = 1;
    refreshFilterControls();
    loadTasks();
  });

  el.priorityFilter.addEventListener("change", () => {
    cancelPendingSearch();
    state.filters.priority = el.priorityFilter.value;
    state.page = 1;
    refreshFilterControls();
    loadTasks();
  });

  el.sortSelect.addEventListener("change", () => {
    cancelPendingSearch();
    setSortFilter(el.sortSelect.value);
    state.page = 1;
    refreshFilterControls();
    loadTasks();
  });

  el.filtersForm.addEventListener("submit", (event) => {
    event.preventDefault();
    cancelPendingSearch();
    loadTasks();
  });

  el.resetFilters.addEventListener("click", resetFilters);
  el.emptyResetButton.addEventListener("click", resetFilters);

  el.taskDescription.addEventListener("input", setDescriptionCount);

  el.taskForm.addEventListener("submit", submitTaskForm);

  for (const button of document.querySelectorAll("[data-close-dialog]")) {
    button.addEventListener("click", () => {
      const dialog = document.getElementById(button.dataset.closeDialog);
      if (dialog === el.taskDialog) closeTaskDialog();
      else closeDialog(dialog);
    });
  }

  el.taskDialog.addEventListener("cancel", (event) => {
    if (state.saving) event.preventDefault();
  });

  el.deleteDialog.addEventListener("cancel", (event) => {
    if (state.deleting) event.preventDefault();
  });

  el.taskDialog.addEventListener("click", (event) => {
    if (event.target === el.taskDialog) closeTaskDialog();
  });

  el.deleteDialog.addEventListener("click", (event) => {
    if (event.target === el.deleteDialog) closeDeleteDialog();
  });

  el.taskDialog.addEventListener("close", () => {
    const trigger = state.taskDialogTrigger;
    state.taskDialogTrigger = null;
    state.editingId = null;
    resetTaskForm();
    focusAfterDialog(trigger, el.newTaskButton);
  });

  el.deleteDialog.addEventListener("close", () => {
    const trigger = state.deleteDialogTrigger;
    state.deleteDialogTrigger = null;
    state.deleteTarget = null;
    state.deleting = false;
    setDeleteBusy(false);
    focusAfterDialog(trigger, el.newTaskButton);
  });

  el.deleteCancel.addEventListener("click", closeDeleteDialog);
  el.deleteConfirm.addEventListener("click", confirmDelete);
  el.paginationPrev.addEventListener("click", () => goToPage(state.page - 1));
  el.paginationNext.addEventListener("click", () => goToPage(state.page + 1));

  el.pageButtons.addEventListener("click", (event) => {
    const button = event.target.closest("[data-page]");
    if (!button) return;
    goToPage(Number(button.dataset.page));
  });

  el.taskList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const { action, id } = button.dataset;
    if (action !== "edit" && action !== "delete") return;
    const task = state.tasks.find((item) => item.id === id);
    if (!task) {
      showToast("Tugas tidak ditemukan pada halaman ini. Muat ulang daftar.", "error");
      return;
    }
    if (action === "edit") openEditDialog(task, button);
    else openDeleteDialog(task, button);
  });

  el.taskList.addEventListener("change", (event) => {
    const select = event.target.closest('[data-action="status"]');
    if (select) changeTaskStatus(select);
  });

  el.toastClose.addEventListener("click", hideToast);

  window.addEventListener("online", () => {
    refreshHealth();
    loadTasks({ showLoader: false });
  });
}

function initialize() {
  bindEvents();
  setSummaryLoading();
  setFiltersActive(false);
  setResultSummary("Memuat tugas…");
  refreshHealth();
  loadTasks();
}

initialize();
