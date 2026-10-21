import { getCategoriesByType, getCategoryById } from "./categories.js";
import { isValidMonthKey, monthKeyOf } from "./dates.js";
import { isPositiveIntegerAmount, parseAmount } from "./money.js";

const ID_PATTERN = /^[A-Za-z0-9_-]{6,120}$/;
const EXPENSE_CATEGORY_ORDER = new Map(
  getCategoriesByType("expense").map((category, index) => [category.id, index]),
);

export function createBudgetId() {
  const randomId = globalThis.crypto?.randomUUID?.();
  if (randomId) return `bdg-${randomId}`;
  return `bdg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function budgetKey(month, categoryId) {
  return `${month}:${categoryId}`;
}

function normalizedNow(now) {
  const value = now instanceof Date ? now : new Date();
  return Number.isNaN(value.getTime()) ? new Date().toISOString() : value.toISOString();
}

export function validateBudgetInput(input = {}) {
  const errors = {};
  const categoryId = typeof input.categoryId === "string" ? input.categoryId : "";
  const category = getCategoryById(categoryId);
  if (!categoryId) {
    errors.categoryId = "Pilih kategori pengeluaran.";
  } else if (!category) {
    errors.categoryId = "Kategori tidak valid.";
  } else if (category.type !== "expense") {
    errors.categoryId = "Anggaran hanya dapat dibuat untuk kategori pengeluaran.";
  }

  const month = typeof input.month === "string" ? input.month.trim() : "";
  if (!month) {
    errors.month = "Bulan anggaran wajib dipilih.";
  } else if (!isValidMonthKey(month)) {
    errors.month = "Bulan anggaran tidak valid.";
  }

  const limit = parseAmount(input.limit);
  if (!limit.ok) errors.limit = limit.error;

  if (Object.keys(errors).length) {
    return { ok: false, errors, value: null };
  }

  return {
    ok: true,
    errors: {},
    value: { categoryId, month, limit: limit.value },
  };
}

export function createBudget(input, {
  now = new Date(),
  id = createBudgetId(),
  existingBudgets = [],
} = {}) {
  const validation = validateBudgetInput(input);
  if (!validation.ok) return { ok: false, errors: validation.errors, budget: null };
  if (!ID_PATTERN.test(id)) {
    return { ok: false, errors: { form: "ID anggaran tidak valid." }, budget: null };
  }

  const key = budgetKey(validation.value.month, validation.value.categoryId);
  const duplicate = existingBudgets.some(
    (budget) => budgetKey(budget.month, budget.categoryId) === key,
  );
  if (duplicate) {
    return {
      ok: false,
      errors: {
        categoryId: "Anggaran untuk kategori dan bulan ini sudah ada. Ubah anggaran tersebut.",
      },
      budget: null,
    };
  }

  const timestamp = normalizedNow(now);
  return {
    ok: true,
    errors: {},
    budget: {
      id,
      ...validation.value,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  };
}

export function updateBudget(existing, input, { now = new Date(), existingBudgets = [] } = {}) {
  const validation = validateBudgetInput(input);
  if (!validation.ok) return { ok: false, errors: validation.errors, budget: null };
  if (!existing || typeof existing.id !== "string") {
    return { ok: false, errors: { form: "Anggaran tidak ditemukan." }, budget: null };
  }

  const key = budgetKey(validation.value.month, validation.value.categoryId);
  const duplicate = existingBudgets.some(
    (budget) =>
      budget.id !== existing.id &&
      budgetKey(budget.month, budget.categoryId) === key,
  );
  if (duplicate) {
    return {
      ok: false,
      errors: {
        categoryId: "Anggaran untuk kategori dan bulan ini sudah ada.",
      },
      budget: null,
    };
  }

  return {
    ok: true,
    errors: {},
    budget: {
      ...existing,
      ...validation.value,
      updatedAt: normalizedNow(now),
    },
  };
}

function normalizeIsoTimestamp(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function normalizeBudgets(raw) {
  if (!Array.isArray(raw)) return { budgets: [], invalidCount: 1 };

  const budgets = [];
  const seenIds = new Set();
  const seenKeys = new Set();
  let invalidCount = 0;

  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      invalidCount += 1;
      continue;
    }

    const id = typeof item.id === "string" ? item.id.trim() : "";
    const validation = validateBudgetInput(item);
    const key = validation.ok ? budgetKey(validation.value.month, validation.value.categoryId) : null;
    const createdAt = normalizeIsoTimestamp(item.createdAt);
    const updatedAt = normalizeIsoTimestamp(item.updatedAt);
    if (
      !ID_PATTERN.test(id) ||
      seenIds.has(id) ||
      !validation.ok ||
      !key ||
      seenKeys.has(key) ||
      !createdAt ||
      !updatedAt
    ) {
      invalidCount += 1;
      continue;
    }

    seenIds.add(id);
    seenKeys.add(key);
    budgets.push({
      id,
      ...validation.value,
      createdAt,
      updatedAt,
    });
  }

  return { budgets, invalidCount };
}

export function getBudgetById(budgets, budgetId) {
  return budgets.find((budget) => budget.id === budgetId) || null;
}

export function getBudgetForCategory(budgets, categoryId, month) {
  return (
    budgets.find(
      (budget) => budget.categoryId === categoryId && budget.month === month,
    ) || null
  );
}

export function getBudgetPercent(used, limit) {
  if (!Number.isFinite(used) || !Number.isFinite(limit) || limit <= 0) {
    return used > 0 ? 100 : 0;
  }
  return Math.round((used / limit) * 100);
}

export function getBudgetStatus(used, limit) {
  const percent = getBudgetPercent(used, limit);
  if (used > limit) return { status: "over", label: "Melewati batas", percent };
  if (percent >= 80) return { status: "warning", label: "Mendekati batas", percent };
  return { status: "safe", label: "Dalam batas", percent };
}

export function getBudgetUsage(budgets, transactions, month) {
  if (!isValidMonthKey(month)) {
    return {
      month,
      items: [],
      totals: { limit: 0, used: 0, remaining: 0, count: 0 },
      spentByCategory: {},
    };
  }

  const spentByCategory = {};
  for (const transaction of transactions) {
    if (
      transaction.type !== "expense" ||
      !isPositiveIntegerAmount(transaction.amount) ||
      monthKeyOf(transaction.date) !== month
    ) {
      continue;
    }
    spentByCategory[transaction.categoryId] =
      (spentByCategory[transaction.categoryId] || 0) + transaction.amount;
  }

  const items = budgets
    .filter((budget) => budget.month === month)
    .sort(
      (left, right) =>
        (EXPENSE_CATEGORY_ORDER.get(left.categoryId) ?? 99) -
        (EXPENSE_CATEGORY_ORDER.get(right.categoryId) ?? 99),
    )
    .map((budget) => {
      const used = spentByCategory[budget.categoryId] || 0;
      const status = getBudgetStatus(used, budget.limit);
      return {
        ...budget,
        category: getCategoryById(budget.categoryId),
        used,
        remaining: budget.limit - used,
        percent: status.percent,
        status: status.status,
        statusLabel: status.label,
      };
    });

  const totals = items.reduce(
    (result, item) => ({
      limit: result.limit + item.limit,
      used: result.used + item.used,
      remaining: result.remaining + item.remaining,
      count: result.count + 1,
    }),
    { limit: 0, used: 0, remaining: 0, count: 0 },
  );

  return { month, items, totals, spentByCategory };
}
