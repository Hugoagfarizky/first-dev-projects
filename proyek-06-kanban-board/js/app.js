import {
  STATUSES,
  STATUS_LABELS,
  addTask,
  createSampleTasks,
  deleteTask,
  getLabels,
  getTaskById,
  getTaskStats,
  getVisibleTasks,
  hasActiveFilters,
  moveTask,
  updateTask,
} from "./tasks.js";
import { loadTasks, saveTasks } from "./storage.js";
import {
  clearFormErrors,
  focusTaskTitle,
  hideStorageNotice,
  populateTaskForm,
  readTaskForm,
  renderBoard,
  renderLabelOptions,
  renderLabelSuggestions,
  renderSaveState,
  renderStats,
  setTodayLabel,
  showFormErrors,
  showStorageNotice,
  showToast,
} from "./ui.js";

const byId = (id) => document.getElementById(id);

const dom = {
  board: byId("board"),
  lists: {
    todo: byId("task-list-todo"),
    "in-progress": byId("task-list-in-progress"),
    done: byId("task-list-done"),
  },
  counts: {
    todo: byId("count-todo"),
    "in-progress": byId("count-in-progress"),
    done: byId("count-done"),
  },
  empties: {
    todo: byId("empty-todo"),
    "in-progress": byId("empty-in-progress"),
    done: byId("empty-done"),
  },
  statTotal: byId("stat-total"),
  statTodo: byId("stat-todo"),
  statProgress: byId("stat-progress"),
  statDone: byId("stat-done"),
  statPercent: byId("stat-percent"),
  completionBar: byId("completion-bar"),
  completionFill: byId("completion-fill"),
  storageBanner: byId("storage-banner"),
  storageBannerMessage: byId("storage-banner-message"),
  storageResetButton: byId("storage-reset-button"),
  emptyBoard: byId("empty-board"),
  emptyFilter: byId("empty-filter"),
  emptyBoardCreate: byId("empty-board-create"),
  emptyFilterClear: byId("empty-filter-clear"),
  searchInput: byId("search-input"),
  clearSearch: byId("clear-search"),
  priorityFilter: byId("priority-filter"),
  labelFilter: byId("label-filter"),
  clearFilters: byId("clear-filters"),
  filterSummary: byId("filter-summary"),
  labelSuggestions: byId("label-suggestions"),
  boardHintText: byId("board-hint")?.querySelector("span"),
  saveState: byId("save-state"),
  todayLabel: byId("today-label"),
  newTaskButton: byId("new-task-button"),
  taskDialog: byId("task-dialog"),
  taskForm: byId("task-form"),
  taskDialogTitle: byId("task-dialog-title"),
  taskDialogSubtitle: byId("task-dialog-subtitle"),
  taskId: byId("task-id"),
  taskMeta: byId("task-meta"),
  createdAtText: byId("task-created"),
  updatedAtText: byId("task-updated"),
  deleteTaskButton: byId("delete-task-button"),
  submitTaskButton: byId("submit-task-button"),
  formError: byId("task-form-error"),
  confirmDialog: byId("confirm-dialog"),
  confirmEyebrow: byId("confirm-eyebrow"),
  confirmTitle: byId("confirm-title"),
  confirmMessage: byId("confirm-message"),
  confirmAction: byId("confirm-action"),
  confirmCancel: byId("confirm-cancel"),
  confirmIcon: document.querySelector(".confirm-icon use"),
  toast: byId("toast"),
  toastIcon: byId("toast-icon"),
  toastMessage: byId("toast-message"),
  fields: {
    title: byId("task-title"),
    description: byId("task-description"),
    status: byId("task-status"),
    priority: byId("task-priority"),
    label: byId("task-label"),
    dueDate: byId("task-due-date"),
  },
  fieldErrors: {
    title: byId("task-title-error"),
    description: byId("task-description-error"),
    status: byId("task-status-error"),
    priority: byId("task-priority-error"),
    label: byId("task-label-error"),
    dueDate: byId("task-due-error"),
  },
};

const state = {
  tasks: [],
  filters: { query: "", priority: "all", label: "all" },
  editingId: null,
  dialogTrigger: null,
  restoreDialogFocus: true,
  confirm: null,
  restoreConfirmFocus: true,
  storageLocked: false,
  loadStatus: "ready",
  saveStatus: "saved",
  lastSavedAt: null,
  sampleLoaded: false,
  drag: null,
};

function setSaveStatus(status, savedAt = null) {
  state.saveStatus = status;
  state.lastSavedAt = savedAt;
  renderSaveState(dom.saveState, status, savedAt);
}

