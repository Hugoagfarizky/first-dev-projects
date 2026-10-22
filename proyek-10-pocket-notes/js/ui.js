import { LIMITS } from "./notes.js";

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
});

export const refs = {
  list: document.querySelector("#notes-list"),
  emptyState: document.querySelector("#empty-state"),
  emptyTitle: document.querySelector("#empty-title"),
  emptyBody: document.querySelector("#empty-body"),
  emptyAction: document.querySelector("#empty-action"),
  notesHeading: document.querySelector("#notes-heading"),
  notesCount: document.querySelector("#notes-count"),
  resultsStatus: document.querySelector("#results-status"),
  search: document.querySelector("#search-input"),
  filterButtons: Array.from(document.querySelectorAll("[data-filter]")),
  newNote: document.querySelector("#new-note"),
  installButton: document.querySelector("#install-button"),
  updateBanner: document.querySelector("#update-banner"),
  updateReload: document.querySelector("#update-reload"),
  updateStatus: document.querySelector("#update-status"),
  storageStatus: document.querySelector("#storage-status"),
  offlineStatus: document.querySelector("#offline-status"),
  dbBanner: document.querySelector("#db-banner"),
  dbBannerMessage: document.querySelector("#db-banner-message"),
  dbRetry: document.querySelector("#db-retry"),
  noteDialog: document.querySelector("#note-dialog"),
  noteForm: document.querySelector("#note-form"),
  noteDialogTitle: document.querySelector("#note-dialog-title"),
  noteClose: document.querySelector("#note-close"),
  noteId: document.querySelector("#note-id"),
  noteTitle: document.querySelector("#note-title"),
  noteBody: document.querySelector("#note-body"),
  noteTitleError: document.querySelector("#note-title-error"),
  noteBodyError: document.querySelector("#note-body-error"),
  noteFormError: document.querySelector("#note-form-error"),
  noteSubmit: document.querySelector("#note-submit"),
  noteCancel: document.querySelector("#note-cancel"),
  noteCharCount: document.querySelector("#note-char-count"),
  deleteDialog: document.querySelector("#delete-dialog"),
  deleteNoteTitle: document.querySelector("#delete-note-title"),
  deleteError: document.querySelector("#delete-error"),
  deleteCancel: document.querySelector("#delete-cancel"),
  deleteConfirm: document.querySelector("#delete-confirm"),
  toast: document.querySelector("#toast"),
};

let toastTimer = 0;
let overflowFrame = 0;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function makeFocusable(node) {
  if (node && !node.hasAttribute("tabindex")) {
    node.setAttribute("tabindex", "-1");
  }
  return node;
}

export function formatDateTime(value) {
  const time = Date.parse(value);
  if (Number.isNaN(time)) return "waktu tidak diketahui";
  return dateFormatter.format(time);
}

function findNoteCard(noteId) {
  if (!noteId) return null;
  return (
    Array.from(refs.list.children).find((card) => card.dataset.noteId === noteId) ?? null
  );
}

export function focusNoteCard(noteId, action = "title") {
  const card = findNoteCard(noteId);
  if (!card) return false;

  let target = null;
  if (action && action !== "title") {
    target = card.querySelector(`[data-action="${action}"]`);
  }
  if (!target) {
    target = card.querySelector(".note-card__title");
  }
  if (!target) return false;

  makeFocusable(target);
  target.focus();
  return true;
}

export function focusFirstNoteCard() {
  const target = refs.list.querySelector(".note-card .note-card__title");
  if (!target) return false;
  makeFocusable(target);
  target.focus();
  return true;
}

export function focusListFallback() {
  if (!refs.emptyState.hidden) {
    makeFocusable(refs.emptyTitle);
    refs.emptyTitle.focus();
    return true;
  }

  makeFocusable(refs.notesHeading);
  refs.notesHeading.focus();
  return true;
}

function measureCardOverflow(bodyWrap) {
  const body = bodyWrap.querySelector(".note-card__body");
  const toggle = bodyWrap.querySelector(".note-card__more");
  if (!body || !toggle) return;

  if (bodyWrap.classList.contains("is-expanded")) {
    toggle.hidden = false;
    return;
  }

  const overflowing = body.scrollHeight > body.clientHeight + 1;
  toggle.hidden = !overflowing;

  if (!overflowing) {
    toggle.setAttribute("aria-expanded", "false");
    toggle.textContent = "Baca selengkapnya";
  }
}

export function refreshNoteOverflow() {
  refs.list.querySelectorAll(".note-card__body-wrap").forEach(measureCardOverflow);
}

function scheduleOverflowRefresh() {
  if (overflowFrame) return;
  overflowFrame = window.requestAnimationFrame(() => {
    overflowFrame = 0;
    refreshNoteOverflow();
  });
}

