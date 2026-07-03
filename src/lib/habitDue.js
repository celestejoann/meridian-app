export function formatLocalDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function habitCreatedDateKey(habit) {
  return String(habit.created_at).slice(0, 10);
}

export function isOnOrAfterCreated(habit, todayKey) {
  return todayKey >= habitCreatedDateKey(habit);
}

export function getWeeklyDueDay(habit) {
  if (habit.weekly_due_day != null) {
    return habit.weekly_due_day;
  }
  return new Date(habit.created_at).getDay();
}

export function buildWeekCountMap(weekRows) {
  const map = new Map();
  for (const row of weekRows) {
    map.set(row.habit_id, (map.get(row.habit_id) ?? 0) + 1);
  }
  return map;
}

export function isDueToday(habit, weekCountMap, todayKey) {
  if (!isOnOrAfterCreated(habit, todayKey)) return false;

  const freq = (habit.frequency || 'daily').toLowerCase();
  const dow = new Date().getDay();

  switch (freq) {
    case 'daily':
      return true;
    case 'weekdays':
      return dow >= 1 && dow <= 5;
    case 'weekly':
      return dow === getWeeklyDueDay(habit);
    case 'xperweek': {
      const target = habit.frequency_count ?? 1;
      const count = weekCountMap.get(habit.id) ?? 0;
      return count < target;
    }
    default:
      return true;
  }
}

export function getMondayKey(d = new Date()) {
  const x = new Date(d);
  const dow = x.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  x.setDate(x.getDate() + diff);
  return formatLocalDateKey(x);
}
