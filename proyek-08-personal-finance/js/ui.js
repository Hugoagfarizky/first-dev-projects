import {
  getCategoryExpenseBreakdown,
  getMonthlyTrend,
  getRecentTransactions,
  compareWithPreviousMonth,
  getAllTimeSummary,
  getExpenseSpendingByCategory,
} from "./analytics.js";
import { getBudgetUsage } from "./budgets.js";
import {
  EXPENSE_CATEGORIES,
  TYPE_LABELS,
  getCategoriesByType,
  getCategoryById,
} from "./categories.js";
import {
  formatDate,
  formatMonth,
  formatMonthShort,
  monthKeyOf,
} from "./dates.js";
import {
  formatCurrency,
  formatSignedCurrency,
} from "./money.js";
import { SORT_OPTIONS } from "./transactions.js";

const SVG_NS = "http://www.w3.org/2000/svg";
let toastTimer = null;

export function createIcon(name, className = "icon") {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", className);
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const use = document.createElementNS(SVG_NS, "use");
  use.setAttribute("href", `#icon-${name}`);
  svg.append(use);
  return svg;
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(className, text) {
  const node = element("button", className);
  node.type = "button";
  if (text) node.textContent = text;
  return node;
}

function iconButton(iconName, label, { className = "icon-button", action, id } = {}) {
  const node = button(className);
  node.setAttribute("aria-label", label);
  node.append(createIcon(iconName));
  if (action) node.dataset.action = action;
  if (id) node.dataset.id = id;
  return node;
}

function setText(node, value) {
  if (node) node.textContent = value;
}

function appendEmpty(container, { icon = "info", title, copy, action }) {
  container.replaceChildren();
  const wrapper = element("div", "empty-state empty-state-inline");
  const iconWrapper = element("span", "empty-icon");
  iconWrapper.append(createIcon(icon));
  wrapper.append(iconWrapper);
  wrapper.append(element("h3", "", title));
  if (copy) wrapper.append(element("p", "", copy));
  if (action) wrapper.append(action);
  container.append(wrapper);
}

function comparisonTone(metric, direction) {
  if (metric === "count") return "neutral";
  if (direction === "flat") return "neutral";
  if (metric === "expense") return direction === "down" ? "positive" : "negative";
  return direction === "up" ? "positive" : "negative";
}

function renderComparison(node, comparison, { metric, hasPreviousData, previous, current }) {
  if (!node) return;
  node.replaceChildren();
  node.removeAttribute("title");
  node.title = "Perbandingan memakai total bulan kalender yang sama, bukan rata-rata harian.";

  if (!hasPreviousData) {
    node.dataset.tone = "neutral";
    node.append(createIcon("info", "comparison-icon"));
    node.append(element("span", "", "Belum ada data bulan lalu"));
    return;
  }

  const change = comparison.changes[metric];
  let tone = comparisonTone(metric, change.direction);

  if (metric === "net") {
    node.dataset.tone = tone;
    const directionIcon =
      change.direction === "flat" ? "arrow-right" : change.direction === "up" ? "trend-up" : "trend-down";
    node.append(createIcon(directionIcon, "comparison-icon"));
    const value = change.delta === 0 ? "Sama dengan bulan lalu" : `${formatSignedCurrency(change.delta)} vs bulan lalu`;
    node.append(element("span", "", value));
    return;
  }

  if (change.percent !== null) {
    node.dataset.tone = tone;
    const directionIcon =
      change.direction === "flat" ? "arrow-right" : change.direction === "up" ? "trend-up" : "trend-down";
    node.append(createIcon(directionIcon, "comparison-icon"));
    const sign = change.percent > 0 ? "+" : "";
    node.append(element("span", "", `${sign}${change.percent}% vs bulan lalu`));
    return;
  }

  if (change.current > 0 && change.previous === 0) {
    tone = metric === "expense" ? "negative" : metric === "count" ? "neutral" : "positive";
    node.dataset.tone = tone;
    node.append(createIcon("trend-up", "comparison-icon"));
    node.append(
      element(
        "span",
        "",
        metric === "count" ? "Aktivitas baru bulan ini" : "Baru tercatat bulan ini",
      ),
    );
    return;
  }

  node.dataset.tone = "neutral";
  node.append(createIcon("info", "comparison-icon"));
  node.append(
    element(
      "span",
      "",
      metric === "count" ? "Tidak ada transaksi di kedua bulan" : "Tidak ada nilai untuk dibandingkan",
    ),
  );
  if (previous && current) node.dataset.previous = String(metric === "count" ? previous.count : previous[metric]);
}

function renderTrendChart(container, trend) {
  container.replaceChildren();
  if (!trend.hasData) {
    appendEmpty(container, {
      icon: "trend-up",
      title: "Belum ada arus kas",
      copy: "Grafik akan muncul setelah ada transaksi pada enam bulan terakhir.",
    });
    return;
  }

  const list = element("div", "trend-list");
  for (const month of trend.months) {
    const row = element("div", "trend-row");
    const label = element("div", "trend-month-label");
    label.append(element("span", "trend-month-short", formatMonthShort(month.month)));
    label.append(element("span", "trend-month-year", month.month.slice(0, 4)));
    row.append(label);

    const bars = element("div", "trend-bars");
    for (const kind of ["income", "expense"]) {
      const value = kind === "income" ? month.income : month.expense;
      const line = element("div", "trend-line");
      const type = element("span", `trend-type trend-type-${kind}`, kind === "income" ? "Masuk" : "Keluar");
      const track = element("div", "trend-track");
      const fill = element("span", `trend-fill trend-fill-${kind}`);
      const width = trend.maxValue > 0 ? Math.max(value > 0 ? 1.5 : 0, (value / trend.maxValue) * 100) : 0;
      fill.style.width = `${width}%`;
      track.append(fill);
      track.setAttribute(
        "aria-label",
        `${kind === "income" ? "Pemasukan" : "Pengeluaran"} ${formatMonth(month.month)}: ${formatCurrency(value)}`,
      );
      const amount = element("span", "trend-amount", formatCurrency(value));
      line.append(type, track, amount);
      bars.append(line);
    }
    row.append(bars);
    list.append(row);
  }
  container.append(list);
  const note = element("p", "chart-note", "Angka ditampilkan dalam rupiah penuh. Warna dibantu label dan nominal.");
  container.append(note);
}

function renderCategoryChart(container, breakdown) {
  container.replaceChildren();
  if (!breakdown.hasData) {
    appendEmpty(container, {
      icon: "chart",
      title: "Belum ada pengeluaran",
      copy: "Kategori pengeluaran akan tampil setelah ada transaksi pengeluaran pada periode ini.",
    });
    return;
  }

  const list = element("div", "category-list");
  for (const item of breakdown.items) {
    const row = element("div", "category-row");
    const head = element("div", "category-row-head");
    const label = element("span", "category-label");
    const dot = element("span", "category-dot");
    dot.style.backgroundColor = item.color;
    dot.setAttribute("aria-hidden", "true");
    label.append(dot, element("span", "", item.label));
    const value = element("span", "category-value");
    value.append(element("strong", "", formatCurrency(item.amount)));
    value.append(element("span", "category-percent", `${item.percent}%`));
    head.append(label, value);

    const track = element("div", "category-track");
    const fill = element("span", "category-fill");
    fill.style.width = `${Math.max(item.percent > 0 ? 1.5 : 0, item.percent)}%`;
    fill.style.backgroundColor = item.color;
    track.append(fill);
    track.setAttribute(
      "aria-label",
      `${item.label}: ${formatCurrency(item.amount)}, ${item.percent}% dari total pengeluaran`,
    );
    row.append(head, track);
    list.append(row);
  }
  const total = element("p", "chart-total");
  total.append(element("span", "", "Total pengeluaran"));
  total.append(element("strong", "", formatCurrency(breakdown.total)));
  container.append(list, total);
}

function renderRecent(container, transactions) {
  container.replaceChildren();
  if (!transactions.length) {
    appendEmpty(container, {
      icon: "receipt",
      title: "Belum ada transaksi periode ini",
      copy: "Transaksi terbaru akan tampil di sini setelah kamu mencatatnya.",
    });
    return;
  }

  const list = element("div", "recent-list");
  for (const transaction of transactions) {
    const row = button("recent-item");
    row.dataset.action = "edit-transaction";
    row.dataset.id = transaction.id;
    row.setAttribute(
      "aria-label",
      `Ubah ${TYPE_LABELS[transaction.type]} ${formatCurrency(transaction.amount)}, ${transaction.description || getCategoryById(transaction.categoryId)?.name || ""}`,
    );

    const icon = element("span", `recent-icon recent-icon-${transaction.type}`);
    icon.append(createIcon(transaction.type === "income" ? "trend-up" : "trend-down"));
    const main = element("span", "recent-main");
    main.append(
      element(
        "span",
        "recent-title",
        transaction.description || getCategoryById(transaction.categoryId)?.name || "Tanpa deskripsi",
      ),
    );
    main.append(
      element(
        "span",
        "recent-meta",
        `${getCategoryById(transaction.categoryId)?.name || "Tanpa kategori"} · ${formatDate(transaction.date)}`,
      ),
    );
    const amount = element(
      "span",
      `recent-amount amount-${transaction.type}`,
      transaction.type === "income" ? formatSignedCurrency(transaction.amount) : `−${formatCurrency(transaction.amount)}`,
    );
    row.append(icon, main, amount);
    list.append(row);
  }
  container.append(list);
}

function renderBudgetSnapshot(container, usage) {
  container.replaceChildren();
  if (!usage.items.length) {
    appendEmpty(container, {
      icon: "target",
      title: "Belum ada anggaran",
      copy: "Tetapkan batas perencanaan untuk kategori pengeluaran bulan ini.",
      action: (() => {
        const link = element("a", "button button-secondary", "Atur anggaran");
        link.href = "#budgets";
        return link;
      })(),
    });
    return;
  }

  const sorted = [...usage.items].sort((left, right) => {
    const rank = { over: 0, warning: 1, safe: 2 };
    return rank[left.status] - rank[right.status] || right.percent - left.percent;
  });
  const list = element("div", "snapshot-list");
  for (const item of sorted.slice(0, 3)) {
    const row = element("div", "snapshot-row");
    const head = element("div", "snapshot-head");
    head.append(element("span", "snapshot-name", item.category?.name || "Kategori"));
    head.append(
      element(
        "span",
        `budget-status budget-status-${item.status}`,
        `${item.percent}%`,
      ),
    );
    const track = element("div", "snapshot-track");
    const fill = element("span", `snapshot-fill budget-fill-${item.status}`);
    fill.style.width = `${Math.min(100, item.percent)}%`;
    track.append(fill);
    track.setAttribute("role", "progressbar");
    track.setAttribute("aria-valuemin", "0");
    track.setAttribute("aria-valuemax", "100");
    track.setAttribute("aria-valuenow", String(Math.min(100, item.percent)));
    track.setAttribute(
      "aria-label",
      `${item.category?.name || "Kategori"}: ${formatCurrency(item.used)} dari ${formatCurrency(item.limit)}`,
    );
    const meta = element(
      "p",
      "snapshot-meta",
      `${formatCurrency(item.used)} dari ${formatCurrency(item.limit)}`,
    );
    row.append(head, track, meta);
    list.append(row);
  }
  const footer = element("div", "panel-footer");
  footer.append(
    element(
      "span",
      "muted",
      `${usage.totals.count} kategori dianggarkan`,
    ),
  );
  const link = element("a", "text-link", "Lihat anggaran");
  link.href = "#budgets";
  footer.append(link);
  container.append(list, footer);
}

function renderFilteredTotals(container, totals) {
  container.replaceChildren();
  const entries = [
    { label: "Pemasukan", value: totals.income, className: "income" },
    { label: "Pengeluaran", value: totals.expense, className: "expense" },
    { label: "Arus kas", value: totals.net, className: totals.net < 0 ? "negative" : "net" },
  ];
  for (const entry of entries) {
    const item = element("div", `filter-total filter-total-${entry.className}`);
    item.append(element("span", "filter-total-label", entry.label));
    item.append(
      element(
        "strong",
        "",
        entry.className === "income" || entry.className === "expense"
          ? formatCurrency(entry.value)
          : formatSignedCurrency(entry.value),
      ),
    );
    container.append(item);
  }
}

export function populateCategorySelect(select, type, selectedId = "", {
  includeAll = false,
  allLabel = "Semua kategori",
} = {}) {
  if (!select) return;
  const fragment = document.createDocumentFragment();
  if (includeAll) {
    const option = document.createElement("option");
    option.value = "all";
    option.textContent = allLabel;
    fragment.append(option);

    for (const categoryType of ["income", "expense"]) {
      const group = document.createElement("optgroup");
      group.label = TYPE_LABELS[categoryType];
      for (const category of getCategoriesByType(categoryType)) {
        const item = document.createElement("option");
        item.value = category.id;
        item.textContent = category.name;
        group.append(item);
      }
      fragment.append(group);
    }
  } else {
    for (const category of getCategoriesByType(type)) {
      const option = document.createElement("option");
      option.value = category.id;
      option.textContent = category.name;
      fragment.append(option);
    }
  }
  select.replaceChildren(fragment);
  if (selectedId) {
    select.value = selectedId;
    if (select.value !== selectedId && select.options.length) {
      select.selectedIndex = 0;
    }
  } else if (select.options.length) {
    select.selectedIndex = 0;
  }
}

export function populateMonthSelect(select, months, selected = "all", allLabel = "Semua bulan") {
  if (!select) return;
  const fragment = document.createDocumentFragment();
  const all = document.createElement("option");
  all.value = "all";
  all.textContent = allLabel;
  fragment.append(all);
  for (const month of months) {
    const option = document.createElement("option");
    option.value = month;
    option.textContent = formatMonth(month);
    fragment.append(option);
  }
  select.replaceChildren(fragment);
  select.value = months.includes(selected) ? selected : "all";
}

export function setMonthControls(dom, month) {
  if (dom.dashboardMonth) dom.dashboardMonth.value = month;
  if (dom.budgetMonth) dom.budgetMonth.value = month;
}

export function renderDashboard(dom, { data, month }) {
  const comparison = compareWithPreviousMonth(data.transactions, month);
  const allTime = getAllTimeSummary(data.transactions);
  const current = comparison.current;

  setText(dom.dashboardPeriodCopy, `Ringkasan ${formatMonth(month)}. Pembanding memakai total bulan kalender sebelumnya, bukan rata-rata harian.`);
  setText(dom.summaryIncome, formatCurrency(current.income));
  setText(dom.summaryExpense, formatCurrency(current.expense));
  setText(dom.summaryNet, formatSignedCurrency(current.net));
  setText(dom.summaryCount, String(current.count));
  if (dom.summaryNet) {
    dom.summaryNet.classList.toggle("is-negative", current.net < 0);
    dom.summaryNet.classList.toggle("is-positive", current.net > 0);
  }

  renderComparison(dom.summaryIncomeComparison, comparison, {
    metric: "income",
    hasPreviousData: comparison.hasPreviousData,
    previous: comparison.previous,
    current,
  });
  renderComparison(dom.summaryExpenseComparison, comparison, {
    metric: "expense",
    hasPreviousData: comparison.hasPreviousData,
    previous: comparison.previous,
    current,
  });
  renderComparison(dom.summaryNetComparison, comparison, {
    metric: "net",
    hasPreviousData: comparison.hasPreviousData,
    previous: comparison.previous,
    current,
  });
  renderComparison(dom.summaryCountComparison, comparison, {
    metric: "count",
    hasPreviousData: comparison.hasPreviousData,
    previous: comparison.previous,
    current,
  });

  setText(dom.cumulativeNet, formatSignedCurrency(allTime.net));
  if (dom.cumulativeNet) {
    dom.cumulativeNet.classList.toggle("is-negative", allTime.net < 0);
  }
  setText(
    dom.cumulativeMeta,
    allTime.count
      ? `Saldo seluruh riwayat dari ${allTime.count} transaksi. Berbeda dari arus kas bulan yang sedang dipilih.`
      : "Belum ada transaksi sepanjang riwayat.",
  );

  if (dom.dashboardEmpty) {
    dom.dashboardEmpty.hidden = current.count > 0;
    if (current.count === 0) {
      setText(
        dom.dashboardEmptyCopy,
        `Belum ada transaksi pada ${formatMonth(month)}. Catat pemasukan atau pengeluaran pertama untuk melihat ringkasan dan grafik.`,
      );
    }
  }

  const trend = getMonthlyTrend(data.transactions, month, 6);
  renderTrendChart(dom.trendChart, trend);
  const breakdown = getCategoryExpenseBreakdown(data.transactions, month);
  setText(dom.categoryChartPeriod, formatMonth(month));
  renderCategoryChart(dom.categoryChart, breakdown);
  renderRecent(dom.recentTransactions, getRecentTransactions(data.transactions, month, 5));
  renderBudgetSnapshot(
    dom.budgetSnapshot,
    getBudgetUsage(data.budgets, data.transactions, month),
  );
}

export function renderTransactionFilterOptions(dom, transactions, filters) {
  const months = [...new Set(transactions.map((transaction) => monthKeyOf(transaction.date)).filter(Boolean))]
    .sort((left, right) => right.localeCompare(left));
  populateCategorySelect(dom.filterCategory, "all", filters.category, { includeAll: true });
  populateMonthSelect(dom.filterMonth, months, filters.month);
  if (dom.filterType) dom.filterType.value = filters.type;
  if (dom.filterSort) dom.filterSort.value = filters.sort;
}

export function syncTransactionFilterFields(dom, filters) {
  if (dom.filterSearch) dom.filterSearch.value = filters.search;
  if (dom.filterType) dom.filterType.value = filters.type;
  if (dom.filterCategory) dom.filterCategory.value = filters.category;
  if (dom.filterMonth) dom.filterMonth.value = filters.month;
  if (dom.filterFrom) dom.filterFrom.value = filters.from;
  if (dom.filterTo) dom.filterTo.value = filters.to;
  if (dom.filterSort) dom.filterSort.value = filters.sort;
}

export function renderTransactionsView(dom, {
  transactions,
  totalCount,
  filters,
  hasFilters,
}) {
  const filtered = transactions;
  const summary = filtered.reduce(
    (totals, transaction) => {
      if (transaction.type === "income") totals.income += transaction.amount;
      else totals.expense += transaction.amount;
      return totals;
    },
    { income: 0, expense: 0 },
  );
  const net = summary.income - summary.expense;

  setText(
    dom.transactionFilterSummary,
    hasFilters || filtered.length !== totalCount
      ? `Menampilkan ${filtered.length} dari ${totalCount} transaksi`
      : `${filtered.length} transaksi`,
  );
  renderFilteredTotals(dom.filteredTotals, { ...summary, net });
  setText(dom.exportCount, filtered.length ? `${filtered.length} transaksi` : "Tidak ada data");
  if (dom.exportCsv) {
    dom.exportCsv.dataset.count = String(filtered.length);
    dom.exportCsv.title = filtered.length
      ? "Ekspor transaksi yang saat ini lolos filter ke CSV"
      : "Tidak ada transaksi untuk diekspor";
  }
  setText(
    dom.filterActiveLabel,
    hasFilters ? "Filter aktif diterapkan pada daftar dan ekspor CSV." : "Menampilkan seluruh transaksi.",
  );
  if (dom.resetFilters) dom.resetFilters.disabled = !hasFilters;

  dom.transactionsBody.replaceChildren();
  for (const transaction of filtered) {
    const row = document.createElement("tr");
    row.dataset.id = transaction.id;

    const dateCell = document.createElement("td");
    dateCell.dataset.label = "Tanggal";
    dateCell.append(element("span", "tx-date", formatDate(transaction.date)));

    const descriptionCell = document.createElement("td");
    descriptionCell.dataset.label = "Deskripsi";
    descriptionCell.append(
      element("span", "tx-description", transaction.description || "Tanpa deskripsi"),
    );

    const categoryCell = document.createElement("td");
    categoryCell.dataset.label = "Kategori";
    const category = getCategoryById(transaction.categoryId);
    const categoryLabel = element("span", "tx-category");
    const dot = element("span", "category-dot");
    dot.style.backgroundColor = category?.color || "#7a8178";
    dot.setAttribute("aria-hidden", "true");
    categoryLabel.append(dot, element("span", "", category?.name || "Tidak dikenal"));
    categoryCell.append(categoryLabel);

    const typeCell = document.createElement("td");
    typeCell.dataset.label = "Jenis";
    typeCell.append(
      element("span", `type-badge type-badge-${transaction.type}`, TYPE_LABELS[transaction.type]),
    );

    const amountCell = document.createElement("td");
    amountCell.dataset.label = "Nominal";
    amountCell.className = "tx-amount-cell";
    amountCell.append(
      element(
        "span",
        `amount amount-${transaction.type}`,
        transaction.type === "income"
          ? formatSignedCurrency(transaction.amount)
          : `−${formatCurrency(transaction.amount)}`,
      ),
    );

    const actionCell = document.createElement("td");
    actionCell.dataset.label = "Aksi";
    actionCell.className = "tx-actions-cell";
    const actions = element("div", "row-actions");
    actions.append(
      iconButton("edit", `Ubah transaksi ${transaction.description || "tanpa deskripsi"}`, {
        action: "edit-transaction",
        id: transaction.id,
      }),
      iconButton("trash", `Hapus transaksi ${transaction.description || "tanpa deskripsi"}`, {
        className: "icon-button icon-button-danger",
        action: "delete-transaction",
        id: transaction.id,
      }),
    );
    actionCell.append(actions);

    row.append(dateCell, descriptionCell, categoryCell, typeCell, amountCell, actionCell);
    dom.transactionsBody.append(row);
  }

  const empty = dom.transactionsEmpty;
  if (empty) {
    empty.hidden = filtered.length > 0;
    if (!filtered.length) {
      if (!totalCount) {
        setText(dom.transactionsEmptyTitle, "Belum ada transaksi");
        setText(
          dom.transactionsEmptyCopy,
          "Mulai catat pemasukan dan pengeluaran agar dashboard, grafik, dan anggaran dapat dihitung.",
        );
        if (dom.transactionsEmptyAdd) dom.transactionsEmptyAdd.hidden = false;
        if (dom.transactionsEmptyReset) dom.transactionsEmptyReset.hidden = true;
      } else {
        setText(dom.transactionsEmptyTitle, "Tidak ada transaksi yang cocok");
        setText(
          dom.transactionsEmptyCopy,
          "Coba kata kunci, jenis, kategori, atau periode yang lain. Filter dapat dihapus tanpa mengubah data.",
        );
        if (dom.transactionsEmptyAdd) dom.transactionsEmptyAdd.hidden = true;
        if (dom.transactionsEmptyReset) dom.transactionsEmptyReset.hidden = false;
      }
    }
  }
  if (dom.transactionsTableWrap) dom.transactionsTableWrap.hidden = filtered.length === 0;
}

export function renderBudgetsView(dom, { data, month }) {
  const usage = getBudgetUsage(data.budgets, data.transactions, month);
  const spending = getExpenseSpendingByCategory(data.transactions, month);
  setText(dom.budgetLimitValue, formatCurrency(usage.totals.limit));
  setText(dom.budgetUsedValue, formatCurrency(usage.totals.used));
  setText(dom.budgetRemainingValue, formatCurrency(usage.totals.remaining));
  if (dom.budgetRemainingValue) {
    dom.budgetRemainingValue.classList.toggle("is-negative", usage.totals.remaining < 0);
  }
  setText(
    dom.budgetSummaryCopy,
    usage.totals.count
      ? `${usage.totals.count} dari ${EXPENSE_CATEGORIES.length} kategori pengeluaran memiliki anggaran.`
      : "Belum ada anggaran untuk bulan ini.",
  );
  setText(dom.budgetPeriodCopy, `Anggaran dan pemakaian untuk ${formatMonth(month)}.`);

  if (dom.budgetEmpty) {
    dom.budgetEmpty.hidden = usage.items.length > 0;
  }

  dom.budgetGrid.replaceChildren();
  for (const category of EXPENSE_CATEGORIES) {
    const item = usage.items.find((budget) => budget.categoryId === category.id) || null;
    const card = element("article", `budget-card${item ? ` budget-card-${item.status}` : " budget-card-unset"}`);
    const head = element("div", "budget-card-head");
    const heading = element("div", "budget-category");
    const dot = element("span", "category-dot");
    dot.style.backgroundColor = category.color;
    dot.setAttribute("aria-hidden", "true");
    heading.append(dot, element("h3", "", category.name));
    head.append(heading);

    if (item) {
      head.append(element("span", `budget-status budget-status-${item.status}`, item.statusLabel));
    } else {
      head.append(element("span", "budget-status budget-status-unset", "Belum dianggarkan"));
    }
    card.append(head);

    if (item) {
      const figures = element("dl", "budget-figures");
      for (const [term, value, className] of [
        ["Batas", formatCurrency(item.limit), ""],
        ["Terpakai", formatCurrency(item.used), ""],
        ["Sisa", formatCurrency(item.remaining), item.remaining < 0 ? "is-negative" : ""],
      ]) {
        const group = element("div", `budget-figure${className ? ` ${className}` : ""}`);
        group.append(element("dt", "", term), element("dd", "", value));
        figures.append(group);
      }
      const percentRow = element("div", "budget-percent-row");
      percentRow.append(element("span", "", `${item.percent}% terpakai`));
      percentRow.append(element("span", "muted", `${formatCurrency(item.used)} / ${formatCurrency(item.limit)}`));
      const track = element("div", `budget-track budget-track-${item.status}`);
      const fill = element("span", `budget-fill budget-fill-${item.status}`);
      fill.style.width = `${Math.min(100, item.percent)}%`;
      track.append(fill);
      track.setAttribute("role", "progressbar");
      track.setAttribute("aria-valuemin", "0");
      track.setAttribute("aria-valuemax", "100");
      track.setAttribute("aria-valuenow", String(Math.min(100, item.percent)));
      track.setAttribute(
        "aria-valuetext",
        `${item.percent}% terpakai, ${item.statusLabel.toLowerCase()}`,
      );
      track.setAttribute("aria-label", `Pemakaian anggaran ${category.name}`);
      const actions = element("div", "budget-card-actions");
      actions.append(
        iconButton("edit", `Ubah anggaran ${category.name}`, {
          action: "edit-budget",
          id: item.id,
        }),
        iconButton("trash", `Hapus anggaran ${category.name}`, {
          className: "icon-button icon-button-danger",
          action: "delete-budget",
          id: item.id,
        }),
      );
      card.append(figures, percentRow, track, actions);
    } else {
      const used = spending[category.id] || 0;
      const copy = element("p", "budget-unset-copy");
      copy.append(element("span", "", "Terpakai bulan ini"));
      copy.append(element("strong", "", formatCurrency(used)));
      card.append(copy);
      const add = button("button button-secondary budget-add-button", "Atur anggaran");
      add.dataset.action = "new-budget";
      add.dataset.category = category.id;
      card.append(add);
    }
    dom.budgetGrid.append(card);
  }
}

export function renderBudgetFormOptions(select, selectedId = "") {
  populateCategorySelect(select, "expense", selectedId);
}

export function showStorageNotice(dom, {
  title,
  message,
  rawAvailable = false,
  resetAvailable = false,
}) {
  if (!dom.storageBanner) return;
  dom.storageBanner.hidden = false;
  setText(dom.storageBannerTitle, title);
  setText(dom.storageBannerMessage, message);
  if (dom.downloadRawButton) dom.downloadRawButton.hidden = !rawAvailable;
  if (dom.resetStorageButton) dom.resetStorageButton.hidden = !resetAvailable;
}

export function hideStorageNotice(dom) {
  if (dom.storageBanner) dom.storageBanner.hidden = true;
}

export function renderSaveState(dom, state, message) {
  if (!dom.saveState) return;
  dom.saveState.dataset.state = state;
  setText(dom.saveStateText, message);
}

export function showToast(message, tone = "success") {
  const toast = document.getElementById("toast");
  const toastMessage = document.getElementById("toast-message");
  const iconUse = document.getElementById("toast-icon-use");
  if (!toast || !toastMessage || !iconUse) return;
  toast.hidden = false;
  toast.dataset.tone = tone;
  toastMessage.textContent = message;
  iconUse.setAttribute("href", tone === "error" ? "#icon-alert" : "#icon-check");
  if (toastTimer) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => hideToast(), 4800);
}

