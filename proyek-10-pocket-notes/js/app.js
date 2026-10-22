import { addNote, deleteNote, getAllNotes, setNotePinned, updateNote } from "./db.js";
import {
  FILTERS,
  createNote,
  filterNotes,
  normalizeNote,
  sortNotes,
  validateNoteInput,
} from "./notes.js";
import * as ui from "./ui.js";

const state = {
  notes: [],
  visibleNotes: [],
  filter: "all",
  query: "",
  dbReady: false,
  loading: true,
  saving: false,
  deleting: false,
  deleteTargetId: null,
  deleteExpectedUpdatedAt: null,
  pinPending: new Set(),
  pendingWrites: new Set(),
  storageWriteCount: 0,
  storageWriteError: false,
  editorNoteId: null,
  editorExpectedUpdatedAt: null,
};

const cardHandlers = {
  onEdit: (note) => openEditor(note),
  onDelete: (note) => requestDelete(note),
  onTogglePin: (note) => handleTogglePin(note),
};

let announceTimer = 0;
let swRegistration = null;
let swInitialized = false;
let deferredPrompt = null;
let applyingUpdate = false;
let reloadWhenIdle = false;
let updateFailureNotified = false;
let swInstallFailureNotified = false;
let notesChannel = null;
let refreshTimer = 0;
let refreshPending = false;
let refreshInFlight = false;
let lastRefreshErrorAt = 0;

function buildCountLabel(visibleCount) {
  if (!state.dbReady) return state.loading ? "Memuat catatan…" : "Penyimpanan tidak tersedia";
  if (state.notes.length === 0) return "Belum ada catatan";
  if (visibleCount === 0) return "Tidak ada catatan yang ditampilkan";
  if (visibleCount === state.notes.length) return `${visibleCount} catatan`;
  return `${visibleCount} dari ${state.notes.length} catatan`;
}

function buildEmptyState(visibleCount) {
  if (visibleCount > 0) return null;

  if (!state.dbReady) {
    if (state.loading) return null;
    return {
      title: "Catatan tidak dapat dimuat",
      body:
        "IndexedDB tidak tersedia atau aksesnya diblokir. Pocket Notes tidak beralih ke penyimpanan lain agar tidak menimbulkan kesan data tersimpan dengan aman.",
      actionLabel: "Coba lagi",
      onAction: () => loadNotes(),
    };
  }

  if (state.notes.length === 0) {
    return {
      title: "Belum ada catatan",
      body:
        "Simpan ide, pengingat, atau catatan singkat. Semua catatan tetap berada di browser ini.",
      actionLabel: "Buat catatan pertama",
      onAction: () => openEditor(null),
    };
  }

  if (state.query.trim() !== "") {
    return {
      title: "Tidak ada hasil",
      body: `Tidak ada catatan yang cocok dengan “${state.query.trim()}”. Coba kata kunci lain.`,
      actionLabel: "Hapus pencarian",
      onAction: clearSearch,
    };
  }

  return {
    title: "Belum ada catatan disematkan",
    body: "Sematkan catatan penting agar mudah ditemukan kembali.",
    actionLabel: "Lihat semua catatan",
    onAction: () => setFilter("all", { moveFocus: true }),
  };
}

function render() {
  const visible = filterNotes(state.notes, { filter: state.filter, query: state.query });
  state.visibleNotes = visible;

  ui.setFilter(state.filter);
  ui.setNotesCount(buildCountLabel(visible.length));
  ui.renderNotes(visible, cardHandlers);
  ui.renderEmptyState(buildEmptyState(visible.length));
}

function announceResults(delay = 0) {
  window.clearTimeout(announceTimer);
  announceTimer = window.setTimeout(() => {
    if (!state.dbReady) return;

    const visible = state.visibleNotes.length;
    const query = state.query.trim();

    if (query) {
      ui.setResultsStatus(`${visible} hasil untuk pencarian “${query}”.`);
    } else if (state.filter === "pinned") {
      ui.setResultsStatus(`${visible} catatan disematkan ditampilkan.`);
    } else {
      ui.setResultsStatus(`${visible} catatan ditampilkan.`);
    }
  }, delay);
}

