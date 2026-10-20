(() => {
  "use strict";

  const STORAGE_KEY = "taskflow.tasks.v1";
  const PRIORITIES = ["low", "medium", "high"];
  const PRIORITY_LABELS = { low: "Rendah", medium: "Sedang", high: "Tinggi" };
  const FILTER_TITLES = {
    all: "Semua Tugas",
    active: "Tugas Aktif",
    completed: "Tugas Selesai",
    high: "Prioritas Tinggi",
  };

  const state = {
    tasks: [],
    filter: "all",
    query: "",
    editingId: null,
    pendingDelete: null,
  };

  const el = {
    list: document.querySelector("#task-list"),
    empty: document.querySelector("#empty-state"),
    emptyTitle: document.querySelector("#empty-title"),
    emptyMessage: document.querySelector("#empty-message"),
    emptyAction: document.querySelector("#empty-action"),
    listTitle: document.querySelector("#list-title"),
    listSummary: document.querySelector("#list-summary"),
    statTotal: document.querySelector("#stat-total"),
    statActive: document.querySelector("#stat-active"),
    statCompleted: document.querySelector("#stat-completed"),
    statHigh: document.querySelector("#stat-high"),
    countAll: document.querySelector("#count-all"),
    countActive: document.querySelector("#count-active"),
    countCompleted: document.querySelector("#count-completed"),
    countHigh: document.querySelector("#count-high"),
    navItems: Array.from(document.querySelectorAll(".nav-item")),
    search: document.querySelector("#search-input"),
    clearSearch: document.querySelector("#clear-search"),
    sampleBanner: document.querySelector("#sample-banner"),
    removeSamples: document.querySelector("#remove-samples"),
    storageBanner: document.querySelector("#storage-banner"),
    storageMessage: document.querySelector("#storage-message"),
    todayLabel: document.querySelector("#today-label"),
    newTaskButton: document.querySelector("#new-task-button"),
    taskDialog: document.querySelector("#task-dialog"),
    taskForm: document.querySelector("#task-form"),
    taskDialogTitle: document.querySelector("#task-dialog-title"),
    taskTitle: document.querySelector("#task-title"),
    taskDescription: document.querySelector("#task-description"),
    taskPriority: document.querySelector("#task-priority"),
    taskDue: document.querySelector("#task-due"),
    descCount: document.querySelector("#desc-count"),
    titleError: document.querySelector("#title-error"),
    saveTask: document.querySelector("#save-task"),
    closeTaskDialog: document.querySelector("#close-task-dialog"),
    cancelTask: document.querySelector("#cancel-task"),
    deleteDialog: document.querySelector("#delete-dialog"),
    deleteTitle: document.querySelector("#delete-title"),
    deleteMessage: document.querySelector("#delete-message"),
    confirmDelete: document.querySelector("#confirm-delete"),
    cancelDelete: document.querySelector("#cancel-delete"),
    toast: document.querySelector("#toast"),
  };

  let toastTimer = null;

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function toISODate(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function addDaysISO(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return toISODate(date);
  }

  function makeId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return `task-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function isValidDateString(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    );
  }

  function parseDate(value) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  function formatShortDate(value) {
    return parseDate(value).toLocaleDateString("id-ID", {
      month: "short",
      day: "numeric",
    });
  }

  function dueInfo(value, completed) {
    if (!isValidDateString(value)) return null;

    if (completed) {
      return { text: `Tenggat ${formatShortDate(value)}`, className: "" };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = parseDate(value);
    const dayDiff = Math.round((due - today) / 86400000);

    if (dayDiff < 0) {
      const days = Math.abs(dayDiff);
      return {
        text: `Terlambat ${days} hari`,
        className: "is-overdue",
      };
    }
    if (dayDiff === 0) return { text: "Tenggat hari ini", className: "is-today" };
    if (dayDiff === 1) return { text: "Tenggat besok", className: "is-today" };
    return { text: `Tenggat ${formatShortDate(value)}`, className: "" };
  }

  // Prioritas tinggi mencakup tugas aktif maupun yang sudah selesai.
  function isHighPriority(task) {
    return task.priority === "high";
  }

  function normalizeTask(raw) {
    if (!raw || typeof raw !== "object") return null;

    const title = typeof raw.title === "string" ? raw.title.trim().slice(0, 120) : "";
    if (!title) return null;

    return {
      id: typeof raw.id === "string" && raw.id ? raw.id : makeId(),
      title,
      description:
        typeof raw.description === "string" ? raw.description.slice(0, 500) : "",
      priority: PRIORITIES.includes(raw.priority) ? raw.priority : "medium",
      dueDate:
        typeof raw.dueDate === "string" && isValidDateString(raw.dueDate)
          ? raw.dueDate
          : "",
      completed: Boolean(raw.completed),
      createdAt:
        typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString(),
      sample: Boolean(raw.sample),
    };
  }

  function createSampleTasks() {
    const now = Date.now();
    return [
      {
        id: makeId(),
        title: "Tinjau tata letak TaskFlow",
        description: "Periksa spasi, skala tipografi, dan tampilan panel samping di ponsel.",
        priority: "high",
        dueDate: addDaysISO(1),
        completed: false,
        createdAt: new Date(now).toISOString(),
        sample: true,
      },
      {
        id: makeId(),
        title: "Tulis README proyek",
        description: "Dokumentasikan fitur, cara menjalankan, dan batasan localStorage.",
        priority: "medium",
        dueDate: addDaysISO(3),
        completed: false,
        createdAt: new Date(now - 60000).toISOString(),
        sample: true,
      },
      {
        id: makeId(),
        title: "Latih dasar localStorage",
        description: "Simpan, muat, dan hapus beberapa tugas di browser.",
        priority: "low",
        dueDate: "",
        completed: true,
        createdAt: new Date(now - 120000).toISOString(),
        sample: true,
      },
      {
        id: makeId(),
        title: "Rencanakan proyek vibecoding berikutnya",
        description: "",
        priority: "medium",
        dueDate: "",
        completed: false,
        createdAt: new Date(now - 180000).toISOString(),
        sample: true,
      },
    ];
  }

  function showStorageBanner(message) {
    if (!el.storageBanner || !el.storageMessage) return;
    el.storageMessage.textContent = message;
    el.storageBanner.hidden = false;
  }

  function saveTasks() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks));
      return true;
    } catch (error) {
      showStorageBanner(
        "TaskFlow tidak dapat menyimpan ke penyimpanan browser ini. Perubahan tetap ada di tab ini, tetapi bisa hilang saat halaman dimuat ulang."
      );
      return false;
    }
  }

  function loadTasks() {
    let raw;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      showStorageBanner(
        "TaskFlow tidak dapat membaca penyimpanan browser ini. Anda masih bisa bekerja, tetapi perubahan tidak akan tersimpan."
      );
      return [];
    }

    if (raw === null) {
      const samples = createSampleTasks();
      state.tasks = samples;
      saveTasks();
      return samples;
    }

    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error("Data tersimpan bukan daftar tugas.");

      const seen = new Set();
      const tasks = [];
      for (const item of parsed) {
        const task = normalizeTask(item);
        if (!task) continue;
        if (seen.has(task.id)) task.id = makeId();
        seen.add(task.id);
        tasks.push(task);
      }
      return tasks;
    } catch (error) {
      showStorageBanner(
        "Data tugas tersimpan tidak dapat dibaca, jadi TaskFlow dimulai dengan daftar kosong. Perubahan baru dapat menimpa data yang rusak."
      );
      return [];
    }
  }

  function getVisibleTasks() {
    const query = state.query.toLowerCase();
    const priorityRank = { high: 0, medium: 1, low: 2 };

    return state.tasks
      .filter((task) => {
        if (state.filter === "active" && task.completed) return false;
        if (state.filter === "completed" && !task.completed) return false;
        if (state.filter === "high" && !isHighPriority(task)) return false;
        if (query && !task.title.toLowerCase().includes(query)) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        if (priorityRank[a.priority] !== priorityRank[b.priority]) {
          return priorityRank[a.priority] - priorityRank[b.priority];
        }
        const aDue = a.dueDate || "9999-12-31";
        const bDue = b.dueDate || "9999-12-31";
        if (aDue !== bDue) return aDue.localeCompare(bDue);
        return b.createdAt.localeCompare(a.createdAt);
      });
  }

  function updateStats() {
    const total = state.tasks.length;
    const completed = state.tasks.filter((task) => task.completed).length;
    const high = state.tasks.filter(isHighPriority).length;
    const active = total - completed;

    el.statTotal.textContent = String(total);
    el.statActive.textContent = String(active);
    el.statCompleted.textContent = String(completed);
    el.statHigh.textContent = String(high);
    el.countAll.textContent = String(total);
    el.countActive.textContent = String(active);
    el.countCompleted.textContent = String(completed);
    el.countHigh.textContent = String(high);
  }

  function updateNav() {
    for (const item of el.navItems) {
      const isActive = item.dataset.filter === state.filter;
      item.classList.toggle("is-active", isActive);
      if (isActive) {
        item.setAttribute("aria-current", "page");
      } else {
        item.removeAttribute("aria-current");
      }
    }
  }

  function updateListSummary(count) {
    let summary = `${count} tugas`;
    if (state.query) {
      summary = `${count} hasil untuk “${state.query}”`;
    }
    el.listSummary.textContent = summary;
    el.listTitle.textContent = FILTER_TITLES[state.filter];
  }

  function setEmptyState() {
    const hasTasks = state.tasks.length > 0;
    let title = "Belum ada tugas";
    let message = "Tambahkan tugas pertama Anda agar hari ini lebih terarah.";
    let action = "Buat Tugas";
    let mode = "create";

    if (hasTasks && state.query) {
      title = "Tidak ada hasil";
      message = `Tidak ada yang cocok dengan “${state.query}”. Coba judul lain atau hapus pencarian.`;
      action = "Hapus Pencarian";
      mode = "clear-search";
    } else if (hasTasks) {
      if (state.filter === "active") {
        title = "Tidak ada tugas aktif";
        message = "Semua tugas sudah selesai. Tambahkan tugas baru atau tinjau daftar selesai Anda.";
      } else if (state.filter === "completed") {
        title = "Belum ada tugas selesai";
        message = "Centang tugas setelah selesai dan tugas itu akan muncul di sini.";
      } else if (state.filter === "high") {
        title = "Tidak ada tugas prioritas tinggi";
        message = "Belum ada yang perlu perhatian ekstra. Coba filter lain atau tambahkan tugas.";
      }
      action = "Tampilkan Semua Tugas";
      mode = "show-all";
    }

    el.empty.hidden = false;
    el.emptyTitle.textContent = title;
    el.emptyMessage.textContent = message;
    el.emptyAction.textContent = action;
    el.emptyAction.dataset.mode = mode;
  }

  function createTaskCard(task) {
    const card = document.createElement("article");
    card.className = `task-card${task.completed ? " is-completed" : ""}`;
    card.dataset.id = task.id;

    const checkLabel = document.createElement("label");
    checkLabel.className = "task-check";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = task.completed;
    checkbox.dataset.action = "toggle";
    checkbox.setAttribute(
      "aria-label",
      task.completed
        ? `Aktifkan kembali “${task.title}”`
        : `Tandai “${task.title}” sebagai selesai`
    );
    const checkBox = document.createElement("span");
    checkBox.className = "check-box";
    checkBox.setAttribute("aria-hidden", "true");
    checkLabel.append(checkbox, checkBox);

    const body = document.createElement("div");
    body.className = "task-body";

    const head = document.createElement("div");
    head.className = "task-head";
    const title = document.createElement("h3");
    title.className = "task-title";
    title.textContent = task.title;
    const badge = document.createElement("span");
    badge.className = `badge badge-${task.priority}`;
    badge.textContent = PRIORITY_LABELS[task.priority];
    head.append(title, badge);
    body.append(head);

    if (task.description) {
      const description = document.createElement("p");
      description.className = "task-description";
      description.textContent = task.description;
      body.append(description);
    }

    const meta = document.createElement("div");
    meta.className = "task-meta";

    if (task.completed) {
      const completed = document.createElement("span");
      completed.className = "task-meta-item is-completed-label";
      completed.textContent = "Selesai";
      meta.append(completed);
    }

    const due = dueInfo(task.dueDate, task.completed);
    if (due) {
      const dueItem = document.createElement("time");
      dueItem.className = `task-meta-item ${due.className}`.trim();
      dueItem.dateTime = task.dueDate;
      dueItem.textContent = due.text;
      meta.append(dueItem);
    }

    if (meta.childElementCount > 0) body.append(meta);

    const actions = document.createElement("div");
    actions.className = "task-actions";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "task-action";
    editButton.dataset.action = "edit";
    editButton.textContent = "Ubah";

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "task-action task-action-danger";
    deleteButton.dataset.action = "delete";
    deleteButton.textContent = "Hapus";

    actions.append(editButton, deleteButton);
    card.append(checkLabel, body, actions);
    return card;
  }

  function renderList() {
    const visible = getVisibleTasks();
    el.list.replaceChildren();

    if (visible.length === 0) {
      setEmptyState();
    } else {
      el.empty.hidden = true;
      const fragment = document.createDocumentFragment();
      for (const task of visible) fragment.append(createTaskCard(task));
      el.list.append(fragment);
    }

    updateListSummary(visible.length);
  }

  function render() {
    updateStats();
    updateNav();
    renderList();
    el.sampleBanner.hidden = !state.tasks.some((task) => task.sample);
  }

  function showToast(message) {
    el.toast.textContent = message;
    el.toast.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      el.toast.hidden = true;
    }, 2800);
  }

  function findTask(id) {
    return state.tasks.find((task) => task.id === id) || null;
  }

  function findTaskCard(id) {
    return Array.from(el.list.children).find((card) => card.dataset.id === id) || null;
  }

  function focusTaskAction(id, action) {
    const card = findTaskCard(id);
    if (!card) return;
    const button = card.querySelector(`button[data-action="${action}"]`);
    if (button) button.focus();
  }

  function setTitleError(message) {
    el.titleError.textContent = message;
    el.taskTitle.setAttribute("aria-invalid", "true");
    el.taskTitle.focus();
  }

  function clearTitleError() {
    el.titleError.textContent = "";
    el.taskTitle.removeAttribute("aria-invalid");
  }

  function updateDescriptionCount() {
    el.descCount.textContent = String(el.taskDescription.value.length);
  }

  function openTaskDialog(task = null) {
    state.editingId = task ? task.id : null;
    el.taskForm.reset();
    clearTitleError();

    el.taskTitle.value = task ? task.title : "";
    el.taskDescription.value = task ? task.description : "";
    el.taskPriority.value = task ? task.priority : "medium";
    el.taskDue.value = task ? task.dueDate : "";
    updateDescriptionCount();

    el.taskDialogTitle.textContent = task ? "Ubah Tugas" : "Tugas Baru";
    el.saveTask.textContent = task ? "Simpan Perubahan" : "Tambah Tugas";

    el.taskDialog.showModal();
    window.requestAnimationFrame(() => el.taskTitle.focus());
  }

  function closeTaskDialog() {
    if (el.taskDialog.open) el.taskDialog.close();
  }

  function openDeleteDialog(title, message, confirmLabel) {
    el.deleteTitle.textContent = title;
    el.deleteMessage.textContent = message;
    el.confirmDelete.textContent = confirmLabel;
    el.deleteDialog.showModal();
    el.cancelDelete.focus();
  }

  function requestDelete(task) {
    state.pendingDelete = { type: "task", id: task.id };
    openDeleteDialog(
      "Hapus tugas ini?",
      `“${task.title}” akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.`,
      "Hapus Tugas"
    );
  }

  function requestRemoveSamples() {
    const count = state.tasks.filter((task) => task.sample).length;
    if (count === 0) return;

    state.pendingDelete = { type: "samples" };
    openDeleteDialog(
      "Hapus tugas contoh?",
      `Tindakan ini akan menghapus ${count} tugas contoh. Tugas yang Anda buat sendiri tetap aman.`,
      "Hapus Contoh"
    );
  }

  function handleConfirmDelete() {
    const pending = state.pendingDelete;
    if (!pending) return;

    if (pending.type === "task") {
      state.tasks = state.tasks.filter((task) => task.id !== pending.id);
      showToast("Tugas dihapus.");
    } else {
      state.tasks = state.tasks.filter((task) => !task.sample);
      showToast("Tugas contoh dihapus.");
    }

    state.pendingDelete = null;
    el.deleteDialog.close();
    saveTasks();
    render();
    el.newTaskButton.focus();
  }

  function handleSearchInput() {
    state.query = el.search.value.trim();
    el.clearSearch.hidden = state.query.length === 0;
    renderList();
  }

  function clearSearch() {
    el.search.value = "";
    state.query = "";
    el.clearSearch.hidden = true;
    renderList();
    el.search.focus();
  }

  function setFilter(filter) {
    if (!FILTER_TITLES[filter]) return;
    state.filter = filter;
    updateNav();
    renderList();
  }

  function handleFormSubmit(event) {
    event.preventDefault();

    const title = el.taskTitle.value.trim();
    if (!title) {
      setTitleError("Masukkan judul sebelum menyimpan.");
      return;
    }
    if (title.length > 120) {
      setTitleError("Judul maksimal 120 karakter.");
      return;
    }

    const description = el.taskDescription.value.trim();
    const priority = PRIORITIES.includes(el.taskPriority.value)
      ? el.taskPriority.value
      : "medium";
    const dueDate = isValidDateString(el.taskDue.value) ? el.taskDue.value : "";

    if (state.editingId) {
      const task = findTask(state.editingId);
      if (!task) {
        closeTaskDialog();
        showToast("Tugas tersebut sudah tidak ada.");
        render();
        return;
      }
      task.title = title;
      task.description = description;
      task.priority = priority;
      task.dueDate = dueDate;
      saveTasks();
      closeTaskDialog();
      render();
      focusTaskAction(task.id, "edit");
      showToast("Perubahan disimpan.");
      return;
    }

    const task = {
      id: makeId(),
      title,
      description,
      priority,
      dueDate,
      completed: false,
      createdAt: new Date().toISOString(),
      sample: false,
    };

    state.tasks.push(task);
    saveTasks();
    closeTaskDialog();
    render();
    showToast("Tugas ditambahkan.");
  }

  function bindEvents() {
    el.newTaskButton.addEventListener("click", () => openTaskDialog());

    for (const item of el.navItems) {
      item.addEventListener("click", () => setFilter(item.dataset.filter));
    }

    el.search.addEventListener("input", handleSearchInput);
    el.clearSearch.addEventListener("click", clearSearch);
    el.search.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && state.query) {
        event.preventDefault();
        clearSearch();
      }
    });

    el.list.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      const card = button.closest(".task-card");
      if (!card) return;
      const task = findTask(card.dataset.id);
      if (!task) return;

      if (button.dataset.action === "edit") openTaskDialog(task);
      if (button.dataset.action === "delete") requestDelete(task);
    });

    el.list.addEventListener("change", (event) => {
      const checkbox = event.target.closest('input[type="checkbox"][data-action="toggle"]');
      if (!checkbox) return;
      const card = checkbox.closest(".task-card");
      if (!card) return;
      const task = findTask(card.dataset.id);
      if (!task) return;

      task.completed = checkbox.checked;
      saveTasks();
      render();
      const newCard = findTaskCard(task.id);
      const newCheckbox = newCard
        ? newCard.querySelector('input[type="checkbox"][data-action="toggle"]')
        : null;
      if (newCheckbox) {
        newCheckbox.focus();
      } else {
        el.newTaskButton.focus();
      }
      showToast(task.completed ? "Tugas selesai." : "Tugas diaktifkan kembali.");
    });

    el.taskForm.addEventListener("submit", handleFormSubmit);
    el.taskTitle.addEventListener("input", () => {
      if (el.taskTitle.value.trim()) clearTitleError();
    });
    el.taskDescription.addEventListener("input", updateDescriptionCount);
    el.closeTaskDialog.addEventListener("click", closeTaskDialog);
    el.cancelTask.addEventListener("click", closeTaskDialog);

    el.taskDialog.addEventListener("click", (event) => {
      if (event.target === el.taskDialog) closeTaskDialog();
    });

    el.taskDialog.addEventListener("close", () => {
      state.editingId = null;
    });

    el.removeSamples.addEventListener("click", requestRemoveSamples);
    el.cancelDelete.addEventListener("click", () => el.deleteDialog.close());
    el.confirmDelete.addEventListener("click", handleConfirmDelete);

    el.deleteDialog.addEventListener("click", (event) => {
      if (event.target === el.deleteDialog) el.deleteDialog.close();
    });

    el.deleteDialog.addEventListener("close", () => {
      state.pendingDelete = null;
    });

    el.emptyAction.addEventListener("click", () => {
      const mode = el.emptyAction.dataset.mode;
      if (mode === "clear-search") {
        clearSearch();
      } else if (mode === "show-all") {
        setFilter("all");
      } else {
        openTaskDialog();
      }
    });
  }

  function setTodayLabel() {
    el.todayLabel.textContent = new Date().toLocaleDateString("id-ID", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }

  function init() {
    setTodayLabel();
    state.tasks = loadTasks();
    bindEvents();
    render();
  }

  init();
})();