function createNoteCard(note, handlers) {
  const card = element("article", "note-card");
  card.dataset.noteId = note.id;
  if (note.pinned) card.classList.add("note-card--pinned");

  const header = element("div", "note-card__header");
  const title = element("h2", "note-card__title", note.title);
  header.append(title);
  if (note.pinned) header.append(element("span", "note-card__badge", "Disematkan"));

  const bodyWrap = element("div", "note-card__body-wrap");
  const hasBody = note.body.trim() !== "";
  const body = element("p", "note-card__body", hasBody ? note.body : "Tidak ada isi tambahan.");
  if (!hasBody) body.classList.add("note-card__body--empty");
  bodyWrap.append(body);

  if (hasBody) {
    const toggle = element("button", "note-card__more", "Baca selengkapnya");
    toggle.type = "button";
    toggle.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
    toggle.addEventListener("click", () => {
      const expanded = bodyWrap.classList.toggle("is-expanded");
      toggle.setAttribute("aria-expanded", String(expanded));
      toggle.textContent = expanded ? "Ringkas catatan" : "Baca selengkapnya";

      if (!expanded) {
        measureCardOverflow(bodyWrap);
      }
    });
    bodyWrap.append(toggle);
  }

  const meta = element("div", "note-card__meta");
  const updated = element("time", "note-card__time");
  updated.dateTime = note.updatedAt;
  updated.textContent = `Diperbarui ${formatDateTime(note.updatedAt)}`;
  const created = element("p", "note-card__created", `Dibuat ${formatDateTime(note.createdAt)}`);
  meta.append(updated, created);

  const actions = element("div", "note-card__actions");

  const pinButton = element(
    "button",
    "button button--quiet button--small",
    note.pinned ? "Lepas sematan" : "Sematkan",
  );
  pinButton.type = "button";
  pinButton.dataset.action = "pin";
  pinButton.setAttribute("aria-pressed", String(note.pinned));
  pinButton.setAttribute(
    "aria-label",
    `${note.pinned ? "Lepas sematan" : "Sematkan"} catatan: ${note.title}`,
  );
  pinButton.classList.toggle("is-active", note.pinned);
  pinButton.addEventListener("click", () => handlers.onTogglePin(note));

  const editButton = element("button", "button button--quiet button--small", "Ubah");
  editButton.type = "button";
  editButton.dataset.action = "edit";
  editButton.setAttribute("aria-label", `Ubah catatan: ${note.title}`);
  editButton.addEventListener("click", () => handlers.onEdit(note));

  const deleteButton = element("button", "button button--quiet button--small", "Hapus");
  deleteButton.type = "button";
  deleteButton.dataset.action = "delete";
  deleteButton.classList.add("button--danger-quiet");
  deleteButton.setAttribute("aria-label", `Hapus catatan: ${note.title}`);
  deleteButton.addEventListener("click", () => handlers.onDelete(note));

  actions.append(pinButton, editButton, deleteButton);

  const footer = element("div", "note-card__footer");
  footer.append(meta, actions);

  card.append(header, bodyWrap, footer);
  return card;
}

export function renderNotes(notes, handlers) {
  refs.list.replaceChildren(...notes.map((note) => createNoteCard(note, handlers)));
  scheduleOverflowRefresh();
}

export function renderEmptyState(config) {
  if (!config) {
    refs.emptyState.hidden = true;
    refs.emptyAction.onclick = null;
    return;
  }

  refs.emptyState.hidden = false;
  refs.emptyTitle.textContent = config.title;
  refs.emptyBody.textContent = config.body;

  if (config.actionLabel && typeof config.onAction === "function") {
    refs.emptyAction.hidden = false;
    refs.emptyAction.textContent = config.actionLabel;
    refs.emptyAction.onclick = config.onAction;
  } else {
    refs.emptyAction.hidden = true;
    refs.emptyAction.onclick = null;
  }
}

export function setNotesCount(text) {
  refs.notesCount.textContent = text;
}

export function setResultsStatus(text) {
  refs.resultsStatus.textContent = text;
}

export function setFilter(activeFilter) {
  refs.filterButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.filter === activeFilter));
  });
}

export function setStorageStatus(state, label) {
  if (refs.storageStatus.dataset.state === state && refs.storageStatus.textContent === label) {
    return;
  }
  refs.storageStatus.dataset.state = state;
  refs.storageStatus.textContent = label;
}

export function setOfflineStatus(state, label) {
  if (refs.offlineStatus.dataset.state === state && refs.offlineStatus.textContent === label) {
    return;
  }
  refs.offlineStatus.dataset.state = state;
  refs.offlineStatus.textContent = label;
}

export function showDatabaseBanner(message) {
  refs.dbBannerMessage.textContent = message;
  refs.dbBanner.hidden = false;
}

export function hideDatabaseBanner() {
  refs.dbBanner.hidden = true;
}

