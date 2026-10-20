(() => {
  "use strict";

  const STORAGE_KEY = "expenseTracker.transactions.v1";
  const BACKUP_KEY = "expenseTracker.transactions.backup.v1";
  const MAX_AMOUNT = 999_999_999_999;
  const TYPE_LABELS = { income: "Pemasukan", expense: "Pengeluaran" };
  const DEFAULT_FILTERS = {
    query: "",
    type: "all",
    category: "all",
    from: "",
    to: "",
    sort: "newest",
  };

  const CATEGORIES = {
    income: [
      { id: "gaji", label: "Gaji" },
      { id: "freelance", label: "Freelance" },
      { id: "bisnis", label: "Bisnis" },
      { id: "hadiah", label: "Hadiah" },
      { id: "lainnya-masuk", label: "Lainnya" },
    ],
    expense: [
      { id: "makanan", label: "Makanan" },
      { id: "transportasi", label: "Transportasi" },
      { id: "belanja", label: "Belanja" },
      { id: "tagihan", label: "Tagihan" },
      { id: "pendidikan", label: "Pendidikan" },
      { id: "hiburan", label: "Hiburan" },
      { id: "kesehatan", label: "Kesehatan" },
      { id: "lainnya-keluar", label: "Lainnya" },
    ],
  };

  const CHART_COLORS = [
    "#c34f45",
    "#d97858",
    "#b07b24",
    "#7f8f69",
    "#4f7f68",
    "#3d7181",
    "#7a668e",
    "#9c5d71",
  ];

  const CATEGORY_LOOKUP = new Map();
  for (const type of Object.keys(CATEGORIES)) {
    for (const category of CATEGORIES[type]) {
      CATEGORY_LOOKUP.set(`${type}:${category.id}`, category.label);
    }
  }

  const currencyFormatter = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  });
  const numberFormatter = new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  });
  const percentFormatter = new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 1,
  });
  const compactCurrencyFormatter = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    notation: "compact",
    maximumFractionDigits: 1,
  });

  const state = {
    transactions: [],
    filters: { ...DEFAULT_FILTERS },
    editingId: null,
    pendingAction: null,
    toastTimer: null,
    storageReadFailed: false,
  };

  const el = {
    todayLabel: document.querySelector("#today-label"),
    newTransactionButton: document.querySelector("#new-transaction-button"),
    storageBanner: document.querySelector("#storage-banner"),
    storageMessage: document.querySelector("#storage-message"),
    sampleBanner: document.querySelector("#sample-banner"),
    removeSamples: document.querySelector("#remove-samples"),

    balance: document.querySelector("#stat-balance"),
    balanceStatus: document.querySelector("#balance-status"),
    balanceIncome: document.querySelector("#balance-income"),
    balanceExpense: document.querySelector("#balance-expense"),
    statIncome: document.querySelector("#stat-income"),
    statIncomeCount: document.querySelector("#stat-income-count"),
    statExpense: document.querySelector("#stat-expense"),
    statExpenseCount: document.querySelector("#stat-expense-count"),

    chart: document.querySelector("#expense-chart"),
    chartTitle: document.querySelector("#chart-title"),
    donutSegments: document.querySelector("#donut-segments"),
    chartTotal: document.querySelector("#chart-total"),
    chartLegend: document.querySelector("#chart-legend"),
    chartSummary: document.querySelector("#chart-summary"),

    recentList: document.querySelector("#recent-list"),
    recentEmpty: document.querySelector("#recent-empty"),

    historySummary: document.querySelector("#history-summary"),
    clearAll: document.querySelector("#clear-all-button"),
    search: document.querySelector("#search-input"),
    filterType: document.querySelector("#filter-type"),
    filterCategory: document.querySelector("#filter-category"),
    filterFrom: document.querySelector("#filter-from"),
    filterTo: document.querySelector("#filter-to"),
    filterSort: document.querySelector("#filter-sort"),
    filterError: document.querySelector("#filter-error"),
    clearFilters: document.querySelector("#clear-filters"),
    transactionTable: document.querySelector("#transaction-table"),
    transactionList: document.querySelector("#transaction-list"),
    historyEmpty: document.querySelector("#history-empty"),
    emptyTitle: document.querySelector("#empty-title"),
    emptyMessage: document.querySelector("#empty-message"),
    emptyAction: document.querySelector("#empty-action"),

    transactionDialog: document.querySelector("#transaction-dialog"),
    transactionForm: document.querySelector("#transaction-form"),
    transactionDialogTitle: document.querySelector("#transaction-dialog-title"),
    closeTransactionDialog: document.querySelector("#close-transaction-dialog"),
    typeIncome: document.querySelector("#type-income"),
    typeExpense: document.querySelector("#type-expense"),
    typeError: document.querySelector("#transaction-type-error"),
    amount: document.querySelector("#amount"),
    amountError: document.querySelector("#amount-error"),
    category: document.querySelector("#category"),
    categoryError: document.querySelector("#category-error"),
    transactionDate: document.querySelector("#transaction-date"),
    dateError: document.querySelector("#date-error"),
    description: document.querySelector("#description"),
    descriptionError: document.querySelector("#description-error"),
    cancelTransaction: document.querySelector("#cancel-transaction"),
    saveTransaction: document.querySelector("#save-transaction"),

    confirmDialog: document.querySelector("#confirm-dialog"),
    confirmTitle: document.querySelector("#confirm-title"),
    confirmMessage: document.querySelector("#confirm-message"),
    confirmAction: document.querySelector("#confirm-action"),
    cancelConfirm: document.querySelector("#cancel-confirm"),
    toast: document.querySelector("#toast"),
  };

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function toISODate(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function todayISO() {
    return toISODate(new Date());
  }

  function addDaysISO(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return toISODate(date);
  }

  function isValidDateString(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    );
  }

  function parseISODate(value) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  function makeId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return `trx-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function formatCurrency(value) {
    return currencyFormatter.format(Number.isFinite(Number(value)) ? Number(value) : 0);
  }

  function formatCompactCurrency(value) {
    const amount = Number.isFinite(Number(value)) ? Number(value) : 0;
    try {
      return compactCurrencyFormatter.format(amount);
    } catch (error) {
      return formatCurrency(amount);
    }
  }

  function formatNumber(value) {
    return numberFormatter.format(Number(value) || 0);
  }

  function formatDate(value) {
    if (!isValidDateString(value)) return "";
    return parseISODate(value).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  function formatSignedCurrency(amount, type) {
    return `${type === "income" ? "+" : "−"}${formatCurrency(amount)}`;
  }

  function getCategoryLabel(type, categoryId) {
    return CATEGORY_LOOKUP.get(`${type}:${categoryId}`) || "Lainnya";
  }

  function parseAmount(raw) {
    const text = String(raw ?? "").trim();
    if (!text) return { value: null, reason: "empty" };

    const normalized = text.replace(/^Rp\.?\s*/i, "").replace(/\s+/g, "");
    const plainDigits = /^\d+$/.test(normalized);
    const groupedDigits = /^\d{1,3}(?:\.\d{3})+$/.test(normalized);
    if (!plainDigits && !groupedDigits) return { value: null, reason: "invalid" };

    const digits = normalized.replace(/\./g, "");
    if (!/^\d+$/.test(digits)) return { value: null, reason: "invalid" };

    const value = Number(digits);
    if (!Number.isSafeInteger(value) || value > MAX_AMOUNT) {
      return { value: null, reason: "large" };
    }
    if (value <= 0) return { value: null, reason: "zero" };

    return { value, reason: null };
  }

  function normalizeTransaction(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

    const type = raw.type === "income" || raw.type === "expense" ? raw.type : null;
    if (!type) return null;

    let amount = raw.amount;
    if (typeof amount !== "number") {
      const parsed = parseAmount(amount);
      if (parsed.value === null) return null;
      amount = parsed.value;
    }
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > MAX_AMOUNT) return null;

    const categoryIsValid = CATEGORIES[type].some((category) => category.id === raw.category);
    if (!categoryIsValid) return null;
    if (!isValidDateString(raw.date)) return null;

    return {
      id:
        typeof raw.id === "string" && raw.id.trim()
          ? raw.id.trim()
          : makeId(),
      type,
      amount,
      category: raw.category,
      date: raw.date,
      description:
        typeof raw.description === "string" ? raw.description.trim().slice(0, 120) : "",
      createdAt:
        typeof raw.createdAt === "string" && !Number.isNaN(Date.parse(raw.createdAt))
          ? raw.createdAt
          : new Date().toISOString(),
      sample: Boolean(raw.sample),
    };
  }

  function normalizeTransactions(rawList) {
    const seen = new Set();
    const transactions = [];
    let invalid = 0;
    let repaired = 0;

    for (const raw of rawList) {
      const transaction = normalizeTransaction(raw);
      if (!transaction) {
        invalid += 1;
        continue;
      }
      if (seen.has(transaction.id)) {
        transaction.id = makeId();
        repaired += 1;
      }
      seen.add(transaction.id);
      transactions.push(transaction);
    }

    return { transactions, invalid, repaired };
  }

  function getSummary(transactions) {
    let income = 0;
    let expense = 0;
    let incomeCount = 0;
    let expenseCount = 0;

    for (const transaction of transactions) {
      if (transaction.type === "income") {
        income += transaction.amount;
        incomeCount += 1;
      } else {
        expense += transaction.amount;
        expenseCount += 1;
      }
    }

    return {
      income,
      expense,
      balance: income - expense,
      incomeCount,
      expenseCount,
      totalCount: transactions.length,
    };
  }

  function getExpenseBreakdown(transactions) {
    const totals = new Map();
    for (const transaction of transactions) {
      if (transaction.type !== "expense") continue;
      totals.set(
        transaction.category,
        (totals.get(transaction.category) || 0) + transaction.amount
      );
    }

    const total = [...totals.values()].reduce((sum, amount) => sum + amount, 0);
    const categories = [...totals.entries()]
      .map(([categoryId, amount]) => {
        const categoryIndex = CATEGORIES.expense.findIndex(
          (category) => category.id === categoryId
        );
        return {
          id: categoryId,
          label: getCategoryLabel("expense", categoryId),
          amount,
          percentage: total > 0 ? (amount / total) * 100 : 0,
          color: CHART_COLORS[Math.max(categoryIndex, 0) % CHART_COLORS.length],
        };
      })
      .sort((a, b) => b.amount - a.amount);

    return { total, categories };
  }

  function sortTransactions(transactions, direction) {
    return [...transactions].sort((a, b) => {
      const dateOrder = a.date.localeCompare(b.date);
      if (dateOrder !== 0) {
        return direction === "oldest" ? dateOrder : -dateOrder;
      }
      const createdOrder = a.createdAt.localeCompare(b.createdAt);
      return direction === "oldest" ? createdOrder : -createdOrder;
    });
  }

  function getRecentTransactions(transactions, limit = 5) {
    return sortTransactions(transactions, "newest").slice(0, limit);
  }

  function hasActiveFilters() {
    const { query, type, category, from, to, sort } = state.filters;
    return Boolean(query || type !== "all" || category !== "all" || from || to || sort !== "newest");
  }

  function getVisibleTransactions() {
    const { query, type, category, from, to, sort } = state.filters;
    if (from && to && from > to) {
      return {
        transactions: [],
        error: "Tanggal awal tidak boleh setelah tanggal akhir.",
      };
    }

    const normalizedQuery = query.toLocaleLowerCase("id-ID");
    const transactions = state.transactions.filter((transaction) => {
      if (type !== "all" && transaction.type !== type) return false;
      if (category !== "all" && transaction.category !== category) return false;
      if (from && transaction.date < from) return false;
      if (to && transaction.date > to) return false;
      if (
        normalizedQuery &&
        !transaction.description.toLocaleLowerCase("id-ID").includes(normalizedQuery)
      ) {
        return false;
      }
      return true;
    });

    return {
      transactions: sortTransactions(transactions, sort),
      error: "",
    };
  }

  function createSampleTransactions() {
    const now = Date.now();
    return [
      {
        id: makeId(),
        type: "income",
        amount: 8500000,
        category: "gaji",
        date: addDaysISO(-14),
        description: "Gaji bulan ini",
        createdAt: new Date(now - 8 * 60000).toISOString(),
        sample: true,
      },
      {
        id: makeId(),
        type: "income",
        amount: 1750000,
        category: "freelance",
        date: addDaysISO(-8),
        description: "Proyek desain landing page",
        createdAt: new Date(now - 7 * 60000).toISOString(),
        sample: true,
      },
      {
        id: makeId(),
        type: "expense",
        amount: 285000,
        category: "makanan",
        date: addDaysISO(-6),
        description: "Belanja bahan makanan",
        createdAt: new Date(now - 6 * 60000).toISOString(),
        sample: true,
      },
      {
        id: makeId(),
        type: "expense",
        amount: 96000,
        category: "transportasi",
        date: addDaysISO(-5),
        description: "Bensin dan parkir",
        createdAt: new Date(now - 5 * 60000).toISOString(),
        sample: true,
      },
      {
        id: makeId(),
        type: "expense",
        amount: 420000,
        category: "tagihan",
        date: addDaysISO(-3),
        description: "Listrik dan internet",
        createdAt: new Date(now - 4 * 60000).toISOString(),
        sample: true,
      },
      {
        id: makeId(),
        type: "expense",
        amount: 310000,
        category: "belanja",
        date: addDaysISO(-2),
        description: "Perlengkapan rumah",
        createdAt: new Date(now - 3 * 60000).toISOString(),
        sample: true,
      },
      {
        id: makeId(),
        type: "expense",
        amount: 145000,
        category: "hiburan",
        date: addDaysISO(-1),
        description: "Tiket bioskop",
        createdAt: new Date(now - 2 * 60000).toISOString(),
        sample: true,
      },
      {
        id: makeId(),
        type: "expense",
        amount: 180000,
        category: "kesehatan",
        date: todayISO(),
        description: "Vitamin dan obat",
        createdAt: new Date(now - 60000).toISOString(),
        sample: true,
      },
    ];
  }

  function showStorageBanner(message) {
    el.storageMessage.textContent = message;
    el.storageBanner.hidden = false;
  }

  function hideStorageBanner() {
    el.storageBanner.hidden = true;
    el.storageMessage.textContent = "";
  }

  function backupRaw(raw) {
    try {
      if (localStorage.getItem(BACKUP_KEY) === null) {
        localStorage.setItem(BACKUP_KEY, raw);
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  function saveTransactions() {
    if (state.storageReadFailed) {
      showStorageBanner(
        "Penyimpanan browser tidak dapat dibaca. Perubahan tetap ada di tab ini, tetapi tidak disimpan agar data lama tidak tertimpa. Muat ulang halaman untuk mencoba lagi."
      );
      return false;
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.transactions));
      hideStorageBanner();
      return true;
    } catch (error) {
      showStorageBanner(
        "Expense Tracker tidak dapat menyimpan ke penyimpanan browser ini. Perubahan tetap ada di tab ini, tetapi bisa hilang saat halaman dimuat ulang."
      );
      return false;
    }
  }

  function loadTransactions() {
    let raw;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      state.storageReadFailed = true;
      showStorageBanner(
        "Expense Tracker tidak dapat membaca penyimpanan browser ini. Anda masih bisa bekerja, tetapi perubahan tidak akan disimpan agar data lama tidak tertimpa."
      );
      return [];
    }

    if (raw === null) {
      const samples = createSampleTransactions();
      state.transactions = samples;
      saveTransactions();
      return samples;
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      const backedUp = backupRaw(raw);
      showStorageBanner(
        `Data transaksi tersimpan tidak dapat dibaca. Aplikasi dimulai dengan daftar kosong; data lama tidak ditimpa${
          backedUp ? " dan telah dicadangkan" : ""
        }.`
      );
      return [];
    }

    if (!Array.isArray(parsed)) {
      const backedUp = backupRaw(raw);
      showStorageBanner(
        `Format data transaksi tidak sesuai. Aplikasi dimulai dengan daftar kosong; data lama tidak ditimpa${
          backedUp ? " dan telah dicadangkan" : ""
        }.`
      );
      return [];
    }

    const normalized = normalizeTransactions(parsed);
    if (normalized.invalid > 0) {
      const backedUp = backupRaw(raw);
      showStorageBanner(
        `${normalized.invalid} transaksi tidak sesuai format dan tidak ditampilkan. Data asli tidak diubah${
          backedUp ? " dan telah dicadangkan" : ""
        }.`
      );
    }

    return normalized.transactions;
  }

  function setError(input, errorElement, message) {
    errorElement.textContent = message;
    if (input) {
      if (message) input.setAttribute("aria-invalid", "true");
      else input.removeAttribute("aria-invalid");
    }
  }

  function clearFormErrors() {
    setError(el.amount, el.amountError, "");
    setError(el.category, el.categoryError, "");
    setError(el.transactionDate, el.dateError, "");
    setError(el.description, el.descriptionError, "");
    setError(el.typeExpense, el.typeError, "");
    setError(el.typeIncome, el.typeError, "");
  }

  function getSelectedType() {
    if (el.typeIncome.checked) return "income";
    if (el.typeExpense.checked) return "expense";
    return "";
  }

  function populateFormCategories(type, selectedCategory) {
    const categories = CATEGORIES[type] || [];
    el.category.replaceChildren();
    for (const category of categories) {
      el.category.append(new Option(category.label, category.id));
    }
    const selectedIsValid = categories.some((category) => category.id === selectedCategory);
    if (selectedIsValid) el.category.value = selectedCategory;
    else if (categories.length) el.category.value = categories[0].id;
  }

  function populateFilterCategories(type, selectedCategory) {
    el.filterCategory.replaceChildren(new Option("Semua kategori", "all"));
    const groups = type === "all" ? ["income", "expense"] : [type];

    for (const groupType of groups) {
      const options = CATEGORIES[groupType];
      if (type === "all") {
        const optgroup = document.createElement("optgroup");
        optgroup.label = TYPE_LABELS[groupType];
        for (const category of options) {
          optgroup.append(new Option(category.label, category.id));
        }
        el.filterCategory.append(optgroup);
      } else {
        for (const category of options) {
          el.filterCategory.append(new Option(category.label, category.id));
        }
      }
    }

    const validSelection =
      selectedCategory !== "all" &&
      groups.some((groupType) =>
        CATEGORIES[groupType].some((category) => category.id === selectedCategory)
      );
    el.filterCategory.value = validSelection ? selectedCategory : "all";
  }

  function updateTodayLabel() {
    el.todayLabel.textContent = new Date().toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  function renderSummary() {
    const summary = getSummary(state.transactions);
    const status = summary.balance > 0 ? "Surplus" : summary.balance < 0 ? "Defisit" : "Seimbang";

    el.balance.textContent = formatCurrency(summary.balance);
    el.balance.classList.toggle("is-negative", summary.balance < 0);
    el.balanceStatus.textContent = status;
    el.balanceStatus.classList.toggle("is-negative", summary.balance < 0);
    el.balanceIncome.textContent = formatCurrency(summary.income);
    el.balanceExpense.textContent = formatCurrency(summary.expense);

    el.statIncome.textContent = formatCurrency(summary.income);
    el.statExpense.textContent = formatCurrency(summary.expense);
    el.statIncomeCount.textContent = `${summary.incomeCount} transaksi`;
    el.statExpenseCount.textContent = `${summary.expenseCount} transaksi`;
  }

  function renderChart() {
    const breakdown = getExpenseBreakdown(state.transactions);
    el.donutSegments.replaceChildren();
    el.chartLegend.replaceChildren();
    el.chartTotal.textContent = formatCompactCurrency(breakdown.total);

    if (breakdown.total === 0 || breakdown.categories.length === 0) {
      el.chartTitle.textContent = "Belum ada pengeluaran untuk divisualisasikan";
      const empty = document.createElement("li");
      empty.className = "chart-empty";
      empty.textContent = "Belum ada pengeluaran. Grafik akan muncul setelah Anda mencatat transaksi pengeluaran.";
      el.chartLegend.append(empty);
      el.chartSummary.textContent = "Belum ada pengeluaran untuk divisualisasikan.";
      return;
    }

    const circumference = 2 * Math.PI * 46;
    let offset = 0;

    for (const category of breakdown.categories) {
      const length = (category.percentage / 100) * circumference;
      const segment = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      segment.setAttribute("class", "donut-segment");
      segment.setAttribute("cx", "60");
      segment.setAttribute("cy", "60");
      segment.setAttribute("r", "46");
      segment.setAttribute("stroke", category.color);
      segment.setAttribute("stroke-dasharray", `${length.toFixed(3)} ${(circumference - length).toFixed(3)}`);
      segment.setAttribute("stroke-dashoffset", (-offset).toFixed(3));
      el.donutSegments.append(segment);
      offset += length;

      const item = document.createElement("li");
      item.className = "legend-item";
      item.style.setProperty("--segment-color", category.color);
      item.style.setProperty("--segment-width", `${category.percentage.toFixed(2)}%`);

      const dot = document.createElement("span");
      dot.className = "legend-dot";
      dot.setAttribute("aria-hidden", "true");

      const name = document.createElement("span");
      name.className = "legend-name";
      name.textContent = category.label;

      const share = document.createElement("span");
      share.className = "legend-share";
      share.textContent = `${percentFormatter.format(category.percentage)}%`;

      const amount = document.createElement("strong");
      amount.className = "legend-amount";
      amount.textContent = formatCurrency(category.amount);

      const meter = document.createElement("span");
      meter.className = "legend-meter";
      meter.setAttribute("aria-hidden", "true");
      const meterFill = document.createElement("span");
      meter.append(meterFill);

      item.append(dot, name, share, amount, meter);
      el.chartLegend.append(item);
    }

    const largest = breakdown.categories[0];
    el.chartTitle.textContent = `Pengeluaran per kategori: ${breakdown.categories
      .map((category) => `${category.label} ${formatCurrency(category.amount)}`)
      .join(", ")}`;
    el.chartSummary.textContent = `Pengeluaran terbesar ada pada ${largest.label}, yaitu ${formatCurrency(
      largest.amount
    )} (${percentFormatter.format(largest.percentage)}% dari total pengeluaran).`;
  }

  function renderRecent() {
    const recent = getRecentTransactions(state.transactions, 5);
    el.recentList.replaceChildren();
    el.recentEmpty.hidden = recent.length > 0;

    for (const transaction of recent) {
      const item = document.createElement("li");
      item.className = "recent-item";

      const icon = document.createElement("span");
      icon.className = `recent-icon ${transaction.type}`;
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = transaction.type === "income" ? "+" : "−";

      const copy = document.createElement("div");
      copy.className = "recent-copy";
      const title = document.createElement("p");
      title.className = "recent-title";
      title.textContent = transaction.description || "Tanpa deskripsi";
      const meta = document.createElement("p");
      meta.className = "recent-meta";
      meta.textContent = `${getCategoryLabel(transaction.type, transaction.category)} · ${formatDate(
        transaction.date
      )}`;
      copy.append(title, meta);

      const amount = document.createElement("span");
      amount.className = `recent-amount ${transaction.type}`;
      amount.textContent = formatSignedCurrency(transaction.amount, transaction.type);

      item.append(icon, copy, amount);
      el.recentList.append(item);
    }
  }

  function makeActionButton(label, action, transaction) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `row-action${action === "delete" ? " delete" : ""}`;
    button.dataset.action = action;
    button.textContent = label;
    const description = transaction.description || getCategoryLabel(transaction.type, transaction.category);
    button.setAttribute(
      "aria-label",
      `${action === "edit" ? "Ubah" : "Hapus"} transaksi ${description}`
    );
    return button;
  }

  function renderTransactions(transactions, hasError) {
    el.transactionList.replaceChildren();

    for (const transaction of transactions) {
      const row = document.createElement("li");
      row.className = "tx-row";
      row.dataset.id = transaction.id;

      const date = document.createElement("time");
      date.className = "tx-date";
      date.dateTime = transaction.date;
      date.textContent = formatDate(transaction.date);

      const description = document.createElement("div");
      description.className = "tx-desc";
      const title = document.createElement("strong");
      title.textContent = transaction.description || "Tanpa deskripsi";
      description.append(title);

      const category = document.createElement("span");
      category.className = "tx-category";
      category.textContent = getCategoryLabel(transaction.type, transaction.category);

      const type = document.createElement("span");
      type.className = `tx-type ${transaction.type}`;
      type.textContent = TYPE_LABELS[transaction.type];

      const amount = document.createElement("span");
      amount.className = `tx-amount ${transaction.type}`;
      amount.textContent = formatSignedCurrency(transaction.amount, transaction.type);

      const actions = document.createElement("div");
      actions.className = "tx-actions";
      actions.append(
        makeActionButton("Ubah", "edit", transaction),
        makeActionButton("Hapus", "delete", transaction)
      );

      row.append(date, description, category, type, amount, actions);
      el.transactionList.append(row);
    }

    const visible = transactions.length > 0 && !hasError;
    el.transactionTable.hidden = !visible;
    el.historyEmpty.hidden = visible;
  }

  function renderHistory() {
    const { transactions, error } = getVisibleTransactions();
    const total = state.transactions.length;
    const active = hasActiveFilters();

    el.filterError.textContent = error;
    el.clearFilters.disabled = !active;
    el.clearAll.hidden = total === 0;
    el.historySummary.textContent = error
      ? "Rentang tanggal tidak valid"
      : active
        ? `${transactions.length} dari ${total} transaksi`
        : `${total} transaksi`;

    if (transactions.length === 0) {
      if (total === 0) {
        el.emptyTitle.textContent = "Belum ada transaksi";
        el.emptyMessage.textContent =
          "Catat pemasukan atau pengeluaran pertama Anda untuk mulai melihat ringkasan keuangan.";
        el.emptyAction.textContent = "Catat Transaksi";
        el.emptyAction.dataset.mode = "create";
      } else if (error) {
        el.emptyTitle.textContent = "Rentang tanggal tidak valid";
        el.emptyMessage.textContent =
          "Tanggal awal melewati tanggal akhir. Periksa kembali rentang tanggal atau hapus filter.";
        el.emptyAction.textContent = "Hapus Filter";
        el.emptyAction.dataset.mode = "clear";
      } else {
        el.emptyTitle.textContent = "Tidak ada transaksi yang cocok";
        el.emptyMessage.textContent =
          "Coba ubah kata kunci, jenis, kategori, atau rentang tanggal. Data asli tidak berubah.";
        el.emptyAction.textContent = "Hapus Filter";
        el.emptyAction.dataset.mode = "clear";
      }
    }

    renderTransactions(transactions, Boolean(error));
  }

  function renderSampleBanner() {
    const hasSamples = state.transactions.some((transaction) => transaction.sample);
    el.sampleBanner.hidden = !hasSamples;
  }

  function renderAll() {
    renderSummary();
    renderChart();
    renderRecent();
    renderHistory();
    renderSampleBanner();
  }

  function showToast(message) {
    window.clearTimeout(state.toastTimer);
    el.toast.textContent = message;
    el.toast.hidden = false;
    state.toastTimer = window.setTimeout(() => {
      el.toast.hidden = true;
    }, 3000);
  }

  function openTransactionDialog(transaction = null) {
    state.editingId = transaction ? transaction.id : null;
    clearFormErrors();
    el.transactionForm.reset();

    const type = transaction ? transaction.type : "expense";
    if (type === "income") el.typeIncome.checked = true;
    else el.typeExpense.checked = true;

    populateFormCategories(type, transaction ? transaction.category : "");
    el.amount.value = transaction ? formatNumber(transaction.amount) : "";
    el.transactionDate.value = transaction ? transaction.date : todayISO();
    el.description.value = transaction ? transaction.description : "";
    el.transactionDialogTitle.textContent = transaction ? "Ubah Transaksi" : "Transaksi Baru";
    el.saveTransaction.textContent = transaction ? "Simpan Perubahan" : "Simpan Transaksi";

    if (!el.transactionDialog.open) el.transactionDialog.showModal();
    window.requestAnimationFrame(() => el.amount.focus());
  }

  function closeTransactionDialog() {
    if (el.transactionDialog.open) el.transactionDialog.close();
    state.editingId = null;
  }

  function validateForm() {
    clearFormErrors();

    const type = getSelectedType();
    const amountResult = parseAmount(el.amount.value);
    const category = el.category.value;
    const date = el.transactionDate.value;
    const description = el.description.value.trim();
    const firstInvalid = [];

    if (!type) {
      el.typeError.textContent = "Pilih jenis transaksi.";
      firstInvalid.push(el.typeExpense);
    }

    if (amountResult.reason === "empty") {
      setError(el.amount, el.amountError, "Masukkan nominal transaksi.");
      firstInvalid.push(el.amount);
    } else if (amountResult.reason === "zero") {
      setError(el.amount, el.amountError, "Nominal harus lebih besar dari nol.");
      firstInvalid.push(el.amount);
    } else if (amountResult.reason === "large") {
      setError(el.amount, el.amountError, "Nominal terlalu besar.");
      firstInvalid.push(el.amount);
    } else if (amountResult.reason === "invalid") {
      setError(el.amount, el.amountError, "Nominal harus berupa angka yang valid.");
      firstInvalid.push(el.amount);
    }

    if (!type || !CATEGORIES[type].some((item) => item.id === category)) {
      setError(el.category, el.categoryError, "Pilih kategori yang sesuai dengan jenis transaksi.");
      firstInvalid.push(el.category);
    }

    if (!isValidDateString(date)) {
      setError(el.transactionDate, el.dateError, "Pilih tanggal transaksi yang valid.");
      firstInvalid.push(el.transactionDate);
    }

    if (description.length > 120) {
      setError(el.description, el.descriptionError, "Deskripsi maksimal 120 karakter.");
      firstInvalid.push(el.description);
    }

    if (firstInvalid.length > 0) {
      firstInvalid[0].focus();
      return null;
    }

    return {
      type,
      amount: amountResult.value,
      category,
      date,
      description,
    };
  }

  function handleFormSubmit(event) {
    event.preventDefault();
    const values = validateForm();
    if (!values) return;

    if (state.editingId) {
      const existing = state.transactions.find(
        (transaction) => transaction.id === state.editingId
      );
      if (!existing) {
        closeTransactionDialog();
        showToast("Transaksi tersebut sudah tidak ada.");
        renderAll();
        return;
      }
      Object.assign(existing, values, { sample: false });
      saveTransactions();
      renderAll();
      closeTransactionDialog();
      showToast("Perubahan disimpan.");
    } else {
      state.transactions.push({
        id: makeId(),
        ...values,
        createdAt: new Date().toISOString(),
        sample: false,
      });
      saveTransactions();
      renderAll();
      closeTransactionDialog();
      showToast("Transaksi ditambahkan.");
    }

    el.newTransactionButton.focus();
  }

  function openConfirmDialog(title, message, confirmLabel, action) {
    state.pendingAction = action;
    el.confirmTitle.textContent = title;
    el.confirmMessage.textContent = message;
    el.confirmAction.textContent = confirmLabel;
    if (!el.confirmDialog.open) el.confirmDialog.showModal();
    el.cancelConfirm.focus();
  }

  function requestDeleteTransaction(transaction) {
    if (!transaction) return;
    const label = transaction.description || getCategoryLabel(transaction.type, transaction.category);
    openConfirmDialog(
      "Hapus transaksi?",
      `“${label}” akan dihapus permanen. Ringkasan dan grafik akan diperbarui.`,
      "Hapus Transaksi",
      { type: "transaction", id: transaction.id }
    );
  }

  function requestClearAll() {
    if (state.transactions.length === 0) return;
    openConfirmDialog(
      "Hapus semua transaksi?",
      `Seluruh ${state.transactions.length} transaksi akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.`,
      "Hapus Semua",
      { type: "all" }
    );
  }

  function requestRemoveSamples() {
    const count = state.transactions.filter((transaction) => transaction.sample).length;
    if (count === 0) return;
    openConfirmDialog(
      "Hapus data contoh?",
      `Tindakan ini akan menghapus ${count} transaksi contoh. Transaksi yang Anda buat sendiri tetap aman.`,
      "Hapus Data Contoh",
      { type: "samples" }
    );
  }

  function handleConfirmAction() {
    const action = state.pendingAction;
    if (!action) return;

    if (action.type === "transaction") {
      state.transactions = state.transactions.filter(
        (transaction) => transaction.id !== action.id
      );
      saveTransactions();
      showToast("Transaksi dihapus.");
    } else if (action.type === "all") {
      state.transactions = [];
      saveTransactions();
      showToast("Semua transaksi dihapus.");
    } else if (action.type === "samples") {
      state.transactions = state.transactions.filter((transaction) => !transaction.sample);
      saveTransactions();
      showToast("Data contoh dihapus.");
    }

    state.pendingAction = null;
    el.confirmDialog.close();
    renderAll();
    el.newTransactionButton.focus();
  }

  function resetFilters() {
    state.filters = { ...DEFAULT_FILTERS };
    el.search.value = "";
    el.filterType.value = "all";
    el.filterFrom.value = "";
    el.filterTo.value = "";
    el.filterSort.value = "newest";
    populateFilterCategories("all", "all");
    renderHistory();
  }

  function syncFiltersFromControls() {
    state.filters.query = el.search.value.trim();
    state.filters.type = el.filterType.value;
    state.filters.category = el.filterCategory.value;
    state.filters.from = el.filterFrom.value;
    state.filters.to = el.filterTo.value;
    state.filters.sort = el.filterSort.value;
  }

  function handleFilterTypeChange() {
    const previousCategory = el.filterCategory.value;
    state.filters.type = el.filterType.value;
    populateFilterCategories(el.filterType.value, previousCategory);
    state.filters.category = el.filterCategory.value;
    renderHistory();
  }

  function handleTransactionListClick(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const row = button.closest("[data-id]");
    if (!row) return;
    const transaction = state.transactions.find((item) => item.id === row.dataset.id);
    if (!transaction) return;

    if (button.dataset.action === "edit") {
      openTransactionDialog(transaction);
    } else if (button.dataset.action === "delete") {
      requestDeleteTransaction(transaction);
    }
  }

  function bindEvents() {
    el.newTransactionButton.addEventListener("click", () => openTransactionDialog());
    el.closeTransactionDialog.addEventListener("click", closeTransactionDialog);
    el.cancelTransaction.addEventListener("click", closeTransactionDialog);
    el.transactionForm.addEventListener("submit", handleFormSubmit);

    el.typeIncome.addEventListener("change", () => {
      populateFormCategories("income", el.category.value);
      setError(el.category, el.categoryError, "");
      setError(el.typeIncome, el.typeError, "");
      el.typeExpense.removeAttribute("aria-invalid");
    });
    el.typeExpense.addEventListener("change", () => {
      populateFormCategories("expense", el.category.value);
      setError(el.category, el.categoryError, "");
      setError(el.typeExpense, el.typeError, "");
      el.typeIncome.removeAttribute("aria-invalid");
    });

    el.amount.addEventListener("input", () => setError(el.amount, el.amountError, ""));
    el.amount.addEventListener("blur", () => {
      const parsed = parseAmount(el.amount.value);
      if (parsed.value !== null) el.amount.value = formatNumber(parsed.value);
    });
    el.category.addEventListener("change", () => setError(el.category, el.categoryError, ""));
    el.transactionDate.addEventListener("change", () => setError(el.transactionDate, el.dateError, ""));
    el.description.addEventListener("input", () => setError(el.description, el.descriptionError, ""));

    el.transactionList.addEventListener("click", handleTransactionListClick);
    el.clearAll.addEventListener("click", requestClearAll);
    el.removeSamples.addEventListener("click", requestRemoveSamples);
    el.confirmAction.addEventListener("click", handleConfirmAction);
    el.cancelConfirm.addEventListener("click", () => {
      state.pendingAction = null;
      el.confirmDialog.close();
    });

    el.transactionDialog.addEventListener("cancel", () => {
      state.editingId = null;
      clearFormErrors();
    });
    el.confirmDialog.addEventListener("cancel", () => {
      state.pendingAction = null;
    });

    el.search.addEventListener("input", () => {
      syncFiltersFromControls();
      renderHistory();
    });
    el.filterType.addEventListener("change", handleFilterTypeChange);
    el.filterCategory.addEventListener("change", () => {
      syncFiltersFromControls();
      renderHistory();
    });
    el.filterFrom.addEventListener("change", () => {
      syncFiltersFromControls();
      renderHistory();
    });
    el.filterTo.addEventListener("change", () => {
      syncFiltersFromControls();
      renderHistory();
    });
    el.filterSort.addEventListener("change", () => {
      syncFiltersFromControls();
      renderHistory();
    });
    el.clearFilters.addEventListener("click", resetFilters);

    el.emptyAction.addEventListener("click", () => {
      if (el.emptyAction.dataset.mode === "clear") resetFilters();
      else openTransactionDialog();
    });
  }

  function init() {
    updateTodayLabel();
    bindEvents();
    populateFilterCategories("all", "all");
    state.transactions = loadTransactions();
    renderAll();
  }

  init();
})();
