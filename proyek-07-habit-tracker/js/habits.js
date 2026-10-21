import {
  compareDateKeys,
  getWeekday,
  isValidDateKey,
  todayKey,
  WEEKDAY_SHORT,
} from "./dates.js";

export const CATEGORY_IDS = Object.freeze(["health", "productivity", "learning", "personal"]);
export const CATEGORY_LABELS = Object.freeze({
  health: "Kesehatan",
  productivity: "Produktivitas",
  learning: "Belajar",
  personal: "Personal",
});

export const FREQUENCY_TYPES = Object.freeze(["daily", "weekly"]);
export const FREQUENCY_LABELS = Object.freeze({
  daily: "Setiap hari",
  weekly: "Hari tertentu",
});

export const COLOR_OPTIONS = Object.freeze([
  { id: "pine", label: "Pinus", hex: "#1f6b52", soft: "#e4f0e9" },
  { id: "teal", label: "Teal", hex: "#247c76", soft: "#e1f1ef" },
  { id: "sky", label: "Langit", hex: "#3c78a8", soft: "#e7f0f8" },
  { id: "amber", label: "Amber", hex: "#a8742c", soft: "#f6eddc" },
  { id: "rose", label: "Mawar", hex: "#a85a64", soft: "#f7e7e9" },
  { id: "plum", label: "Prem", hex: "#785a8e", soft: "#f0eaf4" },
]);
export const COLOR_MAP = Object.freeze(
  Object.fromEntries(COLOR_OPTIONS.map((color) => [color.id, color])),
);

export const HABIT_LIMITS = Object.freeze({
  name: 60,
  description: 280,
});