export function hideToast() {
  const toast = document.getElementById("toast");
  if (toast) toast.hidden = true;
  if (toastTimer) {
    window.clearTimeout(toastTimer);
    toastTimer = null;
  }
}

export function clearFormErrors(form) {
  if (!form) return;
  for (const error of form.querySelectorAll("[data-error-for]")) {
    error.textContent = "";
  }
  for (const field of form.querySelectorAll("[aria-invalid='true']")) {
    field.removeAttribute("aria-invalid");
  }
  const formError = form.querySelector("[data-form-error]");
  if (formError) {
    formError.textContent = "";
    formError.hidden = true;
  }
}

export function showFormErrors(form, errors) {
  if (!form) return;
  clearFormErrors(form);
  for (const error of form.querySelectorAll("[data-error-for]")) {
    const name = error.dataset.errorFor;
    if (errors[name]) {
      error.textContent = errors[name];
      const field = form.querySelector(`[name="${name}"]`);
      if (field) field.setAttribute("aria-invalid", "true");
    }
  }
  if (errors.form) {
    const formError = form.querySelector("[data-form-error]");
    if (formError) {
      formError.textContent = errors.form;
      formError.hidden = false;
    }
  }
}

export function focusFirstError(form, errors) {
  if (!form) return;
  const order = ["type", "amount", "categoryId", "date", "description", "month", "limit", "form"];
  for (const name of order) {
    if (!errors[name]) continue;
    if (name === "form") {
      const formError = form.querySelector("[data-form-error]");
      formError?.focus?.();
      return;
    }
    const field = form.querySelector(`[name="${name}"]`);
    if (field) {
      field.focus();
      return;
    }
  }
}

