import { getCategoryById } from "./categories.js";
import {
  getLastMonths,
  isDateInMonth,
  previousMonthKey,
} from "./dates.js";
import { percentOf } from "./money.js";
import { summarizeTransactions } from "./transactions.js";

export function getMonthTransactions(transactions, month) {
  return transactions.filter((transaction) => isDateInMonth(transaction.date, month));
}

export function getPeriodSummary(transactions, month) {
  return { month, ...summarizeTransactions(getMonthTransactions(transactions, month)) };
}

export function getAllTimeSummary(transactions) {
  return summarizeTransactions(transactions);
}

function metricComparison(currentValue, previousValue, { hasPreviousData, allowPercent = true }) {
  const delta = currentValue - previousValue;
  const direction = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  const percent =
    allowPercent && hasPreviousData && previousValue > 0
      ? Math.round((delta / previousValue) * 100)
      : null;
  return {
    current: currentValue,
    previous: previousValue,
    delta,
    direction,
    percent,
    available: hasPreviousData,
  };
}

export function compareWithPreviousMonth(transactions, month) {
  const current = getPeriodSummary(transactions, month);
  const previousMonth = previousMonthKey(month);
  const previous = getPeriodSummary(transactions, previousMonth);
  const hasPreviousData = previous.count > 0;

  return {
    current,
    previous,
    previousMonth,
    hasPreviousData,
    changes: {
      income: metricComparison(current.income, previous.income, { hasPreviousData }),
      expense: metricComparison(current.expense, previous.expense, { hasPreviousData }),
      net: metricComparison(current.net, previous.net, {
        hasPreviousData,
        allowPercent: false,
      }),
      count: metricComparison(current.count, previous.count, { hasPreviousData }),
    },
  };
}

export function getCategoryExpenseBreakdown(transactions, month) {
  const totals = new Map();
  let totalExpense = 0;

  for (const transaction of transactions) {
    if (
      transaction.type !== "expense" ||
      !isDateInMonth(transaction.date, month)
    ) {
      continue;
    }
    totals.set(
      transaction.categoryId,
      (totals.get(transaction.categoryId) || 0) + transaction.amount,
    );
    totalExpense += transaction.amount;
  }

  const items = [...totals.entries()]
    .map(([categoryId, amount]) => {
      const category = getCategoryById(categoryId);
      return {
        categoryId,
        label: category?.name || "Kategori tidak dikenal",
        color: category?.color || "#7a8178",
        amount,
        percent: percentOf(amount, totalExpense),
      };
    })
    .sort(
      (left, right) =>
        right.amount - left.amount || left.label.localeCompare(right.label, "id"),
    );

  return {
    month,
    items,
    total: totalExpense,
    hasData: totalExpense > 0,
  };
}

export function getTopExpenseCategory(transactions, month) {
  return getCategoryExpenseBreakdown(transactions, month).items[0] || null;
}

export function getMonthlyTrend(transactions, endMonth, count = 6) {
  const months = getLastMonths(endMonth, count).map((month) => getPeriodSummary(transactions, month));
  const maxValue = months.reduce(
    (maximum, item) => Math.max(maximum, item.income, item.expense),
    0,
  );
  return {
    months,
    maxValue,
    hasData: months.some((item) => item.count > 0),
  };
}

function compareRecent(left, right) {
  const byDate = right.date.localeCompare(left.date);
  if (byDate) return byDate;
  const byUpdated = String(right.updatedAt).localeCompare(String(left.updatedAt));
  if (byUpdated) return byUpdated;
  return left.id.localeCompare(right.id);
}

export function getRecentTransactions(transactions, month, limit = 5) {
  return getMonthTransactions(transactions, month)
    .sort(compareRecent)
    .slice(0, Math.max(0, limit));
}

export function getExpenseSpendingByCategory(transactions, month) {
  const spending = {};
  for (const transaction of transactions) {
    if (transaction.type !== "expense" || !isDateInMonth(transaction.date, month)) continue;
    spending[transaction.categoryId] =
      (spending[transaction.categoryId] || 0) + transaction.amount;
  }
  return spending;
}