async function readNotesFromDatabase() {
  const stored = await getAllNotes();
  const notes = [];
  let skipped = 0;

  stored.forEach((item) => {
    const note = normalizeNote(item);
    if (note) {
      notes.push(note);
    } else {
      skipped += 1;
    }
  });

  return { notes: sortNotes(notes), skipped };
}

function beginStorageWrite() {
  state.storageWriteCount += 1;
  if (state.storageWriteCount === 1) {
    ui.setStorageStatus("saving", "Menyimpan…");
  }
}

function finishStorageWrite(ok, { neutral = false } = {}) {
  state.storageWriteCount = Math.max(0, state.storageWriteCount - 1);

  if (!ok) {
    state.storageWriteError = true;
    ui.setStorageStatus("error", "Gagal menyimpan");
    return;
  }

  if (state.storageWriteCount > 0) return;

  state.storageWriteError = false;
  ui.setStorageStatus("ready", neutral ? "Penyimpanan siap" : "Tersimpan di perangkat");
}

function trackWrite(promise) {
  const tracked = Promise.resolve(promise);
  state.pendingWrites.add(tracked);

  tracked
    .finally(() => {
      state.pendingWrites.delete(tracked);
      flushPendingRefresh();
      if (reloadWhenIdle) tryReload();
    })
    .catch(() => {
      // Penolakan ditangani oleh pemanggil operasi.
    });

  return tracked;
}

function hasPendingWrites() {
  return (
    state.pendingWrites.size > 0 ||
    state.saving ||
    state.deleting ||
    state.pinPending.size > 0
  );
}

async function waitForPendingWrites(timeout = 15000) {
  const started = Date.now();

  while (hasPendingWrites()) {
    const remaining = timeout - (Date.now() - started);
    if (remaining <= 0) return false;

    const pending = [...state.pendingWrites];
    if (pending.length === 0) {
      await new Promise((resolve) => window.setTimeout(resolve, 50));
      continue;
    }

    await Promise.race([
      Promise.allSettled(pending),
      new Promise((resolve) => window.setTimeout(resolve, Math.min(250, remaining))),
    ]);
  }

  return true;
}

function tryReload() {
  if (!reloadWhenIdle || hasPendingWrites()) return;
  reloadWhenIdle = false;
  window.location.reload();
}

function focusCardOrFallback(noteId, action = "title") {
  if (!ui.focusNoteCard(noteId, action)) {
    ui.focusListFallback();
  }
}

async function refreshFromDatabase({ focusNoteId = null, notify = false } = {}) {
  try {
    const { notes, skipped } = await readNotesFromDatabase();
    state.notes = notes;

    if (state.deleteTargetId) {
      const target = notes.find((note) => note.id === state.deleteTargetId);
      const changed =
        state.deleteExpectedUpdatedAt &&
        target &&
        target.updatedAt !== state.deleteExpectedUpdatedAt;

      if (!target || changed) {
        ui.closeDeleteDialog();
        state.deleteTargetId = null;
        state.deleteExpectedUpdatedAt = null;
        ui.showToast(
          !target
            ? "Catatan sudah dihapus di tab lain."
            : "Catatan berubah di tab lain. Dialog hapus ditutup; periksa data terbaru.",
          "info",
        );
      }
    }

    render();

    if (skipped > 0 && notify) {
      ui.showToast(`${skipped} catatan tidak valid dilewati.`, "error");
    }

    if (focusNoteId) {
      focusCardOrFallback(focusNoteId);
    }
  } catch (error) {
    const message = `Data terbaru tidak dapat dimuat: ${error.message}`;

    if (notify) {
      ui.showToast(message, "error");
    } else if (Date.now() - lastRefreshErrorAt > 10000) {
      lastRefreshErrorAt = Date.now();
      ui.showToast(message, "error");
    }

    if (focusNoteId) {
      ui.focusListFallback();
    }
  }
}

