import { getCategoryName, TYPE_LABELS } from "./categories.js";
import { todayKey } from "./dates.js";

export const CSV_HEADERS = Object.freeze([
  "Tanggal (YYYY-MM-DD)",
  "Jenis",
  "Kategori",
  "Deskripsi",
  "Nominal (Rp)",
]);

const CSV_BOM = "\uFEFF";

function protectFormula(text) {
  if (/^[\s]*[=+\-@]/.test(text)) return `'${text}`;
  return text;
}

export function escapeCsvField(value, { protect = true } = {}) {
  const text = value === undefined || value === null ? "" : String(value);
  const safe = protect ? protectFormula(text) : text;
  if (/[",\r\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export function buildCsv(transactions) {
  const rows = [CSV_HEADERS.join(",")];
  for (const transaction of transactions) {
    rows.push(
      [
        escapeCsvField(transaction.date),
        escapeCsvField(TYPE_LABELS[transaction.type] || transaction.type),
        escapeCsvField(getCategoryName(transaction.categoryId)),
        escapeCsvField(transaction.description || ""),
        escapeCsvField(transaction.amount, { protect: false }),
      ].join(","),
    );
  }
  return `${CSV_BOM}${rows.join("\r\n")}\r\n`;
}

export function createCsvFilename(filters = {}, now = new Date()) {
  const parts = ["neraca-transaksi"];
  if (filters.month && filters.month !== "all") {
    parts.push(filters.month);
  } else if (filters.from && filters.to) {
    parts.push(`${filters.from}_sampai_${filters.to}`);
  } else {
    parts.push("semua");
  }
  parts.push(todayKey(now));
  return `${parts.join("-")}.csv`;
}
