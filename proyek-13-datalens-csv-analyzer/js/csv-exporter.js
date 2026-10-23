import { parseNumericCell } from "./data-analyzer.js";

// Best-effort: abaikan whitespace, karakter kontrol, BOM, dan karakter format
// tak terlihat di awal sebelum memeriksa prefiks formula.
const FORMULA_PREFIX_PATTERN = /^[\s\p{Cc}\p{Cf}\uFEFF]*[=+\-@]/u;

export function needsFormulaProtection(value) {
  const text = String(value ?? "");
  return FORMULA_PREFIX_PATTERN.test(text) && parseNumericCell(text) === null;
}

export function sanitizeSpreadsheetCell(value) {
  const text = String(value ?? "");
  return needsFormulaProtection(text) ? `'${text}` : text;
}

export function escapeCsvField(value) {
  const sanitized = sanitizeSpreadsheetCell(value);

  if (/[",\r\n]/.test(sanitized)) {
    return `"${sanitized.replaceAll('"', '""')}"`;
  }

  return sanitized;
}

export function buildCsv(headers, rows) {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvField).join(","));
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export function makeExportFilename(sourceName, { filtered = false, rowCount = 0, now = new Date() } = {}) {
  const base =
    String(sourceName ?? "datalens")
      .replace(/\.[^.]+$/, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "datalens";

  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");

  const scope = filtered ? "filter" : "semua";
  return `${base}-${scope}-${rowCount}baris-${date}.csv`;
}