const ID_PATTERN = /^[A-Za-z0-9_-]{6,80}$/;
const RESERVED_IDS = new Set(["__proto__", "prototype", "constructor"]);
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T/;

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isValidTimestamp(value) {
  return (
    typeof value === "string" &&
    TIMESTAMP_PATTERN.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

function normaliseDays(rawDays) {
  if (!Array.isArray(rawDays)) return [];
  return [
    ...new Set(
      rawDays
        .filter(
          (value) =>
            typeof value === "number" ||
            (typeof value === "string" && value.trim() !== ""),
        )
        .map(Number),
    ),
  ]
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    .sort((a, b) => a - b);
}

function normaliseFrequency(raw) {
  if (!raw || typeof raw !== "object") return null;
  const type = cleanText(raw.type);
  if (!FREQUENCY_TYPES.includes(type)) return null;
  const days = type === "weekly" ? normaliseDays(raw.days) : [];
  if (type === "weekly" && days.length === 0) return null;
  return { type, days };
}

export function createHabitId() {
  if (globalThis.crypto?.randomUUID) return `habit-${globalThis.crypto.randomUUID()}`;
  if (globalThis.crypto?.getRandomValues) {
    const bytes = new Uint32Array(4);
    globalThis.crypto.getRandomValues(bytes);
    return `habit-${Date.now().toString(36)}-${Array.from(bytes, (value) =>
      value.toString(36),
    ).join("")}`;
  }
  return `habit-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function validateHabitInput(input = {}) {
  const rawFrequency = input.frequency;
  const frequencyType = cleanText(rawFrequency?.type);
  const frequency = FREQUENCY_TYPES.includes(frequencyType)
    ? {
        type: frequencyType,
        days: frequencyType === "weekly" ? normaliseDays(rawFrequency.days) : [],
      }
    : null;
  const values = {
    name: cleanText(input.name),
    description: cleanText(input.description),
    category: cleanText(input.category),
    color: cleanText(input.color),
    frequency,
  };
  const errors = {};

  if (!values.name) {
    errors.name = "Nama kebiasaan wajib diisi.";
  } else if (values.name.length > HABIT_LIMITS.name) {
    errors.name = `Nama maksimal ${HABIT_LIMITS.name} karakter.`;
  }

  if (values.description.length > HABIT_LIMITS.description) {
    errors.description = `Deskripsi maksimal ${HABIT_LIMITS.description} karakter.`;
  }

  if (!CATEGORY_IDS.includes(values.category)) {
    errors.category = "Pilih kategori yang valid.";
  }

  if (!COLOR_MAP[values.color]) {
    errors.color = "Pilih warna kebiasaan.";
  }

  if (!values.frequency) {
    errors.frequency = "Pilih frekuensi yang valid.";
  } else if (values.frequency.type === "weekly" && values.frequency.days.length === 0) {
    errors.days = "Pilih minimal satu hari untuk jadwal mingguan.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    values,
  };
}

export function normalizeHabit(raw) {
  if (!raw || typeof raw !== "object") return null;

  const id = cleanText(raw.id);
  const name = cleanText(raw.name);
  const description = cleanText(raw.description);
  const category = cleanText(raw.category);
  const color = cleanText(raw.color);
  const frequency = normaliseFrequency(raw.frequency);
  const createdOn = cleanText(raw.createdOn);
  const archivedAt = raw.archivedAt === null || raw.archivedAt === undefined
    ? null
    : cleanText(raw.archivedAt);

  if (!ID_PATTERN.test(id) || RESERVED_IDS.has(id)) return null;
  if (!name || name.length > HABIT_LIMITS.name) return null;
  if (description.length > HABIT_LIMITS.description) return null;
  if (!CATEGORY_IDS.includes(category) || !COLOR_MAP[color]) return null;
  if (!frequency) return null;
  if (!isValidDateKey(createdOn)) return null;
  if (archivedAt && !isValidDateKey(archivedAt)) return null;
  if (archivedAt && compareDateKeys(archivedAt, createdOn) < 0) return null;
  if (!isValidTimestamp(raw.updatedAt)) return null;

  return {
    id,
    name,
    description,
    category,
    color,
    frequency,
    createdOn,
    updatedAt: new Date(raw.updatedAt).toISOString(),
    archivedAt,
  };
}

export function getHabitById(habits, habitId) {
  return habits.find((habit) => habit.id === habitId) || null;
}

export function isArchived(habit) {
  return Boolean(habit?.archivedAt);
}

export function addHabit(habits, input, now = new Date()) {
  const validation = validateHabitInput(input);
  if (!validation.valid) {
    return { habits, habit: null, errors: validation.errors };
  }

  const habit = {
    ...validation.values,
    id: createHabitId(),
    createdOn: todayKey(now),
    updatedAt: now.toISOString(),
    archivedAt: null,
  };

  return {
    habits: [...habits, habit],
    habit,
    errors: {},
  };
}

export function updateHabit(habits, habitId, input, now = new Date()) {
  const existing = getHabitById(habits, habitId);
  if (!existing) {
    return { habits, habit: null, errors: { form: "Kebiasaan tidak ditemukan." } };
  }

  const validation = validateHabitInput(input);
  if (!validation.valid) {
    return { habits, habit: null, errors: validation.errors };
  }

  const habit = {
    ...existing,
    ...validation.values,
    updatedAt: now.toISOString(),
  };

  return {
    habits: habits.map((item) => (item.id === habitId ? habit : item)),
    habit,
    errors: {},
  };
}

export function archiveHabit(habits, habitId, dateKey = todayKey(), now = new Date()) {
  const existing = getHabitById(habits, habitId);
  if (!existing || existing.archivedAt) {
    return { habits, habit: existing, changed: false };
  }
  const habit = {
    ...existing,
    archivedAt: dateKey,
    updatedAt: now.toISOString(),
  };
  return {
    habits: habits.map((item) => (item.id === habitId ? habit : item)),
    habit,
    changed: true,
  };
}

export function reactivateHabit(habits, habitId, now = new Date()) {
  const existing = getHabitById(habits, habitId);
  if (!existing || !existing.archivedAt) {
    return { habits, habit: existing, changed: false };
  }
  const habit = {
    ...existing,
    archivedAt: null,
    updatedAt: now.toISOString(),
  };
  return {
    habits: habits.map((item) => (item.id === habitId ? habit : item)),
    habit,
    changed: true,
  };
}

export function deleteHabit(habits, habitId) {
  return habits.filter((habit) => habit.id !== habitId);
}

export function isScheduledOn(habit, dateKey) {
  if (!habit || compareDateKeys(dateKey, habit.createdOn) < 0) return false;
  if (habit.archivedAt && compareDateKeys(dateKey, habit.archivedAt) > 0) return false;
  if (habit.frequency.type === "daily") return true;
  return habit.frequency.days.includes(getWeekday(dateKey));
}

export function canCheckIn(habit, dateKey, today = todayKey()) {
  return (
    Boolean(habit) &&
    !isArchived(habit) &&
    compareDateKeys(dateKey, habit.createdOn) >= 0 &&
    compareDateKeys(dateKey, today) <= 0 &&
    isScheduledOn(habit, dateKey)
  );
}

export function getScheduleLabel(habit) {
  if (!habit) return "";
  if (habit.frequency.type === "daily") return "Setiap hari";
  const days = [...habit.frequency.days].sort(
    (a, b) => ((a + 6) % 7) - ((b + 6) % 7),
  );
  return days.map((day) => WEEKDAY_SHORT[day]).join(", ");
}

export function getScheduleDays(habit) {
  return habit?.frequency.type === "weekly" ? [...habit.frequency.days] : [];
}

export function getCategoryLabel(category) {
  return CATEGORY_LABELS[category] || "Lainnya";
}

export function getColor(habitOrId) {
  const id = typeof habitOrId === "string" ? habitOrId : habitOrId?.color;
  return COLOR_MAP[id] || COLOR_OPTIONS[0];
}

export function getActiveHabits(habits) {
  return habits.filter((habit) => !isArchived(habit));
}

export function getArchivedHabits(habits) {
  return habits.filter(isArchived);
}

export function filterHabits(habits, filters = {}) {
  const query = cleanText(filters.query).toLocaleLowerCase("id-ID");
  const category = filters.category || "all";
  const status = filters.status || "active";

  return habits
    .filter((habit) => {
      if (query && !habit.name.toLocaleLowerCase("id-ID").includes(query)) return false;
      if (category !== "all" && habit.category !== category) return false;
      if (status === "active" && isArchived(habit)) return false;
      if (status === "archived" && !isArchived(habit)) return false;
      return true;
    })
    .sort((a, b) => {
      if (isArchived(a) !== isArchived(b)) return isArchived(a) ? 1 : -1;
      const created = compareDateKeys(a.createdOn, b.createdOn);
      if (created !== 0) return created;
      return a.name.localeCompare(b.name, "id-ID");
    });
}

export function hasHabitFilters(filters = {}) {
  return Boolean(
    cleanText(filters.query) ||
      (filters.category && filters.category !== "all") ||
      (filters.status && filters.status !== "active"),
  );
}

export function countActiveHabits(habits) {
  return getActiveHabits(habits).length;
}

export function countArchivedHabits(habits) {
  return getArchivedHabits(habits).length;
}