function ensureWritable() {
  if (!state.storageLocked) return true;
  showStorageNotice(
    dom,
    "Reset data lokal terlebih dahulu agar data lama yang bermasalah tidak tertimpa tanpa persetujuan.",
    true,
  );
  showToast(dom, "Reset data lokal sebelum mengubah papan.", "error");
  dom.storageResetButton.focus();
  return false;
}

function canRestoreFocus(element) {
  return (
    element instanceof HTMLElement &&
    element.isConnected &&
    !element.closest("[hidden]") &&
    element.getClientRects().length > 0
  );
}

function renderAll() {
  const labels = getLabels(state.tasks);
  const selectedLabel = renderLabelOptions(dom.labelFilter, labels, state.filters.label);
  if (selectedLabel !== state.filters.label) state.filters.label = selectedLabel;

  const filtersActive = hasActiveFilters(state.filters);
  const visibleTasks = getVisibleTasks(state.tasks, state.filters);
  const stats = getTaskStats(state.tasks);

  renderStats(dom, stats);
  renderBoard(dom, state.tasks, visibleTasks, filtersActive);
  renderLabelSuggestions(dom.labelSuggestions, labels);

  if (dom.searchInput.value !== state.filters.query) dom.searchInput.value = state.filters.query;
  dom.priorityFilter.value = state.filters.priority;
  dom.clearSearch.hidden = !state.filters.query;
  dom.clearFilters.hidden = !filtersActive;
  dom.emptyBoard.hidden = state.tasks.length !== 0;
  dom.emptyFilter.hidden = !(state.tasks.length > 0 && filtersActive && visibleTasks.length === 0);

  if (state.tasks.length === 0) {
    dom.filterSummary.textContent = "Belum ada tugas di papan.";
  } else if (filtersActive) {
    dom.filterSummary.textContent = `${visibleTasks.length} dari ${state.tasks.length} tugas ditampilkan.`;
  } else {
    dom.filterSummary.textContent = `${state.tasks.length} tugas di papan.`;
  }

  dom.boardHintText.textContent = filtersActive
    ? "Filter aktif. Hapus filter untuk mengubah urutan dengan drag-and-drop."
    : "Tarik kartu di desktop, atau gunakan menu kartu untuk memindahkan.";
}

function persist(message = "") {
  if (state.storageLocked) return false;

  const result = saveTasks(state.tasks);
  if (!result.ok) {
    setSaveStatus("error");
    showStorageNotice(dom, result.message, false);
    showToast(dom, result.message, "error", 5200);
    return false;
  }

  if (state.loadStatus !== "ready") state.loadStatus = "ready";
  hideStorageNotice(dom);
  setSaveStatus("saved", new Date());
  if (message) showToast(dom, message);
  return true;
}

function openTaskDialog({ task = null, defaultStatus = "todo", trigger = document.activeElement } = {}) {
  if (dom.taskDialog.open) return;
  state.editingId = task?.id || null;
  state.dialogTrigger = trigger instanceof HTMLElement ? trigger : document.activeElement;
  populateTaskForm(dom, task, STATUSES.includes(defaultStatus) ? defaultStatus : "todo");
  dom.taskDialog.showModal();
  dom.fields.title.focus();
}

function openNewTask(defaultStatus = "todo", trigger = document.activeElement) {
  if (!ensureWritable()) return;
  openTaskDialog({ task: null, defaultStatus, trigger });
}

function openEditTask(taskId, trigger = document.activeElement) {
  if (!ensureWritable()) return;
  const task = getTaskById(state.tasks, taskId);
  if (!task) {
    showToast(dom, "Tugas tidak ditemukan.", "error");
    return;
  }
  openTaskDialog({ task, defaultStatus: task.status, trigger });
}

function closeTaskDialog({ restoreFocus = true } = {}) {
  if (!dom.taskDialog.open) return;
  state.restoreDialogFocus = restoreFocus;
  dom.taskDialog.close();
}

function handleTaskDialogClose() {
  const trigger = state.dialogTrigger;
  const shouldRestore = state.restoreDialogFocus;
  state.restoreDialogFocus = true;
  state.dialogTrigger = null;
  state.editingId = null;
  clearFormErrors(dom);
  if (shouldRestore && canRestoreFocus(trigger)) trigger.focus();
}

