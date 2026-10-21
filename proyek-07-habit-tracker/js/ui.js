import {
  formatDate,
  formatLongDate,
  formatShortDate,
  formatWeekday,
} from "./dates.js";
import {
  getCategoryLabel,
  getColor,
  getScheduleLabel,
  isArchived,
} from "./habits.js";

const SVG_NS = "http://www.w3.org/2000/svg";
let toastTimer = null;

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

function setText(node, value) {
  if (node) node.textContent = value;
}

function applyAccent(node, habit) {
  const color = getColor(habit);
  node.style.setProperty("--habit-accent", color.hex);
  node.style.setProperty("--habit-soft", color.soft);
}

function createCheckButton({ habit, dateKey, checked, disabled = false, context = "hari ini" }) {
  const node = button("check-button");
  node.dataset.action = "toggle-checkin";
  node.dataset.habitId = habit.id;
  node.dataset.date = dateKey;
  node.setAttribute("aria-pressed", String(checked));
  node.setAttribute(
    "aria-label",
    checked
      ? `Batalkan check-in ${habit.name} untuk ${context}`
      : `Tandai ${habit.name} selesai untuk ${context}`,
  );
  node.append(createIcon("check"));
  if (disabled) node.disabled = true;
  return node;
}

function createStaticCheck(checked, label) {
  const node = element("span", "check-button is-static");
  node.setAttribute("aria-hidden", "true");
  node.title = label;
  if (checked) node.classList.add("is-checked");
  node.append(createIcon("check"));
  return node;
}

function menuItem(iconName, label, action, habitId, danger = false) {
  const node = button(`card-menu-item${danger ? " card-menu-danger" : ""}`);
  node.dataset.action = action;
  node.dataset.habitId = habitId;
  node.append(createIcon(iconName));
  node.append(element("span", "", label));
  return node;
}

function createHabitMenu(habit) {
  const details = element("details", "card-menu");
  const summary = element("summary");
  summary.setAttribute("aria-label", `Buka aksi untuk ${habit.name}`);
  summary.append(createIcon("more"));

  const panel = element("div", "card-menu-panel");
  panel.append(element("p", "card-menu-label", habit.name));
  panel.append(menuItem("edit", "Edit kebiasaan", "edit-habit", habit.id));

  if (isArchived(habit)) {
    panel.append(menuItem("restore", "Aktifkan kembali", "restore-habit", habit.id));
  } else {
    panel.append(menuItem("archive", "Arsipkan", "archive-habit", habit.id));
  }

  panel.append(element("div", "card-menu-separator"));
  panel.append(menuItem("trash", "Hapus", "delete-habit", habit.id, true));

  details.append(summary, panel);
  return details;
}

function createStreakChip(streak) {
  const chip = element("span", "streak-chip");
  chip.title = "Streak saat ini";
  chip.append(createIcon("flame"));
  chip.append(element("span", "", `${streak} hari`));
  return chip;
}

function createHabitRow({ habit, checked, streak, dateKey }) {
  const row = element("article", `habit-row${checked ? " is-done" : ""}`);
  row.dataset.habitId = habit.id;
  row.setAttribute("role", "listitem");
  applyAccent(row, habit);

  row.append(
    createCheckButton({
      habit,
      dateKey,
      checked,
      context: "hari ini",
    }),
  );

  const main = element("div", "habit-row-main");
  const titleLine = element("div", "habit-title-line");
  const title = button("habit-title", habit.name);
  title.dataset.action = "edit-habit";
  title.dataset.habitId = habit.id;
  title.setAttribute("aria-label", `Edit ${habit.name}`);
  titleLine.append(title);
  main.append(titleLine);

  const meta = element("p", "habit-meta");
  meta.append(element("span", "meta-category", getCategoryLabel(habit.category)));
  meta.append(element("span", "dot-separator"));
  meta.append(element("span", "", getScheduleLabel(habit)));
  main.append(meta);

  const side = element("div", "habit-row-side");
  side.append(createStreakChip(streak));
  side.append(createHabitMenu(habit));

  row.append(main, side);
  return row;
}

