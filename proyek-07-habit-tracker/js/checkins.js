import {
  compareDateKeys,
  isValidDateKey,
  todayKey,
} from "./dates.js";

export function createCheckinStore() {
  return Object.create(null);
}

export function normalizeCheckins(raw, habits, today = todayKey()) {
  const store = createCheckinStore();
  const habitsById = new Map(habits.map((habit) => [habit.id, habit]));
  let invalidCount = 0;

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { checkins: store, invalidCount: 1 };
  }

  for (const [habitId, value] of Object.entries(raw)) {
    const habit = habitsById.get(habitId);
    if (!habit || !Array.isArray(value)) {
      invalidCount += 1;
      continue;
    }

    const seen = new Set();
    const dates = [];
    for (const item of value) {
      if (
        !isValidDateKey(item) ||
        compareDateKeys(item, habit.createdOn) < 0 ||
        compareDateKeys(item, today) > 0 ||
        (habit.archivedAt && compareDateKeys(item, habit.archivedAt) > 0)
      ) {
        invalidCount += 1;
        continue;
      }
      if (seen.has(item)) continue;
      seen.add(item);
      dates.push(item);
    }

    if (dates.length) {
      dates.sort(compareDateKeys);
      store[habitId] = dates;
    }
  }

  return { checkins: store, invalidCount };
}

export function getCheckinDates(checkins, habitId) {
  return checkins?.[habitId] ? [...checkins[habitId]] : [];
}

export function isCheckedIn(checkins, habitId, dateKey) {
  return Boolean(checkins?.[habitId]?.includes(dateKey));
}

export function setCheckin(checkins, habitId, dateKey, checked) {
  const next = Object.assign(createCheckinStore(), checkins);
  const dates = new Set(next[habitId] || []);

  if (checked) {
    dates.add(dateKey);
  } else {
    dates.delete(dateKey);
  }

  const updated = [...dates].sort(compareDateKeys);
  if (updated.length) next[habitId] = updated;
  else delete next[habitId];
  return next;
}

export function toggleCheckin(checkins, habitId, dateKey) {
  const checked = !isCheckedIn(checkins, habitId, dateKey);
  return {
    checkins: setCheckin(checkins, habitId, dateKey, checked),
    checked,
  };
}

export function removeHabitCheckins(checkins, habitId) {
  const next = Object.assign(createCheckinStore(), checkins);
  delete next[habitId];
  return next;
}

export function countAllCheckins(checkins) {
  if (!checkins) return 0;
  return Object.values(checkins).reduce(
    (total, dates) => total + (Array.isArray(dates) ? dates.length : 0),
    0,
  );
}

export function countHabitCheckins(checkins, habitId) {
  return checkins?.[habitId]?.length || 0;
}

export function getCheckedDatesInRange(checkins, habitId, startKey, endKey) {
  return getCheckinDates(checkins, habitId).filter(
    (dateKey) =>
      compareDateKeys(dateKey, startKey) >= 0 && compareDateKeys(dateKey, endKey) <= 0,
  );
}
