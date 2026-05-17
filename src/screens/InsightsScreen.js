import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import MeridianWordmark from '../components/MeridianWordmark';
import { useAppNavigation } from '../navigation/AppNavigationContext';
import Svg, { Polygon, Circle, Text as SvgText, Line } from 'react-native-svg';

const AREA_COLORS = {
  health: '#4ade80',
  finance: '#facc15',
  career: '#60a5fa',
  relationships: '#f472b6',
  growth: '#c084fc',
  recreation: '#fb923c',
  spirituality: '#38bdf8',
};

const AREA_ICONS = {
  health: '💚',
  finance: '💰',
  career: '💼',
  relationships: '💕',
  growth: '🌱',
  recreation: '🎯',
  spirituality: '✨',
};

const MEDALS = ['🥇', '🥈', '🥉'];

const GAP = 2;

const HEATMAP_COLORS = {
  none: '#1e1e3f',
  low: '#1a1a2e',
  midLow: '#1e1e3f',
  midHigh: '#2d2b6b',
  high: '#6366f1',
};

const TIMEFRAME_OPTIONS = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
  { label: '1 year', days: 365 },
];

function formatLocalDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDateKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function habitCreatedDateKey(habit) {
  return String(habit.created_at).slice(0, 10);
}

function getWeeklyDueDay(habit) {
  if (habit.weekly_due_day != null) {
    return habit.weekly_due_day;
  }
  return new Date(habit.created_at).getDay();
}

function getMondayOfWeek(d) {
  const x = new Date(d);
  const dow = x.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function getMondayKey(dateKey) {
  return formatLocalDateKey(getMondayOfWeek(parseDateKey(dateKey)));
}

function weekCountUpTo(habitId, dateKey, completions) {
  const monday = getMondayKey(dateKey);
  let n = 0;
  for (const row of completions) {
    const d = String(row.completed_date).slice(0, 10);
    if (row.habit_id === habitId && d >= monday && d <= dateKey) {
      n += 1;
    }
  }
  return n;
}

function isHabitDueOnDate(habit, dateKey, completions) {
  if (dateKey < habitCreatedDateKey(habit)) return false;

  const d = parseDateKey(dateKey);
  const dow = d.getDay();
  const freq = (habit.frequency || 'daily').toLowerCase();

  switch (freq) {
    case 'daily':
      return true;
    case 'weekdays':
      return dow >= 1 && dow <= 5;
    case 'weekly':
      return dow === getWeeklyDueDay(habit);
    case 'xperweek': {
      const target = habit.frequency_count ?? 1;
      return weekCountUpTo(habit.id, dateKey, completions) < target;
    }
    default:
      return true;
  }
}

function completionsOnDate(completions, dateKey) {
  const set = new Set();
  for (const row of completions) {
    if (String(row.completed_date).slice(0, 10) === dateKey) {
      set.add(row.habit_id);
    }
  }
  return set;
}

function getDayScore(habits, completions, dateKey, todayKey) {
  if (dateKey > todayKey) return null;

  const dueHabits = habits.filter((h) =>
    isHabitDueOnDate(h, dateKey, completions)
  );
  if (dueHabits.length === 0) return null;

  const doneSet = completionsOnDate(completions, dateKey);
  const completed = dueHabits.filter((h) => doneSet.has(h.id)).length;
  return Math.round((completed / dueHabits.length) * 100);
}

function heatmapColor(pct) {
  if (pct == null) return HEATMAP_COLORS.none;
  if (pct < 25) return HEATMAP_COLORS.low;
  if (pct < 50) return HEATMAP_COLORS.midLow;
  if (pct < 75) return HEATMAP_COLORS.midHigh;
  return HEATMAP_COLORS.high;
}

function computeShowUpStreak(dateKeysWithActivity) {
  let d = new Date();
  const todayKey = formatLocalDateKey(d);
  if (!dateKeysWithActivity.has(todayKey)) {
    d = addDays(d, -1);
  }
  let streak = 0;
  while (dateKeysWithActivity.has(formatLocalDateKey(d))) {
    streak += 1;
    d = addDays(d, -1);
  }
  return streak;
}

function computeHabitStreak(habitId, completions, todayKey) {
  let d = parseDateKey(todayKey);
  const todayDone = completions.some(
    (r) =>
      r.habit_id === habitId &&
      String(r.completed_date).slice(0, 10) === todayKey
  );
  if (!todayDone) {
    d = addDays(d, -1);
  }
  let streak = 0;
  while (true) {
    const key = formatLocalDateKey(d);
    const done = completions.some(
      (r) =>
        r.habit_id === habitId &&
        String(r.completed_date).slice(0, 10) === key
    );
    if (!done) break;
    streak += 1;
    d = addDays(d, -1);
  }
  return streak;
}

function getLastNDayKeys(todayKey, n) {
  const keys = [];
  let d = parseDateKey(todayKey);
  for (let i = 0; i < n; i++) {
    keys.push(formatLocalDateKey(d));
    d = addDays(d, -1);
  }
  return keys;
}

function getHeatmapWeeksGrid(todayKey, numDays) {
  const today = parseDateKey(todayKey);
  const rangeStart = addDays(today, -(numDays - 1));
  const startMonday = getMondayOfWeek(rangeStart);
  const endMonday = getMondayOfWeek(today);
  const weeks = [];
  let weekStart = startMonday;

  while (weekStart <= endMonday) {
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push(addDays(weekStart, i));
    }
    weeks.push({ weekStart: new Date(weekStart), days });
    weekStart = addDays(weekStart, 7);
  }
  return weeks;
}

