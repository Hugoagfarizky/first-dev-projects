import {
  addDays,
  compareDateKeys,
  getLastNDates,
  todayKey,
} from "./dates.js";
import { getCheckinDates, isCheckedIn } from "./checkins.js";
import {
  getActiveHabits,
  getArchivedHabits,
  isArchived,
  isScheduledOn,
} from "./habits.js";

export function percent(completed, total) {
  if (!total) return 0;
  return Math.round((completed / total) * 100);
}

export function getStreaks(habit, checkins, today = todayKey()) {
  if (!habit) return { current: 0, longest: 0 };

  const checkinSet = new Set(getCheckinDates(checkins, habit.id));
  let current = 0;

  if (!isArchived(habit)) {
    let cursor = today;
    let guard = 0;
    while (compareDateKeys(cursor, habit.createdOn) >= 0 && guard < 50_000) {
      if (isScheduledOn(habit, cursor)) {
        if (checkinSet.has(cursor)) {
          current += 1;
        } else if (cursor !== today) {
          break;
        }
      }
      cursor = addDays(cursor, -1);
      guard += 1;
    }
  }

  let longest = 0;
  let running = 0;
  const endKey = isArchived(habit) ? habit.archivedAt : today;
  let cursor = habit.createdOn;
  let guard = 0;

  while (compareDateKeys(cursor, endKey) <= 0 && guard < 50_000) {
    if (isScheduledOn(habit, cursor)) {
      if (checkinSet.has(cursor)) {
        running += 1;
        longest = Math.max(longest, running);
      } else if (!(cursor === today && !isArchived(habit))) {
        running = 0;
      }
    }
    cursor = addDays(cursor, 1);
    guard += 1;
  }

  return { current, longest };
}

function getHabitRange(habit, checkins, startKey, endKey) {
  let targets = 0;
  let completed = 0;
  let cursor = compareDateKeys(startKey, habit.createdOn) < 0 ? habit.createdOn : startKey;

  while (compareDateKeys(cursor, endKey) <= 0) {
    if (isScheduledOn(habit, cursor)) {
      targets += 1;
      if (isCheckedIn(checkins, habit.id, cursor)) completed += 1;
    }
    cursor = addDays(cursor, 1);
  }

  return {
    targets,
    completed,
    percent: percent(completed, targets),
    hasTargets: targets > 0,
  };
}

export function getRangeSummary(habits, checkins, startKey, endKey) {
  const activeHabits = getActiveHabits(habits);
  const perHabit = new Map();
  let targets = 0;
  let completed = 0;

  for (const habit of activeHabits) {
    const summary = getHabitRange(habit, checkins, startKey, endKey);
    perHabit.set(habit.id, summary);
    targets += summary.targets;
    completed += summary.completed;
  }

  return {
    startKey,
    endKey,
    targets,
    completed,
    percent: percent(completed, targets),
    hasTargets: targets > 0,
    perHabit,
  };
}

export function getTodaySummary(habits, checkins, today = todayKey()) {
  const activeHabits = getActiveHabits(habits);
  const scheduled = activeHabits.filter((habit) => isScheduledOn(habit, today));
  const completed = scheduled.filter((habit) => isCheckedIn(checkins, habit.id, today));

  let bestCurrent = null;
  for (const habit of activeHabits) {
    const streaks = getStreaks(habit, checkins, today);
    if (!bestCurrent || streaks.current > bestCurrent.streak) {
      bestCurrent = { habit, streak: streaks.current };
    }
  }

  return {
    activeCount: activeHabits.length,
    scheduledCount: scheduled.length,
    completedCount: completed.length,
    percent: percent(completed.length, scheduled.length),
    scheduled,
    completed,
    bestCurrent,
  };
}

export function getSevenDayActivity(habits, checkins, today = todayKey()) {
  const activeHabits = getActiveHabits(habits);
  return getLastNDates(today, 7).map((dateKey) => {
    const scheduled = activeHabits.filter((habit) => isScheduledOn(habit, dateKey));
    const completed = scheduled.filter((habit) =>
      isCheckedIn(checkins, habit.id, dateKey),
    );
    return {
      dateKey,
      isToday: dateKey === today,
      targets: scheduled.length,
      completed: completed.length,
      percent: scheduled.length ? percent(completed.length, scheduled.length) : null,
      hasTargets: scheduled.length > 0,
    };
  });
}

export function getHabitProgress(habit, checkins, today = todayKey(), days = 30) {
  const range = getHabitRange(habit, checkins, addDays(today, -(days - 1)), today);
  const streaks = getStreaks(habit, checkins, today);
  return {
    habit,
    range,
    current: streaks.current,
    longest: streaks.longest,
    totalCheckins: getCheckinDates(checkins, habit.id).length,
  };
}

export function getOverallStats(habits, checkins, today = todayKey()) {
  const activeHabits = getActiveHabits(habits);
  const week = getRangeSummary(activeHabits, checkins, addDays(today, -6), today);
  const month = getRangeSummary(activeHabits, checkins, addDays(today, -29), today);
  const progress = activeHabits.map((habit) => getHabitProgress(habit, checkins, today));

  const bestStreak = progress.reduce((best, item) => {
    if (!best || item.longest > best.longest) return item;
    return best;
  }, null);

  const bestCurrent = progress.reduce((best, item) => {
    if (!best || item.current > best.current) return item;
    return best;
  }, null);

  return {
    activeCount: activeHabits.length,
    archivedCount: getArchivedHabits(habits).length,
    totalCheckins: Object.values(checkins || {}).reduce(
      (total, dates) => total + dates.length,
      0,
    ),
    week,
    month,
    progress,
    bestStreak,
    bestCurrent,
  };
}
