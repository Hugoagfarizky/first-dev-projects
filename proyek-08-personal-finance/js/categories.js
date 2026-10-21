export const TRANSACTION_TYPES = Object.freeze(["income", "expense"]);

export const TYPE_LABELS = Object.freeze({
  income: "Pemasukan",
  expense: "Pengeluaran",
});

export const CATEGORY_DEFINITIONS = Object.freeze([
  { id: "salary", name: "Gaji", type: "income", color: "#1f6b52" },
  { id: "freelance", name: "Freelance", type: "income", color: "#2d8271" },
  { id: "investment", name: "Investasi", type: "income", color: "#4f8a5b" },
  { id: "other-income", name: "Lainnya", type: "income", color: "#7a9a68" },
  { id: "food", name: "Makanan", type: "expense", color: "#c47b3c" },
  { id: "transport", name: "Transportasi", type: "expense", color: "#4f7d9e" },
  { id: "bills", name: "Tagihan", type: "expense", color: "#8a6a9c" },
  { id: "shopping", name: "Belanja", type: "expense", color: "#b15f68" },
  { id: "education", name: "Pendidikan", type: "expense", color: "#437f73" },
  { id: "health", name: "Kesehatan", type: "expense", color: "#b28a3d" },
  { id: "entertainment", name: "Hiburan", type: "expense", color: "#9b6b4a" },
  { id: "other-expense", name: "Lainnya", type: "expense", color: "#7a8178" },
]);

export const CATEGORIES = Object.freeze(
  CATEGORY_DEFINITIONS.map((category) => Object.freeze({ ...category })),
);

export const CATEGORY_MAP = Object.freeze(
  Object.fromEntries(CATEGORIES.map((category) => [category.id, category])),
);

export const INCOME_CATEGORIES = Object.freeze(
  CATEGORIES.filter((category) => category.type === "income"),
);

export const EXPENSE_CATEGORIES = Object.freeze(
  CATEGORIES.filter((category) => category.type === "expense"),
);

export function isTransactionType(value) {
  return value === "income" || value === "expense";
}

export function getCategoryById(categoryId) {
  return CATEGORY_MAP[categoryId] || null;
}

export function getCategoriesByType(type) {
  if (!isTransactionType(type)) return [];
  return type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
}

export function isValidCategoryForType(categoryId, type) {
  const category = getCategoryById(categoryId);
  return Boolean(category && category.type === type);
}

export function getCategoryName(categoryId) {
  return getCategoryById(categoryId)?.name || "Kategori tidak dikenal";
}

export function getCategoryColor(categoryId) {
  return getCategoryById(categoryId)?.color || "#7a8178";
}

export function getCategoryType(categoryId) {
  return getCategoryById(categoryId)?.type || null;
}
