import {
  PRIORITY_LABELS,
  STATUSES,
  STATUS_LABELS,
  getColumnTasks,
  getTodayISO,
} from "./tasks.js";

const SVG_NS = "http://www.w3.org/2000/svg";

export function createIcon(name, className = "icon") {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", className);
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const use = document.createElementNS(SVG_NS, "use");
  use.setAttribute("href", `#icon-${name}`);
  svg.append(use);
  return svg;
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(className, text) {
  const node = element("button", className);
  node.type = "button";
  if (text) node.textContent = text;
  return node;
}

function parseLocalDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatDueDate(value) {
  if (!value) return "";
  const due = parseLocalDate(value);
  const today = getTodayISO();
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = getTodayISO(tomorrowDate);

  if (value === today) return "Hari ini";
  if (value === tomorrow) return "Besok";
  return due.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

export function isTaskOverdue(task) {
  return Boolean(task.dueDate) && task.dueDate < getTodayISO() && task.status !== "done";
}

export function formatDateTime(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatLongDate(date = new Date()) {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatShortTime(date = new Date()) {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function createTaskCard(task, draggable) {
  const card = element("article", "task-card");
  card.dataset.taskId = task.id;
  card.dataset.status = task.status;
  card.setAttribute("role", "listitem");
  card.draggable = draggable;
  if (!draggable) {
    card.title = "Hapus filter untuk mengubah urutan dengan drag-and-drop.";
  }
  if (task.status === "done") card.classList.add("is-complete");

  const top = element("div", "task-card-top");
  const priority = element("span", `priority-pill priority-${task.priority}`);
  priority.append(element("span", "priority-dot"), document.createTextNode(PRIORITY_LABELS[task.priority]));
  top.append(priority);

  const menu = element("details", "card-menu");
  const summary = element("summary", "card-menu-trigger");
  summary.setAttribute("aria-label", `Aksi untuk ${task.title}`);
  summary.append(createIcon("more"));
  menu.append(summary);

  const panel = element("div", "card-menu-panel");
  panel.setAttribute("aria-label", `Aksi tugas ${task.title}`);
  panel.append(element("p", "card-menu-label", "Pindahkan ke"));

  STATUSES.filter((status) => status !== task.status).forEach((status) => {
    const moveButton = button("card-menu-item");
    moveButton.dataset.action = "move";
    moveButton.dataset.status = status;
    moveButton.append(createIcon("arrow-right"), document.createTextNode(STATUS_LABELS[status]));
    panel.append(moveButton);
  });

  panel.append(element("div", "card-menu-separator"));

  const editButton = button("card-menu-item");
  editButton.dataset.action = "edit";
  editButton.append(createIcon("edit"), document.createTextNode("Edit detail"));
  panel.append(editButton);

  const deleteButton = button("card-menu-item card-menu-danger");
  deleteButton.dataset.action = "delete";
  deleteButton.append(createIcon("trash"), document.createTextNode("Hapus tugas"));
  panel.append(deleteButton);

  menu.append(panel);
  top.append(menu);
  card.append(top);

  const heading = element("h4", "task-card-title");
  const titleButton = button("task-title-button", task.title);
  titleButton.dataset.action = "edit";
  heading.append(titleButton);
  card.append(heading);

  if (task.description) {
    card.append(element("p", "task-description", task.description));
  }

  if (task.label || task.dueDate) {
    const meta = element("div", "task-meta");
    if (task.label) {
      const label = element("span", "task-label");
      label.append(createIcon("tag"), document.createTextNode(task.label));
      meta.append(label);
    }
    if (task.dueDate) {
      const due = element("span", "task-due");
      due.title = `Tenggat: ${task.dueDate}`;
      due.append(createIcon("calendar"), document.createTextNode(formatDueDate(task.dueDate)));
      if (isTaskOverdue(task)) {
        due.classList.add("is-overdue");
        due.title = `Tenggat terlewat: ${task.dueDate}`;
      }
      meta.append(due);
    }
    card.append(meta);
  }

  return card;
}

export function renderBoard(dom, tasks, visibleTasks, filtersActive) {
  STATUSES.forEach((status) => {
    const visibleColumn = getColumnTasks(visibleTasks, status);
    const actualColumn = getColumnTasks(tasks, status);
    const list = dom.lists[status];
    const empty = dom.empties[status];
    const count = dom.counts[status];

    list.replaceChildren(...visibleColumn.map((task) => createTaskCard(task, !filtersActive)));
    count.textContent = String(visibleColumn.length);
    count.setAttribute(
      "aria-label",
      filtersActive
        ? `${visibleColumn.length} dari ${actualColumn.length} tugas ditampilkan`
        : `${actualColumn.length} tugas`,
    );
    count.title = filtersActive ? `${visibleColumn.length} dari ${actualColumn.length} tugas ditampilkan` : "";

    empty.hidden = visibleColumn.length > 0;
    const text = empty.querySelector("p");
    if (text) {
      if (filtersActive) {
        text.textContent = "Tidak ada kartu yang cocok dengan filter.";
      } else {
        text.textContent = "Belum ada tugas di kolom ini. Tarik kartu ke sini atau buat tugas baru.";
      }
    }
  });
}

export function renderStats(dom, stats) {
  dom.statTotal.textContent = String(stats.total);
  dom.statTodo.textContent = String(stats.todo);
  dom.statProgress.textContent = String(stats.inProgress);
  dom.statDone.textContent = String(stats.done);
  dom.statPercent.textContent = `${stats.completion}%`;
  dom.completionBar.setAttribute("aria-valuenow", String(stats.completion));
  dom.completionFill.style.width = `${stats.completion}%`;
}

export function renderLabelOptions(select, labels, selected) {
  const previous = selected || "all";
  const options = [
    new Option("Semua label", "all"),
    new Option("Tanpa label", "__none__"),
    ...labels.map((label) => new Option(label, label)),
  ];
  select.replaceChildren(...options);
  const values = new Set(options.map((option) => option.value));
  select.value = values.has(previous) ? previous : "all";
  return select.value;
}

export function renderLabelSuggestions(datalist, labels) {
  datalist.replaceChildren(...labels.map((label) => new Option(label, label)));
}

export function renderSaveState(element, status = "saved", savedAt = null) {
  const labels = {
    saved: savedAt ? `Tersimpan · ${formatShortTime(savedAt)}` : "Tersimpan lokal",
    warning: "Perlu perhatian",
    error: "Gagal menyimpan",
    unavailable: "Penyimpanan tidak tersedia",
  };
  element.dataset.state = status;
  element.replaceChildren(
    createIcon(["warning", "error", "unavailable"].includes(status) ? "alert" : "save", "icon icon-sm"),
    document.createTextNode(labels[status] || labels.saved),
  );
}

export function setTodayLabel(element) {
  element.textContent = formatLongDate();
}

export function showStorageNotice(dom, message, canReset = false) {
  dom.storageBannerMessage.textContent = message;
  dom.storageResetButton.hidden = !canReset;
  dom.storageBanner.hidden = false;
}

export function hideStorageNotice(dom) {
  dom.storageBanner.hidden = true;
  dom.storageBannerMessage.textContent = "";
}

export function populateTaskForm(dom, task, defaultStatus = "todo") {
  dom.taskForm.reset();
  clearFormErrors(dom);

  if (task) {
    dom.taskId.value = task.id;
    dom.fields.title.value = task.title;
    dom.fields.description.value = task.description;
    dom.fields.status.value = task.status;
    dom.fields.priority.value = task.priority;
    dom.fields.label.value = task.label;
    dom.fields.dueDate.value = task.dueDate;
    dom.taskDialogTitle.textContent = "Edit tugas";
    dom.taskDialogSubtitle.textContent = "Perbarui detail, status, atau prioritas tugas ini.";
    dom.taskMeta.hidden = false;
    dom.createdAtText.textContent = formatDateTime(task.createdAt);
    dom.updatedAtText.textContent = formatDateTime(task.updatedAt);
    dom.deleteTaskButton.hidden = false;
    dom.submitTaskButton.textContent = "Simpan perubahan";
  } else {
    dom.taskId.value = "";
    dom.fields.status.value = defaultStatus;
    dom.fields.priority.value = "medium";
    dom.taskDialogTitle.textContent = "Tugas baru";
    dom.taskDialogSubtitle.textContent = "Tambahkan detail yang cukup agar pekerjaan mudah dilanjutkan.";
    dom.taskMeta.hidden = true;
    dom.createdAtText.textContent = "-";
    dom.updatedAtText.textContent = "-";
    dom.deleteTaskButton.hidden = true;
    dom.submitTaskButton.textContent = "Buat tugas";
  }
}

export function readTaskForm(dom) {
  return {
    title: dom.fields.title.value,
    description: dom.fields.description.value,
    status: dom.fields.status.value,
    priority: dom.fields.priority.value,
    label: dom.fields.label.value,
    dueDate: dom.fields.dueDate.value,
  };
}

export function clearFormErrors(dom) {
  Object.entries(dom.fieldErrors).forEach(([field, errorNode]) => {
    errorNode.textContent = "";
    if (dom.fields[field]) dom.fields[field].removeAttribute("aria-invalid");
  });
  dom.formError.textContent = "";
  dom.formError.hidden = true;
}

export function showFormErrors(dom, errors) {
  clearFormErrors(dom);

  Object.entries(errors).forEach(([field, message]) => {
    if (field === "form") {
      dom.formError.textContent = message;
      dom.formError.hidden = false;
      return;
    }

    if (dom.fieldErrors[field]) {
      dom.fieldErrors[field].textContent = message;
      dom.fields[field]?.setAttribute("aria-invalid", "true");
    }
  });

  const firstField = ["title", "description", "status", "priority", "label", "dueDate"].find(
    (field) => errors[field],
  );
  if (firstField && dom.fields[firstField]) dom.fields[firstField].focus();
  else if (errors.form) dom.formError.focus?.();
}

let toastTimer = null;

export function showToast(dom, message, type = "success", duration = 3200) {
  if (toastTimer) window.clearTimeout(toastTimer);
  dom.toast.dataset.type = type;
  dom.toastMessage.textContent = message;
  const iconName = type === "error" ? "alert" : "check";
  dom.toastIcon.replaceChildren(createIcon(iconName, "icon icon-sm"));
  dom.toast.hidden = false;
  toastTimer = window.setTimeout(() => {
    dom.toast.hidden = true;
    dom.toastMessage.textContent = "";
  }, duration);
}

export function focusTaskTitle(board, taskId) {
  const card = [...board.querySelectorAll(".task-card")].find(
    (item) => item.dataset.taskId === taskId,
  );
  const target = card?.querySelector(".task-title-button");
  if (!target) return false;
  target.focus();
  return true;
}
