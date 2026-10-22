export const LIMITS = Object.freeze({
  title: 120,
  body: 8000,
});

export const FILTERS = Object.freeze(["all", "pinned"]);

function cleanTitle(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function cleanBody(value) {
  if (typeof value !== "string") return "";
  return value.replace(/\r\n/g, "\n").trim();
}

function normalizeTimestamp(value) {
  if (typeof value !== "string" || value.trim() === "") return null;
  const time = Date.parse(value);
  if (Number.isNaN(time)) return null;
  return new Date(time).toISOString();
}

export function createNoteId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();

  if (globalThis.crypto?.getRandomValues) {
    const bytes = new Uint32Array(4);
    globalThis.crypto.getRandomValues(bytes);
    return `note-${Date.now().toString(36)}-${Array.from(bytes, (value) =>
      value.toString(36),
    ).join("")}`;
  }

  return `note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeNote(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (typeof raw.id !== "string" || raw.id.trim() === "") return null;

  const title = cleanTitle(raw.title);
  if (!title) return null;

  const createdAt = normalizeTimestamp(raw.createdAt);
  if (!createdAt) return null;

  const updatedAt = normalizeTimestamp(raw.updatedAt) ?? createdAt;

  return {
    id: raw.id.trim(),
    title: title.slice(0, LIMITS.title),
    body: cleanBody(raw.body).slice(0, LIMITS.body),
    pinned: raw.pinned === true,
    createdAt,
    updatedAt,
  };
}

export function validateNoteInput(input = {}) {
  const title = cleanTitle(input.title);
  const body = cleanBody(input.body);
  const errors = {};

  if (!title) {
    errors.title = "Judul catatan wajib diisi.";
  } else if (title.length > LIMITS.title) {
    errors.title = `Judul maksimal ${LIMITS.title} karakter.`;
  }

  if (body.length > LIMITS.body) {
    errors.body = `Isi catatan maksimal ${LIMITS.body} karakter.`;
  }

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    values: { title, body },
  };
}

export function createNote(values, now = new Date()) {
  const timestamp = now.toISOString();
  return {
    id: createNoteId(),
    title: values.title,
    body: values.body,
    pinned: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function applyNoteUpdate(note, values, now = new Date()) {
  return {
    ...note,
    title: values.title,
    body: values.body,
    updatedAt: now.toISOString(),
  };
}

export function toggleNotePin(note, now = new Date()) {
  return {
    ...note,
    pinned: !note.pinned,
    updatedAt: now.toISOString(),
  };
}

export function sortNotes(notes) {
  return [...notes].sort((a, b) => {
    const updatedDiff = Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
    if (updatedDiff !== 0) return updatedDiff;

    const createdDiff = Date.parse(b.createdAt) - Date.parse(a.createdAt);
    if (createdDiff !== 0) return createdDiff;

    return a.title.localeCompare(b.title, "id-ID");
  });
}

export function matchesQuery(note, query) {
  const needle = String(query ?? "")
    .trim()
    .toLocaleLowerCase("id-ID");
  if (!needle) return true;

  return (
    note.title.toLocaleLowerCase("id-ID").includes(needle) ||
    note.body.toLocaleLowerCase("id-ID").includes(needle)
  );
}

export function filterNotes(notes, { filter = "all", query = "" } = {}) {
  const activeFilter = FILTERS.includes(filter) ? filter : "all";

  return notes.filter((note) => {
    if (activeFilter === "pinned" && !note.pinned) return false;
    return matchesQuery(note, query);
  });
}
