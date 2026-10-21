export const TASK_STATUSES = Object.freeze(["todo", "in_progress", "done"]);
export const TASK_PRIORITIES = Object.freeze(["low", "medium", "high"]);

export const TITLE_MAX_LENGTH = 200;
export const DESCRIPTION_MAX_LENGTH = 2_000;
export const SEARCH_MAX_LENGTH = 100;

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 50;
export const MAX_PAGE = 1_000_000;

export const SORT_FIELDS = Object.freeze(["created_at", "priority", "due_date"]);
export const SORT_ORDERS = Object.freeze(["asc", "desc"]);

export const CREATE_FIELDS = Object.freeze([
  "title",
  "description",
  "status",
  "priority",
  "due_date",
]);

export const UPDATE_FIELDS = CREATE_FIELDS;

const QUERY_FIELDS = Object.freeze([
  "q",
  "status",
  "priority",
  "sort",
  "order",
  "page",
  "limit",
]);

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function addError(details, field, message) {
  details.push({ field, message });
}

function unknownFieldErrors(payload, allowed, details) {
  for (const key of Object.keys(payload)) {
    if (!allowed.includes(key)) {
      addError(details, key, `Field "${key}" tidak didukung.`);
    }
  }
}

function validateTitle(value, details) {
  if (typeof value !== "string") {
    addError(details, "title", "Judul wajib berupa teks.");
    return "";
  }
  const title = value.trim().replace(/\s+/g, " ");
  if (!title) {
    addError(details, "title", "Judul wajib diisi.");
    return "";
  }
  if (title.length > TITLE_MAX_LENGTH) {
    addError(
      details,
      "title",
      `Judul maksimal ${TITLE_MAX_LENGTH} karakter.`,
    );
  }
  return title;
}

function validateDescription(value, details) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") {
    addError(details, "description", "Deskripsi harus berupa teks.");
    return "";
  }
  const description = value.trim();
  if (description.length > DESCRIPTION_MAX_LENGTH) {
    addError(
      details,
      "description",
      `Deskripsi maksimal ${DESCRIPTION_MAX_LENGTH} karakter.`,
    );
  }
  return description;
}

function validateStatus(value, details, fallback) {
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== "string" || !TASK_STATUSES.includes(value)) {
    addError(
      details,
      "status",
      `Status harus salah satu dari: ${TASK_STATUSES.join(", ")}.`,
    );
    return fallback ?? "";
  }
  return value;
}

function validatePriority(value, details, fallback) {
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== "string" || !TASK_PRIORITIES.includes(value)) {
    addError(
      details,
      "priority",
      `Prioritas harus salah satu dari: ${TASK_PRIORITIES.join(", ")}.`,
    );
    return fallback ?? "";
  }
  return value;
}

export function isValidDateKey(value) {
  if (typeof value !== "string") return false;
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1) {
    return false;
  }

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= daysInMonth;
}

function validateDueDate(value, details) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !isValidDateKey(value)) {
    addError(details, "due_date", "Tenggat harus tanggal valid berformat YYYY-MM-DD.");
    return null;
  }
  return value;
}

function validateCreatePayload(payload) {
  const details = [];
  if (!isPlainObject(payload)) {
    return {
      ok: false,
      value: null,
      details: [{ field: "body", message: "Body harus berupa objek JSON." }],
    };
  }

  unknownFieldErrors(payload, CREATE_FIELDS, details);

  const value = {
    title: validateTitle(payload.title, details),
    description: validateDescription(payload.description, details),
    status: validateStatus(payload.status, details, "todo"),
    priority: validatePriority(payload.priority, details, "medium"),
    due_date: validateDueDate(payload.due_date, details),
  };

  return details.length
    ? { ok: false, value: null, details }
    : { ok: true, value, details: [] };
}

export function validateCreateTask(payload) {
  return validateCreatePayload(payload);
}