function openConfirm({ type, taskId = null, trigger = document.activeElement, title, message, eyebrow, actionLabel, icon = "trash" }) {
  if (dom.confirmDialog.open) return;
  state.confirm = { type, taskId, trigger };
  dom.confirmEyebrow.textContent = eyebrow;
  dom.confirmTitle.textContent = title;
  dom.confirmMessage.textContent = message;
  dom.confirmAction.textContent = actionLabel;
  dom.confirmAction.className = "button button-danger";
  dom.confirmIcon?.setAttribute("href", `#icon-${icon}`);
  dom.confirmDialog.showModal();
  dom.confirmCancel.focus();
}

function requestTaskDelete(taskId, trigger = document.activeElement) {
  if (!ensureWritable()) return;
  const task = getTaskById(state.tasks, taskId);
  if (!task) return;
  openConfirm({
    type: "delete",
    taskId,
    trigger,
    eyebrow: "Hapus tugas",
    title: "Hapus tugas ini?",
    message: `"${task.title}" akan dihapus permanen dari papan. Tindakan ini tidak dapat dibatalkan.`,
    actionLabel: "Hapus tugas",
    icon: "trash",
  });
}

function requestStorageReset(trigger = dom.storageResetButton) {
  openConfirm({
    type: "reset",
    trigger,
    eyebrow: "Data lokal",
    title: "Reset data lokal?",
    message: "Data lama akan diganti dengan papan kosong. Tindakan ini tidak dapat dibatalkan.",
    actionLabel: "Reset data",
    icon: "alert",
  });
}

function resetFilters() {
  state.filters = { query: "", priority: "all", label: "all" };
  dom.priorityFilter.value = "all";
  dom.labelFilter.value = "all";
  renderAll();
  dom.searchInput.focus();
}

function handleTaskSubmit(event) {
  event.preventDefault();
  if (!ensureWritable()) return;

  const values = readTaskForm(dom);
  const editingId = state.editingId;
  const result = editingId ? updateTask(state.tasks, editingId, values) : addTask(state.tasks, values);

  if (!result.task) {
    showFormErrors(dom, result.errors);
    return;
  }

  state.tasks = result.tasks;
  const savedTaskId = result.task.id;
  const trigger = state.dialogTrigger;
  closeTaskDialog({ restoreFocus: false });
  renderAll();

  if (editingId) {
    if (!focusTaskTitle(dom.board, savedTaskId)) dom.newTaskButton.focus();
  } else if (canRestoreFocus(trigger)) {
    trigger.focus();
  } else {
    dom.newTaskButton.focus();
  }

  persist(editingId ? "Perubahan tugas disimpan." : "Tugas baru dibuat.");
}

function handleBoardClick(event) {
  const addButton = event.target.closest("[data-add-status]");
  if (addButton) {
    openNewTask(addButton.dataset.addStatus, addButton);
    return;
  }

  const action = event.target.closest("[data-action]");
  if (!action) return;
  const card = action.closest(".task-card");
  if (!card) return;

  const taskId = card.dataset.taskId;
  const trigger = card.querySelector(".task-title-button") || action;

  if (action.dataset.action === "edit") {
    closeAllMenus();
    openEditTask(taskId, trigger);
    return;
  }

  if (action.dataset.action === "move") {
    closeAllMenus();
    moveTaskToStatus(taskId, action.dataset.status);
    return;
  }

  if (action.dataset.action === "delete") {
    closeAllMenus();
    requestTaskDelete(taskId, trigger);
  }
}

function moveTaskToStatus(taskId, toStatus) {
  if (!ensureWritable() || !STATUSES.includes(toStatus)) return;
  const result = moveTask(state.tasks, taskId, toStatus, null, "end");
  if (!result.changed) return;

  state.tasks = result.tasks;
  renderAll();
  persist(`Tugas dipindahkan ke ${STATUS_LABELS[toStatus]}.`);
  if (!focusTaskTitle(dom.board, taskId)) dom.newTaskButton.focus();
}

function handleConfirmAction() {
  const pending = state.confirm;
  if (!pending) return;

  state.confirm = null;
  state.restoreConfirmFocus = false;
  dom.confirmDialog.close();

  if (pending.type === "delete") {
    if (!state.tasks.some((task) => task.id === pending.taskId)) return;

    if (dom.taskDialog.open) {
      state.restoreDialogFocus = false;
      state.dialogTrigger = null;
      dom.taskDialog.close();
    }

    state.tasks = deleteTask(state.tasks, pending.taskId);
    renderAll();
    persist("Tugas dihapus.");
    dom.newTaskButton.focus();
    return;
  }

  if (pending.type === "reset") {
    const result = saveTasks([]);
    if (!result.ok) {
      setSaveStatus("error");
      showStorageNotice(dom, result.message, state.storageLocked);
      showToast(dom, result.message, "error", 5200);
      return;
    }

    state.tasks = [];
    state.storageLocked = false;
    state.loadStatus = "ready";
    state.filters = { query: "", priority: "all", label: "all" };
    hideStorageNotice(dom);
    setSaveStatus("saved", new Date());
    renderAll();
    showToast(dom, "Data lokal direset. Papan sekarang kosong.");
    dom.newTaskButton.focus();
  }
}