function scheduleExternalRefresh() {
  refreshPending = true;
  window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(runExternalRefresh, 180);
}

async function runExternalRefresh() {
  refreshTimer = 0;
  if (refreshInFlight) {
    refreshPending = true;
    return;
  }

  if (hasPendingWrites() || state.loading || !state.dbReady) {
    refreshPending = true;
    return;
  }

  refreshPending = false;
  refreshInFlight = true;

  try {
    await refreshFromDatabase();
  } finally {
    refreshInFlight = false;
    if (refreshPending) scheduleExternalRefresh();
  }
}

function flushPendingRefresh() {
  if (!refreshPending || hasPendingWrites() || state.loading || !state.dbReady) return;
  scheduleExternalRefresh();
}

function broadcastNotesChanged(action, noteId) {
  if (!notesChannel) return;
  try {
    notesChannel.postMessage({ type: "notes-changed", action, noteId, at: Date.now() });
  } catch {
    // Sinkronisasi tetap memiliki fallback visibility/focus.
  }
}

async function loadNotes() {
  state.loading = true;
  state.dbReady = false;
  ui.setControlsDisabled(true);
  ui.setStorageStatus("loading", "Memuat catatan…");
  ui.setNotesCount("Memuat catatan…");
  ui.renderEmptyState(null);

  try {
    const { notes, skipped } = await readNotesFromDatabase();

    state.notes = notes;
    state.dbReady = true;
    state.storageWriteError = false;
    ui.hideDatabaseBanner();
    ui.setStorageStatus("ready", "Penyimpanan siap");
    ui.setControlsDisabled(false);

    if (skipped > 0) {
      ui.showToast(`${skipped} catatan tidak valid dilewati.`, "error");
    }
  } catch (error) {
    state.notes = [];
    state.dbReady = false;
    ui.setStorageStatus("error", "Penyimpanan bermasalah");
    ui.showDatabaseBanner(error.message);
    ui.setControlsDisabled(true);
  } finally {
    state.loading = false;
    render();
    announceResults();
    flushPendingRefresh();
  }
}

function openEditor(note = null) {
  if (!state.dbReady) {
    ui.showToast("Catatan belum dapat disimpan karena penyimpanan tidak tersedia.", "error");
    return;
  }

  state.editorNoteId = note?.id ?? null;
  state.editorExpectedUpdatedAt = note?.updatedAt ?? null;
  ui.openNoteEditor(note);
}

async function handleSave(event) {
  event.preventDefault();
  if (state.saving) return;

  const values = ui.getEditorValues();
  const result = validateNoteInput(values);

  if (!result.ok) {
    ui.showFormErrors(result.errors);
    return;
  }

  const isEdit = Boolean(values.id);
  const expectedUpdatedAt = isEdit ? state.editorExpectedUpdatedAt : null;
  const newNote = isEdit ? null : createNote(result.values);

  state.saving = true;
  ui.setSaving(true, isEdit);
  beginStorageWrite();

  try {
    const writeResult = await trackWrite(
      isEdit
        ? updateNote(values.id, result.values, expectedUpdatedAt)
        : addNote(newNote),
    );

    if (isEdit && writeResult.status === "conflict") {
      finishStorageWrite(true, { neutral: true });
      ui.closeNoteEditor();
      await refreshFromDatabase({ focusNoteId: values.id });
      ui.showToast(
        "Catatan ini sudah diubah di tab lain. Dialog ditutup dan data terbaru dimuat; buka kembali untuk memeriksa perubahannya.",
        "error",
      );
      return;
    }

    if (isEdit && writeResult.status === "missing") {
      finishStorageWrite(true, { neutral: true });
      ui.closeNoteEditor();
      await refreshFromDatabase();
      ui.showToast(
        "Catatan sudah dihapus di tab lain. Perubahan tidak disimpan dan catatan tidak dibuat ulang.",
        "error",
      );
      ui.focusListFallback();
      return;
    }

    const savedNote = isEdit ? writeResult.note : writeResult;

    state.notes = sortNotes([
      ...state.notes.filter((note) => note.id !== savedNote.id),
      savedNote,
    ]);

    finishStorageWrite(true);
    ui.closeNoteEditor();
    render();
    focusCardOrFallback(savedNote.id);
    ui.showToast(
      isEdit ? "Perubahan catatan disimpan." : "Catatan baru disimpan.",
      "success",
    );
    broadcastNotesChanged(isEdit ? "update" : "create", savedNote.id);
  } catch (error) {
    finishStorageWrite(false);
    ui.showFormError(error.message);
  } finally {
    state.saving = false;
    ui.setSaving(false, isEdit);
    flushPendingRefresh();
    if (reloadWhenIdle) tryReload();
  }
}

