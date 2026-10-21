import {
  currentMonthKey,
  formatMonth,
  isValidMonthKey,
  monthKeyOf,
  shiftMonth,
  todayKey,
} from "./dates.js";
import {
  DEFAULT_FILTERS,
  createTransaction,
  filterTransactions,
  getTransactionById,
  getTransactionMonths,
  hasActiveFilters,
  updateTransaction,
} from "./transactions.js";
import {
  createBudget,
  getBudgetById,
  updateBudget,
} from "./budgets.js";
import { getCategoryById } from "./categories.js";
import { formatAmountForInput, formatCurrency, parseAmount } from "./money.js";
import { buildCsv, createCsvFilename } from "./csv.js";
import {
  createEmptyData,
  loadData,
  resetStoredData,
  saveData,
} from "./storage.js";
import {
  clearFormErrors,
  focusBudgetForm,
  focusFirstError,
  focusTransactionForm,
  getBudgetFormValues,
  getTransactionFormValues,
  hideStorageNotice,
  hideToast,
  renderBudgetFormOptions,
  renderBudgetsView,
  renderDashboard,
  renderSaveState,
  renderSortOptions,
  renderTransactionFilterOptions,
  renderTransactionsView,
  setBudgetDialogTitle,
  setBudgetFormCategory,
  setBudgetLimitField,
  setBudgetMonthField,
  setConfirmContent,
  setDialogTitle,
  setMonthControls,
  setTransactionDateField,
  setTransactionDescriptionField,
  setTransactionType,
  showFormErrors,
  showStorageNotice,
  showToast,
  syncTransactionFilterFields,
  updateDescriptionCount,
  updateTransactionTypeCategories,
} from "./ui.js";

const byId = (id) => document.getElementById(id);
const VALID_VIEWS = new Set(["dashboard", "transactions", "budgets"]);