export function validateUpdateTask(payload) {
  const details = [];
  if (!isPlainObject(payload)) {
    return {
      ok: false,
      value: null,
      details: [{ field: "body", message: "Body harus berupa objek JSON." }],
    };
  }

  unknownFieldErrors(payload, UPDATE_FIELDS, details);

  const keys = Object.keys(payload).filter((key) => UPDATE_FIELDS.includes(key));
  if (keys.length === 0) {
    addError(details, "body", "Payload pembaruan tidak boleh kosong.");
  }

  const value = {};
  for (const key of keys) {
    switch (key) {
      case "title":
        value.title = validateTitle(payload.title, details);
        break;
      case "description":
        value.description = validateDescription(payload.description, details);
        break;
      case "status":
        value.status = validateStatus(payload.status, details);
        break;
      case "priority":
        value.priority = validatePriority(payload.priority, details);
        break;
      case "due_date":
        value.due_date = validateDueDate(payload.due_date, details);
        break;
      default:
        break;
    }
  }

  return details.length
    ? { ok: false, value: null, details }
    : { ok: true, value, details: [] };
}

function parsePositiveInteger(value, field, details, { fallback, max }) {
  if (value === undefined || value === "") return fallback;
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    addError(details, field, `${field} harus berupa bilangan bulat positif.`);
    return fallback;
  }
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1 || number > max) {
    addError(details, field, `${field} harus berada di antara 1 dan ${max}.`);
    return fallback;
  }
  return number;
}

export function validateListQuery(query = {}) {
  const details = [];
  if (!isPlainObject(query)) {
    return {
      ok: false,
      value: null,
      details: [{ field: "query", message: "Query string tidak valid." }],
    };
  }

  for (const key of Object.keys(query)) {
    if (!QUERY_FIELDS.includes(key)) {
      addError(details, key, `Query parameter "${key}" tidak didukung.`);
    }
  }

  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value) || (value && typeof value === "object")) {
      addError(details, key, `Query parameter "${key}" hanya boleh memiliki satu nilai.`);
    } else if (typeof value !== "string") {
      addError(details, key, `Query parameter "${key}" tidak valid.`);
    }
  }

  const text = (key, fallback) => {
    const value = query[key];
    return typeof value === "string" ? value.trim() : fallback;
  };

  let q = text("q", null);
  if (q === "") q = null;
  if (q && q.length > SEARCH_MAX_LENGTH) {
    addError(details, "q", `Pencarian maksimal ${SEARCH_MAX_LENGTH} karakter.`);
  }

  const status = text("status", "");
  if (status && !TASK_STATUSES.includes(status)) {
    addError(details, "status", `Status harus salah satu dari: ${TASK_STATUSES.join(", ")}.`);
  }

  const priority = text("priority", "");
  if (priority && !TASK_PRIORITIES.includes(priority)) {
    addError(details, "priority", `Prioritas harus salah satu dari: ${TASK_PRIORITIES.join(", ")}.`);
  }

  const sort = text("sort", "created_at");
  if (!SORT_FIELDS.includes(sort)) {
    addError(details, "sort", `Pengurutan harus salah satu dari: ${SORT_FIELDS.join(", ")}.`);
  }

  const order = text("order", "desc");
  if (!SORT_ORDERS.includes(order)) {
    addError(details, "order", "Urutan harus asc atau desc.");
  }

  const page = parsePositiveInteger(query.page, "page", details, {
    fallback: DEFAULT_PAGE,
    max: MAX_PAGE,
  });
  const limit = parsePositiveInteger(query.limit, "limit", details, {
    fallback: DEFAULT_LIMIT,
    max: MAX_LIMIT,
  });

  return details.length
    ? { ok: false, value: null, details }
    : {
        ok: true,
        details: [],
        value: {
          q: q || null,
          status: status || null,
          priority: priority || null,
          sort,
          order,
          page,
          limit,
        },
      };
}

export function isValidTaskId(value) {
  return typeof value === "string" && UUID_PATTERN.test(value);
}