function requestDelete(note) {
  if (!state.dbReady) return;
  state.deleteTargetId = note.id;
  state.deleteExpectedUpdatedAt = note.updatedAt;
  ui.openDeleteDialog(note);
}

async function handleDeleteConfirm() {
  if (state.deleting) return;

  const note = state.notes.find((item) => item.id === state.deleteTargetId);
  if (!note) {
    ui.closeDeleteDialog();
    return;
  }

  const visibleBefore = state.visibleNotes;
  const index = visibleBefore.findIndex((item) => item.id === note.id);
  const nextNoteId =
    index >= 0
      ? visibleBefore[index + 1]?.id ?? visibleBefore[index - 1]?.id ?? null
      : null;

  const expectedUpdatedAt = state.deleteExpectedUpdatedAt ?? note.updatedAt;

  state.deleting = true;
  ui.setDeleteBusy(true);
  beginStorageWrite();

  try {
    const writeResult = await trackWrite(deleteNote(note.id, expectedUpdatedAt));

    if (writeResult.status === "conflict") {
      finishStorageWrite(true, { neutral: true });
      state.deleteTargetId = null;
      state.deleteExpectedUpdatedAt = null;
      ui.closeDeleteDialog();
      await refreshFromDatabase({ focusNoteId: note.id });
      ui.showToast(
        "Catatan berubah di tab lain. Penghapusan dibatalkan agar perubahan terbaru tidak hilang; periksa data terbaru.",
        "error",
      );
      return;
    }

    state.notes = state.notes.filter((item) => item.id !== note.id);
    ui.closeDeleteDialog();
    render();

    if (writeResult.status === "missing") {
      finishStorageWrite(true, { neutral: true });
      if (nextNoteId) {
        focusCardOrFallback(nextNoteId);
      } else {
        ui.focusListFallback();
      }
      ui.showToast("Catatan sudah dihapus di tab lain.", "info");
      return;
    }

    finishStorageWrite(true);
    if (nextNoteId) {
      focusCardOrFallback(nextNoteId);
    } else {
      ui.focusListFallback();
    }
    ui.showToast("Catatan dihapus.", "success");
    broadcastNotesChanged("delete", note.id);
  } catch (error) {
    finishStorageWrite(false);
    ui.showDeleteError(error.message);
  } finally {
    state.deleting = false;
    ui.setDeleteBusy(false);
    flushPendingRefresh();
    if (reloadWhenIdle) tryReload();
  }
}