const dom = {
  saveState: byId("save-state"),
  saveStateText: byId("save-state-text"),
  newTransactionButton: byId("new-transaction-button"),
  transactionsPageAdd: byId("transactions-page-add"),
  dashboardEmptyAdd: byId("dashboard-empty-add"),
  transactionsEmptyAdd: byId("transactions-empty-add"),
  newBudgetButton: byId("new-budget-button"),
  budgetEmptyAdd: byId("budget-empty-add"),

  storageBanner: byId("storage-banner"),
  storageBannerTitle: byId("storage-banner-title"),
  storageBannerMessage: byId("storage-banner-message"),
  downloadRawButton: byId("download-raw-button"),
  resetStorageButton: byId("reset-storage-button"),

  dashboardMonth: byId("dashboard-month"),
  dashboardPrevMonth: byId("dashboard-prev-month"),
  dashboardNextMonth: byId("dashboard-next-month"),
  dashboardCurrentMonth: byId("dashboard-current-month"),
  dashboardPeriodCopy: byId("dashboard-period-copy"),
  summaryIncome: byId("summary-income"),
  summaryExpense: byId("summary-expense"),
  summaryNet: byId("summary-net"),
  summaryCount: byId("summary-count"),
  summaryIncomeComparison: byId("summary-income-comparison"),
  summaryExpenseComparison: byId("summary-expense-comparison"),
  summaryNetComparison: byId("summary-net-comparison"),
  summaryCountComparison: byId("summary-count-comparison"),
  cumulativeNet: byId("cumulative-net"),
  cumulativeMeta: byId("cumulative-meta"),
  dashboardEmpty: byId("dashboard-empty"),
  dashboardEmptyCopy: byId("dashboard-empty-copy"),
  trendChart: byId("trend-chart"),
  categoryChart: byId("category-chart"),
  categoryChartPeriod: byId("category-chart-period"),
  recentTransactions: byId("recent-transactions"),
  budgetSnapshot: byId("budget-snapshot"),

  transactionFilters: byId("transaction-filters"),
  filterSearch: byId("filter-search"),
  filterType: byId("filter-type"),
  filterCategory: byId("filter-category"),
  filterMonth: byId("filter-month"),
  filterFrom: byId("filter-from"),
  filterTo: byId("filter-to"),
  filterSort: byId("filter-sort"),
  resetFilters: byId("reset-filters"),
  filterActiveLabel: byId("filter-active-label"),
  transactionFilterSummary: byId("transaction-filter-summary"),
  exportCsv: byId("export-csv"),
  exportCount: byId("export-count"),
  filteredTotals: byId("filtered-totals"),
  transactionsTableWrap: byId("transactions-table-wrap"),
  transactionsBody: byId("transactions-body"),
  transactionsEmpty: byId("transactions-empty"),
  transactionsEmptyTitle: byId("transactions-empty-title"),
  transactionsEmptyCopy: byId("transactions-empty-copy"),
  transactionsEmptyReset: byId("transactions-empty-reset"),

  budgetMonth: byId("budget-month"),
  budgetPrevMonth: byId("budget-prev-month"),
  budgetNextMonth: byId("budget-next-month"),
  budgetCurrentMonth: byId("budget-current-month"),
  budgetLimitValue: byId("budget-limit-value"),
  budgetUsedValue: byId("budget-used-value"),
  budgetRemainingValue: byId("budget-remaining-value"),
  budgetSummaryCopy: byId("budget-summary-copy"),
  budgetPeriodCopy: byId("budget-period-copy"),
  budgetEmpty: byId("budget-empty"),
  budgetGrid: byId("budget-grid"),

  transactionDialog: byId("transaction-dialog"),
  transactionForm: byId("transaction-form"),
  transactionDialogTitle: byId("transaction-dialog-title"),
  transactionAmount: byId("tx-amount"),
  transactionCategory: byId("tx-category"),
  transactionDate: byId("tx-date"),
  transactionDescription: byId("tx-description"),
  transactionDescriptionCount: byId("tx-description-count"),
  transactionSubmit: byId("transaction-submit"),

  budgetDialog: byId("budget-dialog"),
  budgetForm: byId("budget-form"),
  budgetDialogTitle: byId("budget-dialog-title"),
  budgetCategory: byId("budget-category"),
  budgetFormMonth: byId("budget-form-month"),
  budgetLimit: byId("budget-limit"),
  budgetSubmit: byId("budget-submit"),

  confirmDialog: byId("confirm-dialog"),
  confirmTitle: byId("confirm-title"),
  confirmMessage: byId("confirm-message"),
  confirmSubmit: byId("confirm-submit"),
  confirmCancel: byId("confirm-cancel"),
  confirmSymbolUse: byId("confirm-symbol")?.querySelector("use"),

  toast: byId("toast"),
  toastClose: byId("toast-close"),
};

const state = {
  data: createEmptyData(),
  reportMonth: currentMonthKey(),
  filters: { ...DEFAULT_FILTERS },
  storage: null,
  storageStatus: "loading",
  storageLocked: false,
  rawData: "",
  backupSaved: false,
  editingTransactionId: null,
  editingBudgetId: null,
  transactionTrigger: null,
  budgetTrigger: null,
  confirmAction: null,
  confirmTrigger: null,
};

function isVisible(element) {
  return Boolean(
    element &&
      element.isConnected &&
      !element.closest("[hidden]") &&
      !element.disabled &&
      element.getClientRects().length,
  );
}

function focusFallback(dialogId) {
  const target =
    dialogId === "budget-dialog" ? dom.newBudgetButton : dom.newTransactionButton;
  target?.focus();
}