export function updateDescriptionCount(textarea, counter) {
  if (!textarea || !counter) return;
  counter.textContent = `${textarea.value.length}/160`;
}

export function renderSortOptions(select) {
  if (!select) return;
  const fragment = document.createDocumentFragment();
  for (const option of SORT_OPTIONS) {
    const node = document.createElement("option");
    node.value = option.id;
    node.textContent = option.label;
    fragment.append(node);
  }
  select.replaceChildren(fragment);
}

export function setDialogTitle(dom, title) {
  setText(dom.transactionDialogTitle, title);
}

export function setBudgetDialogTitle(dom, title) {
  setText(dom.budgetDialogTitle, title);
}

export function setConfirmContent(dom, { title, message, confirmLabel, tone = "danger" }) {
  setText(dom.confirmTitle, title);
  setText(dom.confirmMessage, message);
  setText(dom.confirmSubmit, confirmLabel);
  dom.confirmSubmit.className = tone === "danger" ? "button button-danger" : "button button-primary";
}

export function updateTransactionTypeCategories(dom, type, selectedId = "") {
  if (!dom.transactionCategory) return;
  populateCategorySelect(dom.transactionCategory, type, selectedId);
}

export function setBudgetFormCategory(dom, categoryId, { disabled = false } = {}) {
  if (!dom.budgetCategory) return;
  if (categoryId) dom.budgetCategory.value = categoryId;
  dom.budgetCategory.disabled = disabled;
}

