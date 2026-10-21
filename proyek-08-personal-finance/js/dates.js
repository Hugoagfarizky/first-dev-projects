export const MONTH_NAMES = Object.freeze([
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
]);

export const MONTH_SHORT = Object.freeze([
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
]);

export const WEEKDAY_NAMES = Object.freeze([
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
]);

export const WEEKDAY_SHORT = Object.freeze(["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"]);

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_KEY_PATTERN = /^(\d{4})-(\d{2})$/;

export function pad2(value) {
  return String(value).padStart(2, "0");
}

export function isValidDateKey(value) {
  if (typeof value !== "string") return false;
  const match = DATE_KEY_PATTERN.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }

  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export function isValidMonthKey(value) {
  if (typeof value !== "string") return false;
  const match = MONTH_KEY_PATTERN.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  return year >= 1900 && year <= 2200 && month >= 1 && month <= 12;
}

export function parseDateKey(value) {
  if (!isValidDateKey(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

export function parseMonthKey(value) {
  if (!isValidMonthKey(value)) return null;
  const [year, month] = value.split("-").map(Number);
  return { year, month };
}

export function dateKeyFromParts(year, month, day) {
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function monthKeyFromParts(year, month) {
  if (year < 1900 || year > 2200 || month < 1 || month > 12) return null;
  return `${year}-${pad2(month)}`;
}

export function todayKey(date = new Date()) {
  return dateKeyFromParts(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function currentMonthKey(date = new Date()) {
  return monthKeyFromParts(date.getFullYear(), date.getMonth() + 1);
}

export function monthKeyOf(dateKey) {
  return isValidDateKey(dateKey) ? dateKey.slice(0, 7) : null;
}

export function compareDateKeys(left, right) {
  return String(left).localeCompare(String(right));
}

export function compareMonthKeys(left, right) {
  return String(left).localeCompare(String(right));
}

export function addDays(dateKey, amount) {
  const parts = parseDateKey(dateKey);
  if (!parts || !Number.isInteger(amount)) return null;
  const date = new Date(parts.year, parts.month - 1, parts.day + amount);
  return todayKey(date);
}

export function daysInMonth(monthKey) {
  const parts = parseMonthKey(monthKey);
  if (!parts) return 0;
  return new Date(parts.year, parts.month, 0).getDate();
}

export function monthRange(monthKey) {
  const parts = parseMonthKey(monthKey);
  if (!parts) return null;
  return {
    start: `${monthKey}-01`,
    end: `${monthKey}-${pad2(daysInMonth(monthKey))}`,
  };
}

export function shiftMonth(monthKey, amount) {
  const parts = parseMonthKey(monthKey);
  if (!parts || !Number.isInteger(amount)) return null;
  const date = new Date(parts.year, parts.month - 1 + amount, 1);
  return monthKeyFromParts(date.getFullYear(), date.getMonth() + 1);
}

export function previousMonthKey(monthKey) {
  return shiftMonth(monthKey, -1);
}

export function getLastMonths(endMonthKey, count = 6) {
  if (!isValidMonthKey(endMonthKey) || !Number.isInteger(count) || count < 1) {
    return [];
  }
  const months = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    months.push(shiftMonth(endMonthKey, -offset));
  }
  return months;
}

export function isDateInMonth(dateKey, monthKey) {
  return isValidDateKey(dateKey) && isValidMonthKey(monthKey) && dateKey.startsWith(`${monthKey}-`);
}

export function formatMonth(monthKey, { short = false } = {}) {
  const parts = parseMonthKey(monthKey);
  if (!parts) return "";
  const names = short ? MONTH_SHORT : MONTH_NAMES;
  return `${names[parts.month - 1]} ${parts.year}`;
}

export function formatMonthShort(monthKey) {
  const parts = parseMonthKey(monthKey);
  if (!parts) return "";
  return MONTH_SHORT[parts.month - 1];
}

export function formatDate(dateKey, { long = false } = {}) {
  const parts = parseDateKey(dateKey);
  if (!parts) return "";
  if (long) {
    const date = new Date(parts.year, parts.month - 1, parts.day);
    return `${WEEKDAY_NAMES[date.getDay()]}, ${parts.day} ${MONTH_NAMES[parts.month - 1]} ${parts.year}`;
  }
  return `${parts.day} ${MONTH_SHORT[parts.month - 1]} ${parts.year}`;
}

export function formatDateNumeric(dateKey) {
  const parts = parseDateKey(dateKey);
  if (!parts) return "";
  return `${pad2(parts.day)}/${pad2(parts.month)}/${parts.year}`;
}