export function showUpdateBanner() {
  if (!refs.updateBanner.hidden) return;
  refs.updateBanner.hidden = false;
  refs.updateStatus.textContent =
    "Versi baru Pocket Notes sudah siap digunakan. Tombol Muat ulang tersedia.";
}

export function hideUpdateBanner() {
  refs.updateBanner.hidden = true;
  refs.updateStatus.textContent = "";
}

export function setUpdateBusy(isBusy, label = "Menyiapkan…") {
  refs.updateReload.disabled = isBusy;
  refs.updateReload.textContent = isBusy ? label : "Muat ulang";
}

export function showInstallButton() {
  refs.installButton.hidden = false;
}

export function hideInstallButton() {
  refs.installButton.hidden = true;
}

export function setControlsDisabled(disabled) {
  refs.newNote.disabled = disabled;
  refs.search.disabled = disabled;
  refs.filterButtons.forEach((button) => {
    button.disabled = disabled;
  });
}

export function showToast(message, type = "info") {
  refs.toast.textContent = message;
  refs.toast.dataset.type = type;
  refs.toast.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    refs.toast.hidden = true;
  }, 5000);
}

function updateCharCount() {
  refs.noteCharCount.textContent = `${refs.noteBody.value.length} / ${LIMITS.body}`;
}

export function clearFormErrors() {
  refs.noteTitleError.textContent = "";
  refs.noteBodyError.textContent = "";
  refs.noteTitle.setAttribute("aria-invalid", "false");
  refs.noteBody.setAttribute("aria-invalid", "false");
  refs.noteFormError.textContent = "";
  refs.noteFormError.hidden = true;
}

export function showFormErrors(errors = {}) {
  const titleError = errors.title ?? "";
  const bodyError = errors.body ?? "";

  refs.noteTitleError.textContent = titleError;
  refs.noteBodyError.textContent = bodyError;
  refs.noteTitle.setAttribute("aria-invalid", titleError ? "true" : "false");
  refs.noteBody.setAttribute("aria-invalid", bodyError ? "true" : "false");

  if (titleError) {
    refs.noteTitle.focus();
  } else if (bodyError) {
    refs.noteBody.focus();
  }
}

export function showFormError(message) {
  refs.noteFormError.textContent = message;
  refs.noteFormError.hidden = false;
  refs.noteFormError.focus();
}

export function openNoteEditor(note) {
  if (refs.noteDialog.open) return;
  refs.noteForm.reset();
  refs.noteId.value = note?.id ?? "";
  refs.noteTitle.value = note?.title ?? "";
  refs.noteBody.value = note?.body ?? "";
  refs.noteDialogTitle.textContent = note ? "Ubah catatan" : "Catatan baru";
  refs.noteSubmit.textContent = note ? "Simpan perubahan" : "Simpan catatan";
  clearFormErrors();
  updateCharCount();
  refs.noteDialog.showModal();
  refs.noteTitle.focus();
}

export function getEditorValues() {
  return {
    id: refs.noteId.value || null,
    title: refs.noteTitle.value,
    body: refs.noteBody.value,
  };
}

export function setSaving(isSaving, isEditing) {
  refs.noteSubmit.disabled = isSaving;
  refs.noteCancel.disabled = isSaving;
  refs.noteClose.disabled = isSaving;
  refs.noteSubmit.textContent = isSaving
    ? "Menyimpan…"
    : isEditing
      ? "Simpan perubahan"
      : "Simpan catatan";
}

export function closeNoteEditor() {
  if (refs.noteDialog.open) refs.noteDialog.close();
}

export function openDeleteDialog(note) {
  if (refs.deleteDialog.open) return;
  refs.deleteNoteTitle.textContent = note.title;
  refs.deleteError.textContent = "";
  refs.deleteError.hidden = true;
  refs.deleteCancel.disabled = false;
  refs.deleteConfirm.disabled = false;
  refs.deleteConfirm.textContent = "Hapus";
  refs.deleteDialog.showModal();
  refs.deleteCancel.focus();
}

export function showDeleteError(message) {
  refs.deleteError.textContent = message;
  refs.deleteError.hidden = false;
}

export function setDeleteBusy(isBusy) {
  refs.deleteConfirm.disabled = isBusy;
  refs.deleteCancel.disabled = isBusy;
  refs.deleteConfirm.textContent = isBusy ? "Menghapus…" : "Hapus";
}

export function closeDeleteDialog() {
  if (refs.deleteDialog.open) refs.deleteDialog.close();
}

export function focusSearch() {
  refs.search.focus();
}

refs.noteBody.addEventListener("input", updateCharCount);
window.addEventListener("resize", scheduleOverflowRefresh, { passive: true });
window.addEventListener("orientationchange", scheduleOverflowRefresh, { passive: true });

if (document.fonts?.ready) {
  document.fonts.ready.then(scheduleOverflowRefresh).catch(() => {});
}
