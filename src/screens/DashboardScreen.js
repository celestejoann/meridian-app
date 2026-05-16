import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';

const AREA_COLORS = {
  health: '#4ade80',
  finance: '#facc15',
  career: '#60a5fa',
  relationships: '#f472b6',
  growth: '#c084fc',
  recreation: '#fb923c',
  spirituality: '#38bdf8',
};

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

function formatLocalDateKey(d) {
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

function getMondayKey(d = new Date()) {
  const x = new Date(d);
  const dow = x.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  x.setDate(x.getDate() + diff);
  return formatLocalDateKey(x);
}

function habitCreatedDateKey(habit) {
  return String(habit.created_at).slice(0, 10);
}

function isOnOrAfterCreated(habit, todayKey) {
  return todayKey >= habitCreatedDateKey(habit);
}

function getWeeklyDueDay(habit) {
  if (habit.weekly_due_day != null) {
    return habit.weekly_due_day;
  }
  return new Date(habit.created_at).getDay();
}

function buildWeekCountMap(weekRows) {
  const map = new Map();
  for (const row of weekRows) {
    map.set(row.habit_id, (map.get(row.habit_id) ?? 0) + 1);
  }
  return map;
}

function isDueToday(habit, weekCountMap, todayKey) {
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

function computeShowUpStreak(dateKeysWithActivity) {
  let d = new Date();
  if (!dateKeysWithActivity.has(formatLocalDateKey(d))) {
    d = addDays(d, -1);
  }
  let streak = 0;
  while (dateKeysWithActivity.has(formatLocalDateKey(d))) {
    streak += 1;
    d = addDays(d, -1);
  }
  return streak;
}

function computeBestStreak(dateKeysWithActivity) {
  if (dateKeysWithActivity.size === 0) return 0;
  const sorted = [...dateKeysWithActivity].sort();
  let best = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(`${sorted[i - 1]}T12:00:00`);
    const cur = new Date(`${sorted[i]}T12:00:00`);
    const diff = Math.round((cur - prev) / 86400000);
    if (diff === 1) {
      run += 1;
      if (run > best) best = run;
    } else if (diff > 1) {
      run = 1;
    }
  }
  return best;
}

function headerDateLabel(d) {
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function getStreakHeroState(todayRate) {
  const hour = new Date().getHours();
  const isAfterSixPM = hour >= 18;

  if (todayRate >= 0.5) {
    return {
      color: '#4ade80',
      border: '#4ade80',
      status: 'Streak extended ✦',
      statusColor: '#4ade80',
    };
  }
  if (isAfterSixPM) {
    return {
      color: '#f87171',
      border: '#f87171',
      status: '⏰ Ends at midnight',
      statusColor: '#f87171',
    };
  }
  return {
    color: '#facc15',
    border: '#facc15',
    status: '⏰ Complete today to keep it alive',
    statusColor: '#facc15',
  };
}

function Card({ children, accentColor }) {
  return (
    <View
      style={[
        styles.card,
        accentColor
          ? { borderLeftWidth: 3, borderLeftColor: accentColor }
          : null,
      ]}>
      {children}
    </View>
  );
}

function HabitRow({
  habit,
  completionType,
  busy,
  onToggle,
  onLifeHappens,
  subtitle,
  variant = 'due',
}) {
  const areaKey = (habit.area || '').toLowerCase();
  const tagColor = AREA_COLORS[areaKey] || '#ffffff40';
  const done = completionType != null;
  const isCompleted = completionType === 'completed';
  const isLifeHappens = completionType === 'life_happens';

  const rowStyle = [
    styles.row,
    isCompleted && styles.rowCompleted,
    variant === 'week' && styles.rowWeek,
  ];

  const titleStyle = [
    styles.habitTitle,
    (isCompleted || isLifeHappens) && styles.habitTitleDone,
  ];

  let leading = null;
  if (variant === 'due') {
    if (isLifeHappens) {
      leading = (
        <TouchableOpacity
          style={styles.lifeHappensMark}
          onPress={onToggle}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Remove life happens">
          <Text style={styles.lifeHappensEmoji}>🌱</Text>
        </TouchableOpacity>
      );
    } else {
      leading = (
        <TouchableOpacity
          style={[styles.checkbox, isCompleted && styles.checkboxOn]}
          onPress={onToggle}
          disabled={busy}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: isCompleted, busy }}>
          {isCompleted ? (
            <Text style={styles.checkMark}>✓</Text>
          ) : null}
        </TouchableOpacity>
      );
    }
  } else if (variant === 'week') {
    leading = (
      <TouchableOpacity
        style={styles.weekDotBtn}
        onPress={onToggle}
        disabled={busy}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done, busy }}>
        <Text style={[styles.weekDot, done && styles.weekDotDone]}>
          {done ? '●' : '○'}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={rowStyle}>
      {leading}
      <View style={styles.habitTextCol}>
        <Text style={titleStyle} numberOfLines={2}>
          {habit.title}
        </Text>
        {subtitle ? (
          <Text style={styles.habitSubtitle}>{subtitle}</Text>
        ) : null}
        {variant === 'due' && !done && onLifeHappens ? (
          <TouchableOpacity
            onPress={onLifeHappens}
            disabled={busy}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
            <Text style={styles.lifeHappensBtn}>Life happens</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <View style={[styles.areaPill, { backgroundColor: tagColor }]}>
        <Text style={styles.areaPillText}>
          {(habit.area || 'area').replace(/^\w/, (c) => c.toUpperCase())}
        </Text>
      </View>
    </View>
  );
}

export default function DashboardScreen() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const [habits, setHabits] = useState([]);
  const [todayByHabit, setTodayByHabit] = useState(() => new Map());
  const [weekCompletions, setWeekCompletions] = useState([]);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [toggleBusyId, setToggleBusyId] = useState(null);

  const dateSubtitle = useMemo(() => headerDateLabel(new Date()), []);
  const todayKey = useMemo(() => formatLocalDateKey(new Date()), []);

  const weekCountMap = useMemo(
    () => buildWeekCountMap(weekCompletions),
    [weekCompletions]
  );

  const dueToday = useMemo(
    () => habits.filter((h) => isDueToday(h, weekCountMap, todayKey)),
    [habits, weekCountMap, todayKey]
  );

  const thisWeek = useMemo(() => {
    const items = [];
    for (const h of habits) {
      if (!isOnOrAfterCreated(h, todayKey)) continue;
      const freq = (h.frequency || 'daily').toLowerCase();
      if (isDueToday(h, weekCountMap, todayKey)) continue;

      if (freq === 'xperweek') {
        const target = h.frequency_count ?? 1;
        const count = weekCountMap.get(h.id) ?? 0;
        items.push({
          habit: h,
          subtitle: `${count} of ${target} this week`,
        });
      } else if (freq === 'weekly') {
        const dueDay = getWeeklyDueDay(h);
        items.push({
          habit: h,
          subtitle: `Due ${DAY_NAMES[dueDay]}`,
        });
      }
    }
    return items;
  }, [habits, weekCountMap, todayKey]);

  const dueTodayDoneCount = useMemo(
    () => dueToday.filter((h) => todayByHabit.has(h.id)).length,
    [dueToday, todayByHabit]
  );

  const todayRate = useMemo(() => {
    if (dueToday.length === 0) return 0;
    return dueTodayDoneCount / dueToday.length;
  }, [dueToday.length, dueTodayDoneCount]);

  const todayPct = Math.round(todayRate * 100);

  const streakHero = useMemo(
    () => getStreakHeroState(todayRate),
    [todayRate]
  );

  const recalcStreak = useCallback(async (uid) => {
    const since = addDays(new Date(), -400);
    const sinceKey = formatLocalDateKey(since);

    const { data: streakRows } = await supabase
      .from('habit_completions')
      .select('completed_date')
      .eq('user_id', uid)
      .gte('completed_date', sinceKey);

    const datesWithActivity = new Set();
    for (const row of streakRows ?? []) {
      if (row.completed_date) {
        datesWithActivity.add(String(row.completed_date).slice(0, 10));
      }
    }
    setStreak(computeShowUpStreak(datesWithActivity));
    setBestStreak(computeBestStreak(datesWithActivity));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      setUserId(null);
      setHabits([]);
      setTodayByHabit(new Map());
      setWeekCompletions([]);
      setStreak(0);
      setBestStreak(0);
      setLoading(false);
      return;
    }
    const uid = userData.user.id;
    setUserId(uid);

    const today = new Date();
    const todayStr =
      today.getFullYear() +
      '-' +
      String(today.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(today.getDate()).padStart(2, '0');

    const mondayStr = getMondayKey(today);

    const [
      { data: habitsData, error: habitsErr },
      { data: todayRows },
      { data: weekRows },
    ] = await Promise.all([
      supabase
        .from('habits')
        .select('*')
        .eq('user_id', uid)
        .eq('status', 'active')
        .order('title', { ascending: true }),
      supabase
        .from('habit_completions')
        .select('*')
        .eq('user_id', uid)
        .eq('completed_date', todayStr),
      supabase
        .from('habit_completions')
        .select('*')
        .eq('user_id', uid)
        .gte('completed_date', mondayStr)
        .lte('completed_date', todayStr),
    ]);

    if (habitsErr) {
      setHabits([]);
    } else {
      setHabits(habitsData ?? []);
    }

    const todayMap = new Map();
    for (const row of todayRows ?? []) {
      todayMap.set(row.habit_id, row.completion_type || 'completed');
    }
    setTodayByHabit(todayMap);
    setWeekCompletions(weekRows ?? []);

    await recalcStreak(uid);
    setLoading(false);
  }, [recalcStreak]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const todayStr = useCallback(() => {
    const today = new Date();
    return (
      today.getFullYear() +
      '-' +
      String(today.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(today.getDate()).padStart(2, '0')
    );
  }, []);

  const setCompletion = async (habitId, nextChecked, completionType = 'completed') => {
    if (!userId) return;
    const dateStr = todayStr();

    const prevToday = new Map(todayByHabit);
    const prevWeek = weekCompletions;

    const nextToday = new Map(todayByHabit);
    let nextWeek = weekCompletions;

    if (nextChecked) {
      nextToday.set(habitId, completionType);
      const alreadyToday = weekCompletions.some(
        (r) =>
          r.habit_id === habitId &&
          String(r.completed_date).slice(0, 10) === dateStr
      );
      if (!alreadyToday) {
        nextWeek = [
          ...weekCompletions,
          {
            habit_id: habitId,
            user_id: userId,
            completed_date: dateStr,
            completion_type: completionType,
          },
        ];
      } else {
        nextWeek = weekCompletions.map((r) =>
          r.habit_id === habitId &&
          String(r.completed_date).slice(0, 10) === dateStr
            ? { ...r, completion_type: completionType }
            : r
        );
      }
    } else {
      nextToday.delete(habitId);
      nextWeek = weekCompletions.filter(
        (r) =>
          !(
            r.habit_id === habitId &&
            String(r.completed_date).slice(0, 10) === dateStr
          )
      );
    }

    setTodayByHabit(nextToday);
    setWeekCompletions(nextWeek);
    setToggleBusyId(habitId);

    try {
      if (nextChecked) {
        await supabase
          .from('habit_completions')
          .delete()
          .eq('habit_id', habitId)
          .eq('completed_date', dateStr);

        const { error } = await supabase.from('habit_completions').insert({
          habit_id: habitId,
          user_id: userId,
          completed_date: dateStr,
          completion_type: completionType,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('habit_completions')
          .delete()
          .eq('habit_id', habitId)
          .eq('completed_date', dateStr);
        if (error) throw error;
      }
      await recalcStreak(userId);
    } catch {
      setTodayByHabit(prevToday);
      setWeekCompletions(prevWeek);
    } finally {
      setToggleBusyId(null);
    }
  };

  const toggleHabit = (habitId) => {
    const current = todayByHabit.get(habitId);
    if (current) {
      setCompletion(habitId, false);
    } else {
      setCompletion(habitId, true, 'completed');
    }
  };

  const markLifeHappens = (habitId) => {
    setCompletion(habitId, true, 'life_happens');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <Text style={styles.headerTitle}>Today</Text>
        <Text style={styles.headerDate}>{dateSubtitle}</Text>

        {loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator color="#6366f1" size={32} />
          </View>
        ) : (
          <>
            <View
              style={[
                styles.streakHeroCard,
                { borderLeftColor: streakHero.border },
              ]}>
              <Text style={styles.streakEmojiSide}>🔥</Text>
              <View style={styles.streakHeroRight}>
                <View style={styles.streakTopRow}>
                  <Text
                    style={[
                      styles.streakNumberSide,
                      { color: streakHero.color },
                    ]}>
                    {streak}
                  </Text>
                  <Text style={styles.streakDaysLabel}> days</Text>
                </View>
                <Text
                  style={[
                    styles.streakStatusSide,
                    { color: streakHero.statusColor },
                  ]}>
                  {streakHero.status}
                </Text>
                {bestStreak > 0 ? (
                  <Text style={styles.streakMetaLine}>
                    Best: {bestStreak} days
                  </Text>
                ) : null}
                <Text style={styles.streakMetaLine}>
                  Today: {todayPct}%
                </Text>
              </View>
            </View>

            <Card>
              <Text style={styles.sectionTitle}>DUE TODAY</Text>
              {dueToday.length > 0 ? (
                <Text style={styles.dueCount}>
                  {dueTodayDoneCount} of {dueToday.length} due today
                </Text>
              ) : null}
              {dueToday.length === 0 ? (
                <Text style={styles.emptyText}>No commitments due today</Text>
              ) : (
                dueToday.map((h) => {
                  const busy = toggleBusyId === h.id;
                  return (
                    <HabitRow
                      key={h.id}
                      habit={h}
                      completionType={todayByHabit.get(h.id) ?? null}
                      busy={busy}
                      onToggle={() => toggleHabit(h.id)}
                      onLifeHappens={() => markLifeHappens(h.id)}
                      variant="due"
                    />
                  );
                })
              )}
            </Card>

            {thisWeek.length > 0 ? (
              <Card>
                <Text style={styles.sectionTitle}>THIS WEEK</Text>
                {thisWeek.map(({ habit, subtitle }) => {
                  const busy = toggleBusyId === habit.id;
                  return (
                    <HabitRow
                      key={habit.id}
                      habit={habit}
                      completionType={todayByHabit.get(habit.id) ?? null}
                      busy={busy}
                      onToggle={() => toggleHabit(habit.id)}
                      subtitle={subtitle}
                      variant="week"
                    />
                  );
                })}
              </Card>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#080812',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '300',
    color: '#ffffff',
    marginTop: 8,
  },
  headerDate: {
    marginTop: 6,
    fontSize: 14,
    color: '#ffffff60',
    marginBottom: 20,
  },
  loaderWrap: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#0f0f1e',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    overflow: 'hidden',
  },
  streakHeroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 20,
    borderLeftWidth: 3,
    backgroundColor: '#0f0f1e',
    marginBottom: 16,
    overflow: 'hidden',
  },
  streakEmojiSide: {
    fontSize: 40,
  },
  streakHeroRight: {
    flex: 1,
    paddingLeft: 16,
  },
  streakTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  streakNumberSide: {
    fontSize: 48,
    fontWeight: '700',
  },
  streakDaysLabel: {
    fontSize: 16,
    color: '#ffffff60',
    alignSelf: 'flex-end',
    paddingBottom: 8,
  },
  streakStatusSide: {
    fontSize: 12,
    marginTop: 4,
  },
  streakMetaLine: {
    fontSize: 11,
    color: '#ffffff40',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  dueCount: {
    fontSize: 13,
    color: '#ffffff50',
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 15,
    color: '#ffffff55',
    marginTop: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginHorizontal: -10,
  },
  rowCompleted: {
    borderLeftWidth: 3,
    borderLeftColor: '#4ade80',
    backgroundColor: '#4ade8008',
  },
  rowWeek: {
    paddingVertical: 10,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#ffffff35',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: '#4ade80',
    borderColor: '#4ade80',
  },
  checkMark: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  lifeHappensMark: {
    width: 26,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lifeHappensEmoji: {
    fontSize: 20,
  },
  lifeHappensBtn: {
    marginTop: 4,
    fontSize: 12,
    color: '#a78bfa',
  },
  weekDotBtn: {
    width: 28,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekDot: {
    fontSize: 18,
    color: '#ffffff35',
  },
  weekDotDone: {
    color: '#4ade80',
  },
  habitTextCol: {
    flex: 1,
    minWidth: 0,
  },
  habitTitle: {
    color: '#ffffff',
    fontSize: 16,
  },
  habitTitleDone: {
    opacity: 0.55,
  },
  habitSubtitle: {
    color: '#ffffff55',
    fontSize: 13,
    marginTop: 2,
  },
  areaPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginLeft: 8,
    maxWidth: 120,
  },
  areaPillText: {
    color: '#080812',
    fontSize: 11,
    fontWeight: '700',
  },
});