function createHabitCard({ habit, metrics, checkedToday, scheduledToday, today }) {
  const archived = isArchived(habit);
  const card = element("article", `habit-card${archived ? " is-archived" : ""}`);
  card.dataset.habitId = habit.id;
  card.setAttribute("role", "listitem");
  applyAccent(card, habit);

  const top = element("div", "habit-card-top");
  const badges = element("div", "habit-card-badges");
  badges.append(element("span", "category-pill", getCategoryLabel(habit.category)));
  if (archived) {
    badges.append(element("span", "status-pill", "Diarsipkan"));
  }
  top.append(badges, createHabitMenu(habit));

  const heading = element("h3");
  const title = button("habit-card-title-button", habit.name);
  title.dataset.action = "edit-habit";
  title.dataset.habitId = habit.id;
  title.setAttribute("aria-label", `Edit ${habit.name}`);
  heading.append(title);

  const meta = element("div", "habit-card-meta");
  const schedule = element("span");
  schedule.append(createIcon("calendar"), element("span", "", getScheduleLabel(habit)));
  meta.append(schedule);
  if (archived && habit.archivedAt) {
    const archivedDate = element("span");
    archivedDate.append(
      createIcon("archive"),
      element("span", "", `Diarsipkan ${formatShortDate(habit.archivedAt)}`),
    );
    meta.append(archivedDate);
  }

  const progress = element("div", "card-progress");
  const progressHead = element("div", "card-progress-head");
  const hasTargets = metrics?.range.hasTargets;
  progressHead.append(
    element("span", "", "Konsistensi 30 hari"),
    element("strong", "", hasTargets ? `${metrics.range.percent}%` : "—"),
  );
  const track = element("div", "progress-track");
  track.setAttribute("role", "progressbar");
  track.setAttribute("aria-label", `Konsistensi 30 hari ${habit.name}`);
  track.setAttribute("aria-valuemin", "0");
  track.setAttribute("aria-valuemax", "100");
  track.setAttribute("aria-valuenow", String(hasTargets ? metrics.range.percent : 0));
  const fill = element("span", "progress-fill");
  fill.style.setProperty("--progress", `${hasTargets ? metrics.range.percent : 0}%`);
  track.append(fill);
  progress.append(progressHead, track);

  const footer = element("div", "habit-card-footer");
  footer.append(createStreakChip(metrics?.current || 0));

  if (archived) {
    footer.append(element("span", "card-foot-note", "Riwayat tetap tersimpan"));
  } else if (scheduledToday) {
    const action = button("card-check-action");
    action.dataset.action = "toggle-checkin";
    action.dataset.habitId = habit.id;
    action.dataset.date = today;
    action.setAttribute("aria-pressed", String(checkedToday));
    action.append(
      createIcon("check"),
      element("span", "", checkedToday ? "Selesai" : "Check-in"),
    );
    footer.append(action);
  } else {
    footer.append(element("span", "card-foot-note", "Tidak dijadwalkan hari ini"));
  }

  card.append(top, heading);
  if (habit.description) {
    card.append(element("p", "habit-card-description", habit.description));
  }
  card.append(meta, progress, footer);
  return card;
}

function createWeekChart(container, week, mode = "week") {
  container.replaceChildren();
  const itemClass = mode === "stats" ? "stats-bar-item" : "week-day";
  const trackClass = mode === "stats" ? "stats-bar-track" : "week-bar-track";
  const fillClass = mode === "stats" ? "stats-bar-fill" : "week-bar-fill";
  const labelClass = mode === "stats" ? "stats-bar-label" : "week-day-label";
  const valueClass = mode === "stats" ? "stats-bar-value" : "week-value";

  let targets = 0;
  let completed = 0;

  for (const day of week) {
    targets += day.targets;
    completed += day.completed;
    const item = element("div", itemClass);
    item.classList.toggle("is-empty", !day.hasTargets);
    item.classList.toggle("is-today", day.isToday);
    item.dataset.date = day.dateKey;

    const track = element("div", trackClass);
    const fill = element("div", fillClass);
    fill.style.setProperty("--bar", String(day.percent ?? 0));
    fill.title = day.hasTargets
      ? `${day.completed} dari ${day.targets} selesai`
      : "Tidak ada kewajiban";
    track.append(fill);

    const label = element("div");
    label.append(element("span", labelClass, formatWeekday(day.dateKey)));
    label.append(
      element("span", valueClass, day.hasTargets ? `${day.percent}%` : "—"),
    );
    item.append(track, label);
    container.append(item);
  }

  const rate = targets ? Math.round((completed / targets) * 100) : 0;
  container.setAttribute(
    "aria-label",
    targets
      ? `Grafik ${week.length} hari terakhir, ${completed} dari ${targets} kewajiban selesai, ${rate} persen.`
      : `Grafik ${week.length} hari terakhir, belum ada kewajiban.`,
  );
  return { targets, completed, percent: rate };
}

