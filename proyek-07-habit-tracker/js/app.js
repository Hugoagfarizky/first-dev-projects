import {
  addDays,
  compareDateKeys,
  daysInMonth,
  formatDate,
  formatLongDate,
  formatMonthYear,
  getGreeting,
  parseDateKey,
  shiftMonth,
  todayKey,
} from "./dates.js";
import {
  addHabit,
  archiveHabit,
  canCheckIn,
  deleteHabit,
  filterHabits,
  getActiveHabits,
  getHabitById,
  hasHabitFilters,
  isScheduledOn,
  reactivateHabit,
  updateHabit,
} from "./habits.js";
import {
  isCheckedIn,
  removeHabitCheckins,
  toggleCheckin,
} from "./checkins.js";
import {
  getHabitProgress,
  getOverallStats,
  getSevenDayActivity,
  getStreaks,
  getTodaySummary,
} from "./stats.js";
import { getDayDetails, getMonthDays } from "./calendar.js";
import { saveData, loadData } from "./storage.js";
import {
  clearFormErrors,
  closeAllMenus,
  configureConfirmDialog,
  hideStorageNotice,
  hideToast,
  populateHabitForm,
  readHabitForm,
  renderCalendar,
  renderDashboard,
  renderHabits,
  renderSaveState,
  renderStats,
  showFormErrors,
  showStorageNotice,
  showToast,
  syncFrequencyFields,
} from "./ui.js";

const byId = (id) => document.getElementById(id);
const VALID_VIEWS = new Set(["dashboard", "habits", "calendar", "stats"]);

const dom = {
  navLinks: [...document.querySelectorAll("[data-nav]")],
  views: {
    dashboard: byId("view-dashboard"),
    habits: byId("view-habits"),
    calendar: byId("view-calendar"),
    stats: byId("view-stats"),
  },
  save: {
    root: byId("save-state"),
    text: byId("save-state-text"),
  },
  newHabitButton: byId("new-habit-button"),
  storage: {
    root: byId("storage-banner"),
    message: byId("storage-banner-message"),
    download: byId("storage-download-button"),
    reset: byId("storage-reset-button"),
  },
  dashboard: {
    greeting: byId("greeting"),
    todayLabel: byId("today-label"),
    ring: byId("today-ring"),
    percent: byId("today-percent"),
    ringCaption: byId("today-ring-caption"),
    ringDetail: byId("today-ring-detail"),
    statActive: byId("stat-active"),
    statActiveNote: byId("stat-active-note"),
    statDone: byId("stat-done"),
    statDoneNote: byId("stat-done-note"),
    statStreak: byId("stat-streak"),
    statStreakNote: byId("stat-streak-note"),
    statWeek: byId("stat-week"),
    statWeekNote: byId("stat-week-note"),
    todayList: byId("today-list"),
    todayEmpty: byId("today-empty"),
    todayEmptyTitle: byId("today-empty-title"),
    todayEmptyCopy: byId("today-empty-copy"),
    todayScheduledLabel: byId("today-scheduled-label"),
    weekChart: byId("week-chart"),
    weekSummary: byId("week-summary"),
  },
  habits: {
    search: byId("habits-search"),
    clearSearch: byId("clear-habit-search"),
    category: byId("habits-category"),
    statusButtons: [...document.querySelectorAll("[data-status-filter]")],
    clearFilters: byId("clear-habit-filters"),
    summary: byId("habits-summary"),
    list: byId("habits-list"),
    empty: byId("habits-empty"),
    emptyTitle: byId("habits-empty-title"),
    emptyCopy: byId("habits-empty-copy"),
    emptyCreate: byId("habits-empty-create"),
    emptyClear: byId("habits-empty-clear"),
  },
  calendar: {
    monthLabel: byId("calendar-month-label"),
    prev: byId("calendar-prev"),
    next: byId("calendar-next"),
    today: byId("calendar-today"),
    grid: byId("calendar-grid"),
    selectedLabel: byId("selected-date-label"),
    selectedSummary: byId("selected-date-summary"),
    dayList: byId("day-habits"),
    dayEmpty: byId("day-empty"),
    dayEmptyCopy: byId("day-empty-copy"),
  },
  stats: {
    totalCheckins: byId("stats-total-checkins"),
    week: byId("stats-week"),
    weekNote: byId("stats-week-note"),
    month: byId("stats-month"),
    monthNote: byId("stats-month-note"),
    bestStreak: byId("stats-best-streak"),
    bestStreakNote: byId("stats-best-streak-note"),
    weekCaption: byId("stats-week-caption"),
    weekChart: byId("stats-week-chart"),
    weekSummary: byId("stats-week-summary"),
    bestNumber: byId("stats-best-number"),
    bestName: byId("stats-best-name"),
    bestDetail: byId("stats-best-detail"),
    progressList: byId("stats-progress-list"),
    empty: byId("stats-empty"),
  },
  form: {
    dialog: byId("habit-dialog"),
    form: byId("habit-form"),
    id: byId("habit-id"),
    name: byId("habit-name"),
    nameError: byId("habit-name-error"),
    category: byId("habit-category"),
    categoryError: byId("habit-category-error"),
    colorField: document.querySelector(".color-field"),
    colors: [...document.querySelectorAll('input[name="color"]')],
    colorError: byId("habit-color-error"),
    frequencyField: document.querySelector(".frequency-field"),
    frequencyRadios: [...document.querySelectorAll('input[name="frequency"]')],
    frequencyError: byId("habit-frequency-error"),
    daysField: byId("habit-days-group"),
    daysError: byId("habit-days-error"),
    dayCheckboxes: [...document.querySelectorAll('input[name="days"]')],
    description: byId("habit-description"),
    descriptionError: byId("habit-description-error"),
    formError: byId("habit-form-error"),
    eyebrow: byId("habit-dialog-eyebrow"),
    title: byId("habit-dialog-title"),
    subtitle: byId("habit-dialog-subtitle"),
    submitLabel: byId("habit-submit-label"),
    created: byId("habit-created"),
    submit: byId("habit-submit"),
  },
  confirm: {
    dialog: byId("confirm-dialog"),
    eyebrow: byId("confirm-eyebrow"),
    title: byId("confirm-title"),
    message: byId("confirm-message"),
    action: byId("confirm-action"),
    cancel: byId("confirm-cancel"),
    iconUse: byId("confirm-icon-use"),
  },
  toast: {
    root: byId("toast"),
    message: byId("toast-message"),
    close: byId("toast-close"),
  },
};

