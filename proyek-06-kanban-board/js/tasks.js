export const STATUSES = Object.freeze(["todo", "in-progress", "done"]);
export const STATUS_LABELS = Object.freeze({
  todo: "To Do",
  "in-progress": "In Progress",
  done: "Done",
});
export const PRIORITIES = Object.freeze(["low", "medium", "high"]);
export const PRIORITY_LABELS = Object.freeze({
  low: "Rendah",
  medium: "Sedang",
  high: "Tinggi",
});
export const LIMITS = Object.freeze({
  title: 120,
  description: 1000,
  label: 40,
});

const NO_LABEL_FILTER = "__none__";

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isTimestamp(value) {
  return typeof value === "string" && value.trim() && !Number.isNaN(Date.parse(value));
}

export function isValidDateString(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function getTodayISO(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function offsetDateISO(days, now = new Date()) {
  const date = new Date(now);
  date.setDate(date.getDate() + days);
  return getTodayISO(date);
}

function offsetTimestamp(days, hours, now = new Date()) {
  const date = new Date(now);
  date.setDate(date.getDate() + days);
  date.setHours(date.getHours() + hours);
  return date.toISOString();
}

export function createTaskId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();

  if (globalThis.crypto?.getRandomValues) {
    const bytes = new Uint32Array(4);
    globalThis.crypto.getRandomValues(bytes);
    return `task-${Date.now().toString(36)}-${Array.from(bytes, (value) => value.toString(36)).join("")}`;
  }

  return `task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function validateTaskInput(input = {}) {
  const values = {
    title: cleanText(input.title),
    description: cleanText(input.description),
    status: cleanText(input.status),
    priority: cleanText(input.priority),
    label: cleanText(input.label),
    dueDate: cleanText(input.dueDate),
  };
  const errors = {};

  if (!values.title) {
    errors.title = "Judul tugas wajib diisi.";
  } else if (values.title.length > LIMITS.title) {
    errors.title = `Judul maksimal ${LIMITS.title} karakter.`;
  }

  if (values.description.length > LIMITS.description) {
    errors.description = `Deskripsi maksimal ${LIMITS.description} karakter.`;
  }

  if (!STATUSES.includes(values.status)) {
    errors.status = "Pilih status tugas yang valid.";
  }

  if (!PRIORITIES.includes(values.priority)) {
    errors.priority = "Pilih prioritas tugas yang valid.";
  }

  if (values.label.length > LIMITS.label) {
    errors.label = `Label maksimal ${LIMITS.label} karakter.`;
  }

  if (values.dueDate && !isValidDateString(values.dueDate)) {
    errors.dueDate = "Tanggal tenggat tidak valid.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    values,
  };
}

export function normalizeTask(raw) {
  if (!raw || typeof raw !== "object") return null;

  const id = cleanText(raw.id);
  const title = cleanText(raw.title);
  const description = cleanText(raw.description);
  const status = STATUSES.includes(raw.status) ? raw.status : null;
  const priority = PRIORITIES.includes(raw.priority) ? raw.priority : null;
  const label = cleanText(raw.label);
  const dueDate = cleanText(raw.dueDate);

  if (!id || !title || title.length > LIMITS.title) return null;
  if (description.length > LIMITS.description) return null;
  if (!status || !priority) return null;
  if (label.length > LIMITS.label) return null;
  if (dueDate && !isValidDateString(dueDate)) return null;
  if (!isTimestamp(raw.createdAt) || !isTimestamp(raw.updatedAt)) return null;

  const order = Number.isInteger(raw.order) && raw.order >= 0 ? raw.order : 0;

  return {
    id,
    title,
    description,
    status,
    priority,
    label,
    dueDate,
    createdAt: new Date(raw.createdAt).toISOString(),
    updatedAt: new Date(raw.updatedAt).toISOString(),
    order,
  };
}

function compareTasks(a, b) {
  if (a.order !== b.order) return a.order - b.order;
  const createdComparison = a.createdAt.localeCompare(b.createdAt);
  if (createdComparison !== 0) return createdComparison;
  return a.id.localeCompare(b.id);
}

export function getColumnTasks(tasks, status) {
  return tasks.filter((task) => task.status === status).sort(compareTasks);
}

export function getTaskById(tasks, taskId) {
  return tasks.find((task) => task.id === taskId) || null;
}

function nextOrder(tasks, status) {
  const column = getColumnTasks(tasks, status);
  return column.length ? column[column.length - 1].order + 1 : 0;
}

export function addTask(tasks, input, now = Date.now()) {
  const validation = validateTaskInput(input);
  if (!validation.valid) return { tasks, task: null, errors: validation.errors };

  const timestamp = new Date(now).toISOString();
  const task = {
    ...validation.values,
    id: createTaskId(),
    order: nextOrder(tasks, validation.values.status),
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  return {
    tasks: [...tasks, task],
    task,
    errors: {},
  };
}

export function updateTask(tasks, taskId, input, now = Date.now()) {
  const existing = getTaskById(tasks, taskId);
  if (!existing) return { tasks, task: null, errors: { form: "Tugas tidak ditemukan." } };

  const validation = validateTaskInput(input);
  if (!validation.valid) return { tasks, task: null, errors: validation.errors };

  const statusChanged = existing.status !== validation.values.status;
  const task = {
    ...existing,
    ...validation.values,
    order: statusChanged ? nextOrder(tasks.filter((item) => item.id !== taskId), validation.values.status) : existing.order,
    updatedAt: new Date(now).toISOString(),
  };

  return {
    tasks: tasks.map((item) => (item.id === taskId ? task : item)),
    task,
    errors: {},
  };
}

export function deleteTask(tasks, taskId) {
  return tasks.filter((task) => task.id !== taskId);
}

export function moveTask(tasks, taskId, toStatus, targetId = null, position = "end", now = Date.now()) {
  const movingTask = getTaskById(tasks, taskId);
  if (!movingTask || !STATUSES.includes(toStatus) || targetId === taskId) {
    return { tasks, changed: false, movedTask: movingTask };
  }

  const remaining = tasks.filter((task) => task.id !== taskId);
  const destination = getColumnTasks(remaining, toStatus);
  let insertIndex = destination.length;

  if (targetId) {
    const targetIndex = destination.findIndex((task) => task.id === targetId);
    if (targetIndex >= 0) {
      insertIndex = position === "before" ? targetIndex : targetIndex + 1;
    }
  }

  const movedTask = {
    ...movingTask,
    status: toStatus,
    updatedAt: new Date(now).toISOString(),
  };

  destination.splice(insertIndex, 0, movedTask);

  const updates = new Map();
  destination.forEach((task, index) => {
    updates.set(task.id, { ...task, order: index });
  });

  if (movingTask.status !== toStatus) {
    getColumnTasks(remaining, movingTask.status).forEach((task, index) => {
      updates.set(task.id, { ...task, order: index });
    });
  }

  return {
    tasks: tasks.map((task) => updates.get(task.id) || task),
    changed: true,
    movedTask: updates.get(taskId) || movedTask,
  };
}

export function getLabels(tasks) {
  return [...new Set(tasks.map((task) => task.label).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "id-ID"),
  );
}

export function hasActiveFilters(filters = {}) {
  return Boolean(cleanText(filters.query)) || Boolean(filters.priority && filters.priority !== "all") || Boolean(filters.label && filters.label !== "all");
}

export function getVisibleTasks(tasks, filters = {}) {
  const query = cleanText(filters.query).toLocaleLowerCase("id-ID");
  const priority = filters.priority || "all";
  const label = filters.label || "all";

  return tasks.filter((task) => {
    if (query) {
      const title = task.title.toLocaleLowerCase("id-ID");
      const description = task.description.toLocaleLowerCase("id-ID");
      if (!title.includes(query) && !description.includes(query)) return false;
    }

    if (priority !== "all" && task.priority !== priority) return false;

    if (label !== "all") {
      if (label === NO_LABEL_FILTER) return !task.label;
      if (task.label !== label) return false;
    }

    return true;
  });
}

export function getTaskStats(tasks) {
  const total = tasks.length;
  const todo = tasks.filter((task) => task.status === "todo").length;
  const inProgress = tasks.filter((task) => task.status === "in-progress").length;
  const done = tasks.filter((task) => task.status === "done").length;
  const completion = total === 0 ? 0 : Math.round((done / total) * 100);

  return { total, todo, inProgress, done, completion };
}

export function createSampleTasks(now = new Date()) {
  const samples = [
    {
      title: "Finalisasi proposal klien",
      description: "Rapikan ruang lingkup, estimasi biaya, dan jadwal presentasi untuk klien baru.",
      status: "todo",
      priority: "high",
      label: "Klien",
      dueDate: offsetDateISO(2, now),
      createdAt: offsetTimestamp(-4, -2, now),
    },
    {
      title: "Rapikan dokumentasi onboarding",
      description: "Susun ulang langkah onboarding agar anggota tim baru bisa mulai lebih cepat.",
      status: "todo",
      priority: "medium",
      label: "Internal",
      dueDate: offsetDateISO(5, now),
      createdAt: offsetTimestamp(-3, -1, now),
    },
    {
      title: "Desain ulang halaman harga",
      description: "Bandingkan tiga arah visual dan siapkan prototipe responsif untuk review.",
      status: "in-progress",
      priority: "high",
      label: "Produk",
      dueDate: offsetDateISO(1, now),
      createdAt: offsetTimestamp(-6, 0, now),
    },
    {
      title: "Riset alat analitik",
      description: "Kumpulkan kebutuhan tim dan bandingkan opsi pelacakan yang ringan.",
      status: "in-progress",
      priority: "low",
      label: "Riset",
      dueDate: "",
      createdAt: offsetTimestamp(-2, -4, now),
    },
    {
      title: "Kirim laporan mingguan",
      description: "Ringkas progres pekan ini dan catat keputusan yang perlu ditindaklanjuti.",
      status: "done",
      priority: "medium",
      label: "Operasional",
      dueDate: offsetDateISO(-1, now),
      createdAt: offsetTimestamp(-7, 0, now),
    },
    {
      title: "Perbarui aset merek",
      description: "Ekspor ulang logo dan panduan warna untuk kebutuhan presentasi.",
      status: "done",
      priority: "low",
      label: "Desain",
      dueDate: "",
      createdAt: offsetTimestamp(-8, -3, now),
    },
  ];

  const orderByStatus = new Map();
  return samples.map((sample) => {
    const order = orderByStatus.get(sample.status) || 0;
    orderByStatus.set(sample.status, order + 1);
    return {
      ...sample,
      id: createTaskId(),
      order,
      createdAt: sample.createdAt,
      updatedAt: sample.createdAt,
    };
  });
}
