import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, FONTS, AREA_COLORS } from '../constants/theme';
import { supabase } from '../lib/supabase';
import Svg, { Polygon } from 'react-native-svg';

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

function computeHabitsForTodayRate(habits, weekRows, todayKey) {
  const weekCountMap = buildWeekCountMap(weekRows);
  const dueToday = habits.filter((h) => isDueToday(h, weekCountMap, todayKey));
  const weekHabits = [];
  for (const h of habits) {
    if (!isOnOrAfterCreated(h, todayKey)) continue;
    const freq = (h.frequency || 'daily').toLowerCase();
    if (isDueToday(h, weekCountMap, todayKey)) continue;
    if (freq === 'xperweek' || freq === 'weekly') {
      weekHabits.push(h);
    }
  }
  return [...dueToday, ...weekHabits];
}

function buildMorningInsightPrompt({
  streakVal,
  todayCount,
  totalToday,
  topArea,
  identityStatement,
}) {
  return `You are Meridian, a warm life companion. Write exactly 2 warm sentences for someone who has a ${streakVal}-day streak, showed up ${todayCount} of ${totalToday} times today, their top area is ${topArea}, and one of their identity statements is: ${identityStatement}. Be personal and specific to their day. Never end with a general statement about identity or who they are. Just be warm and encouraging about their actual day.`;
}

function buildFallbackMorningInsight({
  streakVal,
  todayCount,
  totalToday,
  topArea,
  identityStatement,
}) {
  const areaLabel = topArea.replace(/^\w/, (c) => c.toUpperCase());
  if (todayCount > 0) {
    return `You are someone who shows up — ${todayCount} of ${totalToday} commitments today, and a ${streakVal}-day streak that reflects who you already are. Your ${areaLabel} life is part of how you live as someone who ${identityStatement}.`;
  }
  return `You are someone with a ${streakVal}-day practice of returning to what matters. Today in ${areaLabel} is another chance to live as someone who ${identityStatement}.`;
}

