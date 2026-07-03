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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, AREA_COLORS } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { calculateLoggingStreak, getStreakMilestone } from '../lib/streak';
import LifeWheelCompact from '../components/LifeWheelCompact';
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

const MILESTONE_MESSAGES = {
  7: 'A week of showing up.',
  30: 'Thirty days of evidence.',
  100: 'One hundred days logged.',
};

const STREAK_WARM = '#f97316';

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
  const [isTodayLogged, setIsTodayLogged] = useState(false);
  const [showMilestoneCelebration, setShowMilestoneCelebration] = useState(false);
  const [toggleBusyId, setToggleBusyId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [tasksDueToday, setTasksDueToday] = useState([]);
  const [tasksDueThisWeek, setTasksDueThisWeek] = useState([]);
  const [showGraceCard, setShowGraceCard] = useState(false);
  const confirmationSlide = useRef(new Animated.Value(120)).current;
  const confirmationTimerRef = useRef(null);
  const graceFadeAnim = useRef(new Animated.Value(0)).current;

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

  const activeMilestone = useMemo(() => getStreakMilestone(streak), [streak]);

  const dashboardWheelAreas = useMemo(() => {
    const areas =
      userAreas.length > 0
        ? userAreas
        : [...new Set(habits.map((h) => (h.area || 'general').toLowerCase()))].map(
            (slug) => ({ slug, name: slug, color: getAreaColor(slug) })
          );

    const today = new Date();

    return areas.slice(0, 8).map((ua) => {
      const slug = (ua.slug || ua.area || '').toLowerCase();
      const hasIdentity = userIdentities.some(
        (i) => (i.area_slug || i.area || '').toLowerCase() === slug
      );
      const areaHabits = habits.filter((h) => (h.area || '').toLowerCase() === slug);
      const hasCommitment = areaHabits.length > 0;

      let spokeLengthRatio = 0;
      if (hasIdentity && hasCommitment) spokeLengthRatio = 1.0;
      else if (hasIdentity) spokeLengthRatio = 0.5;

      const habitIds = new Set(areaHabits.map((h) => h.id));
      let mostRecent = null;
      for (const c of weekCompletions) {
        if (habitIds.has(c.habit_id)) {
          const d = String(c.completed_date).slice(0, 10);
          if (!mostRecent || d > mostRecent) mostRecent = d;
        }
      }

      let vibrancy = hasIdentity ? 0.4 : 0.15;
      if (mostRecent) {
        const diff =
          (today - new Date(`${mostRecent}T12:00:00`)) / (1000 * 60 * 60 * 24);
        if (diff <= 30) vibrancy = 1.0;
        else if (diff <= 60) vibrancy = 0.5;
        else vibrancy = 0.2;
      }

      const identityRow = userIdentities.find(
        (i) => (i.area_slug || i.area || '').toLowerCase() === slug
      );

      return {
        slug,
        name: ua.name || slug,
        color: ua.color || getAreaColor(slug),
        spokeLengthRatio,
        vibrancy,
        identityStatement: identityRow?.statement
          ? `I am someone who ${identityRow.statement}`
          : null,
      };
    });
  }, [userAreas, userIdentities, habits, weekCompletions]);

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

  const recalcStreak = useCallback(async (uid) => {
    const { currentStreak, isTodayLogged: loggedToday } =
      await calculateLoggingStreak(uid);
    setStreak(currentStreak);
    setIsTodayLogged(loggedToday);

    const milestone = getStreakMilestone(currentStreak);
    if (milestone) {
      const storageKey = `streak_milestone_${milestone}_${todayKey}`;
      const alreadyShown = await AsyncStorage.getItem(storageKey);
      setShowMilestoneCelebration(!alreadyShown);
      if (!alreadyShown) {
        await AsyncStorage.setItem(storageKey, '1');
      }
    } else {
      setShowMilestoneCelebration(false);
    }

    return { currentStreak, isTodayLogged: loggedToday };
  }, [todayKey]);

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
      setIsTodayLogged(false);
      setShowMilestoneCelebration(false);
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

    await recalcStreak(uid);
    setLoading(false);
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
            {isTodayLogged ? (
              <Text style={styles.loggedStatusLine}>
                Today&apos;s evidence: logged ✓
              </Text>
            ) : null}

            <View
              style={[
                styles.streakLineWrap,
                showMilestoneCelebration && styles.streakLineWrapMilestone,
              ]}>
              <View style={styles.streakLineRow}>
                <Ionicons
                  name="flame"
                  size={showMilestoneCelebration ? 24 : 20}
                  color={STREAK_WARM}
                  style={styles.streakFlameIcon}
                />
                <Text
                  style={[
                    styles.streakLineText,
                    showMilestoneCelebration && styles.streakLineTextMilestone,
                  ]}>
                  {streak === 1 ? '1 day showing up' : `${streak} days showing up`}
                </Text>
              </View>
              {showMilestoneCelebration && activeMilestone ? (
                <Text style={styles.streakMilestoneNote}>
                  ✦ {MILESTONE_MESSAGES[activeMilestone]}
                </Text>
              ) : null}
            </View>

            <View style={styles.lifeWheelSection}>
              <Text style={styles.lifeWheelSectionTitle}>Life wheel</Text>
              <LifeWheelCompact areas={dashboardWheelAreas} />
            </View>

            <View style={styles.secondarySection}>
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
            </View>
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
    fontSize: 20,
    fontWeight: '300',
    color: COLORS.text,
    marginBottom: 10,
  },
  playfairSectionHeadingFont: {
    fontFamily: 'PlayfairDisplay_300Light',
  },
  loaderWrap: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  secondarySection: {
    marginTop: 8,
    opacity: 0.92,
  },
  loggedStatusLine: {
    fontSize: 14,
    color: COLORS.mutedLight,
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 8,
  },
  streakLineWrap: {
    alignItems: 'center',
    marginBottom: 6,
    marginTop: 0,
    paddingVertical: 2,
  },
  streakLineWrapMilestone: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: 'rgba(167, 139, 250, 0.06)',
    shadowColor: '#a78bfa',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 4,
  },
  streakLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakFlameIcon: {
    marginRight: 8,
  },
  streakLineText: {
    fontSize: 18,
    color: STREAK_WARM,
    fontFamily: FONTS.bodyMedium,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  streakLineTextMilestone: {
    fontSize: 22,
    color: STREAK_WARM,
    fontFamily: 'PlayfairDisplay_300Light',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  streakMilestoneNote: {
    marginTop: 6,
    fontSize: 13,
    color: COLORS.mutedLight,
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  lifeWheelSection: {
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 0,
    opacity: 0.85,
  },
  lifeWheelSectionTitle: {
    fontSize: 9,
    letterSpacing: 2,
    color: COLORS.muted,
    textTransform: 'uppercase',
    fontFamily: FONTS.bodyMedium,
    marginBottom: 0,
    alignSelf: 'flex-start',
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
