import { compareDateKeys, getMonthGrid, todayKey } from "./dates.js";
import { getCheckinDates, isCheckedIn } from "./checkins.js";
import {
  canCheckIn,
  getActiveHabits,
  getArchivedHabits,
  isScheduledOn,
} from "./habits.js";
import { percent } from "./stats.js";

export function getDayDetails(habits, checkins, dateKey, today = todayKey()) {
  const activeHabits = getActiveHabits(habits);
  const archivedHabits = getArchivedHabits(habits);

  const active = activeHabits
    .filter((habit) => isScheduledOn(habit, dateKey))
    .map((habit) => ({
      habit,
      checked: isCheckedIn(checkins, habit.id, dateKey),
      canCheck: canCheckIn(habit, dateKey, today),
    }));

  const archived = archivedHabits
    .filter((habit) => {
      if (isScheduledOn(habit, dateKey)) return true;
      return isCheckedIn(checkins, habit.id, dateKey);
    })
    .map((habit) => ({
      habit,
      checked: isCheckedIn(checkins, habit.id, dateKey),
      canCheck: false,
    }));

  const completed = active.filter((item) => item.checked).length;
  const archivedCompleted = archived.filter((item) => item.checked).length;
  const anyActivity = completed > 0 || archivedCompleted > 0;

  return {
    dateKey,
    active,
    archived,
    targets: active.length,
    completed,
    archivedCompleted,
    percent: percent(completed, active.length),
    anyActivity,
    hasObligations: active.length > 0,
    isToday: compareDateKeys(dateKey, today) === 0,
    isFuture: compareDateKeys(dateKey, today) > 0,
  };
}

export function getMonthDays(habits, checkins, year, monthIndex, today = todayKey()) {
  return getMonthGrid(year, monthIndex).map((cell) => ({
    ...cell,
    details: getDayDetails(habits, checkins, cell.key, today),
  }));
}

export function getCheckinDatesForHabit(checkins, habitId) {
  return getCheckinDates(checkins, habitId);
}

export function getArchivedCheckinCount(checkins, habits) {
  return getArchivedHabits(habits).reduce(
    (total, habit) => total + getCheckinDates(checkins, habit.id).length,
    0,
  );
}