function parseAnthropicResponse(rawData) {
  let data = rawData;
  if (typeof rawData === 'string') {
    try {
      data = JSON.parse(rawData);
    } catch {
      return rawData.trim();
    }
  }
  if (typeof data?.content?.[0]?.text === 'string') {
    return data.content[0].text.trim();
  }
  if (typeof data?.result === 'string') return data.result.trim();
  if (typeof data?.text === 'string') return data.text.trim();
  return '';
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

function formatIdentityConfirmation(statement) {
  if (!statement || !String(statement).trim()) {
    return "You showed up. That's who you are.";
  }
  let text = String(statement).trim();
  const prefix = /^I am someone who\s+/i;
  if (prefix.test(text)) {
    text = text.replace(prefix, '');
  }
  return `You showed up as someone who ${text}`;
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

function MeridianLogoSmall({ size = 32 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Polygon
        points="20,4 36,34 20,28 4,34"
        fill="none"
        stroke="#a78bfa"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Polygon
        points="20,4 28,34 20,28 12,34"
        fill="#a78bfa"
        fillOpacity={0.3}
        stroke="none"
      />
    </Svg>
  );
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
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const [habits, setHabits] = useState([]);
  const [userAreas, setUserAreas] = useState([]);
  const [userIdentities, setUserIdentities] = useState([]);
  const [identityMap, setIdentityMap] = useState({});
  const [confirmationMessage, setConfirmationMessage] = useState(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [todayByHabit, setTodayByHabit] = useState(() => new Map());
  const [weekCompletions, setWeekCompletions] = useState([]);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [toggleBusyId, setToggleBusyId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [tasksDueToday, setTasksDueToday] = useState([]);
  const [tasksDueThisWeek, setTasksDueThisWeek] = useState([]);
  const [showGraceCard, setShowGraceCard] = useState(false);
  const [morningInsight, setMorningInsight] = useState('');
  const [insightLoading, setInsightLoading] = useState(true);
  const [showMilestone, setShowMilestone] = useState(false);
  const [milestoneText, setMilestoneText] = useState('');
  const [milestoneSubtext, setMilestoneSubtext] = useState('');
  const confirmationSlide = useRef(new Animated.Value(120)).current;
  const confirmationTimerRef = useRef(null);
  const graceFadeAnim = useRef(new Animated.Value(0)).current;
  const milestoneAnim = useRef(new Animated.Value(0)).current;

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

  const dismissConfirmation = useCallback(() => {
    Animated.timing(confirmationSlide, {
      toValue: 120,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setShowConfirmation(false);
      setConfirmationMessage(null);
    });
  }, [confirmationSlide]);

  const showIdentityConfirmationBanner = useCallback(
    (message) => {
      if (confirmationTimerRef.current) {
        clearTimeout(confirmationTimerRef.current);
      }
      setConfirmationMessage(message);
      setShowConfirmation(true);
      confirmationSlide.setValue(120);
      Animated.spring(confirmationSlide, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
      confirmationTimerRef.current = setTimeout(() => {
        dismissConfirmation();
      }, 2500);
    },
    [confirmationSlide, dismissConfirmation]
  );

  useEffect(() => {
    return () => {
      if (confirmationTimerRef.current) {
        clearTimeout(confirmationTimerRef.current);
      }
    };
  }, []);

  const openGraceCard = useCallback(() => {
    setShowGraceCard(true);
    graceFadeAnim.setValue(0);
    Animated.timing(graceFadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [graceFadeAnim]);

  const closeGraceCard = useCallback(() => {
    setShowGraceCard(false);
    graceFadeAnim.setValue(0);
  }, [graceFadeAnim]);

  const checkStreakMilestone = (streakCount) => {
    const milestones = {
      7: {
        text: '7 Days Showing Up',
        subtext: 'A week of evidence. This is who you are.',
      },
      21: {
        text: '21 Days Showing Up',
        subtext: 'Three weeks of proof. Your identity is clear.',
      },
      66: {
        text: '66 Days Showing Up',
        subtext: 'This is no longer a habit. It is simply you.',
      },
      100: {
        text: '100 Days Showing Up',
        subtext: 'One hundred days of being exactly who you said you were.',
      },
    };

    if (milestones[streakCount]) {
      setMilestoneText(milestones[streakCount].text);
      setMilestoneSubtext(milestones[streakCount].subtext);
      setShowMilestone(true);
      Animated.sequence([
        Animated.timing(milestoneAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.delay(3000),
        Animated.timing(milestoneAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start(() => setShowMilestone(false));
    }
  };

  const fetchMorningInsight = async ({
    streakVal,
    todayCount,
    totalToday,
    topArea,
    identityStatement,
  }) => {
    const insightParams = {
      streakVal,
      todayCount,
      totalToday,
      topArea,
      identityStatement,
    };
    const fallback = buildFallbackMorningInsight(insightParams);

    try {
      setInsightLoading(true);
      const prompt = buildMorningInsightPrompt(insightParams);

      const { data, error: invokeError } = await supabase.functions.invoke(
        'anthropic',
        {
          body: {
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 200,
            messages: [{ role: 'user', content: prompt }],
          },
        }
      );

      if (invokeError) {
        console.log('Insight fetch error:', invokeError);
        setMorningInsight(fallback);
      } else {
        const text = data?.content?.[0]?.text ?? null;
        setMorningInsight(text || fallback);
      }
    } catch (e) {
      console.log('Insight fetch error:', e);
      setMorningInsight(fallback);
    } finally {
      setInsightLoading(false);
    }
  };

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
    const streakVal = computeShowUpStreak(datesWithActivity);
    const bestVal = computeBestStreak(datesWithActivity);
    setStreak(streakVal);
    checkStreakMilestone(streakVal);
    setBestStreak(bestVal);
    return { streak: streakVal, bestStreak: bestVal };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      setUserId(null);
      setHabits([]);
      setUserAreas([]);
      setUserIdentities([]);
      setIdentityMap({});
      setTodayByHabit(new Map());
      setWeekCompletions([]);
      setStreak(0);
      checkStreakMilestone(0);
      setBestStreak(0);
      setInsightLoading(false);
      setLoading(false);
      return;
    }
    const uid = userData.user.id;
    setUserId(uid);
    setInsightLoading(true);

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

    const habitsList = habitsData ?? [];
    const todayMap = new Map();
    for (const row of todayRows ?? []) {
      todayMap.set(row.habit_id, row.completion_type || 'completed');
    }
    const habitsForToday = computeHabitsForTodayRate(
      habitsList,
      weekRows ?? [],
      todayStr
    );
    const todayCount = habitsForToday.filter((h) => todayMap.has(h.id)).length;
    const totalToday = habitsForToday.length;
    const identities = identitiesData ?? [];
    const topArea = identities[0]?.area_slug || 'life';
    const identityStatement =
      identities[0]?.statement || 'they are building a meaningful life';

    setTodayByHabit(todayMap);
    setWeekCompletions(weekRows ?? []);
    setUserAreas(areasData ?? []);
    setUserIdentities(identitiesData ?? []);
    const idMap = {};
    for (const row of identitiesData ?? []) {
      const slug = (row.area_slug || row.area || '').toLowerCase();
      if (slug && row.statement) {
        idMap[slug] = row.statement;
      }
    }
    setIdentityMap(idMap);

    const allTasks = tasksData || [];
    setTasksDueToday(allTasks.filter(t => t.due_date <= todayStr));
    setTasksDueThisWeek(allTasks.filter(t => t.due_date > todayStr));

    const { streak: streakVal } = await recalcStreak(uid);
    setLoading(false);
    fetchMorningInsight({
      streakVal,
      todayCount,
      totalToday,
      topArea,
      identityStatement,
    });
  }, [recalcStreak]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

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
        if (completionType === 'life_happens') {
          openGraceCard();
        }
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
      const habit = habits.find((h) => h.id === habitId);
      const areaKey = (habit?.area || '').toLowerCase();
      const statement = areaKey ? identityMap[areaKey] : null;
      showIdentityConfirmationBanner(formatIdentityConfirmation(statement));
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
      {showMilestone && (
        <Animated.View style={{
          position: 'absolute',
          top: 80,
          left: 24,
          right: 24,
          zIndex: 999,
          backgroundColor: '#1a1628',
          borderRadius: 20,
          padding: 24,
          alignItems: 'center',
          borderWidth: 1,
          borderColor: '#a78bfa',
          shadowColor: '#a78bfa',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.4,
          shadowRadius: 20,
          elevation: 10,
          opacity: milestoneAnim,
          transform: [{
            translateY: milestoneAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [-20, 0],
            }),
          }],
        }}>
          <Text style={{
            fontSize: 28,
            marginBottom: 8,
          }}>✦</Text>
          <Text style={{
            fontSize: 22,
            color: '#f5f3ff',
            fontFamily: 'PlayfairDisplay_300Light',
            textAlign: 'center',
            marginBottom: 8,
          }}>{milestoneText}</Text>
          <Text style={{
            fontSize: 14,
            color: '#a78bfa',
            fontFamily: 'DMSans_400Regular',
            textAlign: 'center',
            lineHeight: 22,
          }}>{milestoneSubtext}</Text>
        </Animated.View>
      )}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#a78bfa"
            colors={['#a78bfa']}
          />
        }>
        <View style={styles.meridianHeader}>
          <View style={styles.meridianLogoRow}>
            <Svg width={28} height={28} viewBox="0 0 40 40">
              <Polygon
                points="20,4 36,34 20,28 4,34"
                fill="none"
                stroke="#a78bfa"
                strokeWidth={2}
                strokeLinejoin="round"
              />
              <Polygon
                points="20,4 28,34 20,28 12,34"
                fill="#a78bfa"
                fillOpacity={0.3}
                stroke="none"
              />
            </Svg>
            <View style={styles.meridianWordmark}>
              <Text style={styles.meridianName}>Meridian</Text>
              <Text style={styles.meridianTagline}>LIVE YOUR VALUES</Text>
            </View>
          </View>
        </View>

        {loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator color={COLORS.accent} size={32} />
          </View>
        ) : (
          <>
            <View style={styles.morningInsightCard}>
              <Text style={styles.morningInsightLabel}>
                YOUR MORNING INSIGHT
              </Text>
              {insightLoading ? (
                <Text style={styles.morningInsightLoadingText}>
                  Reflecting on your morning...
                </Text>
              ) : (
                <Text style={styles.morningInsightText}>{morningInsight}</Text>
              )}
            </View>

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
      {showConfirmation && confirmationMessage ? (
        <Animated.View
          style={[
            styles.confirmationBanner,
            {
              bottom: 64 + insets.bottom,
              transform: [{ translateY: confirmationSlide }],
            },
          ]}
          pointerEvents="none">
          <Text style={styles.confirmationText}>
            <Text style={styles.confirmationCheck}>✦ </Text>
            {confirmationMessage}
          </Text>
        </Animated.View>
      ) : null}
      <Modal
        visible={showGraceCard}
        transparent
        animationType="none"
        onRequestClose={closeGraceCard}>
        <Animated.View style={[styles.graceOverlay, { opacity: graceFadeAnim }]}>
          <View style={styles.graceCard}>
            <View style={styles.graceLogoWrap}>
              <MeridianLogoSmall size={32} />
            </View>
            <Text style={styles.graceHeadline}>
              Your worth isn&apos;t in your streak.
            </Text>
            <Text style={styles.graceBody}>
              Life happened today. That doesn&apos;t change who you are — it
              proves you&apos;re human. Tomorrow you show up again, not to earn
              your place, but because this is who you are.
            </Text>
            <TouchableOpacity
              style={styles.graceButton}
              onPress={closeGraceCard}
              accessibilityRole="button"
              accessibilityLabel="Life happens">
              <Text style={styles.graceButtonText}>Life happens</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Modal>
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
  meridianHeader: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8, alignItems: 'center' },
  meridianLogoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  meridianWordmark: { flexDirection: 'column' },
  meridianName: { fontSize: 22, fontFamily: 'PlayfairDisplay_300Light', color: COLORS.text, letterSpacing: 0.5 },
  meridianTagline: { fontSize: 8, fontFamily: 'DMSans_500Medium', color: COLORS.muted, letterSpacing: 3, marginTop: 1 },
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
    fontWeight: '300',
    color: COLORS.text,
    marginBottom: 12,
  },
  playfairSectionHeadingFont: {
    fontFamily: 'PlayfairDisplay_300Light',
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
  morningInsightCard: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.accent,
    zIndex: 2,
    elevation: 2,
  },
  morningInsightLabel: {
    fontSize: 10,
    letterSpacing: 2,
    color: COLORS.accent,
    marginBottom: 8,
    fontFamily: FONTS.bodyMedium,
  },
  morningInsightText: {
    fontSize: 15,
    color: COLORS.text,
    fontStyle: 'italic',
    fontFamily: FONTS.body,
    lineHeight: 24,
  },
  morningInsightLoadingText: {
    fontSize: 14,
    color: COLORS.muted,
    fontStyle: 'italic',
    fontFamily: FONTS.body,
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
  confirmationBanner: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: '#1a1628',
    borderLeftWidth: 4,
    borderLeftColor: '#a78bfa',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    zIndex: 100,
  },
  confirmationText: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    lineHeight: 20,
  },
  confirmationCheck: {
    color: '#a78bfa',
  },
  graceOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  graceCard: {
    backgroundColor: '#1a1628',
    borderRadius: 24,
    padding: 32,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  graceLogoWrap: {
    marginBottom: 8,
  },
  graceHeadline: {
    fontFamily: 'PlayfairDisplay_300Light',
    fontSize: 26,
    color: '#ffffff',
    textAlign: 'center',
  },
  graceBody: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    color: '#c4b5fd',
    textAlign: 'center',
    lineHeight: 24,
    marginTop: 12,
  },
  graceButton: {
    width: '100%',
    backgroundColor: '#a78bfa',
    borderRadius: 12,
    padding: 16,
    marginTop: 28,
  },
  graceButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f0d1a',
    textAlign: 'center',
  },
});