function weekLabel(d) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const MAX_HABITS_PER_AREA = 4;

function hexToRgba(hex, opacity) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

function completionOpacity(rate) {
  if (rate === 0) return 0.2;
  if (rate < 50) return 0.5;
  if (rate < 75) return 0.75;
  return 1;
}

function getIdentityStatement(identity) {
  return (
    identity.statement ||
    identity.identity_statement ||
    identity.text ||
    identity.content ||
    ''
  );
}

function getIdentityPeriodLabel(selectedDays) {
  if (selectedDays === 7) return 'this week';
  if (selectedDays === 30) return 'this month';
  if (selectedDays === 90) return 'this quarter';
  return 'this year';
}

function relativeCompletionDate(dateKey, todayKey) {
  const today = parseDateKey(todayKey);
  const d = parseDateKey(dateKey);
  const diffDays = Math.round((today - d) / 86400000);
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays <= 7) return `${diffDays} days ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function SectionTitle({ children }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function HeroStatCard({ emoji, value, label }) {
  return (
    <View style={styles.heroCard}>
      {emoji ? <Text style={styles.heroEmoji}>{emoji}</Text> : null}
      <Text style={styles.heroValue}>{value}</Text>
      <Text style={styles.heroLabel}>{label}</Text>
    </View>
  );
}

function LifeWheel({ areas, areasCovered, selectedArea, onSelectArea }) {
  const cx = 150;
  const cy = 150;
  const maxRadius = 90;
  const totalAreas = areas.length;

  if (totalAreas === 0) {
    return (
      <Text style={styles.lifeWheelEmpty}>Add life areas to see your wheel</Text>
    );
  }

  const spokes = areas.map((area, index) => {
    const angle = (index / totalAreas) * 2 * Math.PI - Math.PI / 2;
    const r = area.spokeLengthRatio * maxRadius;
    const scoreX = cx + r * Math.cos(angle);
    const scoreY = cy + r * Math.sin(angle);
    const edgeX = cx + maxRadius * Math.cos(angle);
    const edgeY = cy + maxRadius * Math.sin(angle);
    const labelR = maxRadius + 38;
    const labelX = cx + labelR * Math.cos(angle);
    const labelY = cy + labelR * Math.sin(angle);
    const colorOpacity = completionOpacity(area.completionRate);
    const dotColor = hexToRgba(area.color, colorOpacity);
    const labelColor = area.isEmpty
      ? '#ffffff25'
      : hexToRgba(area.color, colorOpacity);
    return {
      ...area,
      angle,
      scoreX,
      scoreY,
      edgeX,
      edgeY,
      labelX,
      labelY,
      dotColor,
      labelColor,
    };
  });

  const polygonPoints = spokes.map((p) => `${p.scoreX},${p.scoreY}`).join(' ');

  return (
    <View style={styles.lifeWheelSvgWrap}>
      <Svg width={300} height={300} viewBox="0 0 300 300">
        {[0.25, 0.5, 0.75, 1].map((pct) => (
          <Circle
            key={pct}
            cx={cx}
            cy={cy}
            r={maxRadius * pct}
            stroke="#ffffff08"
            strokeWidth={1}
            fill="none"
          />
        ))}
        {spokes.map((p) => (
          <Line
            key={`spoke-${p.key}`}
            x1={cx}
            y1={cy}
            x2={p.edgeX}
            y2={p.edgeY}
            stroke={
              selectedArea === p.key
                ? hexToRgba(p.color, 0.6)
                : '#ffffff10'
            }
            strokeWidth={selectedArea === p.key ? 2 : 1}
          />
        ))}
        <Polygon
          points={polygonPoints}
          fill="#6366f1"
          fillOpacity={0.3}
        />
        <Polygon
          points={polygonPoints}
          fill="none"
          stroke="#6366f1"
          strokeWidth={2}
        />
        {spokes.map(
          (p) =>
            !p.isEmpty ? (
              <Circle
                key={`dot-${p.key}`}
                cx={p.scoreX}
                cy={p.scoreY}
                r={selectedArea === p.key ? 8 : 6}
                fill={p.dotColor}
              />
            ) : null
        )}
        {spokes.map((p) => {
          const textAnchor =
            p.labelX < cx - 60
              ? 'start'
              : p.labelX > cx + 60
                ? 'end'
                : 'middle';
          return (
            <SvgText
              key={`label-${p.key}`}
              x={p.labelX}
              y={p.labelY}
              fontSize={10}
              fill={p.labelColor}
              textAnchor={textAnchor}
              alignmentBaseline="middle">
              {p.name}
            </SvgText>
          );
        })}
        <SvgText
          x={cx}
          y={cy - 4}
          fontSize={22}
          fontWeight="600"
          fill="#6366f1"
          textAnchor="middle">
          {`${areasCovered.covered}/${areasCovered.total}`}
        </SvgText>
        <SvgText
          x={cx}
          y={cy + 16}
          fontSize={10}
          fill="#ffffff50"
          textAnchor="middle">
          areas covered
        </SvgText>
      </Svg>
      {spokes.map((p) => (
        <React.Fragment key={`touch-${p.key}`}>
          {!p.isEmpty ? (
            <TouchableOpacity
              style={[
                styles.lifeWheelTouchDot,
                { left: p.scoreX - 18, top: p.scoreY - 18 },
              ]}
              onPress={() => onSelectArea(p.key)}
              activeOpacity={0.7}
            />
          ) : null}
          <TouchableOpacity
            style={[
              styles.lifeWheelTouchLabel,
              { left: p.labelX - 44, top: p.labelY - 14 },
            ]}
            onPress={() => onSelectArea(p.key)}
            activeOpacity={0.7}
          />
        </React.Fragment>
      ))}
    </View>
  );
}

function WhoIAmRow({ row }) {
  return (
    <View
      style={[styles.identityRow, { borderLeftColor: row.areaColor }]}>
      <Text style={styles.identityStatement}>{row.statement}</Text>
      {row.hasActivity ? (
        <>
          <Text style={styles.identityEvidence}>
            You showed up{' '}
            <Text style={styles.identityEvidenceCount}>{row.count}</Text>
            {row.count >= 5 ? (
              <Text style={styles.identityEvidenceStar}> ✦</Text>
            ) : null}
            {` times ${row.periodLabel}`}
          </Text>
          <Text style={styles.identityRecent}>
            Most recent: {relativeCompletionDate(row.mostRecent.date, row.todayKey)}
            {' · '}
            {row.mostRecent.title}
          </Text>
        </>
      ) : (
        <Text style={styles.identityNoActivity}>
          No activity yet {row.periodLabel}
        </Text>
      )}
    </View>
  );
}

export default function InsightsScreen() {
  const { openLegacy, openSettings } = useAppNavigation();
  const screenWidth = Dimensions.get('window').width;
  const squareSize = Math.floor((screenWidth - 120) / 7) - 4;
  const squareGap = 2;
  const rowSquaresWidth = squareSize * 7 + squareGap * 6;
  console.log('HEATMAP', { screenWidth, squareSize, total: squareSize * 7 });
  const rowHeight = squareSize + 4;
  const visibleWeeks = 4;
  const heatmapHeight = rowHeight * visibleWeeks;

  const scrollRef = useRef(null);
  const mainScrollRef = useRef(null);
  const byAreaSectionY = useRef(0);
  const areaRowOffsets = useRef({});
  const todayKey = useMemo(() => formatLocalDateKey(new Date()), []);

  const [loading, setLoading] = useState(true);
  const [habits, setHabits] = useState([]);
  const [completions, setCompletions] = useState([]);
  const [userAreas, setUserAreas] = useState([]);
  const [userIdentities, setUserIdentities] = useState([]);
  const [selectedArea, setSelectedArea] = useState(null);
  const [selectedDays, setSelectedDays] = useState(30);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData?.user?.id;
    if (!uid) {
      setHabits([]);
      setCompletions([]);
      setUserAreas([]);
      setUserIdentities([]);
      setLoading(false);
      return;
    }

    const since365 = formatLocalDateKey(addDays(new Date(), -364));

    const [
      { data: habitsData },
      { data: completionData },
      { data: areasData },
      { data: identitiesData },
    ] = await Promise.all([
      supabase
        .from('habits')
        .select('*')
        .eq('user_id', uid)
        .eq('status', 'active'),
      supabase
        .from('habit_completions')
        .select('*')
        .eq('user_id', uid)
        .gte('completed_date', since365)
        .lte('completed_date', todayKey),
      supabase.from('user_areas').select('*').eq('user_id', uid),
      supabase.from('user_identities').select('*').eq('user_id', uid),
    ]);

    setHabits(habitsData ?? []);
    setCompletions(completionData ?? []);
    setUserAreas(areasData ?? []);
    setUserIdentities(identitiesData ?? []);
    setLoading(false);
  }, [todayKey]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const rangeKeys = useMemo(
    () => getLastNDayKeys(todayKey, selectedDays),
    [todayKey, selectedDays]
  );

  const rangeStartKey = useMemo(
    () => formatLocalDateKey(addDays(parseDateKey(todayKey), -(selectedDays - 1))),
    [todayKey, selectedDays]
  );

  const timeframeHeroLabel = useMemo(() => {
    if (selectedDays === 7) return 'last 7 days';
    if (selectedDays === 30) return 'last 30 days';
    if (selectedDays === 90) return 'last 90 days';
    return 'last year';
  }, [selectedDays]);

  const timeframeHeatmapLabel = useMemo(() => {
    if (selectedDays === 7) return 'Last 7 days';
    if (selectedDays === 30) return 'Last 30 days';
    if (selectedDays === 90) return 'Last 90 days';
    return 'Last year';
  }, [selectedDays]);

  const dailyScoresRange = useMemo(() => {
    return rangeKeys.map((key) => getDayScore(habits, completions, key, todayKey));
  }, [habits, completions, rangeKeys, todayKey]);

  const currentStreak = useMemo(() => {
    const datesWithActivity = new Set(
      completions.map((r) => String(r.completed_date).slice(0, 10))
    );
    return computeShowUpStreak(datesWithActivity);
  }, [completions]);

  const avgScoreRange = useMemo(() => {
    const scored = dailyScoresRange.filter((p) => p != null);
    if (scored.length === 0) return 0;
    return Math.round(scored.reduce((a, b) => a + b, 0) / scored.length);
  }, [dailyScoresRange]);

  const daysAtTarget = useMemo(() => {
    return dailyScoresRange.filter((p) => p != null && p >= 70).length;
  }, [dailyScoresRange]);

  const heatmapWeeks = useMemo(
    () => getHeatmapWeeksGrid(todayKey, selectedDays),
    [todayKey, selectedDays]
  );

  useEffect(() => {
    if (!loading) {
      scrollRef.current?.scrollToEnd({ animated: false });
    }
  }, [loading, heatmapWeeks, squareSize, selectedDays]);

  const topHabits = useMemo(() => {
    const stats = habits.map((habit) => {
      let dueDays = 0;
      let completedDays = 0;

      for (const key of rangeKeys) {
        if (!isHabitDueOnDate(habit, key, completions)) continue;
        dueDays += 1;
        const doneSet = completionsOnDate(completions, key);
        if (doneSet.has(habit.id)) completedDays += 1;
      }

      const rate =
        dueDays === 0 ? 0 : Math.round((completedDays / dueDays) * 100);
      const streak = computeHabitStreak(habit.id, completions, todayKey);

      return { habit, rate, streak, dueDays };
    });

    return stats
      .filter((s) => s.dueDays > 0)
      .sort((a, b) => b.rate - a.rate || b.streak - a.streak)
      .slice(0, 3);
  }, [habits, completions, rangeKeys, todayKey]);

  const areaStats = useMemo(() => {
    const areas =
      userAreas.length > 0
        ? userAreas
        : [...new Set(habits.map((h) => (h.area || 'general').toLowerCase()))].map(
            (area) => ({ area, name: area })
          );

    return areas.map((ua) => {
      const areaKey = (ua.area || ua.name || '').toLowerCase();
      const areaHabits = habits.filter(
        (h) => (h.area || '').toLowerCase() === areaKey
      );

      let totalDue = 0;
      let totalDone = 0;

      for (const key of rangeKeys) {
        const due = areaHabits.filter((h) =>
          isHabitDueOnDate(h, key, completions)
        );
        if (due.length === 0) continue;
        const doneSet = completionsOnDate(completions, key);
        totalDue += due.length;
        totalDone += due.filter((h) => doneSet.has(h.id)).length;
      }

      const rate =
        totalDue === 0 ? 0 : Math.round((totalDone / totalDue) * 100);

      return {
        key: areaKey,
        name:
          ua.name ||
          ua.display_name ||
          areaKey.replace(/^\w/, (c) => c.toUpperCase()),
        icon: ua.icon || AREA_ICONS[areaKey] || '◆',
        color: ua.color || AREA_COLORS[areaKey] || '#6366f1',
        rate,
        totalDue,
      };
    }).filter((a) => a.totalDue > 0 || userAreas.length > 0)
      .sort((a, b) => b.rate - a.rate);
  }, [userAreas, habits, completions, rangeKeys]);

  const lifeWheelAreas = useMemo(() => {
    const areas =
      userAreas.length > 0
        ? userAreas
        : [...new Set(habits.map((h) => (h.area || 'general').toLowerCase()))].map(
            (area) => ({ area, name: area })
          );

    return areas.slice(0, 7).map((ua) => {
      const areaKey = (ua.area || ua.name || '').toLowerCase();
      const areaHabits = habits.filter(
        (h) => (h.area || '').toLowerCase() === areaKey
      );

      const habitCount = areaHabits.length;
      const spokeLengthRatio =
        habitCount === 0
          ? 0
          : Math.min(habitCount, MAX_HABITS_PER_AREA) / MAX_HABITS_PER_AREA;

      let totalDue = 0;
      let totalDone = 0;

      for (const key of rangeKeys) {
        const due = areaHabits.filter((h) =>
          isHabitDueOnDate(h, key, completions)
        );
        if (due.length === 0) continue;
        const doneSet = completionsOnDate(completions, key);
        totalDue += due.length;
        totalDone += due.filter((h) => doneSet.has(h.id)).length;
      }

      const completionRate =
        totalDue === 0 ? 0 : Math.round((totalDone / totalDue) * 100);

      return {
        key: areaKey,
        name:
          ua.name ||
          ua.display_name ||
          areaKey.replace(/^\w/, (c) => c.toUpperCase()),
        color: ua.color || AREA_COLORS[areaKey] || '#6366f1',
        habitCount,
        spokeLengthRatio,
        completionRate,
        isEmpty: habitCount === 0,
      };
    });
  }, [userAreas, habits, completions, rangeKeys]);

  const lifeWheelAreasCovered = useMemo(() => {
    const total = lifeWheelAreas.length;
    const covered = lifeWheelAreas.filter((a) => a.habitCount > 0).length;
    return { covered, total };
  }, [lifeWheelAreas]);

  const identityRows = useMemo(() => {
    console.log('Identity areas:', userIdentities.map((i) => i.area));
    console.log('Habit areas:', habits.map((h) => h.area));

    const periodLabel = getIdentityPeriodLabel(selectedDays);
    const habitsById = new Map(habits.map((h) => [h.id, h]));
    const areaColorMap = new Map();
    for (const ua of userAreas) {
      const key = ua.area || ua.name || '';
      areaColorMap.set(
        key,
        ua.color || AREA_COLORS[key.toLowerCase()] || '#6366f1'
      );
    }

    return userIdentities.map((identity) => {
      const identityArea = identity.area || '';
      const areaHabitIds = new Set(
        habits
          .filter((h) => (h.area || '') === identityArea)
          .map((h) => h.id)
      );

      const areaCompletions = completions.filter((row) => {
        if (!areaHabitIds.has(row.habit_id)) return false;
        const d = String(row.completed_date).slice(0, 10);
        return d >= rangeStartKey && d <= todayKey;
      });

      const count = areaCompletions.length;

      let mostRecent = null;
      for (const row of areaCompletions) {
        const d = String(row.completed_date).slice(0, 10);
        if (!mostRecent || d > mostRecent.date) {
          const habit = habitsById.get(row.habit_id);
          mostRecent = {
            date: d,
            title: habit?.title || 'Commitment',
          };
        }
      }

      const fullStatement = identity.statement
        ? `I am someone who ${identity.statement}`
        : '';

      return {
        id: identity.id,
        statement: fullStatement,
        areaColor:
          areaColorMap.get(identityArea) ||
          AREA_COLORS[identityArea.toLowerCase()] ||
          '#6366f1',
        count,
        periodLabel,
        mostRecent,
        hasActivity: count > 0,
        todayKey,
      };
    });
  }, [
    userIdentities,
    habits,
    completions,
    userAreas,
    rangeStartKey,
    todayKey,
    selectedDays,
  ]);

  const handleSelectArea = useCallback((key) => {
    setSelectedArea(key);
    const rowY = areaRowOffsets.current[key] ?? 0;
    const targetY = byAreaSectionY.current + rowY - 12;
    mainScrollRef.current?.scrollTo({ y: targetY, animated: true });
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        ref={mainScrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <Text
          style={{
            fontSize: 32,
            fontWeight: '300',
            color: '#ffffff',
            paddingHorizontal: 20,
            paddingTop: 20,
            paddingBottom: 4,
          }}>
          Insights
        </Text>

        <View style={styles.timeframeRow}>
          {TIMEFRAME_OPTIONS.map((option, index) => {
            const isSelected = selectedDays === option.days;
            const isLast = index === TIMEFRAME_OPTIONS.length - 1;
            return (
              <TouchableOpacity
                key={option.days}
                style={[
                  styles.timeframePill,
                  isSelected && styles.timeframePillSelected,
                  isLast && styles.timeframePillLast,
                ]}
                onPress={() => setSelectedDays(option.days)}
                activeOpacity={0.8}>
                <Text
                  style={[
                    styles.timeframePillText,
                    isSelected && styles.timeframePillTextSelected,
                  ]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <MeridianWordmark />

        {loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator color="#6366f1" size={32} />
          </View>
        ) : (
          <>
            <View style={styles.lifeWheelCard}>
              <Text style={styles.lifeWheelTitle}>YOUR LIFE WHEEL</Text>
              <Text style={styles.lifeWheelQuestion}>
                Am I being intentional across all areas of my life?
              </Text>
              <LifeWheel
                areas={lifeWheelAreas}
                areasCovered={lifeWheelAreasCovered}
                selectedArea={selectedArea}
                onSelectArea={handleSelectArea}
              />
              <Text style={styles.lifeWheelLegend}>
                Spoke length = commitments · Color = consistency
              </Text>
            </View>

            <View style={styles.whoIAmSection}>
              <Text style={styles.lifeWheelTitle}>WHO I AM</Text>
              {identityRows.length === 0 ? (
                <View style={styles.identityEmpty}>
                  <Text style={styles.identityEmptyText}>
                    Add identity statements in Settings to see who you are
                    reflected here.
                  </Text>
                  <TouchableOpacity
                    onPress={openSettings}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={styles.identityEmptyLink}>Add identities →</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                identityRows.map((row) => (
                  <WhoIAmRow key={row.id ?? row.statement} row={row} />
                ))
              )}
            </View>

            <View style={styles.heroRow}>
              <HeroStatCard
                emoji="🔥"
                value={String(currentStreak)}
                label="day streak"
              />
              <HeroStatCard
                value={`${avgScoreRange}%`}
                label={timeframeHeroLabel}
              />
              <HeroStatCard
                value={String(daysAtTarget)}
                label="days ≥70%"
              />
            </View>

            <View style={styles.card}>
              <SectionTitle>CONSISTENCY</SectionTitle>
              <Text style={styles.sectionSubtitle}>{timeframeHeatmapLabel}</Text>

              <View style={styles.heatmapWrap}>
                <ScrollView
                  ref={scrollRef}
                  style={{ height: heatmapHeight }}
                  showsVerticalScrollIndicator={false}
                  scrollEnabled={true}
                  nestedScrollEnabled>
                  {heatmapWeeks.map((week) => (
                  <View
                    key={formatLocalDateKey(week.weekStart)}
                    style={[styles.heatmapWeekRow, { height: rowHeight }]}>
                    <Text
                      style={[
                        styles.weekLabel,
                        {
                          height: rowHeight,
                          lineHeight: rowHeight,
                        },
                      ]}>
                      {weekLabel(week.weekStart)}
                    </Text>
                    <View
                      style={{
                        flexDirection: 'row',
                        width: rowSquaresWidth,
                        gap: squareGap,
                        overflow: 'hidden',
                        height: rowHeight,
                      }}>
                      {week.days.map((day) => {
                        const key = formatLocalDateKey(day);
                        const inRange =
                          key >= rangeStartKey && key <= todayKey;
                        const pct = inRange
                          ? getDayScore(
                              habits,
                              completions,
                              key,
                              todayKey
                            )
                          : null;
                        return (
                          <View
                            key={key}
                            style={[
                              styles.heatmapSquare,
                              {
                                width: squareSize,
                                height: squareSize,
                                backgroundColor: heatmapColor(pct),
                              },
                            ]}
                          />
                        );
                      })}
                    </View>
                  </View>
                  ))}
                </ScrollView>
              </View>
            </View>

            <View style={styles.card}>
              <SectionTitle>TOP COMMITMENTS</SectionTitle>
              {topHabits.length === 0 ? (
                <Text style={styles.emptyText}>
                  Complete commitments to see rankings
                </Text>
              ) : (
                topHabits.map((item, index) => (
                  <View key={item.habit.id} style={styles.commitmentRow}>
                    <Text style={styles.medal}>{MEDALS[index]}</Text>
                    <View style={styles.commitmentBody}>
                      <Text style={styles.commitmentTitle} numberOfLines={1}>
                        {item.habit.title}
                      </Text>
                      <Text style={styles.commitmentMeta}>
                        {item.rate}% completion rate
                      </Text>
                      <Text style={styles.commitmentStreak}>
                        🔥 {item.streak} day{item.streak === 1 ? '' : 's'} streak
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>

            <View
              style={styles.card}
              onLayout={(e) => {
                byAreaSectionY.current = e.nativeEvent.layout.y;
              }}>
              <SectionTitle>BY AREA</SectionTitle>
              {areaStats.length === 0 ? (
                <Text style={styles.emptyText}>No area data yet</Text>
              ) : (
                areaStats.map((area) => (
                  <View
                    key={area.key}
                    style={[
                      styles.areaRow,
                      selectedArea === area.key && styles.areaRowSelected,
                    ]}
                    onLayout={(e) => {
                      areaRowOffsets.current[area.key] = e.nativeEvent.layout.y;
                    }}>
                    <Text style={styles.areaIcon}>{area.icon}</Text>
                    <View style={styles.areaBody}>
                      <View style={styles.areaTitleRow}>
                        <Text style={styles.areaName} numberOfLines={1}>
                          {area.name}
                        </Text>
                        <Text style={styles.areaRate}>{area.rate}%</Text>
                      </View>
                      <View style={styles.areaBarTrack}>
                        <View
                          style={[
                            styles.areaBarFill,
                            {
                              width: `${area.rate}%`,
                              backgroundColor: area.color,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>

            <TouchableOpacity style={styles.legacyLink} onPress={openLegacy}>
              <Text style={styles.legacyLinkText}>View Legacy ›</Text>
            </TouchableOpacity>
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
  pageTitle: {
    fontSize: 32,
    fontWeight: '300',
    color: '#ffffff',
    marginTop: 8,
    marginBottom: 16,
  },
  loaderWrap: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  timeframeRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: 12,
    marginBottom: 4,
  },
  timeframePill: {
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
  },
  timeframePillLast: {
    marginRight: 0,
  },
  timeframePillSelected: {
    backgroundColor: '#6366f1',
  },
  timeframePillText: {
    fontSize: 12,
    color: '#ffffff60',
  },
  timeframePillTextSelected: {
    color: '#ffffff',
  },
  lifeWheelCard: {
    backgroundColor: '#0f0f1e',
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 16,
    alignItems: 'center',
  },
  lifeWheelTitle: {
    fontSize: 9,
    letterSpacing: 2,
    color: '#6366f1',
    textTransform: 'uppercase',
    alignSelf: 'flex-start',
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      default: 'monospace',
    }),
  },
  lifeWheelQuestion: {
    fontSize: 14,
    fontWeight: '300',
    fontStyle: 'italic',
    marginTop: 4,
    marginBottom: 16,
    color: '#ffffff80',
    alignSelf: 'flex-start',
  },
  lifeWheelLegend: {
    fontSize: 9,
    color: '#ffffff30',
    textAlign: 'center',
    marginTop: 8,
    alignSelf: 'stretch',
  },
  lifeWheelSvgWrap: {
    width: 300,
    height: 300,
    position: 'relative',
    alignSelf: 'center',
  },
  lifeWheelTouchDot: {
    position: 'absolute',
    width: 36,
    height: 36,
  },
  lifeWheelTouchLabel: {
    position: 'absolute',
    width: 88,
    height: 28,
  },
  lifeWheelEmpty: {
    fontSize: 14,
    color: '#ffffff55',
    paddingVertical: 24,
  },
  whoIAmSection: {
    marginBottom: 16,
    alignSelf: 'stretch',
  },
  identityRow: {
    backgroundColor: '#0f0f1e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderLeftWidth: 3,
  },
  identityStatement: {
    fontSize: 15,
    fontStyle: 'italic',
    fontWeight: '300',
    color: '#ffffff',
    marginBottom: 8,
  },
  identityEvidence: {
    fontSize: 13,
    color: '#ffffff90',
    marginBottom: 4,
  },
  identityEvidenceCount: {
    color: '#ffffff90',
  },
  identityEvidenceStar: {
    color: '#6366f1',
  },
  identityRecent: {
    fontSize: 11,
    color: '#ffffff45',
  },
  identityNoActivity: {
    fontSize: 11,
    color: '#ffffff30',
  },
  identityEmpty: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 12,
  },
  identityEmptyText: {
    fontSize: 13,
    color: '#ffffff55',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 12,
  },
  identityEmptyLink: {
    fontSize: 14,
    color: '#6366f1',
    fontWeight: '500',
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    marginHorizontal: -4,
  },
  heroCard: {
    flex: 1,
    backgroundColor: '#0f0f1e',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  heroEmoji: {
    fontSize: 20,
    marginBottom: 4,
  },
  heroValue: {
    fontSize: 28,
    fontWeight: '600',
    color: '#6366f1',
    textAlign: 'center',
  },
  heroLabel: {
    fontSize: 11,
    color: '#ffffff50',
    textAlign: 'center',
    marginTop: 4,
  },
  card: {
    backgroundColor: '#0f0f1e',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 9,
    letterSpacing: 2,
    color: '#6366f1',
    textTransform: 'uppercase',
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      default: 'monospace',
    }),
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#ffffff45',
    marginTop: 4,
    marginBottom: 12,
  },
  heatmapWrap: {
    width: '100%',
  },
  heatmapWeekRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  weekLabel: {
    width: 48,
    fontSize: 9,
    color: '#ffffff40',
    marginRight: GAP,
  },
  heatmapSquare: {
    borderRadius: 3,
    marginHorizontal: 0,
    marginVertical: 1,
  },
  emptyText: {
    fontSize: 14,
    color: '#ffffff55',
    marginTop: 8,
  },
  commitmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
  },
  medal: {
    fontSize: 22,
    marginRight: 10,
  },
  commitmentBody: {
    flex: 1,
    minWidth: 0,
  },
  commitmentTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  commitmentMeta: {
    color: '#6366f1',
    fontSize: 13,
    marginTop: 2,
    fontWeight: '500',
  },
  commitmentStreak: {
    color: '#ffffff50',
    fontSize: 12,
    marginTop: 2,
  },
  areaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    borderRadius: 10,
    paddingHorizontal: 4,
    marginHorizontal: -4,
  },
  areaRowSelected: {
    backgroundColor: '#6366f118',
    borderLeftWidth: 3,
    borderLeftColor: '#6366f1',
    paddingLeft: 8,
  },
  areaIcon: {
    fontSize: 20,
    width: 28,
    marginRight: 10,
  },
  areaBody: {
    flex: 1,
    minWidth: 0,
  },
  areaTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  areaName: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
    marginRight: 8,
  },
  areaRate: {
    color: '#ffffff70',
    fontSize: 13,
    fontWeight: '600',
  },
  areaBarTrack: {
    height: 6,
    backgroundColor: '#1a1a2e',
    borderRadius: 3,
    overflow: 'hidden',
  },
  areaBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  legacyLink: {
    marginTop: 8,
    marginBottom: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  legacyLinkText: {
    color: '#6366f1',
    fontSize: 15,
    fontWeight: '500',
  },
});