async function handleTogglePin(note) {
  if (state.pinPending.has(note.id)) return;

  state.pinPending.add(note.id);
  beginStorageWrite();

  try {
    const writeResult = await trackWrite(setNotePinned(note.id, !note.pinned));

    if (writeResult.status === "missing") {
      finishStorageWrite(true, { neutral: true });
      state.notes = state.notes.filter((item) => item.id !== note.id);
      render();
      ui.focusListFallback();
      ui.showToast(
        "Catatan sudah dihapus di tab lain. Sematan tidak dibuat ulang.",
        "error",
      );
      return;
    }

    const updated = writeResult.note;
    state.notes = sortNotes([
      ...state.notes.filter((item) => item.id !== updated.id),
      updated,
    ]);

    finishStorageWrite(true);
    render();
    focusCardOrFallback(updated.id, "pin");
    ui.showToast(
      updated.pinned ? "Catatan disematkan." : "Sematan catatan dilepas.",
      "success",
    );
    broadcastNotesChanged("pin", updated.id);
  } catch (error) {
    finishStorageWrite(false);
    ui.showToast(error.message, "error");
  } finally {
    state.pinPending.delete(note.id);
    flushPendingRefresh();
    if (reloadWhenIdle) tryReload();
  }
}

function setFilter(filter, { moveFocus = false } = {}) {
  if (!FILTERS.includes(filter)) {
    render();
    return;
  }

  const changed = state.filter !== filter;
  state.filter = filter;
  render();

  if (moveFocus) {
    if (!ui.focusFirstNoteCard()) {
      ui.focusListFallback();
    }
  }

  if (changed) {
    announceResults();
  }
}

function clearSearch() {
  state.query = "";
  ui.refs.search.value = "";
  render();
  announceResults();
  ui.focusSearch();
}

function handleSearchInput() {
  state.query = ui.refs.search.value;
  render();
  announceResults(500);
}

function waitForController(timeout = 15000) {
  if (navigator.serviceWorker.controller) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleChange);
      reject(new Error("Service Worker belum mengendalikan halaman."));
    }, timeout);

    function handleChange() {
      window.clearTimeout(timer);
      navigator.serviceWorker.removeEventListener("controllerchange", handleChange);
      resolve();
    }

    navigator.serviceWorker.addEventListener("controllerchange", handleChange);
  });
}

function queryCacheStatus(timeout = 4000) {
  return new Promise((resolve) => {
    const controller = navigator.serviceWorker.controller;
    if (!controller) {
      resolve(null);
      return;
    }

    const channel = new MessageChannel();
    const timer = window.setTimeout(() => resolve(null), timeout);

    channel.port1.onmessage = (event) => {
      window.clearTimeout(timer);
      resolve(event.data ?? null);
    };

    controller.postMessage({ type: "pocket-notes:status" }, [channel.port2]);
  });
}

function notifyUpdateFailure(message) {
  if (updateFailureNotified) return;
  updateFailureNotified = true;
  ui.hideUpdateBanner();
  ui.showToast(message, "error");
}

function showWaitingUpdateIfPresent() {
  if (swRegistration?.waiting && navigator.serviceWorker.controller) {
    ui.showUpdateBanner();
  }
}

function handleUpdateFound() {
  const worker = swRegistration?.installing;
  if (!worker) return;

  updateFailureNotified = false;
  swInstallFailureNotified = false;

  const onStateChange = () => {
    if (worker.state === "installed" && navigator.serviceWorker.controller) {
      ui.showUpdateBanner();
      return;
    }

    if (worker.state === "redundant" && navigator.serviceWorker.controller) {
      // Beri kesempatan pesan install-failed yang menyebut aset tiba lebih dahulu.
      window.setTimeout(() => {
        if (worker.state !== "redundant" || swInstallFailureNotified) return;
        notifyUpdateFailure(
          "Pembaruan gagal dipasang. Versi lama tetap digunakan dan tetap dapat dibuka offline.",
        );
      }, 350);
    }
  };

  worker.addEventListener("statechange", onStateChange);

  if (worker.state === "installed" && navigator.serviceWorker.controller) {
    ui.showUpdateBanner();
  }
}