function handleConfirmClose() {
  const pending = state.confirm;
  const shouldRestore = state.restoreConfirmFocus;
  state.restoreConfirmFocus = true;
  state.confirm = null;
  if (shouldRestore && canRestoreFocus(pending?.trigger)) pending.trigger.focus();
}

function clearDragFeedback() {
  dom.board.querySelectorAll(".board-column").forEach((column) => {
    column.classList.remove("is-drop-over");
  });
  dom.board.querySelectorAll(".task-card").forEach((card) => {
    card.classList.remove("drop-before", "drop-after");
  });
}

function handleDragStart(event) {
  if (state.storageLocked || hasActiveFilters(state.filters)) {
    event.preventDefault();
    return;
  }

  const card = event.target.closest(".task-card");
  if (!card) return;
  if (event.target.closest("button, summary, a, input, select, textarea")) {
    event.preventDefault();
    return;
  }

  closeAllMenus();
  state.drag = { id: card.dataset.taskId, sourceStatus: card.dataset.status };
  card.classList.add("is-dragging");

  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", card.dataset.taskId);
  }
}

function handleDragOver(event) {
  if (!state.drag || !event.target.closest(".board-column")) return;

  event.preventDefault();
  clearDragFeedback();

  const column = event.target.closest(".board-column");
  column.classList.add("is-drop-over");
  if (event.dataTransfer) event.dataTransfer.dropEffect = "move";

  const targetCard = event.target.closest(".task-card");
  if (!targetCard || targetCard.classList.contains("is-dragging")) return;

  const rect = targetCard.getBoundingClientRect();
  targetCard.classList.add(event.clientY < rect.top + rect.height / 2 ? "drop-before" : "drop-after");
}

function handleDrop(event) {
  if (!state.drag) return;
  const column = event.target.closest(".board-column");
  if (!column) return;

  event.preventDefault();

  if (state.storageLocked || hasActiveFilters(state.filters)) {
    state.drag = null;
    clearDragFeedback();
    return;
  }

  const draggedId = state.drag.id;
  const sourceStatus = state.drag.sourceStatus;
  const targetCard = event.target.closest(".task-card");

  if (targetCard?.dataset.taskId === draggedId) {
    state.drag = null;
    clearDragFeedback();
    return;
  }

  const toStatus = column.dataset.status;
  let targetId = null;
  let position = "end";

  if (targetCard) {
    targetId = targetCard.dataset.taskId;
    const rect = targetCard.getBoundingClientRect();
    position = event.clientY < rect.top + rect.height / 2 ? "before" : "after";
  }

  state.drag = null;
  clearDragFeedback();

  const result = moveTask(state.tasks, draggedId, toStatus, targetId, position);
  if (!result.changed) return;

  state.tasks = result.tasks;
  renderAll();
  persist(
    sourceStatus === toStatus
      ? "Urutan tugas diperbarui."
      : `Tugas dipindahkan ke ${STATUS_LABELS[toStatus]}.`,
  );
}

function handleDragEnd() {
  dom.board.querySelectorAll(".is-dragging").forEach((card) => card.classList.remove("is-dragging"));
  clearDragFeedback();
  state.drag = null;
}

function closeAllMenus(except = null) {
  document.querySelectorAll("details.card-menu[open]").forEach((menu) => {
    if (menu !== except) menu.open = false;
  });
}

function handleDocumentClick(event) {
  if (!event.target.closest(".card-menu")) closeAllMenus();
}

function handleMenuToggle(event) {
  if (!(event.target instanceof HTMLDetailsElement) || !event.target.matches(".card-menu")) return;
  if (event.target.open) closeAllMenus(event.target);
}

function handleDocumentKeydown(event) {
  if (event.key !== "Escape") return;
  const openMenu = document.querySelector("details.card-menu[open]");
  if (openMenu) {
    const trigger = openMenu.querySelector("summary");
    openMenu.open = false;
    trigger?.focus();
  }
}

