import { normalizeBudgets } from "./budgets.js";
import { normalizeTransactions } from "./transactions.js";

export const STORAGE_KEY = "neraca.finance.v1";
export const BACKUP_KEY = "neraca.finance.backup.v1";
export const SCHEMA_VERSION = 1;

export function createEmptyData() {
  return {
    version: SCHEMA_VERSION,
    transactions: [],
    budgets: [],
  };
}

function storageErrorMessage(error, fallback) {
  if (!error) return fallback;
  if (error.name === "SecurityError") {
    return "Akses penyimpanan browser diblokir. Perubahan hanya bertahan selama tab ini terbuka.";
  }
  if (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED") {
    return "Ruang penyimpanan browser penuh. Hapus sebagian data atau ekspor data lalu coba lagi.";
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

function unavailableResult(message) {
  return {
    status: "unavailable",
    data: createEmptyData(),
    raw: "",
    invalidCount: 0,
    backupSaved: false,
    message,
    storage: null,
  };
}

function corruptResult(storage, raw, message, backupSaved = false) {
  return {
    status: "corrupt",
    data: createEmptyData(),
    raw,
    invalidCount: 0,
    backupSaved,
    message,
    storage,
  };
}

function saveRawBackup(storage, raw) {
  if (!storage) return false;
  try {
    storage.setItem(
      BACKUP_KEY,
      JSON.stringify({
        savedAt: new Date().toISOString(),
        raw,
      }),
    );
    return true;
  } catch {
    return false;
  }
}

export function loadData(storageOverride) {
  const resolved = resolveStorage(storageOverride);
  if (resolved.error) {
    return unavailableResult(storageErrorMessage(resolved.error, "Penyimpanan browser tidak dapat diakses."));
  }
  const storage = resolved.storage;
  if (!storage) {
    return unavailableResult("Penyimpanan browser tidak tersedia. Data hanya dapat digunakan selama tab ini terbuka.");
  }

  let raw;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch (error) {
    return unavailableResult(
      storageErrorMessage(error, "Data lokal tidak dapat dibaca. Data hanya dapat digunakan di memori."),
    );
  }

  if (raw === null) {
    return {
      status: "empty",
      data: createEmptyData(),
      raw: "",
      invalidCount: 0,
      backupSaved: false,
      message: "",
      storage,
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const backupSaved = saveRawBackup(storage, raw);
    return corruptResult(
      storage,
      raw,
      `Data lokal tidak dapat dibaca karena JSON rusak.${
        backupSaved ? " Salinan mentah telah dicadangkan di browser." : " Unduh data mentah sebelum mereset."
      }`,
      backupSaved,
    );
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    const backupSaved = saveRawBackup(storage, raw);
    return corruptResult(
      storage,
      raw,
      "Struktur data lokal tidak dikenali. Data mentah dapat diunduh sebelum reset.",
      backupSaved,
    );
  }

  if (parsed.version !== SCHEMA_VERSION) {
    const backupSaved = saveRawBackup(storage, raw);
    return corruptResult(
      storage,
      raw,
      `Versi skema data tidak dikenal (${String(parsed.version ?? "tidak ada")}).`,
      backupSaved,
    );
  }

  if (!Array.isArray(parsed.transactions) || !Array.isArray(parsed.budgets)) {
    const backupSaved = saveRawBackup(storage, raw);
    return corruptResult(
      storage,
      raw,
      "Data transaksi atau anggaran tidak memiliki struktur yang valid.",
      backupSaved,
    );
  }

  const transactions = normalizeTransactions(parsed.transactions);
  const budgets = normalizeBudgets(parsed.budgets);
  const invalidCount = transactions.invalidCount + budgets.invalidCount;
  const data = {
    version: SCHEMA_VERSION,
    transactions: transactions.transactions,
    budgets: budgets.budgets,
  };

  if (invalidCount > 0) {
    return {
      status: "partial",
      data,
      raw,
      invalidCount,
      backupSaved: false,
      message: `${invalidCount} catatan tidak valid dilewati. Data valid tetap ditampilkan; unduh data mentah jika perlu memeriksanya.`,
      storage,
    };
  }

  return {
    status: "ready",
    data,
    raw,
    invalidCount: 0,
    backupSaved: false,
    message: "",
    storage,
  };
}

export function saveData(data, storageOverride) {
  const resolved = resolveStorage(storageOverride);
  if (resolved.error) {
    return {
      ok: false,
      errorName: resolved.error.name || "SecurityError",
      message: storageErrorMessage(resolved.error, "Data tidak dapat disimpan."),
    };
  }
  if (!resolved.storage) {
    return {
      ok: false,
      errorName: "UnavailableError",
      message: "Penyimpanan browser tidak tersedia. Perubahan hanya bertahan selama tab ini terbuka.",
    };
  }

  const payload = {
    version: SCHEMA_VERSION,
    transactions: data.transactions,
    budgets: data.budgets,
  };

  try {
    resolved.storage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return { ok: true, errorName: "", message: "Data tersimpan di browser ini." };
  } catch (error) {
    return {
      ok: false,
      errorName: error?.name || "StorageError",
      message: storageErrorMessage(error, "Data gagal disimpan. Perubahan hanya ada di memori."),
    };
  }
}

export function resetStoredData(storageOverride) {
  const resolved = resolveStorage(storageOverride);
  if (resolved.error || !resolved.storage) {
    return {
      ok: false,
      message: "Penyimpanan browser tidak tersedia sehingga data tidak dapat direset.",
    };
  }
  try {
    resolved.storage.removeItem(STORAGE_KEY);
    return { ok: true, message: "Data lokal direset." };
  } catch (error) {
    return {
      ok: false,
      message: storageErrorMessage(error, "Data lokal gagal direset."),
    };
  }
}