function handleServiceWorkerMessage(event) {
  const data = event.data;
  if (!data || typeof data !== "object" || data.type !== "pocket-notes:install-failed") {
    return;
  }

  swInstallFailureNotified = true;

  const failures = Array.isArray(data.failures) ? data.failures : [];
  const names = failures
    .map((failure) => {
      try {
        const url = new URL(failure.url);
        return url.pathname.split("/").filter(Boolean).pop() ?? url.pathname;
      } catch {
        return String(failure.url ?? "aset");
      }
    })
    .slice(0, 3);
  const detail = names.length > 0 ? names.join(", ") : "aset wajib";

  if (navigator.serviceWorker.controller) {
    notifyUpdateFailure(
      `Pembaruan gagal: ${detail} tidak dapat disimpan. Versi lama tetap digunakan dan tetap dapat dibuka offline.`,
    );
    return;
  }

  ui.setOfflineStatus("warning", "Cache offline gagal");
  ui.showToast(
    `Cache offline gagal: ${detail} tidak dapat disimpan. Aplikasi tetap dapat dipakai selama terhubung ke server.`,
    "error",
  );
}

async function initServiceWorker() {
  if (swInitialized) return;
  swInitialized = true;

  if (!("serviceWorker" in navigator)) {
    ui.setOfflineStatus("unsupported", "Offline tidak didukung");
    return;
  }

  if (!window.isSecureContext) {
    ui.setOfflineStatus("unsupported", "Offline butuh localhost/HTTPS");
    return;
  }

  ui.setOfflineStatus("checking", "Menyiapkan cache…");
  navigator.serviceWorker.addEventListener("message", handleServiceWorkerMessage);

  try {
    swRegistration = await navigator.serviceWorker.register("./sw.js", { scope: "./" });
    swRegistration.addEventListener("updatefound", handleUpdateFound);

    await waitForController();
    showWaitingUpdateIfPresent();

    const status = await queryCacheStatus();

    if (status?.cached) {
      ui.setOfflineStatus("ready", "Siap offline");
    } else {
      ui.setOfflineStatus("warning", "Cache belum siap");
      if (!swInstallFailureNotified) {
        ui.showToast(
          "Cache offline belum siap. Aplikasi tetap dapat dipakai selama terhubung ke server.",
          "error",
        );
      }
    }
  } catch {
    if (navigator.serviceWorker.controller) {
      const status = await queryCacheStatus();
      if (status?.cached) {
        ui.setOfflineStatus("ready", "Siap offline");
        return;
      }
    }

    ui.setOfflineStatus("warning", "Offline belum siap");
    if (!swInstallFailureNotified) {
      ui.showToast(
        "Cache offline belum siap. Aplikasi tetap dapat dipakai selama terhubung ke server.",
        "error",
      );
    }
  }
}

function waitForWaitingActivation(waiting) {
  return new Promise((resolve) => {
    let settled = false;

    const cleanup = () => {
      window.clearTimeout(timer);
      navigator.serviceWorker.removeEventListener("controllerchange", handleChange);
    };

    const finish = (activated) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(activated);
    };

    function handleChange() {
      finish(true);
    }

    const timer = window.setTimeout(() => finish(false), 10000);
    navigator.serviceWorker.addEventListener("controllerchange", handleChange);

    try {
      waiting.postMessage({ type: "SKIP_WAITING" });
    } catch {
      finish(false);
    }
  });
}

async function applyUpdate() {
  if (applyingUpdate) return;

  applyingUpdate = true;
  ui.setUpdateBusy(true, "Menyiapkan…");

  let controllerChanged = false;
  const handleControllerChange = () => {
    controllerChanged = true;
  };

  navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

  try {
    const idle = await waitForPendingWrites(15000);

    if (!idle) {
      ui.showToast(
        "Pembaruan ditunda karena penyimpanan belum selesai. Coba lagi setelah operasi selesai.",
        "error",
      );
      return;
    }

    if (controllerChanged) {
      reloadWhenIdle = true;
      tryReload();
      return;
    }

    const waiting = swRegistration?.waiting;

    if (!waiting) {
      ui.hideUpdateBanner();
      ui.showToast("Tidak ada pembaruan yang menunggu untuk diaktifkan.", "info");
      return;
    }

    const activated = await waitForWaitingActivation(waiting);

    if (activated) {
      reloadWhenIdle = true;
      tryReload();
      return;
    }

    if (!swRegistration?.waiting) {
      ui.hideUpdateBanner();
    }

    ui.showToast(
      "Pembaruan belum dapat diaktifkan. Versi lama tetap digunakan; coba lagi setelah memuat ulang halaman.",
      "error",
    );
  } finally {
    navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    applyingUpdate = false;
    ui.setUpdateBusy(false);
  }
}

