import {
  compareDateKeys,
  isValidDateKey,
  monthKeyOf,
} from "./dates.js";
import {
  getCategoryById,
  isTransactionType,
  isValidCategoryForType,
} from "./categories.js";
import { isPositiveIntegerAmount, parseAmount } from "./money.js";

export const DESCRIPTION_MAX = 160;

export const DEFAULT_FILTERS = Object.freeze({
  search: "",
  type: "all",
  category: "all",
  month: "all",
  from: "",
  to: "",
  sort: "date-desc",
});

export const SORT_OPTIONS = Object.freeze([
  { id: "date-desc", label: "Tanggal terbaru" },
  { id: "date-asc", label: "Tanggal terlama" },
  { id: "amount-desc", label: "Nominal terbesar" },
  { id: "amount-asc", label: "Nominal terkecil" },
]);

const ID_PATTERN = /^[A-Za-z0-9_-]{6,120}$/;

export function createTransactionId() {
  const randomId = globalThis.crypto?.randomUUID?.();
  if (randomId) return `txn-${randomId}`;
  return `txn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizedNow(now) {
  const value = now instanceof Date ? now : new Date();
  return Number.isNaN(value.getTime()) ? new Date().toISOString() : value.toISOString();
}

function normalizeDescription(value) {
  if (value === undefined || value === null) return { ok: true, value: "" };
  if (typeof value !== "string") {
    return { ok: false, value: "", error: "Deskripsi harus berupa teks." };
  }
  const text = value.trim();
  if (text.length > DESCRIPTION_MAX) {
    return {
      ok: false,
      value: text,
      error: `Deskripsi maksimal ${DESCRIPTION_MAX} karakter.`,
    };
  }
  return { ok: true, value: text };
}

export function validateTransactionInput(input = {}) {
  const errors = {};
  const type = input.type;
  if (!isTransactionType(type)) {
    errors.type = "Pilih jenis transaksi.";
  }

  const amount = parseAmount(input.amount);
  if (!amount.ok) errors.amount = amount.error;

  const categoryId = typeof input.categoryId === "string" ? input.categoryId : "";
  const category = getCategoryById(categoryId);
  if (!categoryId) {
    errors.categoryId = "Pilih kategori.";
  } else if (!category) {
    errors.categoryId = "Kategori tidak valid.";
  } else if (!isTransactionType(type)) {
    errors.categoryId = "Pilih jenis transaksi terlebih dahulu.";
  } else if (!isValidCategoryForType(categoryId, type)) {
    errors.categoryId = "Kategori tidak sesuai dengan jenis transaksi.";
  }

  const date = typeof input.date === "string" ? input.date.trim() : "";
  if (!date) {
    errors.date = "Tanggal transaksi wajib diisi.";
  } else if (!isValidDateKey(date)) {
    errors.date = "Tanggal transaksi tidak valid.";
  }

  const description = normalizeDescription(input.description);
  if (!description.ok) errors.description = description.error;

  if (Object.keys(errors).length) {
    return { ok: false, errors, value: null };
  }

  return {
    ok: true,
    errors: {},
    value: {
      type,
      amount: amount.value,
      categoryId,
      date,
      description: description.value,
    },
  };
}

export function createTransaction(input, { now = new Date(), id = createTransactionId() } = {}) {
  const validation = validateTransactionInput(input);
  if (!validation.ok) return { ok: false, errors: validation.errors, transaction: null };
  if (!ID_PATTERN.test(id)) {
    return {
      ok: false,
      errors: { form: "ID transaksi tidak valid." },
      transaction: null,
    };
  }

  const timestamp = normalizedNow(now);
  return {
    ok: true,
    errors: {},
    transaction: {
      id,
      ...validation.value,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  };
}

export function updateTransaction(existing, input, { now = new Date() } = {}) {
  const validation = validateTransactionInput(input);
  if (!validation.ok) return { ok: false, errors: validation.errors, transaction: null };
  if (!existing || typeof existing.id !== "string") {
    return {
      ok: false,
      errors: { form: "Transaksi yang akan diubah tidak ditemukan." },
      transaction: null,
    };
  }

  return {
    ok: true,
    errors: {},
    transaction: {
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

export function normalizeTransactions(raw) {
  if (!Array.isArray(raw)) return { transactions: [], invalidCount: 1 };

  const transactions = [];
  const seenIds = new Set();
  let invalidCount = 0;

  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      invalidCount += 1;
      continue;
    }

    const id = typeof item.id === "string" ? item.id.trim() : "";
    if (!ID_PATTERN.test(id) || seenIds.has(id)) {
      invalidCount += 1;
      continue;
    }

    const validation = validateTransactionInput(item);
    const createdAt = normalizeIsoTimestamp(item.createdAt);
    const updatedAt = normalizeIsoTimestamp(item.updatedAt);
    if (!validation.ok || !createdAt || !updatedAt) {
      invalidCount += 1;
      continue;
    }

    seenIds.add(id);
    transactions.push({
      id,
      ...validation.value,
      createdAt,
      updatedAt,
    });
  }

  return { transactions, invalidCount };
}

export function getTransactionById(transactions, transactionId) {
  return transactions.find((transaction) => transaction.id === transactionId) || null;
}

function compareTimestamps(left, right) {
  return String(left.updatedAt).localeCompare(String(right.updatedAt));
}

function compareForSort(left, right, sort) {
  switch (sort) {
    case "date-asc":
      return (
        compareDateKeys(left.date, right.date) ||
        compareTimestamps(left, right) ||
        left.id.localeCompare(right.id)
      );
    case "amount-desc":
      return (
        right.amount - left.amount ||
        compareDateKeys(right.date, left.date) ||
        compareTimestamps(right, left) ||
        left.id.localeCompare(right.id)
      );
    case "amount-asc":
      return (
        left.amount - right.amount ||
        compareDateKeys(right.date, left.date) ||
        compareTimestamps(right, left) ||
        left.id.localeCompare(right.id)
      );
    case "date-desc":
    default:
      return (
        compareDateKeys(right.date, left.date) ||
        compareTimestamps(right, left) ||
        left.id.localeCompare(right.id)
      );
  }
}

export function filterTransactions(transactions, filters = {}) {
  const active = { ...DEFAULT_FILTERS, ...filters };
  const search = typeof active.search === "string" ? active.search.trim().toLowerCase() : "";
  const from = isValidDateKey(active.from) ? active.from : "";
  const to = isValidDateKey(active.to) ? active.to : "";
  const month = typeof active.month === "string" && active.month !== "all" ? active.month : "";

  const filtered = transactions.filter((transaction) => {
    if (search && !transaction.description.toLowerCase().includes(search)) return false;
    if (active.type !== "all" && transaction.type !== active.type) return false;
    if (active.category !== "all" && transaction.categoryId !== active.category) return false;
    if (month && monthKeyOf(transaction.date) !== month) return false;
    if (from && compareDateKeys(transaction.date, from) < 0) return false;
    if (to && compareDateKeys(transaction.date, to) > 0) return false;
    return true;
  });

  return filtered.sort((left, right) => compareForSort(left, right, active.sort));
}

export function hasActiveFilters(filters = {}) {
  const active = { ...DEFAULT_FILTERS, ...filters };
  const search = typeof active.search === "string" ? active.search.trim() : "";
  return (
    Boolean(search) ||
    active.type !== "all" ||
    active.category !== "all" ||
    active.month !== "all" ||
    Boolean(active.from) ||
    Boolean(active.to) ||
    active.sort !== DEFAULT_FILTERS.sort
  );
}

export function getTransactionMonths(transactions) {
  return [...new Set(transactions.map((transaction) => monthKeyOf(transaction.date)).filter(Boolean))].sort(
    (left, right) => right.localeCompare(left),
  );
}

export function summarizeTransactions(transactions) {
  let income = 0;
  let expense = 0;
  for (const transaction of transactions) {
    if (!isPositiveIntegerAmount(transaction.amount)) continue;
    if (transaction.type === "income") income += transaction.amount;
    else if (transaction.type === "expense") expense += transaction.amount;
  }
  return {
    income,
    expense,
    net: income - expense,
    count: transactions.length,
  };
}
