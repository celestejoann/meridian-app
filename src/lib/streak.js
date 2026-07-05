import { supabase } from './supabase';

export function formatLocalDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function getStreakMilestone(streakCount) {
  if (streakCount === 7 || streakCount === 30 || streakCount === 100) {
    return streakCount;
  }
  return null;
}

export async function calculateLoggingStreak(userId) {
  const today = new Date();
  const todayKey = formatLocalDateKey(today);

  const [{ data: completionRows }, { data: noteRows }] = await Promise.all([
    supabase
      .from('habit_completions')
      .select('completed_date')
      .eq('user_id', userId),
    supabase
      .from('general_notes')
      .select('created_at')
      .eq('user_id', userId),
  ]);

  const activeDates = new Set();

  for (const row of completionRows ?? []) {
    if (row.completed_date) {
      activeDates.add(String(row.completed_date).slice(0, 10));
    }
  }

  for (const row of noteRows ?? []) {
    if (row.created_at) {
      activeDates.add(formatLocalDateKey(new Date(row.created_at)));
    }
  }

  const isTodayLogged = activeDates.has(todayKey);

  let cursor = new Date(today);
  if (!isTodayLogged) {
    cursor = addDays(cursor, -1);
  }

  let currentStreak = 0;
  while (activeDates.has(formatLocalDateKey(cursor))) {
    currentStreak += 1;
    cursor = addDays(cursor, -1);
  }

  return { currentStreak, isTodayLogged };
}

/** Days in window with ≥1 habit completion or general_note (matches streak "logged" days). */
export function countLoggingDaysInWindow(completionRows, noteRows, windowDateKeys) {
  const windowSet = new Set(windowDateKeys);
  const activeDates = new Set();

  for (const row of completionRows ?? []) {
    if (row.completed_date) {
      const key = String(row.completed_date).slice(0, 10);
      if (windowSet.has(key)) activeDates.add(key);
    }
  }

  for (const row of noteRows ?? []) {
    if (row.created_at) {
      const key = formatLocalDateKey(new Date(row.created_at));
      if (windowSet.has(key)) activeDates.add(key);
    }
  }

  return activeDates.size;
}