export function renderDashboard(dom, data) {
  setText(dom.greeting, data.greeting);
  setText(dom.todayLabel, data.todayLabel);
  setText(dom.percent, `${data.summary.percent}%`);
  dom.ring.style.setProperty("--ring-progress", String(data.summary.percent));
  dom.ring.setAttribute("aria-valuenow", String(data.summary.percent));
  dom.ring.setAttribute(
    "aria-label",
    data.summary.scheduledCount
      ? `Penyelesaian hari ini ${data.summary.percent} persen, ${data.summary.completedCount} dari ${data.summary.scheduledCount} kebiasaan.`
      : "Belum ada kebiasaan yang dijadwalkan hari ini.",
  );

  if (!data.summary.scheduledCount) {
    setText(dom.ringCaption, "Hari ini lapang");
    setText(dom.ringDetail, "Tidak ada kebiasaan yang dijadwalkan. Nikmati jeda ini.");
  } else if (data.summary.percent === 100) {
    setText(dom.ringCaption, "Ritme hari ini lengkap");
    setText(dom.ringDetail, "Semua kebiasaan terjadwal sudah selesai.");
  } else if (data.summary.completedCount > 0) {
    setText(dom.ringCaption, "Sedang merawat ritme");
    setText(
      dom.ringDetail,
      `${data.summary.completedCount} dari ${data.summary.scheduledCount} kebiasaan selesai.`,
    );
  } else {
    setText(dom.ringCaption, "Mulai dari satu langkah");
    setText(
      dom.ringDetail,
      `${data.summary.scheduledCount} kebiasaan menunggu untuk hari ini.`,
    );
  }

  setText(dom.statActive, String(data.summary.activeCount));
  setText(
    dom.statActiveNote,
    data.summary.scheduledCount
      ? `${data.summary.scheduledCount} dijadwalkan hari ini`
      : "Belum ada jadwal hari ini",
  );
  setText(dom.statDone, String(data.summary.completedCount));
  setText(
    dom.statDoneNote,
    `Dari ${data.summary.scheduledCount} yang dijadwalkan`,
  );
  setText(dom.statStreak, String(data.summary.bestCurrent?.streak || 0));
  setText(
    dom.statStreakNote,
    data.summary.bestCurrent?.streak
      ? data.summary.bestCurrent.habit.name
      : "Belum ada streak",
  );

  const weekTotals = createWeekChart(dom.weekChart, data.week, "week");
  setText(dom.statWeek, `${weekTotals.percent}%`);
  setText(
    dom.statWeekNote,
    weekTotals.targets
      ? `${weekTotals.completed} dari ${weekTotals.targets} kewajiban`
      : "Belum ada kewajiban",
  );
  setText(
    dom.weekSummary,
    weekTotals.targets
      ? `${weekTotals.percent}% kewajiban selesai dalam tujuh hari terakhir (${weekTotals.completed}/${weekTotals.targets}).`
      : "Belum ada kewajiban pada tujuh hari terakhir.",
  );

  dom.todayList.replaceChildren();
  if (data.summary.scheduled.length) {
    dom.todayList.hidden = false;
    dom.todayEmpty.hidden = true;
    for (const item of data.summary.scheduled) {
      dom.todayList.append(
        createHabitRow({
          habit: item,
          checked: data.summary.completed.some((habit) => habit.id === item.id),
          streak: data.streaks.get(item.id)?.current || 0,
          dateKey: data.today,
        }),
      );
    }
  } else {
    dom.todayList.hidden = true;
    dom.todayEmpty.hidden = false;
    if (data.summary.activeCount === 0) {
      setText(dom.todayEmptyTitle, "Mulai dari satu kebiasaan");
      setText(
        dom.todayEmptyCopy,
        "Belum ada kebiasaan aktif. Tambahkan satu langkah kecil yang bisa kamu rawat.",
      );
    } else {
      setText(dom.todayEmptyTitle, "Hari ini lapang");
      setText(
        dom.todayEmptyCopy,
        "Tidak ada kebiasaan yang dijadwalkan hari ini. Kamu tetap bisa menambah kebiasaan baru.",
      );
    }
  }

  setText(
    dom.todayScheduledLabel,
    data.summary.scheduledCount
      ? `${data.summary.scheduledCount} kebiasaan`
      : "Tidak ada",
  );
}