export function setTransactionFormCategory(dom, categoryId) {
  if (dom.transactionCategory && categoryId) dom.transactionCategory.value = categoryId;
}

export function setBudgetMonthField(dom, month) {
  if (dom.budgetFormMonth) dom.budgetFormMonth.value = month;
}

export function setTransactionDateField(dom, date) {
  if (dom.transactionDate) dom.transactionDate.value = date;
}

export function setAmountField(dom, amount) {
  if (dom.transactionAmount) dom.transactionAmount.value = amount;
}

export function setBudgetLimitField(dom, amount) {
  if (dom.budgetLimit) dom.budgetLimit.value = amount;
}

export function setTransactionDescriptionField(dom, description) {
  if (dom.transactionDescription) dom.transactionDescription.value = description;
  if (dom.transactionDescription && dom.transactionDescriptionCount) {
    updateDescriptionCount(dom.transactionDescription, dom.transactionDescriptionCount);
  }
}

export function setTransactionType(dom, type) {
  if (!dom.transactionForm) return;
  const radio = dom.transactionForm.querySelector(`input[name="type"][value="${type}"]`);
  if (radio) radio.checked = true;
}

export function getTransactionFormValues(dom) {
  const form = dom.transactionForm;
  const type = form.querySelector("input[name='type']:checked")?.value || "";
  return {
    type,
    amount: dom.transactionAmount?.value || "",
    categoryId: dom.transactionCategory?.value || "",
    date: dom.transactionDate?.value || "",
    description: dom.transactionDescription?.value || "",
  };
}

export function getBudgetFormValues(dom) {
  return {
    categoryId: dom.budgetCategory?.value || "",
    month: dom.budgetFormMonth?.value || "",
    limit: dom.budgetLimit?.value || "",
  };
}

export function focusTransactionForm(dom) {
  dom.transactionAmount?.focus();
}

export function focusBudgetForm(dom) {
  dom.budgetLimit?.focus();
}

export function setButtonBusy(buttonElement, busy, busyLabel = "Menyimpan…") {
  if (!buttonElement) return;
  if (busy) {
    buttonElement.dataset.originalLabel = buttonElement.textContent;
    buttonElement.textContent = busyLabel;
    buttonElement.disabled = true;
  } else {
    if (buttonElement.dataset.originalLabel) {
      buttonElement.textContent = buttonElement.dataset.originalLabel;
      delete buttonElement.dataset.originalLabel;
    }
    buttonElement.disabled = false;
  }
}