const state = {
  habits: [],
  checkins: {},
  view: "dashboard",
  filters: { query: "", category: "all", status: "active" },
  calendar: {
    year: new Date().getFullYear(),
    monthIndex: new Date().getMonth(),
    selectedDate: todayKey(),
  },
  today: todayKey(),
  editingId: null,
  dialogTrigger: null,
  restoreDialogFocus: true,
  confirmAction: null,
  confirmTrigger: null,
  storageStatus: "empty",
  storageLocked: false,
  storageRaw: "",
  saveStatus: "idle",
  saveError: "",
  notice: null,
};

function getViewFromHash() {
  const value = window.location.hash.replace(/^#/, "");
  return VALID_VIEWS.has(value) ? value : "dashboard";
}

function setView(view, { updateHash = true, scroll = true } = {}) {
  if (!VALID_VIEWS.has(view)) view = "dashboard";
  state.view = view;
  for (const [name, section] of Object.entries(dom.views)) {
    section.hidden = name !== view;
  }
  for (const link of dom.navLinks) {
    const active = link.dataset.nav === view;
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  if (updateHash && window.location.hash !== `#${view}`) {
    window.location.hash = view;
  }
  if (scroll) window.scrollTo({ top: 0, behavior: "auto" });
}

function resolveReturnFocus(trigger, habitId) {
  if (!trigger) return dom.newHabitButton;
  const card = habitId
    ? sectorCardForHabit(habitId)
    : trigger.closest("[data-habit-id]");
  const preferred = card?.querySelector(".habit-card-title-button, .habit-title");
  return preferred || trigger;
}

function sectorCardForHabit(habitId) {
  return [...document.querySelectorAll("[data-habit-id]")].find(
    (node) =>
      node.dataset.habitId === habitId &&
      !node.closest("[hidden]") &&
      node.getClientRects().length > 0,
  );
}

function focusConnected(node) {
  if (
    node &&
    node.isConnected &&
    !node.closest("[hidden]") &&
    node.getClientRects().length > 0
  ) {
    node.focus({ preventScroll: true });
    return true;
  }
  return false;
}

function findHabitAction(habitId, action) {
  return [...document.querySelectorAll(`[data-action="${action}"]`)].find(
    (node) =>
      node.dataset.habitId === habitId &&
      !node.closest("[hidden]") &&
      node.getClientRects().length > 0 &&
      !node.disabled,
  );
}

function focusHabitAction(habitId, action = "edit-habit") {
  let candidate = findHabitAction(habitId, action);
  if (!candidate && action !== "edit-habit") {
    candidate = findHabitAction(habitId, "edit-habit");
  }
  if (candidate) {
    candidate.focus({ preventScroll: true });
    return true;
  }
  return focusConnected(dom.newHabitButton);
}

function focusCheckButton(habitId, dateKey) {
  const candidate = [...document.querySelectorAll('[data-action="toggle-checkin"]')].find(
    (node) =>
      node.dataset.habitId === habitId &&
      node.dataset.date === dateKey &&
      !node.closest("[hidden]") &&
      node.getClientRects().length > 0 &&
      !node.disabled,
  );
  if (candidate) {
    candidate.focus({ preventScroll: true });
    return true;
  }
  return false;
}

function focusSelectedCalendarDay() {
  const selected = dom.calendar.grid.querySelector(
    `[data-date="${state.calendar.selectedDate}"]`,
  );
  selected?.focus({ preventScroll: true });
}

function showNotice(notice) {
  state.notice = notice;
  if (!notice) {
    hideStorageNotice(dom.storage);
    return;
  }
  showStorageNotice(dom.storage, notice);
}

function setSaveError(message) {
  state.saveError = message;
  showNotice({
    message: `${message} Perubahan tetap ada di tab ini, tetapi akan hilang jika halaman dimuat ulang.`,
    canDownload: false,
    canReset: false,
  });
}

function applyLoadResult(result) {
  state.habits = result.habits;
  state.checkins = result.checkins;
  state.storageStatus = result.status;
  state.storageLocked = result.status === "corrupt";
  state.storageRaw = result.raw || "";
  state.saveStatus = result.status === "ready" ? "saved" : "idle";
  state.saveError = "";
  state.today = todayKey();

  if (result.status === "corrupt") {
    showNotice({
      message: `${result.message} Unduh data mentah jika ingin menyimpannya, lalu reset setelah yakin.`,
      canDownload: Boolean(result.raw),
      canReset: true,
    });
  } else if (result.status === "partial") {
    showNotice({
      message: `${result.message} Perubahan berikutnya akan menyimpan data valid yang terlihat.`,
      canDownload: Boolean(result.raw),
      canReset: false,
    });
  } else if (result.status === "unavailable") {
    showNotice({
      message: result.message,
      canDownload: false,
      canReset: false,
    });
  } else {
    showNotice(null);
  }
}

function getSavePresentation() {
  if (state.saveError) return { state: "error", text: "Tidak tersimpan" };
  if (state.storageStatus === "corrupt") return { state: "locked", text: "Terkunci" };
  if (state.storageStatus === "unavailable") {
    return { state: "unavailable", text: "Tidak tersedia" };
  }
  if (state.storageStatus === "partial") return { state: "warning", text: "Perlu perhatian" };
  if (state.saveStatus === "saved") return { state: "saved", text: "Tersimpan" };
  return { state: "idle", text: "Siap" };
}

function renderPersistenceState() {
  const presentation = getSavePresentation();
  renderSaveState(dom.save, presentation.state, presentation.text);
  dom.newHabitButton.disabled = state.storageLocked;
}

function persist(successMessage = "") {
  if (state.storageLocked) {
    showToast(dom.toast, "Data lokal terkunci. Reset data melalui banner penyimpanan.", "error");
    dom.storage.root.scrollIntoView({ behavior: "smooth", block: "center" });
    return false;
  }

  const result = saveData({ habits: state.habits, checkins: state.checkins });
  if (!result.ok) {
    state.saveStatus = "error";
    setSaveError(result.message);
    renderPersistenceState();
    showToast(dom.toast, result.message, "error");
    return false;
  }

  state.saveStatus = "saved";
  state.saveError = "";
  state.storageStatus = "ready";
  state.storageRaw = "";
  showNotice(null);
  renderPersistenceState();
  if (successMessage) showToast(dom.toast, successMessage);
  return true;
}

function renderAll() {
  state.today = todayKey();
  const active = getActiveHabits(state.habits);
  const summary = getTodaySummary(state.habits, state.checkins, state.today);
  const week = getSevenDayActivity(state.habits, state.checkins, state.today);
  const overall = getOverallStats(state.habits, state.checkins, state.today);
  const streaks = new Map(
    state.habits.map((habit) => [
      habit.id,
      getStreaks(habit, state.checkins, state.today),
    ]),
  );
  const metrics = new Map(
    state.habits.map((habit) => [
      habit.id,
      getHabitProgress(habit, state.checkins, state.today),
    ]),
  );
  const filtered = filterHabits(state.habits, state.filters);
  const checkedToday = new Set(
    active
      .filter((habit) => isCheckedIn(state.checkins, habit.id, state.today))
      .map((habit) => habit.id),
  );
  const scheduledToday = new Set(
    active
      .filter((habit) => isScheduledOn(habit, state.today))
      .map((habit) => habit.id),
  );
  const monthDays = getMonthDays(
    state.habits,
    state.checkins,
    state.calendar.year,
    state.calendar.monthIndex,
    state.today,
  );
  const selectedDetails = getDayDetails(
    state.habits,
    state.checkins,
    state.calendar.selectedDate,
    state.today,
  );

  renderDashboard(dom.dashboard, {
    greeting: getGreeting(),
    todayLabel: formatLongDate(state.today),
    summary,
    week,
    streaks,
    today: state.today,
  });

  renderHabits(dom.habits, {
    filters: state.filters,
    hasFilters: hasHabitFilters(state.filters),
    allHabits: state.habits,
    filtered,
    metrics,
    checkedToday,
    scheduledToday,
    today: state.today,
  });

  renderCalendar(dom.calendar, {
    monthLabel: formatMonthYear(state.calendar.year, state.calendar.monthIndex),
    days: monthDays,
    selectedDate: state.calendar.selectedDate,
    selectedDetails,
  });

  renderStats(dom.stats, {
    overall,
    week,
  });

  renderPersistenceState();
}

function ensureWritable() {
  if (state.storageLocked) {
    showToast(dom.toast, "Data lokal terkunci. Reset data melalui banner penyimpanan.", "error");
    dom.storage.root.scrollIntoView({ behavior: "smooth", block: "center" });
    return false;
  }
  return true;
}

function openHabitDialog(habit = null, trigger = null) {
  if (!ensureWritable()) return;
  closeAllMenus();
  state.editingId = habit?.id || null;
  state.dialogTrigger = resolveReturnFocus(trigger, habit?.id);
  state.restoreDialogFocus = true;
  populateHabitForm(dom.form, habit);
  document.body.classList.add("dialog-open");
  if (!dom.form.dialog.open) dom.form.dialog.showModal();
  requestAnimationFrame(() => dom.form.name.focus());
}

function closeHabitDialog({ restoreFocus = true } = {}) {
  state.restoreDialogFocus = restoreFocus;
  if (dom.form.dialog.open) dom.form.dialog.close();
}

function handleHabitDialogClosed() {
  document.body.classList.remove("dialog-open");
  const trigger = state.dialogTrigger;
  const shouldRestore = state.restoreDialogFocus;
  state.dialogTrigger = null;
  state.editingId = null;
  state.restoreDialogFocus = true;
  if (shouldRestore) {
    if (!focusConnected(trigger)) focusConnected(dom.newHabitButton);
  }
}

function handleHabitSubmit(event) {
  event.preventDefault();
  if (!ensureWritable()) return;

  const editingId = state.editingId;
  const input = readHabitForm(dom.form);
  const result = editingId
    ? updateHabit(state.habits, editingId, input, new Date())
    : addHabit(state.habits, input, new Date());

  if (Object.keys(result.errors).length) {
    showFormErrors(dom.form, result.errors);
    return;
  }

  state.habits = result.habits;
  const savedHabit = result.habit;
  const wasEditing = Boolean(editingId);
  const previousView = state.view;

  closeHabitDialog({ restoreFocus: false });
  const saved = persist(
    wasEditing
      ? `${savedHabit.name} berhasil diperbarui.`
      : `${savedHabit.name} ditambahkan ke ritme kamu.`,
  );

  renderAll();
  if (
    !wasEditing &&
    (previousView === "calendar" ||
      previousView === "stats" ||
      (previousView === "dashboard" && !isScheduledOn(savedHabit, state.today)))
  ) {
    setView("habits");
  }
  if (saved) {
    if (wasEditing) focusHabitAction(savedHabit.id, "edit-habit");
    else focusHabitAction(savedHabit.id, "toggle-checkin");
  } else {
    focusConnected(dom.newHabitButton);
  }
}

function handleArchive(habitId) {
  if (!ensureWritable()) return;
  const result = archiveHabit(state.habits, habitId, todayKey(), new Date());
  if (!result.changed) return;
  state.habits = result.habits;
  persist(`${result.habit.name} diarsipkan. Riwayatnya tetap tersimpan.`);
  renderAll();
  focusHabitAction(habitId, "restore-habit");
}

function handleRestore(habitId) {
  if (!ensureWritable()) return;
  const result = reactivateHabit(state.habits, habitId, new Date());
  if (!result.changed) return;
  state.habits = result.habits;
  persist(`${result.habit.name} aktif kembali.`);
  renderAll();
  focusHabitAction(habitId, "edit-habit");
}

function openConfirm(config, trigger = null) {
  state.confirmTrigger = resolveReturnFocus(trigger);
  state.confirmAction = config.onConfirm;
  configureConfirmDialog(dom.confirm, config);
  document.body.classList.add("dialog-open");
  if (!dom.confirm.dialog.open) dom.confirm.dialog.showModal();
}

function closeConfirm() {
  if (dom.confirm.dialog.open) dom.confirm.dialog.close();
}

function handleConfirmClosed() {
  document.body.classList.remove("dialog-open");
  const trigger = state.confirmTrigger;
  state.confirmTrigger = null;
  state.confirmAction = null;
  if (!focusConnected(trigger)) focusConnected(dom.newHabitButton);
}

function handleConfirmAction() {
  const action = state.confirmAction;
  const trigger = state.confirmTrigger;
  closeConfirm();
  if (action) action();
}

function requestDelete(habitId, trigger) {
  const habit = getHabitById(state.habits, habitId);
  if (!habit) return;
  openConfirm(
    {
      eyebrow: "Hapus permanen",
      title: "Hapus kebiasaan?",
      message: `“${habit.name}” beserta seluruh riwayat check-in-nya akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.`,
      actionLabel: "Hapus kebiasaan",
      danger: true,
      icon: "trash",
      onConfirm: () => {
        state.habits = deleteHabit(state.habits, habitId);
        state.checkins = removeHabitCheckins(state.checkins, habitId);
        persist(`${habit.name} dihapus.`);
        renderAll();
        focusConnected(dom.newHabitButton);
      },
    },
    trigger,
  );
}

function requestResetStorage(trigger) {
  openConfirm(
    {
      eyebrow: "Pemulihan penyimpanan",
      title: "Reset data lokal?",
      message:
        "Data lokal yang rusak akan diganti dengan ruang kosong. Unduh data mentah terlebih dahulu jika kamu masih membutuhkannya. Tindakan ini tidak dapat dibatalkan.",
      actionLabel: "Reset data",
      danger: true,
      icon: "alert",
      onConfirm: () => {
        const result = saveData({ habits: [], checkins: {} });
        if (!result.ok) {
          state.saveError = result.message;
          showNotice({
            message: `${result.message} Data lama tetap tidak diubah. Kamu bisa mencoba reset lagi.`,
            canDownload: Boolean(state.storageRaw),
            canReset: true,
          });
          renderPersistenceState();
          showToast(dom.toast, result.message, "error");
          return;
        }
        state.habits = [];
        state.checkins = {};
        state.storageLocked = false;
        state.storageStatus = "ready";
        state.saveStatus = "saved";
        state.storageRaw = "";
        state.saveError = "";
        showNotice(null);
        renderAll();
        showToast(dom.toast, "Data lokal berhasil direset.");
        focusConnected(dom.newHabitButton);
      },
    },
    trigger,
  );
}

function handleToggleCheckin(habitId, dateKey) {
  if (!ensureWritable()) return;
  const habit = getHabitById(state.habits, habitId);
  if (!habit) return;
  if (!canCheckIn(habit, dateKey, state.today)) {
    const message =
      compareDateKeys(dateKey, state.today) > 0
        ? "Check-in untuk tanggal yang belum terjadi tidak tersedia."
        : "Kebiasaan ini tidak dijadwalkan pada tanggal tersebut.";
    showToast(dom.toast, message, "error");
    return;
  }

  const result = toggleCheckin(state.checkins, habitId, dateKey);
  state.checkins = result.checkins;
  const dateLabel =
    dateKey === state.today ? "hari ini" : formatDate(dateKey);
  persist(
    result.checked
      ? `Check-in ${habit.name} untuk ${dateLabel} tercatat.`
      : `Check-in ${habit.name} untuk ${dateLabel} dibatalkan.`,
  );
  renderAll();
  focusCheckButton(habitId, dateKey);
}

function navigateTo(view) {
  if (state.view === view) {
    if (window.location.hash !== `#${view}`) window.location.hash = view;
    return;
  }
  setView(view);
}

function selectCalendarDate(dateKey, { focus = true } = {}) {
  if (!dateKey) return;
  state.calendar.selectedDate = dateKey;
  const date = parseDateKey(dateKey);
  state.calendar.year = date.getFullYear();
  state.calendar.monthIndex = date.getMonth();
  renderAll();
  if (focus) focusSelectedCalendarDay();
}

function changeCalendarMonth(delta) {
  const next = shiftMonth(state.calendar.year, state.calendar.monthIndex, delta);
  const currentDay = parseDateKey(state.calendar.selectedDate).getDate();
  const nextDay = Math.min(currentDay, daysInMonth(next.year, next.monthIndex));
  state.calendar.year = next.year;
  state.calendar.monthIndex = next.monthIndex;
  state.calendar.selectedDate = `${next.year}-${String(next.monthIndex + 1).padStart(
    2,
    "0",
  )}-${String(nextDay).padStart(2, "0")}`;
  renderAll();
}

function changeCalendarToToday() {
  state.today = todayKey();
  state.calendar.selectedDate = state.today;
  const date = parseDateKey(state.today);
  state.calendar.year = date.getFullYear();
  state.calendar.monthIndex = date.getMonth();
  renderAll();
  focusSelectedCalendarDay();
}

function handleCalendarGridKeydown(event) {
  const dayButton = event.target.closest(".calendar-day");
  if (!dayButton) return;
  const offsets = {
    ArrowLeft: -1,
    ArrowRight: 1,
    ArrowUp: -7,
    ArrowDown: 7,
  };
  const offset = offsets[event.key];
  if (!offset) return;
  event.preventDefault();
  selectCalendarDate(addDays(dayButton.dataset.date, offset));
}

function resetFilters() {
  state.filters = { query: "", category: "all", status: "active" };
  renderAll();
  dom.habits.search.focus();
}

function handleClick(event) {
  if (!event.target.closest(".card-menu")) closeAllMenus();
  const trigger = event.target.closest("[data-action]");
  if (!trigger) return;

  const action = trigger.dataset.action;
  const habitId = trigger.dataset.habitId;

  switch (action) {
    case "new-habit":
      event.preventDefault();
      openHabitDialog(null, trigger);
      break;
    case "edit-habit": {
      const habit = getHabitById(state.habits, habitId);
      if (habit) {
        event.preventDefault();
        openHabitDialog(habit, trigger);
      }
      break;
    }
    case "archive-habit":
      closeAllMenus();
      handleArchive(habitId);
      break;
    case "restore-habit":
      closeAllMenus();
      handleRestore(habitId);
      break;
    case "delete-habit":
      closeAllMenus();
      requestDelete(habitId, trigger);
      break;
    case "toggle-checkin":
      handleToggleCheckin(habitId, trigger.dataset.date);
      break;
    case "select-date":
      selectCalendarDate(trigger.dataset.date);
      break;
    case "go-stats":
      navigateTo("stats");
      break;
    default:
      break;
  }
}

function downloadRawData() {
  if (!state.storageRaw) {
    showToast(dom.toast, "Tidak ada data mentah untuk diunduh.", "error");
    return;
  }
  const blob = new Blob([state.storageRaw], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `ritme-data-${todayKey()}.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  showToast(dom.toast, "Data mentah diunduh.");
}

function attachEvents() {
  dom.newHabitButton.addEventListener("click", () => openHabitDialog(null, dom.newHabitButton));

  document.addEventListener("click", handleClick);

  dom.habits.search.addEventListener("input", (event) => {
    state.filters.query = event.target.value;
    renderAll();
  });
  dom.habits.category.addEventListener("change", (event) => {
    state.filters.category = event.target.value;
    renderAll();
  });
  for (const button of dom.habits.statusButtons) {
    button.addEventListener("click", () => {
      state.filters.status = button.dataset.statusFilter;
      renderAll();
    });
  }
  dom.habits.clearSearch.addEventListener("click", () => {
    state.filters.query = "";
    renderAll();
    dom.habits.search.focus();
  });
  dom.habits.clearFilters.addEventListener("click", resetFilters);
  dom.habits.emptyClear.addEventListener("click", resetFilters);

  dom.calendar.prev.addEventListener("click", () => changeCalendarMonth(-1));
  dom.calendar.next.addEventListener("click", () => changeCalendarMonth(1));
  dom.calendar.today.addEventListener("click", changeCalendarToToday);
  dom.calendar.grid.addEventListener("keydown", handleCalendarGridKeydown);

  dom.form.form.addEventListener("submit", handleHabitSubmit);
  dom.form.form.addEventListener("change", (event) => {
    if (event.target.name === "frequency") syncFrequencyFields(dom.form);
  });
  for (const closeButton of dom.form.dialog.querySelectorAll("[data-dialog-close]")) {
    closeButton.addEventListener("click", () => closeHabitDialog());
  }
  dom.form.dialog.addEventListener("close", handleHabitDialogClosed);
  dom.form.dialog.addEventListener("cancel", () => {
    state.restoreDialogFocus = true;
  });

  dom.confirm.cancel.addEventListener("click", closeConfirm);
  dom.confirm.action.addEventListener("click", handleConfirmAction);
  dom.confirm.dialog.addEventListener("close", handleConfirmClosed);

  dom.storage.download.addEventListener("click", downloadRawData);
  dom.storage.reset.addEventListener("click", (event) =>
    requestResetStorage(event.currentTarget),
  );

  dom.toast.close.addEventListener("click", () => hideToast(dom.toast));

  window.addEventListener("hashchange", () => {
    setView(getViewFromHash(), { updateHash: false });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeAllMenus();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    const current = todayKey();
    if (current === state.today) return;
    const wasSelectedToday = state.calendar.selectedDate === state.today;
    state.today = current;
    if (wasSelectedToday) {
      state.calendar.selectedDate = current;
      const date = parseDateKey(current);
      state.calendar.year = date.getFullYear();
      state.calendar.monthIndex = date.getMonth();
    }
    renderAll();
  });
}

function initialize() {
  applyLoadResult(loadData());
  const initialView = getViewFromHash();
  if (!window.location.hash || !VALID_VIEWS.has(window.location.hash.slice(1))) {
    window.history.replaceState(null, "", "#dashboard");
  }
  setView(initialView, { updateHash: false, scroll: false });
  renderAll();
  attachEvents();
}

initialize();