export function renderHabits(dom, data) {
  if (dom.search.value !== data.filters.query) dom.search.value = data.filters.query;
  dom.category.value = data.filters.category;
  dom.clearSearch.hidden = !data.filters.query;
  dom.clearFilters.hidden = !data.hasFilters;
  dom.emptyClear.hidden = !data.hasFilters;

  for (const statusButton of dom.statusButtons) {
    statusButton.setAttribute(
      "aria-pressed",
      String(statusButton.dataset.statusFilter === data.filters.status),
    );
  }

  const filtered = data.filtered;
  const total = data.allHabits.length;
  const archiveOnly =
    data.filters.status === "archived" &&
    !data.filters.query &&
    data.filters.category === "all";
  let summary;
  if (archiveOnly) {
    summary = `${filtered.length} kebiasaan di arsip`;
  } else if (data.hasFilters) {
    summary = `${filtered.length} dari ${total} kebiasaan`;
  } else if (data.filters.status === "all") {
    summary = `${filtered.length} kebiasaan total`;
  } else {
    summary = `${filtered.length} kebiasaan aktif`;
  }
  setText(dom.summary, summary);

  dom.list.replaceChildren();
  if (!filtered.length) {
    dom.list.hidden = true;
    dom.empty.hidden = false;

    if (!total) {
      setText(dom.emptyTitle, "Belum ada kebiasaan");
      setText(
        dom.emptyCopy,
        "Mulai dengan satu kebiasaan kecil yang ingin kamu rawat.",
      );
    } else if (archiveOnly && !data.allHabits.some((habit) => isArchived(habit))) {
      setText(dom.emptyTitle, "Arsip masih kosong");
      setText(
        dom.emptyCopy,
        "Kebiasaan yang diarsipkan akan muncul di sini beserta riwayatnya.",
      );
    } else if (data.hasFilters) {
      setText(dom.emptyTitle, "Tidak ada yang cocok");
      setText(
        dom.emptyCopy,
        "Coba kata kunci atau filter lain. Kebiasaanmu yang lain tetap aman.",
      );
    } else {
      setText(dom.emptyTitle, "Belum ada kebiasaan aktif");
      setText(
        dom.emptyCopy,
        "Tambahkan kebiasaan baru atau lihat arsip untuk mengaktifkan kembali.",
      );
    }
  } else {
    dom.empty.hidden = true;
    dom.list.hidden = false;
    for (const habit of filtered) {
      dom.list.append(
        createHabitCard({
          habit,
          metrics: data.metrics.get(habit.id),
          checkedToday: data.checkedToday.has(habit.id),
          scheduledToday: data.scheduledToday.has(habit.id),
          today: data.today,
        }),
      );
    }
  }
}

