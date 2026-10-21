export const WEEKDAY_SHORT = Object.freeze(["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"]);
export const WEEKDAY_LONG = Object.freeze([
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
]);
export const WEEKDAY_UI_ORDER = Object.freeze([1, 2, 3, 4, 5, 6, 0]);
export const MONTH_LONG = Object.freeze([
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

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

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
  if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export function dateKeyFromDate(date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function todayKey(now = new Date()) {
  return dateKeyFromDate(now);
}

export function parseDateKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function dateOrdinal(key) {
  const [year, month, day] = key.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
}

export function compareDateKeys(a, b) {
  return dateOrdinal(a) - dateOrdinal(b);
}

export function addDays(key, amount) {
  const date = parseDateKey(key);
  date.setDate(date.getDate() + amount);
  return dateKeyFromDate(date);
}

export function daysBetween(fromKey, toKey) {
  return dateOrdinal(toKey) - dateOrdinal(fromKey);
}

export function getWeekday(key) {
  return parseDateKey(key).getDay();
}

export function isWeekend(key) {
  const day = getWeekday(key);
  return day === 0 || day === 6;
}

export function shiftMonth(year, monthIndex, delta) {
  const date = new Date(year, monthIndex + delta, 1, 12, 0, 0, 0);
  return { year: date.getFullYear(), monthIndex: date.getMonth() };
}

export function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0, 12, 0, 0, 0).getDate();
}

export function monthStartKey(year, monthIndex) {
  return `${year}-${pad2(monthIndex + 1)}-01`;
}

export function getMonthGrid(year, monthIndex) {
  const first = new Date(year, monthIndex, 1, 12, 0, 0, 0);
  const offset = (first.getDay() + 6) % 7;
  const startKey = addDays(dateKeyFromDate(first), -offset);
  return Array.from({ length: 42 }, (_, index) => {
    const key = addDays(startKey, index);
    const date = parseDateKey(key);
    return {
      key,
      day: date.getDate(),
      monthIndex: date.getMonth(),
      year: date.getFullYear(),
      weekday: date.getDay(),
      inMonth: date.getMonth() === monthIndex && date.getFullYear() === year,
    };
  });
}

export function formatLongDate(key, options = {}) {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    ...options,
  }).format(parseDateKey(key));
}

export function formatDate(key, options = {}) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    ...options,
  }).format(parseDateKey(key));
}

export function formatShortDate(key) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
  }).format(parseDateKey(key));
}

export function formatMonthYear(year, monthIndex) {
  return `${MONTH_LONG[monthIndex]} ${year}`;
}

export function formatWeekday(key, style = "short") {
  const index = getWeekday(key);
  return style === "long" ? WEEKDAY_LONG[index] : WEEKDAY_SHORT[index];
}

export function getGreeting(now = new Date()) {
  const hour = now.getHours();
  if (hour < 11) return "Selamat pagi";
  if (hour < 15) return "Selamat siang";
  if (hour < 19) return "Selamat sore";
  return "Selamat malam";
}

export function getLastNDates(endKey, count) {
  return Array.from({ length: count }, (_, index) => addDays(endKey, index - (count - 1)));
}

export function isFutureDate(key, today = todayKey()) {
  return compareDateKeys(key, today) > 0;
}

export function isDateInRange(key, startKey, endKey) {
  return compareDateKeys(key, startKey) >= 0 && compareDateKeys(key, endKey) <= 0;
}
