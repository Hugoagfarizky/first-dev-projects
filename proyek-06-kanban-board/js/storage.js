import { normalizeTask } from "./tasks.js";

export const STORAGE_KEY = "kanbanBoard.tasks.v1";
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

function readStorage() {
  try {
    return { storage: window.localStorage, error: null };
  } catch (error) {
    return { storage: null, error };
  }
}

export function loadTasks() {
  const { storage, error } = readStorage();
  if (!storage) {
    return {
      status: "unavailable",
      tasks: [],
      message: errorMessage(error, "Penyimpanan lokal tidak dapat diakses."),
    };
  }

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) {
      return { status: "empty", tasks: [], message: "" };
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return {
        status: "corrupt",
        tasks: [],
        message: "Data lokal tidak dapat dibaca karena formatnya rusak. Data lama tidak ditimpa.",
      };
    }

    if (
      !parsed ||
      typeof parsed !== "object" ||
      parsed.version !== STORAGE_VERSION ||
      !Array.isArray(parsed.tasks)
    ) {
      return {
        status: "corrupt",
        tasks: [],
        message: "Format data lokal tidak dikenali. Data lama tidak ditimpa.",
      };
    }

    const tasks = [];
    const seenIds = new Set();
    let invalidCount = 0;

    parsed.tasks.forEach((item) => {
      const task = normalizeTask(item);
      if (!task || seenIds.has(task.id)) {
        invalidCount += 1;
        return;
      }
      seenIds.add(task.id);
      tasks.push(task);
    });

    if (invalidCount > 0) {
      return {
        status: "partial",
        tasks,
        invalidCount,
        message: `${invalidCount} data tugas tidak valid dan dilewati. Data lain tetap ditampilkan tanpa ditimpa.`,
      };
    }

    return { status: "ready", tasks, message: "" };
  } catch (error) {
    return {
      status: "unavailable",
      tasks: [],
      message: errorMessage(error, "Penyimpanan lokal tidak dapat dibaca."),
    };
  }
}

export function saveTasks(tasks) {
  const { storage, error } = readStorage();
  if (!storage) {
    return {
      ok: false,
      message: errorMessage(error, "Perubahan tidak dapat disimpan karena penyimpanan tidak dapat diakses."),
    };
  }

  try {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: STORAGE_VERSION,
        tasks,
      }),
    );
    return { ok: true, message: "" };
  } catch (error) {
    return {
      ok: false,
      message: errorMessage(error, "Perubahan tidak dapat disimpan. Coba lagi setelah memeriksa penyimpanan browser."),
    };
  }
}

export function clearTasks() {
  const { storage, error } = readStorage();
  if (!storage) {
    return {
      ok: false,
      message: errorMessage(error, "Data lokal tidak dapat dihapus karena penyimpanan tidak dapat diakses."),
    };
  }

  try {
    storage.removeItem(STORAGE_KEY);
    return { ok: true, message: "" };
  } catch (error) {
    return {
      ok: false,
      message: errorMessage(error, "Data lokal tidak dapat dihapus."),
    };
  }
}