export function renderCalendar(dom, data) {
  setText(dom.monthLabel, data.monthLabel);
  dom.grid.replaceChildren();

  for (const cell of data.days) {
    const details = cell.details;
    const dayButton = button("calendar-day");
    dayButton.dataset.action = "select-date";
    dayButton.dataset.date = cell.key;
    dayButton.tabIndex = cell.key === data.selectedDate ? 0 : -1;
    dayButton.classList.toggle("is-outside", !cell.inMonth);
    dayButton.classList.toggle("is-today", details.isToday);
    dayButton.classList.toggle("is-selected", cell.key === data.selectedDate);
    dayButton.classList.toggle("is-future", details.isFuture);
    dayButton.classList.toggle("has-activity", details.anyActivity);
    dayButton.classList.toggle("has-progress", details.completed > 0);
    dayButton.classList.toggle(
      "is-complete",
      details.targets > 0 && details.completed === details.targets,
    );
    dayButton.classList.toggle(
      "has-archived",
      details.archivedCompleted > 0 && details.completed === 0,
    );
    dayButton.style.setProperty("--day-progress", String(details.percent));
    dayButton.setAttribute("aria-pressed", String(cell.key === data.selectedDate));
    if (details.isToday) dayButton.setAttribute("aria-current", "date");

    let label = formatLongDate(cell.key);
    if (details.targets) {
      label += `, ${details.completed} dari ${details.targets} kebiasaan selesai`;
    } else {
      label += ", tidak ada jadwal aktif";
    }
    if (details.archivedCompleted) {
      label += `, ${details.archivedCompleted} riwayat arsip selesai`;
    }
    if (details.isFuture && details.targets) {
      label += ", belum bisa check-in";
    }
    dayButton.setAttribute("aria-label", label);
    dayButton.append(element("span", "day-number", String(cell.day)));
    dayButton.append(element("span", "day-dot"));
    if (details.targets) {
      dayButton.append(
        element("span", "day-count", `${details.completed}/${details.targets}`),
      );
    }
    const progress = element("span", "day-progress");
    progress.setAttribute("aria-hidden", "true");
    progress.append(element("span"));
    dayButton.append(progress);
    dom.grid.append(dayButton);
  }

  const selected = data.selectedDetails;
  setText(
    dom.selectedLabel,
    selected.isToday
      ? `Hari ini, ${formatDate(selected.dateKey, { weekday: "long" })}`
      : formatLongDate(selected.dateKey),
  );

  let summary;
  if (selected.targets) {
    summary = `${selected.completed} dari ${selected.targets} kebiasaan selesai (${selected.percent}%).`;
    if (selected.isFuture) summary += " Tanggal ini belum terjadi, jadi check-in belum tersedia.";
  } else if (selected.archived.length) {
    summary = "Tidak ada jadwal aktif. Riwayat arsip pada tanggal ini tetap ditampilkan.";
  } else {
    summary = "Tidak ada jadwal pada tanggal ini. Tidak ada yang perlu diperbaiki.";
  }
  setText(dom.selectedSummary, summary);

  dom.dayList.replaceChildren();
  const items = [
    ...selected.active.map((item) => ({ ...item, archived: false })),
    ...selected.archived.map((item) => ({ ...item, archived: true })),
  ];

  if (items.length) {
    dom.dayEmpty.hidden = true;
    dom.dayList.hidden = false;
    for (const item of items) {
      const { habit, checked, archived, canCheck } = item;
      const row = element(
        "article",
        `day-item${checked ? " is-checked" : ""}${archived ? " is-archived" : ""}`,
      );
      row.dataset.habitId = habit.id;
      applyAccent(row, habit);

      if (archived) {
        row.append(
          createStaticCheck(
            checked,
            checked ? "Selesai, riwayat arsip" : "Tidak selesai, riwayat arsip",
          ),
        );
      } else {
        row.append(
          createCheckButton({
            habit,
            dateKey: selected.dateKey,
            checked,
            disabled: !canCheck,
            context: selected.isToday ? "hari ini" : formatShortDate(selected.dateKey),
          }),
        );
      }

      const main = element("div", "day-item-main");
      const title = element("div", "day-item-title");
      title.append(element("span", "", habit.name));
      if (archived) title.append(element("span", "archive-pill", "Arsip"));
      const meta = element("div", "day-item-meta");
      meta.append(
        element("span", "", getCategoryLabel(habit.category)),
        element("span", "", getScheduleLabel(habit)),
      );
      if (archived) {
        meta.append(
          element(
            "span",
            "visually-hidden",
            checked ? "Selesai, riwayat arsip" : "Belum selesai, riwayat arsip",
          ),
        );
      }
      if (!archived && !canCheck) {
        meta.append(
          element(
            "span",
            "",
            selected.isFuture ? "Belum bisa check-in" : "Tanggal sebelum kebiasaan dibuat",
          ),
        );
      }
      main.append(title, meta);
      row.append(main);
      dom.dayList.append(row);
    }
  } else {
    dom.dayList.hidden = true;
    dom.dayEmpty.hidden = false;
    setText(
      dom.dayEmptyCopy,
      selected.isFuture
        ? "Tanggal ini belum terjadi dan tidak ada kebiasaan yang dijadwalkan."
        : "Hari ini bebas dari kewajiban. Tidak ada yang perlu diperbaiki.",
    );
  }

  if (selected.isFuture && selected.active.length) {
    dom.dayList.append(
      element(
        "p",
        "day-note",
        "Tanggal ini belum terjadi. Check-in akan tersedia saat harinya tiba.",
      ),
    );
  }
  if (selected.archived.length) {
    dom.dayList.append(
      element(
        "p",
        "day-note",
        "Kebiasaan arsip ditampilkan sebagai riwayat dan tidak dapat diubah.",
      ),
    );
  }
}

