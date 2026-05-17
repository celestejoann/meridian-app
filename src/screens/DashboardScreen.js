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
import { COLORS, FONTS, AREA_COLORS } from '../constants/theme';
import { supabase } from '../lib/supabase';

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

const DASHBOARD_AREA_COLORS = {
  health: '#86efac',
  finance: '#fbbf24',
  career: '#60a5fa',
  relationships: '#f472b6',
  growth: '#c084fc',
  recreation: '#fb923c',
  spirituality: '#38bdf8',
};

function getAreaColor(area) {
  const key = (area || '').toLowerCase();
  return DASHBOARD_AREA_COLORS[key] || AREA_COLORS[key] || COLORS.accent;
}

function isLightAreaColor(hex) {
  const h = hex.replace('#', '');
  if (h.length < 6) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.65;
}

function getCheckmarkColor(areaColor) {
  return isLightAreaColor(areaColor) ? '#ffffff' : COLORS.bg;
}

function getStreakHeroState(todayRate) {
  const hour = new Date().getHours();
  const isAfterSixPM = hour >= 18;

  if (todayRate === 0) {
    return {
      color: COLORS.gold,
      border: COLORS.gold,
      status: 'How will you show up today?',
      statusColor: COLORS.gold,
    };
  }
  if (todayRate >= 0.5) {
    return {
      color: COLORS.streakColor,
      border: COLORS.streakColor,
      status: "You're still showing up ✦",
      statusColor: COLORS.streakColor,
    };
  }
  if (isAfterSixPM) {
    return {
      color: COLORS.red,
      border: COLORS.red,
      status: '⏰ Today is still here',
      statusColor: COLORS.red,
    };
  }
  return {
    color: COLORS.gold,
    border: COLORS.gold,
    status: 'Show up for your commitments today',
    statusColor: COLORS.gold,
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
  const areaColor = getAreaColor(habit.area);
  const tagColor = AREA_COLORS[areaKey] || COLORS.muted;
  const done = completionType != null;
  const isCompleted = completionType === 'completed';
  const isLifeHappens = completionType === 'life_happens';

  const rowStyle = [
    styles.row,
    isCompleted && {
      ...styles.rowCompleted,
      borderLeftColor: areaColor,
      backgroundColor: areaColor + '08',
    },
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
          style={[
            styles.checkbox,
            { borderColor: areaColor + '50' },
            isCompleted && {
              backgroundColor: areaColor,
              borderColor: areaColor,
            },
          ]}
          onPress={onToggle}
          disabled={busy}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: isCompleted, busy }}>
          {isCompleted ? (
            <Text
              style={[
                styles.checkMark,
                { color: getCheckmarkColor(areaColor) },
              ]}>
              ✓
            </Text>
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
        accessibilityState={{ checked: isCompleted, busy }}>
        <Text
          style={[
            styles.weekDot,
            { color: isCompleted ? areaColor : areaColor + '50' },
          ]}>
          {isCompleted ? '●' : '○'}
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
  const [userAreas, setUserAreas] = useState([]);
  const [userIdentities, setUserIdentities] = useState([]);
  const [todayByHabit, setTodayByHabit] = useState(() => new Map());
  const [weekCompletions, setWeekCompletions] = useState([]);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [toggleBusyId, setToggleBusyId] = useState(null);
  const [tasksDueToday, setTasksDueToday] = useState([]);
  const [tasksDueThisWeek, setTasksDueThisWeek] = useState([]);

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

  const habitsForTodayRate = useMemo(() => {
    const weekHabits = thisWeek.map((item) => item.habit);
    return [...dueToday, ...weekHabits];
  }, [dueToday, thisWeek]);

  const todayCompletionsCount = useMemo(
    () => habitsForTodayRate.filter((h) => todayByHabit.has(h.id)).length,
    [habitsForTodayRate, todayByHabit]
  );

  const todayRate = useMemo(() => {
    if (habitsForTodayRate.length === 0) return 0;
    return todayCompletionsCount / habitsForTodayRate.length;
  }, [habitsForTodayRate.length, todayCompletionsCount]);

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
      setUserAreas([]);
      setUserIdentities([]);
      setTodayByHabit(new Map());
      setWeekCompletions([]);
      setStreak(0);
      setBestStreak(0);
      setLoading(false);
      return;
    }
    const uid = userData.user.id;
    setUserId(uid);

    const todayStr = formatLocalDateKey(new Date());
    const mondayStr = getMondayKey(new Date());
    const sundayDate = new Date();
    sundayDate.setDate(sundayDate.getDate() + (7 - sundayDate.getDay()));
    const sundayStr = sundayDate.toLocaleDateString('en-CA');

    const [
      { data: habitsData, error: habitsErr },
      { data: todayRows },
      { data: weekRows },
      { data: areasData },
      { data: identitiesData },
      { data: tasksData },
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
      supabase.from('user_areas').select('*').eq('user_id', uid),
      supabase.from('user_identities').select('*').eq('user_id', uid),
      supabase
        .from('tasks')
        .select('*, goals(title, area)')
        .eq('user_id', uid)
        .neq('status', 'completed')
        .not('due_date', 'is', null)
        .lte('due_date', sundayStr)
        .order('due_date', { ascending: true }),
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
    setUserAreas(areasData ?? []);
    setUserIdentities(identitiesData ?? []);

    const allTasks = tasksData || [];
    setTasksDueToday(allTasks.filter(t => t.due_date <= todayStr));
    setTasksDueThisWeek(allTasks.filter(t => t.due_date > todayStr));

    await recalcStreak(uid);
    setLoading(false);
  }, [recalcStreak]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const setCompletion = async (habitId, nextChecked, completionType = 'completed') => {
    if (!userId) return;
    const dateStr = todayKey;

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
          .eq('user_id', userId)
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
          .eq('user_id', userId)
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

  const toggleWeekHabit = async (habitId) => {
    if (!userId) return;

    const dateStr = todayKey;
    const hasCompletionToday = todayByHabit.has(habitId);

    const prevToday = new Map(todayByHabit);
    const prevWeek = weekCompletions;

    if (hasCompletionToday) {
      const nextToday = new Map(todayByHabit);
      nextToday.delete(habitId);
      const nextWeek = weekCompletions.filter(
        (r) =>
          !(
            r.habit_id === habitId &&
            String(r.completed_date).slice(0, 10) === dateStr
          )
      );

      setTodayByHabit(nextToday);
      setWeekCompletions(nextWeek);
      setToggleBusyId(habitId);

      try {
        const { error } = await supabase
          .from('habit_completions')
          .delete()
          .eq('user_id', userId)
          .eq('habit_id', habitId)
          .eq('completed_date', dateStr);
        if (error) throw error;
        await recalcStreak(userId);
      } catch {
        setTodayByHabit(prevToday);
        setWeekCompletions(prevWeek);
      } finally {
        setToggleBusyId(null);
      }
      return;
    }

    const nextToday = new Map(todayByHabit);
    nextToday.set(habitId, 'completed');
    const nextWeek = [
      ...weekCompletions,
      {
        habit_id: habitId,
        user_id: userId,
        completed_date: dateStr,
        completion_type: 'completed',
      },
    ];

    setTodayByHabit(nextToday);
    setWeekCompletions(nextWeek);
    setToggleBusyId(habitId);

    try {
      const { error } = await supabase.from('habit_completions').insert({
        habit_id: habitId,
        user_id: userId,
        completed_date: dateStr,
        completion_type: 'completed',
      });
      if (error) throw error;
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

  const toggleTask = async (taskId) => {
    const { error } = await supabase
      .from('tasks')
      .update({ status: 'completed' })
      .eq('id', taskId);
    if (!error) await load();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <Text
          style={[
            styles.headerTitle,
            styles.headerTitleFont,
          ]}>
          Today
        </Text>
        <Text style={styles.headerDate}>{dateSubtitle}</Text>

        {loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator color={COLORS.accent} size={32} />
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
                    Longest stretch: {bestStreak} days
                  </Text>
                ) : null}
                <Text style={styles.streakMetaLine}>
                  Today: {todayCompletionsCount} of {habitsForTodayRate.length}{' '}
                  shown up
                </Text>
              </View>
            </View>

            {userIdentities.length > 0 ? (
              <View style={styles.whoIAmSection}>
                <Text style={styles.whoIAmTitle}>WHO I AM</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.identityScrollContent}>
                  {userIdentities.map((identity) => {
                    const areaKey = identity.area_slug || identity.area;
                    const areaColor = getAreaColor(areaKey);
                    return (
                      <View
                        key={identity.id}
                        style={[
                          styles.identityCard,
                          { borderLeftColor: areaColor },
                        ]}>
                        <Text
                          style={[styles.identityAreaLabel, { color: areaColor }]}>
                          {(areaKey || '').toUpperCase()}
                        </Text>
                        <Text style={styles.identityStatement}>
                          I am someone who {identity.statement}
                        </Text>
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}

            <Card>
              <Text style={[styles.playfairSectionHeading, styles.playfairSectionHeadingFont]}>
                Commitments
              </Text>

              <Text style={styles.sectionTitle}>DUE TODAY</Text>
              {dueToday.length === 0 ? (
                <Text style={styles.emptyText}>No commitments due today</Text>
              ) : (
                <>
                  {dueToday.length > 0 && (
                    <Text style={styles.dueCount}>
                      {dueTodayDoneCount} of {dueToday.length} to show up for
                    </Text>
                  )}
                  {dueToday.map((h) => {
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
                  })}
                </>
              )}

              {thisWeek.length > 0 && (
                <>
                  <View style={styles.sectionDivider} />
                  <Text style={styles.sectionTitle}>THIS WEEK</Text>
                  {thisWeek.map(({ habit, subtitle }) => {
                    const busy = toggleBusyId === habit.id;
                    return (
                      <HabitRow
                        key={habit.id}
                        habit={habit}
                        completionType={todayByHabit.get(habit.id) ?? null}
                        busy={busy}
                        onToggle={() => toggleWeekHabit(habit.id)}
                        subtitle={subtitle}
                        variant="week"
                      />
                    );
                  })}
                </>
              )}
            </Card>

            {(tasksDueToday.length > 0 || tasksDueThisWeek.length > 0) ? (
              <Card>
                <Text style={[styles.playfairSectionHeading, styles.playfairSectionHeadingFont]}>
                  Actions
                </Text>

                {tasksDueToday.length > 0 && (
                  <>
                    <Text style={styles.sectionTitle}>DUE TODAY</Text>
                    {tasksDueToday.map(task => {
                      const areaKey = (task.goals?.area || '').toLowerCase();
                      const areaColor = AREA_COLORS[areaKey] || COLORS.accent;
                      return (
                        <TouchableOpacity
                          key={task.id}
                          style={styles.actionRow}
                          onPress={() => toggleTask(task.id)}>
                          <View style={[styles.actionCheck, { borderColor: areaColor }]}>
                            <View style={[styles.actionCheckInner, { backgroundColor: areaColor }]} />
                          </View>
                          <View style={styles.actionContent}>
                            <Text style={styles.actionTitle}>{task.title}</Text>
                            <Text style={[styles.actionMeta, { color: areaColor }]}>
                              {task.goals?.title || 'Pursuit'}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </>
                )}

                {tasksDueThisWeek.length > 0 && (
                  <>
                    {tasksDueToday.length > 0 && <View style={styles.sectionDivider} />}
                    <Text style={styles.sectionTitle}>THIS WEEK</Text>
                    {tasksDueThisWeek.map(task => {
                      const areaKey = (task.goals?.area || '').toLowerCase();
                      const areaColor = AREA_COLORS[areaKey] || COLORS.accent;
                      const dueDate = new Date(task.due_date + 'T00:00:00');
                      const dueDateLabel = dueDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                      return (
                        <TouchableOpacity
                          key={task.id}
                          style={styles.actionRow}
                          onPress={() => toggleTask(task.id)}>
                          <View style={[styles.actionCheck, { borderColor: areaColor }]} />
                          <View style={styles.actionContent}>
                            <Text style={styles.actionTitle}>{task.title}</Text>
                            <Text style={[styles.actionMeta, { color: areaColor }]}>
                              {task.goals?.title || 'Pursuit'} · Due {dueDateLabel}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </>
                )}
              </Card>
            ) : (
              <Card>
                <Text style={[styles.playfairSectionHeading, styles.playfairSectionHeadingFont]}>
                  Actions
                </Text>
                <Text style={styles.emptyText}>No actions due this week.</Text>
                <Text style={styles.emptySubtext}>Add milestones to your pursuits to see them here.</Text>
              </Card>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  headerTitle: {
    fontSize: 36,
    fontWeight: '300',
    color: COLORS.text,
    marginTop: 8,
  },
  headerTitleFont: {
    fontFamily: FONTS.heading,
  },
  headerDate: {
    marginTop: 6,
    fontSize: 14,
    color: COLORS.mutedLight,
    marginBottom: 20,
    fontFamily: FONTS.body,
  },
  playfairSectionHeading: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
  },
  playfairSectionHeadingFont: {
    fontFamily: FONTS.headingBold,
  },
  whoIAmSection: {
    marginBottom: 16,
  },
  whoIAmTitle: {
    fontSize: 9,
    letterSpacing: 1.5,
    color: COLORS.accent,
    textTransform: 'uppercase',
    marginBottom: 12,
    fontFamily: FONTS.bodyMedium,
  },
  identityScrollContent: {
    paddingRight: 8,
  },
  identityCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginRight: 12,
    width: 200,
    borderLeftWidth: 3,
  },
  identityAreaLabel: {
    fontSize: 12,
    letterSpacing: 1,
    marginBottom: 8,
    fontFamily: FONTS.body,
  },
  identityStatement: {
    fontSize: 13,
    color: COLORS.text,
    fontStyle: 'italic',
    fontWeight: '300',
    lineHeight: 20,
  },
  loaderWrap: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  card: {
    backgroundColor: COLORS.surface,
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
    backgroundColor: COLORS.surface,
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
    color: COLORS.mutedLight,
    alignSelf: 'flex-end',
    paddingBottom: 8,
  },
  streakStatusSide: {
    fontSize: 12,
    marginTop: 4,
  },
  streakMetaLine: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 9,
    letterSpacing: 1.5,
    color: COLORS.accent,
    textTransform: 'uppercase',
    marginBottom: 4,
    fontFamily: FONTS.bodyMedium,
  },
  sectionDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: 14 },
  dueCount: {
    fontSize: 13,
    color: COLORS.mutedLight,
    marginBottom: 16,
    fontFamily: FONTS.body,
  },
  emptyText: {
    fontSize: 15,
    color: COLORS.muted,
    marginTop: 12,
    fontFamily: FONTS.body,
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
  },
  rowWeek: {
    paddingVertical: 10,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: {
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
    color: COLORS.accent,
  },
  weekDotBtn: {
    width: 28,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekDot: {
    fontSize: 18,
  },
  habitTextCol: {
    flex: 1,
    minWidth: 0,
  },
  habitTitle: {
    color: COLORS.text,
    fontSize: 16,
  },
  habitTitleDone: {
    opacity: 0.55,
  },
  habitSubtitle: {
    color: COLORS.muted,
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
    color: COLORS.bg,
    fontSize: 11,
    fontWeight: '700',
  },
  actionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  actionCheck: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, marginRight: 12, alignItems: 'center', justifyContent: 'center' },
  actionCheckInner: { width: 10, height: 10, borderRadius: 5 },
  actionContent: { flex: 1 },
  actionTitle: { fontSize: 15, fontFamily: FONTS.body, color: COLORS.text, marginBottom: 2 },
  actionMeta: { fontSize: 12, fontFamily: FONTS.body },
  emptySubtext: { fontSize: 13, fontFamily: FONTS.body, color: COLORS.muted, marginTop: 4 },
});