function handleDialogBackdrop(event) {
  if (event.target !== event.currentTarget) return;
  if (event.currentTarget === dom.taskDialog) closeTaskDialog();
  if (event.currentTarget === dom.confirmDialog) dom.confirmDialog.close();
}

function bindEvents() {
  dom.newTaskButton.addEventListener("click", () => openNewTask("todo", dom.newTaskButton));
  dom.emptyBoardCreate.addEventListener("click", () => openNewTask("todo", dom.emptyBoardCreate));
  dom.emptyFilterClear.addEventListener("click", resetFilters);
  dom.clearFilters.addEventListener("click", resetFilters);

  dom.searchInput.addEventListener("input", () => {
    state.filters.query = dom.searchInput.value;
    renderAll();
  });

  dom.clearSearch.addEventListener("click", () => {
    state.filters.query = "";
    dom.searchInput.value = "";
    renderAll();
    dom.searchInput.focus();
  });

  dom.priorityFilter.addEventListener("change", () => {
    state.filters.priority = dom.priorityFilter.value;
    renderAll();
  });

  dom.labelFilter.addEventListener("change", () => {
    state.filters.label = dom.labelFilter.value;
    renderAll();
  });

  dom.board.addEventListener("click", handleBoardClick);
  dom.board.addEventListener("dragstart", handleDragStart);
  dom.board.addEventListener("dragover", handleDragOver);
  dom.board.addEventListener("drop", handleDrop);
  dom.board.addEventListener("dragend", handleDragEnd);

  dom.taskForm.addEventListener("submit", handleTaskSubmit);
  dom.taskForm.addEventListener("input", (event) => {
    const field = event.target.name;
    if (!field || !dom.fieldErrors[field]) return;
    dom.fieldErrors[field].textContent = "";
    event.target.removeAttribute("aria-invalid");
    dom.formError.hidden = true;
    dom.formError.textContent = "";
  });

  dom.deleteTaskButton.addEventListener("click", () => {
    if (state.editingId) requestTaskDelete(state.editingId, dom.deleteTaskButton);
  });

  document.querySelectorAll("[data-dialog-close]").forEach((control) => {
    control.addEventListener("click", () => closeTaskDialog());
  });

  dom.taskDialog.addEventListener("close", handleTaskDialogClose);
  dom.taskDialog.addEventListener("click", handleDialogBackdrop);
  dom.confirmDialog.addEventListener("close", handleConfirmClose);
  dom.confirmDialog.addEventListener("click", handleDialogBackdrop);
  dom.confirmCancel.addEventListener("click", () => dom.confirmDialog.close());
  dom.confirmAction.addEventListener("click", handleConfirmAction);
  dom.storageResetButton.addEventListener("click", () => requestStorageReset(dom.storageResetButton));

  document.addEventListener("click", handleDocumentClick);
  document.addEventListener("toggle", handleMenuToggle, true);
  document.addEventListener("keydown", handleDocumentKeydown);
}

function initialize() {
  setTodayLabel(dom.todayLabel);

  const loaded = loadTasks();
  state.tasks = loaded.tasks;

  if (loaded.status === "empty") {
    state.tasks = createSampleTasks();
    state.sampleLoaded = true;
    const saved = saveTasks(state.tasks);
    if (saved.ok) {
      state.loadStatus = "ready";
      state.lastSavedAt = new Date();
      state.saveStatus = "saved";
    } else {
      state.loadStatus = "ready";
      state.saveStatus = "unavailable";
      showStorageNotice(dom, saved.message, false);
    }
  } else if (loaded.status === "partial") {
    state.loadStatus = "partial";
    state.saveStatus = "warning";
    showStorageNotice(dom, loaded.message, false);
  } else if (loaded.status === "corrupt") {
    state.loadStatus = "corrupt";
    state.saveStatus = "warning";
    state.storageLocked = true;
    showStorageNotice(dom, loaded.message, true);
  } else if (loaded.status === "unavailable") {
    state.loadStatus = "unavailable";
    state.saveStatus = "unavailable";
    showStorageNotice(dom, loaded.message, false);
  } else {
    state.loadStatus = "ready";
    state.saveStatus = "saved";
  }

  bindEvents();
  renderAll();
  renderSaveState(dom.saveState, state.saveStatus, state.lastSavedAt);

  if (state.sampleLoaded && state.saveStatus === "saved") {
    showToast(dom, "Beberapa tugas contoh dimuat untuk membantu Anda memulai.", "success", 4200);
  }
}

initialize();
