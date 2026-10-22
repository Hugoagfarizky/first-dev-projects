export const DB_NAME = "pocketNotes";
export const DB_VERSION = 1;
export const STORE_NAME = "notes";
export const UPDATED_AT_INDEX = "updatedAt";

let databasePromise = null;

function describeError(error, fallback) {
  switch (error?.name) {
    case "QuotaExceededError":
    case "NS_ERROR_DOM_QUOTA_REACHED":
      return "Ruang penyimpanan browser penuh. Hapus beberapa catatan lalu coba lagi.";
    case "SecurityError":
    case "InvalidStateError":
      return "Akses penyimpanan browser diblokir. Izinkan penyimpanan situs untuk halaman ini lalu muat ulang.";
    case "VersionError":
      return "Versi database catatan tidak cocok. Muat ulang halaman untuk mencoba lagi.";
    case "UnknownError":
    case "AbortError":
      return `${fallback} Database mungkin sedang dipakai tab Pocket Notes lain.`;
    default:
      return fallback;
  }
}

function databaseError(message, cause) {
  const error = new Error(message);
  error.name = cause?.name ?? "DatabaseError";
  error.cause = cause;
  return error;
}

export function openDatabase() {
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(
        databaseError(
          "Browser ini tidak menyediakan IndexedDB, sehingga catatan tidak dapat disimpan.",
        ),
      );
      return;
    }

    let request;
    let blocked = false;

    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (error) {
      reject(databaseError(describeError(error, "Database catatan tidak dapat dibuka."), error));
      return;
    }

    request.onupgradeneeded = () => {
      const database = request.result;
      let store;

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        store = database.createObjectStore(STORE_NAME, { keyPath: "id" });
      } else {
        store = request.transaction.objectStore(STORE_NAME);
      }

      // Index tetap dipulihkan bila store sudah ada tetapi index hilang.
      if (!store.indexNames.contains(UPDATED_AT_INDEX)) {
        store.createIndex(UPDATED_AT_INDEX, "updatedAt");
      }
    };

    request.onsuccess = () => {
      const database = request.result;

      // onblocked sudah menolak promise; jangan tinggalkan koneksi tanpa pemilik.
      if (blocked) {
        database.close();
        return;
      }

      database.onversionchange = () => {
        database.close();
        databasePromise = null;
      };
      resolve(database);
    };

    request.onerror = () => {
      reject(
        databaseError(
          describeError(request.error, "Database catatan tidak dapat dibuka."),
          request.error,
        ),
      );
    };

    request.onblocked = () => {
      blocked = true;
      reject(
        databaseError(
          "Database catatan sedang dipakai tab lain. Tutup tab Pocket Notes lainnya lalu coba lagi.",
        ),
      );
    };
  }).catch((error) => {
    databasePromise = null;
    throw error;
  });

  return databasePromise;
}

function runTransaction(mode, fallbackMessage, executor) {
  return openDatabase().then(
    (database) =>
      new Promise((resolve, reject) => {
        let transaction;
        try {
          transaction = database.transaction(STORE_NAME, mode);
        } catch (error) {
          reject(databaseError(describeError(error, fallbackMessage), error));
          return;
        }

        const store = transaction.objectStore(STORE_NAME);
        let result;
        let settled = false;

        const fail = (error) => {
          if (settled) return;
          settled = true;
          try {
            transaction.abort();
          } catch {
            // Transaksi mungkin sudah selesai; error asli tetap dilaporkan.
          }
          reject(databaseError(describeError(error, fallbackMessage), error));
        };

        transaction.oncomplete = () => {
          if (settled) return;
          settled = true;
          resolve(result);
        };

        transaction.onabort = () => fail(transaction.error ?? null);
        transaction.onerror = () => fail(transaction.error ?? null);

        try {
          executor(store, (value) => {
            result = value;
          }, fail);
        } catch (error) {
          fail(error);
        }
      }),
  );
}

export function getAllNotes() {
  return runTransaction(
    "readonly",
    "Catatan tidak dapat dibaca dari IndexedDB.",
    (store, setResult, fail) => {
      const request = store.getAll();
      request.onerror = () => fail(request.error);
      request.onsuccess = () => setResult(request.result);
    },
  ).then((notes) => (Array.isArray(notes) ? notes : []));
}

export function addNote(note) {
  return runTransaction(
    "readwrite",
    "Catatan tidak dapat disimpan ke IndexedDB.",
    (store, setResult, fail) => {
      const request = store.add(note);
      request.onerror = () => fail(request.error);
      request.onsuccess = () => setResult(note);
    },
  );
}

export function updateNote(id, values, expectedUpdatedAt, now = new Date()) {
  return runTransaction(
    "readwrite",
    "Perubahan catatan tidak dapat disimpan ke IndexedDB.",
    (store, setResult, fail) => {
      const getRequest = store.get(id);
      getRequest.onerror = () => fail(getRequest.error);
      getRequest.onsuccess = () => {
        const current = getRequest.result;

        if (!current) {
          setResult({ status: "missing" });
          return;
        }

        if (current.updatedAt !== expectedUpdatedAt) {
          setResult({ status: "conflict", current });
          return;
        }

        const updated = {
          ...current,
          title: values.title,
          body: values.body,
          updatedAt: now.toISOString(),
        };

        const putRequest = store.put(updated);
        putRequest.onerror = () => fail(putRequest.error);
        putRequest.onsuccess = () => setResult({ status: "updated", note: updated });
      };
    },
  );
}

export function setNotePinned(id, pinned, now = new Date()) {
  return runTransaction(
    "readwrite",
    "Status sematan catatan tidak dapat disimpan ke IndexedDB.",
    (store, setResult, fail) => {
      const getRequest = store.get(id);
      getRequest.onerror = () => fail(getRequest.error);
      getRequest.onsuccess = () => {
        const current = getRequest.result;

        if (!current) {
          setResult({ status: "missing" });
          return;
        }

        if (current.pinned === Boolean(pinned)) {
          setResult({ status: "updated", note: current, unchanged: true });
          return;
        }

        const updated = {
          ...current,
          pinned: Boolean(pinned),
          updatedAt: now.toISOString(),
        };

        const putRequest = store.put(updated);
        putRequest.onerror = () => fail(putRequest.error);
        putRequest.onsuccess = () => setResult({ status: "updated", note: updated });
      };
    },
  );
}

export function deleteNote(id, expectedUpdatedAt) {
  return runTransaction(
    "readwrite",
    "Catatan tidak dapat dihapus dari IndexedDB.",
    (store, setResult, fail) => {
      const getRequest = store.get(id);
      getRequest.onerror = () => fail(getRequest.error);
      getRequest.onsuccess = () => {
        const current = getRequest.result;

        if (!current) {
          setResult({ status: "missing" });
          return;
        }

        if (current.updatedAt !== expectedUpdatedAt) {
          setResult({ status: "conflict", current });
          return;
        }

        const deleteRequest = store.delete(id);
        deleteRequest.onerror = () => fail(deleteRequest.error);
        deleteRequest.onsuccess = () => setResult({ status: "deleted" });
      };
    },
  );
}