export function renderStats(dom, data) {
  const overall = data.overall;
  setText(dom.totalCheckins, String(overall.totalCheckins));
  setText(dom.week, `${overall.week.percent}%`);
  setText(dom.month, `${overall.month.percent}%`);
  setText(
    dom.weekNote,
    overall.week.hasTargets
      ? `${overall.week.completed} dari ${overall.week.targets} kewajiban`
      : "Belum ada kewajiban",
  );
  setText(
    dom.monthNote,
    overall.month.hasTargets
      ? `${overall.month.completed} dari ${overall.month.targets} kewajiban`
      : "Belum ada kewajiban",
  );

  const best = overall.bestStreak;
  const bestLongest = best?.longest || 0;
  setText(dom.bestStreak, String(bestLongest));
  setText(
    dom.bestStreakNote,
    bestLongest && best ? best.habit.name : "Belum ada streak",
  );
  setText(dom.bestNumber, String(bestLongest));
  setText(
    dom.bestName,
    bestLongest && best ? best.habit.name : "Belum ada streak",
  );
  setText(
    dom.bestDetail,
    bestLongest && best
      ? `${best.current} hari berjalan · ${best.range.completed}/${best.range.targets} kewajiban dalam 30 hari.`
      : "Streak dihitung dari hari yang benar-benar dijadwalkan.",
  );

  const weekTotals = createWeekChart(dom.weekChart, data.week, "stats");
  setText(
    dom.weekCaption,
    weekTotals.targets
      ? `${weekTotals.completed} dari ${weekTotals.targets}`
      : "0 dari 0",
  );
  setText(
    dom.weekSummary,
    weekTotals.targets
      ? `${weekTotals.percent}% kewajiban selesai dalam tujuh hari terakhir (${weekTotals.completed}/${weekTotals.targets}).`
      : "Belum ada kewajiban pada periode ini.",
  );

  dom.progressList.replaceChildren();
  if (!overall.progress.length) {
    dom.progressList.hidden = true;
    dom.empty.hidden = false;
  } else {
    dom.progressList.hidden = false;
    dom.empty.hidden = true;
    for (const item of overall.progress) {
      const row = element("article", "progress-item");
      applyAccent(row, item.habit);
      const title = element("span", "progress-title", item.habit.name);
      const number = element(
        "strong",
        "progress-number",
        item.range.hasTargets ? `${item.range.percent}%` : "—",
      );
      const track = element("div", "progress-track");
      track.setAttribute("role", "progressbar");
      track.setAttribute("aria-label", `Konsistensi 30 hari ${item.habit.name}`);
      track.setAttribute("aria-valuemin", "0");
      track.setAttribute("aria-valuemax", "100");
      track.setAttribute("aria-valuenow", String(item.range.percent));
      const fill = element("span", "progress-fill");
      fill.style.setProperty("--progress", `${item.range.percent}%`);
      track.append(fill);
      const detail = element("div", "progress-detail");
      detail.append(
        element("span", "", `${item.current} hari berjalan`),
        element("span", "", `${item.longest} hari terpanjang`),
      );
      row.append(title, number, track, detail);
      dom.progressList.append(row);
    }
  }
}

export function renderSaveState(dom, state, text) {
  dom.root.dataset.state = state;
  setText(dom.text, text);
}

export function showStorageNotice(dom, { message, canDownload = false, canReset = false }) {
  setText(dom.message, message);
  dom.download.hidden = !canDownload;
  dom.reset.hidden = !canReset;
  dom.root.hidden = false;
}

export function hideStorageNotice(dom) {
  dom.root.hidden = true;
  dom.download.hidden = true;
  dom.reset.hidden = true;
}

export function showToast(dom, message, tone = "success") {
  window.clearTimeout(toastTimer);
  setText(dom.message, message);
  dom.root.classList.toggle("is-error", tone === "error");
  const use = dom.root.querySelector(".toast-icon use");
  if (use) use.setAttribute("href", tone === "error" ? "#icon-alert" : "#icon-check");
  dom.root.hidden = false;
  toastTimer = window.setTimeout(
    () => {
      dom.root.hidden = true;
    },
    tone === "error" ? 7000 : 4500,
  );
}

export function hideToast(dom) {
  window.clearTimeout(toastTimer);
  dom.root.hidden = true;
}

function setFieldError(errorNode, message) {
  if (!errorNode) return;
  errorNode.textContent = message;
  errorNode.hidden = !message;
}