function setView(view) {
  const active = VALID_VIEWS.has(view) ? view : "dashboard";
  for (const section of document.querySelectorAll(".view")) {
    section.hidden = section.id !== `view-${active}`;
  }
  for (const link of document.querySelectorAll("[data-view]")) {
    const isActive = link.dataset.view === active;
    if (isActive) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
}

function applyRoute() {
  const route = window.location.hash.replace(/^#/, "").split("?")[0];
  setView(route);
}

function navigate(view) {
  if (!VALID_VIEWS.has(view)) return;
  if (window.location.hash !== `#${view}`) {
    window.history.pushState(null, "", `#${view}`);
  }
  setView(view);
  window.scrollTo({ top: 0, behavior: "auto" });
}

function normalizeFiltersForData() {
  if (state.filters.month === "all") return;
  const months = getTransactionMonths(state.data.transactions);
  if (!months.includes(state.filters.month)) {
    state.filters = { ...state.filters, month: "all" };
  }
}

function filteredTransactions() {
  return filterTransactions(state.data.transactions, state.filters);
}

function renderAll() {
  if (!isValidMonthKey(state.reportMonth)) state.reportMonth = currentMonthKey();
  normalizeFiltersForData();

  setMonthControls(dom, state.reportMonth);
  renderDashboard(dom, { data: state.data, month: state.reportMonth });

  renderTransactionFilterOptions(dom, state.data.transactions, state.filters);
  syncTransactionFilterFields(dom, state.filters);
  const filtered = filteredTransactions();
  renderTransactionsView(dom, {
    transactions: filtered,
    totalCount: state.data.transactions.length,
    filters: state.filters,
    hasFilters: hasActiveFilters(state.filters),
  });

  renderBudgetsView(dom, { data: state.data, month: state.reportMonth });
}

function renderTransactionsOnly() {
  const filtered = filteredTransactions();
  renderTransactionsView(dom, {
    transactions: filtered,
    totalCount: state.data.transactions.length,
    filters: state.filters,
    hasFilters: hasActiveFilters(state.filters),
  });
}

function storageFailureNotice(message) {
  showStorageNotice(dom, {
    title: "Perubahan belum tersimpan",
    message,
    rawAvailable: Boolean(state.rawData),
    resetAvailable: state.storageLocked,
  });
  renderSaveState(dom, "error", "Belum tersimpan");
}

function persistChanges() {
  if (state.storageLocked) return false;
  const result = saveData(state.data, state.storage ?? null);
  if (result.ok) {
    state.storageStatus = "ready";
    state.rawData = "";
    state.backupSaved = false;
    renderSaveState(dom, "saved", "Tersimpan");
    hideStorageNotice(dom);
    return true;
  }
  state.storageStatus = "error";
  storageFailureNotice(result.message);
  return false;
}

function ensureWritable() {
  if (!state.storageLocked) return true;
  showToast(
    "Data lokal perlu direset sebelum perubahan baru dapat disimpan. Unduh data mentah terlebih dahulu bila diperlukan.",
    "error",
  );
  showStorageNotice(dom, {
    title: "Data lokal sedang dikunci",
    message:
      "Aplikasi tidak menimpa data yang rusak secara diam-diam. Unduh data mentah lalu reset data untuk mulai kembali.",
    rawAvailable: Boolean(state.rawData),
    resetAvailable: true,
  });
  return false;
}

function closeDialog(dialog) {
  if (dialog?.open) dialog.close();
}

function setConfirmSymbol(iconName) {
  if (dom.confirmSymbolUse) dom.confirmSymbolUse.setAttribute("href", `#icon-${iconName}`);
}

function openConfirm({
  title,
  message,
  confirmLabel,
  tone = "danger",
  icon = "trash",
  action,
  trigger = document.activeElement,
}) {
  state.confirmAction = action;
  state.confirmTrigger = trigger instanceof HTMLElement ? trigger : null;
  setConfirmContent(dom, { title, message, confirmLabel, tone });
  setConfirmSymbol(icon);
  if (!dom.confirmDialog.open) dom.confirmDialog.showModal();
  dom.confirmCancel.focus();
}

function openTransactionDialog(transaction = null, trigger = null) {
  if (!ensureWritable()) return;
  state.editingTransactionId = transaction?.id || null;
  state.transactionTrigger =
    trigger instanceof HTMLElement ? trigger : document.activeElement;

  dom.transactionForm.reset();
  clearFormErrors(dom.transactionForm);
  setDialogTitle(dom, transaction ? "Ubah transaksi" : "Tambah transaksi");
  dom.transactionSubmit.textContent = transaction ? "Simpan perubahan" : "Simpan transaksi";

  const type = transaction?.type || "expense";
  setTransactionType(dom, type);
  updateTransactionTypeCategories(dom, type, transaction?.categoryId || "");
  setTransactionDateField(dom, transaction?.date || todayKey());
  setAmountFieldValue(dom, transaction ? formatAmountForInput(transaction.amount) : "");
  setTransactionDescriptionField(dom, transaction?.description || "");
  updateDescriptionCount(dom.transactionDescription, dom.transactionDescriptionCount);

  dom.transactionDialog.showModal();
  focusTransactionForm(dom);
  if (transaction) dom.transactionAmount.select?.();
}

function setAmountFieldValue(domRefs, value) {
  if (domRefs.transactionAmount) domRefs.transactionAmount.value = value;
}

function openBudgetDialog(budget = null, { categoryId = "", trigger = null } = {}) {
  if (!ensureWritable()) return;
  state.editingBudgetId = budget?.id || null;
  state.budgetTrigger = trigger instanceof HTMLElement ? trigger : document.activeElement;

  dom.budgetForm.reset();
  clearFormErrors(dom.budgetForm);
  setBudgetDialogTitle(dom, budget ? "Ubah anggaran" : "Buat anggaran");
  dom.budgetSubmit.textContent = budget ? "Simpan perubahan" : "Simpan anggaran";
  renderBudgetFormOptions(dom.budgetCategory, budget?.categoryId || categoryId);
  setBudgetFormCategory(dom, budget?.categoryId || categoryId, { disabled: false });
  setBudgetMonthField(dom, budget?.month || state.reportMonth);
  setBudgetLimitField(dom, budget ? formatAmountForInput(budget.limit) : "");

  dom.budgetDialog.showModal();
  focusBudgetForm(dom);
  if (budget) dom.budgetLimit.select?.();
}

function requestDeleteTransaction(transaction, trigger) {
  if (!ensureWritable()) return;
  openConfirm({
    title: "Hapus transaksi?",
    message: `Transaksi “${transaction.description || getCategoryById(transaction.categoryId)?.name || "Tanpa deskripsi"}” sebesar ${formatCurrency(transaction.amount)} akan dihapus permanen. Ringkasan, grafik, dan anggaran akan dihitung ulang.`,
    confirmLabel: "Hapus transaksi",
    icon: "trash",
    trigger,
    action: () => {
      state.data.transactions = state.data.transactions.filter(
        (item) => item.id !== transaction.id,
      );
      const saved = persistChanges();
      renderAll();
      showToast(
        saved
          ? "Transaksi dihapus."
          : "Transaksi dihapus dari memori, tetapi perubahan gagal disimpan.",
        saved ? "success" : "error",
      );
    },
  });
}

function requestDeleteBudget(budget, trigger) {
  if (!ensureWritable()) return;
  openConfirm({
    title: "Hapus anggaran?",
    message: `Anggaran ${getCategoryById(budget.categoryId)?.name || "kategori"} untuk ${formatMonth(budget.month)} akan dihapus. Transaksi dan saldo tidak ikut dihapus.`,
    confirmLabel: "Hapus anggaran",
    icon: "trash",
    trigger,
    action: () => {
      state.data.budgets = state.data.budgets.filter((item) => item.id !== budget.id);
      const saved = persistChanges();
      renderAll();
      showToast(
        saved
          ? "Anggaran dihapus."
          : "Anggaran dihapus dari memori, tetapi perubahan gagal disimpan.",
        saved ? "success" : "error",
      );
    },
  });
}

function requestResetStorage(trigger) {
  openConfirm({
    title: "Reset data lokal?",
    message:
      "Seluruh transaksi dan anggaran lokal akan dihapus dari browser ini. Tindakan ini tidak dapat dibatalkan. Unduh data mentah terlebih dahulu jika masih diperlukan.",
    confirmLabel: "Reset data",
    icon: "alert",
    trigger,
    action: () => {
      const result = resetStoredData(state.storage ?? null);
      if (!result.ok) {
        showToast(result.message, "error");
        storageFailureNotice(result.message);
        return;
      }
      state.data = createEmptyData();
      state.storageLocked = false;
      state.storageStatus = "empty";
      state.rawData = "";
      state.backupSaved = false;
      state.filters = { ...DEFAULT_FILTERS };
      hideStorageNotice(dom);
      renderSaveState(dom, "ready", "Siap menyimpan");
      renderAll();
      showToast("Data lokal berhasil direset.", "success");
    },
  });
}

function downloadRawData() {
  if (!state.rawData) {
    showToast("Tidak ada salinan data mentah yang dapat diunduh.", "error");
    return;
  }
  const blob = new Blob([state.rawData], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `neraca-data-mentah-${todayKey()}.json`;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast("Salinan data mentah diunduh.");
}

function exportCsv() {
  const filtered = filteredTransactions();
  if (!filtered.length) {
    showToast("Tidak ada transaksi sesuai filter untuk diekspor.", "error");
    return;
  }
  const csv = buildCsv(filtered);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = createCsvFilename(state.filters);
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast(`${filtered.length} transaksi diekspor ke CSV.`);
}

function setReportMonth(month) {
  if (!isValidMonthKey(month)) {
    setMonthControls(dom, state.reportMonth);
    return;
  }
  state.reportMonth = month;
  renderAll();
}

function updateFiltersFromInput(target) {
  const name = target.name;
  if (!name || !(name in state.filters)) return;
  state.filters = { ...state.filters, [name]: target.value };
  renderTransactionsOnly();
}

function initializeStorage() {
  const result = loadData();
  state.data = result.data;
  state.storage = result.storage;
  state.storageStatus = result.status;
  state.rawData = result.raw || "";
  state.backupSaved = result.backupSaved;
  state.storageLocked = result.status === "corrupt";

  if (result.status === "corrupt") {
    renderSaveState(dom, "error", "Perlu pemulihan");
    showStorageNotice(dom, {
      title: "Data lokal tidak dapat dibuka",
      message: `${result.message} Aplikasi tidak akan menimpa data ini sampai kamu melakukan reset.`,
      rawAvailable: Boolean(state.rawData),
      resetAvailable: true,
    });
    return;
  }

  if (result.status === "partial") {
    renderSaveState(dom, "warning", "Data parsial");
    showStorageNotice(dom, {
      title: "Sebagian data lokal dilewati",
      message: result.message,
      rawAvailable: Boolean(state.rawData),
      resetAvailable: false,
    });
    return;
  }

  if (result.status === "unavailable") {
    renderSaveState(dom, "error", "Tidak tersedia");
    showStorageNotice(dom, {
      title: "Penyimpanan browser tidak tersedia",
      message: result.message,
      rawAvailable: false,
      resetAvailable: false,
    });
    return;
  }

  if (result.status === "empty") {
    renderSaveState(dom, "ready", "Siap menyimpan");
    return;
  }

  renderSaveState(dom, "saved", "Tersimpan");
}

function bindEvents() {
  window.addEventListener("hashchange", applyRoute);
  window.addEventListener("popstate", applyRoute);

  dom.newTransactionButton.addEventListener("click", (event) => {
    openTransactionDialog(null, event.currentTarget);
  });
  dom.transactionsPageAdd.addEventListener("click", (event) => {
    openTransactionDialog(null, event.currentTarget);
  });
  dom.dashboardEmptyAdd.addEventListener("click", (event) => {
    openTransactionDialog(null, event.currentTarget);
  });
  dom.transactionsEmptyAdd.addEventListener("click", (event) => {
    openTransactionDialog(null, event.currentTarget);
  });
  dom.newBudgetButton.addEventListener("click", (event) => {
    openBudgetDialog(null, { trigger: event.currentTarget });
  });
  dom.budgetEmptyAdd.addEventListener("click", (event) => {
    openBudgetDialog(null, { trigger: event.currentTarget });
  });

  for (const [button, delta] of [
    [dom.dashboardPrevMonth, -1],
    [dom.dashboardNextMonth, 1],
    [dom.budgetPrevMonth, -1],
    [dom.budgetNextMonth, 1],
  ]) {
    button.addEventListener("click", () => {
      setReportMonth(shiftMonth(state.reportMonth, delta));
    });
  }
  dom.dashboardCurrentMonth.addEventListener("click", () => setReportMonth(currentMonthKey()));
  dom.budgetCurrentMonth.addEventListener("click", () => setReportMonth(currentMonthKey()));
  dom.dashboardMonth.addEventListener("change", () => setReportMonth(dom.dashboardMonth.value));
  dom.budgetMonth.addEventListener("change", () => setReportMonth(dom.budgetMonth.value));

  dom.transactionFilters.addEventListener("submit", (event) => event.preventDefault());
  dom.transactionFilters.addEventListener("input", (event) => {
    updateFiltersFromInput(event.target);
  });
  dom.transactionFilters.addEventListener("change", (event) => {
    updateFiltersFromInput(event.target);
  });
  dom.resetFilters.addEventListener("click", () => {
    state.filters = { ...DEFAULT_FILTERS };
    renderAll();
  });
  dom.transactionsEmptyReset.addEventListener("click", () => {
    state.filters = { ...DEFAULT_FILTERS };
    renderAll();
  });
  dom.exportCsv.addEventListener("click", exportCsv);

  dom.downloadRawButton.addEventListener("click", downloadRawData);
  dom.resetStorageButton.addEventListener("click", (event) => {
    requestResetStorage(event.currentTarget);
  });

  document.addEventListener("click", (event) => {
    const actionTarget = event.target.closest("[data-action]");
    if (!actionTarget) return;
    const action = actionTarget.dataset.action;
    const id = actionTarget.dataset.id;

    if (action === "new-budget") {
      openBudgetDialog(null, {
        categoryId: actionTarget.dataset.category || "",
        trigger: actionTarget,
      });
      return;
    }
    if (action === "edit-budget") {
      const budget = getBudgetById(state.data.budgets, id);
      if (!budget) {
        showToast("Anggaran tidak ditemukan.", "error");
        return;
      }
      openBudgetDialog(budget, { trigger: actionTarget });
      return;
    }
    if (action === "delete-budget") {
      const budget = getBudgetById(state.data.budgets, id);
      if (!budget) {
        showToast("Anggaran tidak ditemukan.", "error");
        return;
      }
      requestDeleteBudget(budget, actionTarget);
      return;
    }
    if (action === "edit-transaction") {
      const transaction = getTransactionById(state.data.transactions, id);
      if (!transaction) {
        showToast("Transaksi tidak ditemukan.", "error");
        return;
      }
      openTransactionDialog(transaction, actionTarget);
      return;
    }
    if (action === "delete-transaction") {
      const transaction = getTransactionById(state.data.transactions, id);
      if (!transaction) {
        showToast("Transaksi tidak ditemukan.", "error");
        return;
      }
      requestDeleteTransaction(transaction, actionTarget);
    }
  });

  for (const field of [dom.transactionAmount, dom.budgetLimit]) {
    field.addEventListener("blur", () => {
      const parsed = parseAmount(field.value);
      if (parsed.ok) field.value = formatAmountForInput(parsed.value);
    });
  }

  dom.transactionForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const values = getTransactionFormValues(dom);
    const existing = state.editingTransactionId
      ? getTransactionById(state.data.transactions, state.editingTransactionId)
      : null;
    const result = existing
      ? updateTransaction(existing, values)
      : createTransaction(values);

    if (!result.ok) {
      showFormErrors(dom.transactionForm, result.errors);
      focusFirstError(dom.transactionForm, result.errors);
      return;
    }

    if (existing) {
      state.data.transactions = state.data.transactions.map((transaction) =>
        transaction.id === existing.id ? result.transaction : transaction,
      );
    } else {
      state.data.transactions = [...state.data.transactions, result.transaction];
    }

    const saved = persistChanges();
    const wasEditing = Boolean(existing);
    closeDialog(dom.transactionDialog);
    state.editingTransactionId = null;
    state.reportMonth = monthKeyOf(result.transaction.date) || state.reportMonth;
    renderAll();
    showToast(
      saved
        ? wasEditing
          ? "Perubahan transaksi disimpan."
          : "Transaksi berhasil ditambahkan."
        : "Perubahan diterapkan di memori, tetapi gagal disimpan. Ekspor data bila perlu.",
      saved ? "success" : "error",
    );
  });

  dom.transactionForm.querySelectorAll("input[name='type']").forEach((radio) => {
    radio.addEventListener("change", () => {
      const type = dom.transactionForm.querySelector("input[name='type']:checked")?.value;
      if (!type) return;
      updateTransactionTypeCategories(dom, type, "");
    });
  });
  dom.transactionDescription.addEventListener("input", () => {
    updateDescriptionCount(dom.transactionDescription, dom.transactionDescriptionCount);
  });

  dom.budgetForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const values = getBudgetFormValues(dom);
    const existing = state.editingBudgetId
      ? getBudgetById(state.data.budgets, state.editingBudgetId)
      : null;
    const result = existing
      ? updateBudget(existing, values, { existingBudgets: state.data.budgets })
      : createBudget(values, { existingBudgets: state.data.budgets });

    if (!result.ok) {
      showFormErrors(dom.budgetForm, result.errors);
      focusFirstError(dom.budgetForm, result.errors);
      return;
    }

    if (existing) {
      state.data.budgets = state.data.budgets.map((budget) =>
        budget.id === existing.id ? result.budget : budget,
      );
    } else {
      state.data.budgets = [...state.data.budgets, result.budget];
    }

    const saved = persistChanges();
    const wasEditing = Boolean(existing);
    closeDialog(dom.budgetDialog);
    state.editingBudgetId = null;
    state.reportMonth = result.budget.month;
    renderAll();
    showToast(
      saved
        ? wasEditing
          ? "Perubahan anggaran disimpan."
          : "Anggaran berhasil dibuat."
        : "Perubahan anggaran diterapkan di memori, tetapi gagal disimpan.",
      saved ? "success" : "error",
    );
  });

  for (const closeButton of document.querySelectorAll("[data-close-dialog]")) {
    closeButton.addEventListener("click", () => {
      closeDialog(byId(closeButton.dataset.closeDialog));
    });
  }
  for (const dialog of [dom.transactionDialog, dom.budgetDialog, dom.confirmDialog]) {
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) closeDialog(dialog);
    });
  }

  dom.transactionDialog.addEventListener("close", () => {
    const target = state.transactionTrigger;
    state.transactionTrigger = null;
    state.editingTransactionId = null;
    if (isVisible(target)) target.focus();
    else focusFallback("transaction-dialog");
  });
  dom.budgetDialog.addEventListener("close", () => {
    const target = state.budgetTrigger;
    state.budgetTrigger = null;
    state.editingBudgetId = null;
    if (isVisible(target)) target.focus();
    else focusFallback("budget-dialog");
  });
  dom.confirmDialog.addEventListener("close", () => {
    const target = state.confirmTrigger;
    state.confirmTrigger = null;
    state.confirmAction = null;
    if (isVisible(target)) target.focus();
    else dom.newTransactionButton.focus();
  });
  dom.confirmCancel.addEventListener("click", () => closeDialog(dom.confirmDialog));
  dom.confirmSubmit.addEventListener("click", () => {
    const action = state.confirmAction;
    state.confirmAction = null;
    closeDialog(dom.confirmDialog);
    if (!action) return;
    try {
      action();
    } catch {
      showToast("Tindakan tidak dapat diselesaikan. Data di memori tidak diubah.", "error");
    }
  });

  dom.toastClose.addEventListener("click", hideToast);
}

function initialize() {
  renderSortOptions(dom.filterSort);
  renderBudgetFormOptions(dom.budgetCategory);
  initializeStorage();
  const route = window.location.hash.replace(/^#/, "");
  if (!VALID_VIEWS.has(route)) {
    window.history.replaceState(null, "", "#dashboard");
  }
  applyRoute();
  renderAll();
  bindEvents();
}

initialize();