function setupInstallPrompt() {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

  if (standalone) {
    ui.hideInstallButton();
    return;
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    ui.showInstallButton();
  });

  ui.refs.installButton.addEventListener("click", async () => {
    if (!deferredPrompt) {
      ui.showToast("Browser ini belum menawarkan pemasangan aplikasi.", "info");
      return;
    }

    const promptEvent = deferredPrompt;
    deferredPrompt = null;
    ui.hideInstallButton();

    try {
      promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      ui.showToast(
        choice?.outcome === "accepted"
          ? "Instalasi Pocket Notes dimulai."
          : "Instalasi dibatalkan.",
        "info",
      );
    } catch {
      ui.showToast("Instalasi tidak dapat dilanjutkan di browser ini.", "error");
    }
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    ui.hideInstallButton();
    ui.showToast("Pocket Notes dipasang di perangkat ini.", "success");
  });
}

function setupCrossTabSync() {
  if ("BroadcastChannel" in window) {
    try {
      notesChannel = new BroadcastChannel("pocket-notes-sync");
      notesChannel.addEventListener("message", (event) => {
        if (event.data?.type === "notes-changed") {
          scheduleExternalRefresh();
        }
      });
    } catch {
      notesChannel = null;
    }
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      scheduleExternalRefresh();
    }
  });

  window.addEventListener("focus", scheduleExternalRefresh);

  window.addEventListener("pagehide", () => {
    try {
      notesChannel?.close();
    } catch {
      // Abaikan kegagalan penutupan channel saat halaman ditinggalkan.
    }
  });
}

function bindEvents() {
  ui.refs.newNote.addEventListener("click", () => openEditor(null));
  ui.refs.search.addEventListener("input", handleSearchInput);

  ui.refs.filterButtons.forEach((button) => {
    button.addEventListener("click", () => setFilter(button.dataset.filter));
  });

  ui.refs.noteForm.addEventListener("submit", handleSave);
  ui.refs.noteCancel.addEventListener("click", ui.closeNoteEditor);
  ui.refs.noteClose.addEventListener("click", ui.closeNoteEditor);

  ui.refs.noteDialog.addEventListener("cancel", (event) => {
    if (state.saving) event.preventDefault();
  });

  ui.refs.noteDialog.addEventListener("close", () => {
    state.editorNoteId = null;
    state.editorExpectedUpdatedAt = null;
  });

  ui.refs.deleteCancel.addEventListener("click", ui.closeDeleteDialog);
  ui.refs.deleteConfirm.addEventListener("click", handleDeleteConfirm);

  ui.refs.deleteDialog.addEventListener("cancel", (event) => {
    if (state.deleting) event.preventDefault();
  });

  ui.refs.deleteDialog.addEventListener("close", () => {
    state.deleteTargetId = null;
    state.deleteExpectedUpdatedAt = null;
    ui.setDeleteBusy(false);
  });

  ui.refs.dbRetry.addEventListener("click", () => loadNotes());
  ui.refs.updateReload.addEventListener("click", applyUpdate);
}

function init() {
  ui.setStorageStatus("loading", "Memuat catatan…");
  ui.setControlsDisabled(true);
  bindEvents();
  setupInstallPrompt();
  setupCrossTabSync();
  loadNotes();
  initServiceWorker();
}

init();