export function clearFormErrors(form) {
  for (const errorNode of [
    form.nameError,
    form.categoryError,
    form.colorError,
    form.frequencyError,
    form.daysError,
    form.descriptionError,
    form.formError,
  ]) {
    setFieldError(errorNode, "");
  }
  for (const field of [form.name, form.category, form.description]) {
    field?.removeAttribute("aria-invalid");
  }
  for (const fieldset of [form.colorField, form.frequencyField, form.daysField]) {
    fieldset?.removeAttribute("aria-invalid");
  }
}

export function showFormErrors(form, errors) {
  clearFormErrors(form);
  let focusTarget = null;

  const mark = (key, errorNode, field, target = field) => {
    if (!errors[key]) return false;
    setFieldError(errorNode, errors[key]);
    if (field) field.setAttribute("aria-invalid", "true");
    if (!focusTarget) focusTarget = target || field;
    return true;
  };

  mark("name", form.nameError, form.name);
  mark("category", form.categoryError, form.category);
  mark("color", form.colorError, form.colorField, form.colors[0]);
  mark("frequency", form.frequencyError, form.frequencyField, form.frequencyRadios[0]);
  mark("days", form.daysError, form.daysField, form.dayCheckboxes[0]);
  mark("description", form.descriptionError, form.description);

  if (errors.form) {
    form.formError.textContent = errors.form;
    form.formError.hidden = false;
    if (!focusTarget) focusTarget = form.formError;
  }

  focusTarget?.focus();
}

export function syncFrequencyFields(form) {
  const type =
    form.frequencyRadios.find((radio) => radio.checked)?.value || "daily";
  const weekly = type === "weekly";
  form.daysField.hidden = !weekly;
  for (const checkbox of form.dayCheckboxes) {
    checkbox.disabled = !weekly;
  }
  setFieldError(form.daysError, "");
}

function setRadio(form, name, value) {
  const radios = form.form.querySelectorAll(`input[name="${name}"]`);
  for (const radio of radios) radio.checked = radio.value === value;
}

function formatUpdatedAt(habit) {
  const date = new Date(habit.updatedAt);
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function populateHabitForm(form, habit) {
  form.form.reset();
  clearFormErrors(form);
  form.id.value = habit?.id || "";
  form.name.value = habit?.name || "";
  form.description.value = habit?.description || "";
  form.category.value = habit?.category || "health";
  setRadio(form, "color", habit?.color || "pine");
  setRadio(form, "frequency", habit?.frequency.type || "daily");
  const selectedDays = new Set(habit?.frequency.days || []);
  for (const checkbox of form.dayCheckboxes) {
    checkbox.checked = selectedDays.has(Number(checkbox.value));
  }
  syncFrequencyFields(form);

  setText(form.eyebrow, habit ? "Ubah kebiasaan" : "Kebiasaan baru");
  setText(form.title, habit ? "Sesuaikan ritme" : "Mulai satu ritme");
  setText(
    form.subtitle,
    habit
      ? "Perbarui detail kebiasaan. Riwayat check-in yang sudah ada tetap tersimpan."
      : "Pilih satu langkah kecil yang bisa kamu rawat.",
  );
  setText(form.submitLabel, habit ? "Simpan perubahan" : "Simpan kebiasaan");
  setText(
    form.created,
    habit
      ? `Dibuat ${formatDate(habit.createdOn)} · Terakhir diubah ${formatUpdatedAt(habit)}`
      : "",
  );
}

export function readHabitForm(form) {
  const frequency =
    form.frequencyRadios.find((radio) => radio.checked)?.value || "daily";
  const days = form.dayCheckboxes
    .filter((checkbox) => checkbox.checked)
    .map((checkbox) => Number(checkbox.value));
  return {
    name: form.name.value,
    description: form.description.value,
    category: form.category.value,
    color: form.form.querySelector('input[name="color"]:checked')?.value || "",
    frequency: { type: frequency, days },
  };
}

export function configureConfirmDialog(dom, config) {
  setText(dom.eyebrow, config.eyebrow || "Konfirmasi");
  setText(dom.title, config.title);
  setText(dom.message, config.message);
  setText(dom.action, config.actionLabel || "Lanjutkan");
  dom.action.className = `button ${config.danger ? "button-danger" : "button-primary"}`;
  dom.iconUse.setAttribute("href", `#icon-${config.icon || "alert"}`);
}

export function closeAllMenus() {
  for (const details of document.querySelectorAll(".card-menu[open]")) {
    details.open = false;
  }
}
