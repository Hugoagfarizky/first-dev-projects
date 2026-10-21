import { normalizeHabit } from "./habits.js";
import { createCheckinStore, normalizeCheckins } from "./checkins.js";
import { todayKey } from "./dates.js";

export const STORAGE_KEY = "habitTracker.data.v1";
export const STORAGE_VERSION = 1;

function errorMessage(error, fallback) {
  if (!error) return fallback;
  if (error.name === "SecurityError") {
    return "Akses penyimpanan browser diblokir. Perubahan hanya bertahan selama tab ini terbuka.";
  }
  if (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED") {
    return "Ruang penyimpanan browser penuh. Hapus sebagian data lalu coba lagi.";
  }
  return fallback;
}

function resolveStorage(storageOverride) {
  if (storageOverride !== undefined) {
    return { storage: storageOverride, error: null };
  }
  try {
    return { storage: globalThis.window?.localStorage || null, error: null };
  } catch (error) {
    return { storage: null, error };
  }
}

function emptyResult(status, message = "", extra = {}) {
  return {
    status,
    habits: [],
    checkins: createCheckinStore(),
    message,
    raw: "",
    invalidCount: 0,
    ...extra,
  };
}

export function loadData(storageOverride) {
  const { storage, error } = resolveStorage(storageOverride);
  if (!storage) {
    return emptyResult(
      "unavailable",
      errorMessage(error, "Penyimpanan lokal tidak dapat diakses. Perubahan tidak akan tersimpan."),
    );
  }

  let raw;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch (readError) {
    return emptyResult(
      "unavailable",
      errorMessage(readError, "Data lokal tidak dapat dibaca. Perubahan tidak akan tersimpan."),
    );
  }

  if (raw === null || raw === undefined) {
    return emptyResult("empty");
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return emptyResult(
      "corrupt",
      "Data lokal tidak dapat dibaca karena formatnya rusak. Data lama tidak ditimpa.",
      { raw },
    );
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    Array.isArray(parsed) ||
    parsed.version !== STORAGE_VERSION ||
    !Array.isArray(parsed.habits) ||
    !parsed.checkins ||
    typeof parsed.checkins !== "object" ||
    Array.isArray(parsed.checkins)
  ) {
    return emptyResult(
      "corrupt",
      "Format data lokal tidak dikenali. Data lama tidak ditimpa.",
      { raw },
    );
  }

  const habits = [];
  const seenIds = new Set();
  let invalidHabits = 0;

  for (const item of parsed.habits) {
    const habit = normalizeHabit(item);
    if (!habit || seenIds.has(habit.id)) {
      invalidHabits += 1;
      continue;
    }
    seenIds.add(habit.id);
    habits.push(habit);
  }

  const normalizedCheckins = normalizeCheckins(parsed.checkins, habits, todayKey());
  const invalidCount = invalidHabits + normalizedCheckins.invalidCount;

  if (invalidCount > 0) {
    return {
      status: "partial",
      habits,
      checkins: normalizedCheckins.checkins,
      message: `${invalidCount} data lokal tidak valid dan dilewati. Data lain tetap ditampilkan tanpa ditimpa.`,
      raw,
      invalidCount,
    };
  }

  return {
    status: "ready",
    habits,
    checkins: normalizedCheckins.checkins,
    message: "",
    raw,
    invalidCount: 0,
  };
}

export function saveData(data, storageOverride) {
  const { storage, error } = resolveStorage(storageOverride);
  if (!storage) {
    return {
      ok: false,
      message: errorMessage(
        error,
        "Perubahan tidak dapat disimpan karena penyimpanan tidak dapat diakses.",
      ),
    };
  }

  try {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: STORAGE_VERSION,
        habits: data.habits,
        checkins: data.checkins,
      }),
    );
    return { ok: true, message: "" };
  } catch (writeError) {
    return {
      ok: false,
      message: errorMessage(
        writeError,
        "Perubahan tidak dapat disimpan. Coba lagi setelah memeriksa penyimpanan browser.",
      ),
    };
  }
}

export function createEmptyData() {
  return { habits: [], checkins: createCheckinStore() };
}

export function getStoredRaw(storageOverride) {
  const { storage } = resolveStorage(storageOverride);
  if (!storage) return "";
  try {
    return storage.getItem(STORAGE_KEY) || "";
  } catch {
    return "";
  }
}
