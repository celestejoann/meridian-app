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
import { COLORS, FONTS, AREA_COLORS } from '../constants/theme';
import Svg, { Polygon, Circle, Text as SvgText, Line } from 'react-native-svg';

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
  none: COLORS.surfaceLight,
  low: COLORS.surface,
  midLow: COLORS.surfaceLight,
  midHigh: COLORS.accentDim,
  high: COLORS.accent,
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

function getPreviousPeriodKeys(todayKey, selectedDays) {
  const keys = [];
  let d = addDays(parseDateKey(todayKey), -selectedDays);
  for (let i = 0; i < selectedDays; i++) {
    keys.push(formatLocalDateKey(d));
    d = addDays(d, -1);
  }
  return keys;
}

function avgDailyScoreForKeys(habits, completions, keys, todayKey) {
  const scored = keys
    .map((key) => getDayScore(habits, completions, key, todayKey))
    .filter((p) => p != null);
  if (scored.length === 0) return null;
  return Math.round(scored.reduce((a, b) => a + b, 0) / scored.length);
}

const DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function dowIndexFromDateKey(key) {
  const dow = parseDateKey(key).getDay();
  return dow === 0 ? 6 : dow - 1;
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

function getAreaColor(area) {
  const key = (area || '').toLowerCase();
  return AREA_COLORS[key] || COLORS.accent;
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
      ? COLORS.muted
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
            stroke={COLORS.border}
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
                : COLORS.border
            }
            strokeWidth={selectedArea === p.key ? 2 : 1}
          />
        ))}
        <Polygon
          points={polygonPoints}
          fill={COLORS.accent}
          fillOpacity={0.3}
        />
        <Polygon
          points={polygonPoints}
          fill="none"
          stroke={COLORS.accent}
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
          fill={COLORS.accent}
          textAnchor="middle">
          {`${areasCovered.covered}/${areasCovered.total}`}
        </SvgText>
        <SvgText
          x={cx}
          y={cy + 16}
          fontSize={10}
          fill={COLORS.mutedLight}
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
      style={[
        styles.identityRow,
        { borderLeftColor: row.areaColor },
      ]}>
      {row.areaLabel ? (
        <Text style={[styles.identityAreaLabel, { color: row.areaColor }]}>
          {row.areaLabel}
        </Text>
      ) : null}
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
          Waiting for you to show up here
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
  const [journalEntries, setJournalEntries] = useState([]);
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
      setJournalEntries([]);
      setLoading(false);
      return;
    }

    const since730 = formatLocalDateKey(addDays(new Date(), -729));

    const [
      { data: habitsData },
      { data: completionData },
      { data: areasData },
      { data: identitiesData },
      { data: journalData },
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
        .gte('completed_date', since730)
        .lte('completed_date', todayKey),
      supabase.from('user_areas').select('*').eq('user_id', uid),
      supabase.from('user_identities').select('*').eq('user_id', uid),
      supabase
        .from('daily_entries')
        .select('*')
        .eq('user_id', uid)
        .gte('entry_date', since730)
        .lte('entry_date', todayKey),
    ]);

    setHabits(habitsData ?? []);
    setCompletions(completionData ?? []);
    setUserAreas(areasData ?? []);
    setUserIdentities(identitiesData ?? []);
    setJournalEntries(journalData ?? []);
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

  const previousRangeKeys = useMemo(
    () => getPreviousPeriodKeys(todayKey, selectedDays),
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
        color: ua.color || AREA_COLORS[areaKey] || COLORS.accent,
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
        color: ua.color || AREA_COLORS[areaKey] || COLORS.accent,
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

  const identityStartDateStr = useMemo(() => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - selectedDays);
    return startDate.toLocaleDateString('en-CA');
  }, [selectedDays]);

  const identityRows = useMemo(() => {
    const periodLabel = getIdentityPeriodLabel(selectedDays);
    const habitsById = new Map(habits.map((h) => [h.id, h]));

    return userIdentities.map((identity) => {
      const areaKey = identity.area_slug || identity.area;
      const areaColor = getAreaColor(areaKey);
      const areaLabel = (areaKey || '').toUpperCase();
      const matchingHabits = habits.filter(
        (h) =>
          h.area === identity.area_slug || h.area === identity.area
      );
      const areaHabitIds = new Set(matchingHabits.map((h) => h.id));

      const areaCompletions = completions.filter((row) => {
        if (!areaHabitIds.has(row.habit_id)) return false;
        const d = String(row.completed_date).slice(0, 10);
        return d >= identityStartDateStr;
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
        areaColor,
        areaLabel,
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
    identityStartDateStr,
    todayKey,
    selectedDays,
  ]);

  useEffect(() => {
    if (!loading) {
      scrollRef.current?.scrollToEnd({ animated: false });
    }
  }, [loading, heatmapWeeks, squareSize, selectedDays, identityRows]);

  const dayOfWeekStats = useMemo(() => {
    const buckets = DOW_LABELS.map((label) => ({ label, scores: [] }));

    for (const key of rangeKeys) {
      const score = getDayScore(habits, completions, key, todayKey);
      if (score == null) continue;
      buckets[dowIndexFromDateKey(key)].scores.push(score);
    }

    return buckets.map((b) => ({
      label: b.label,
      rate:
        b.scores.length === 0
          ? null
          : Math.round(b.scores.reduce((a, c) => a + c, 0) / b.scores.length),
    }));
  }, [habits, completions, rangeKeys, todayKey]);

  const dayOfWeekInsight = useMemo(() => {
    const withData = dayOfWeekStats.filter((d) => d.rate != null);
    if (withData.length === 0) return null;
    const strongest = withData.reduce((best, d) =>
      d.rate > best.rate ? d : best
    );
    const dayNames = {
      Mon: 'Monday',
      Tue: 'Tuesday',
      Wed: 'Wednesday',
      Thu: 'Thursday',
      Fri: 'Friday',
      Sat: 'Saturday',
      Sun: 'Sunday',
    };
    return dayNames[strongest.label] || strongest.label;
  }, [dayOfWeekStats]);

  const hasDayOfWeekData = dayOfWeekStats.some((d) => d.rate != null);

  const periodComparison = useMemo(() => {
    const currentAvg = avgDailyScoreForKeys(
      habits,
      completions,
      rangeKeys,
      todayKey
    );
    const previousAvg = avgDailyScoreForKeys(
      habits,
      completions,
      previousRangeKeys,
      todayKey
    );

    let delta = null;
    if (currentAvg != null && previousAvg != null) {
      delta = currentAvg - previousAvg;
    }

    return { currentAvg, previousAvg, delta };
  }, [habits, completions, rangeKeys, previousRangeKeys, todayKey]);

  const journalPatterns = useMemo(() => {
    const entryByDate = new Map();
    for (const entry of journalEntries) {
      const key = String(entry.entry_date).slice(0, 10);
      entryByDate.set(key, entry);
    }

    const totalDays = rangeKeys.length;
    let journaledDays = 0;
    let morningDays = 0;
    let eveningDays = 0;
    let bothDays = 0;
    let neitherDays = 0;

    for (const key of rangeKeys) {
      const entry = entryByDate.get(key);
      const hasMorning = Boolean(entry?.journal_note?.trim());
      const hasEvening = Boolean(entry?.evening_note?.trim());

      if (hasMorning) morningDays += 1;
      if (hasEvening) eveningDays += 1;
      if (hasMorning && hasEvening) bothDays += 1;
      if (!hasMorning && !hasEvening) neitherDays += 1;
      if (hasMorning || hasEvening) journaledDays += 1;
    }

    const journaledPct =
      totalDays === 0 ? 0 : Math.round((journaledDays / totalDays) * 100);

    let observation = '';
    if (journaledDays === 0) {
      observation =
        "The more you reflect, the more you'll see about yourself.";
    } else if (journaledPct < 30) {
      observation =
        'Keep reflecting — patterns will emerge as you show up in your Journal.';
    } else if (journaledPct <= 70) {
      observation =
        "You're building a reflection practice — keep going";
    } else {
      observation =
        'You reflect consistently. Your Journal is revealing who you are.';
    }

    return {
      totalDays,
      journaledDays,
      journaledPct,
      morningDays,
      eveningDays,
      bothDays,
      neitherDays,
      observation,
    };
  }, [journalEntries, rangeKeys]);

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
            color: COLORS.text,
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
            <ActivityIndicator color={COLORS.accent} size={32} />
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
                label="days in a row"
              />
              <HeroStatCard
                value={`${avgScoreRange}%`}
                label={timeframeHeroLabel}
              />
              <HeroStatCard
                value={String(daysAtTarget)}
                label="days you've been showing up"
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
              <SectionTitle>MOST CONSISTENT</SectionTitle>
              <Text style={styles.sectionSubtitle}>
                Where you keep showing up
              </Text>
              {topHabits.length === 0 ? (
                <Text style={styles.emptyText}>
                  Show up for commitments to see where you&apos;re most
                  consistent
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
                        {item.rate}% consistency
                      </Text>
                      <Text style={styles.commitmentStreak}>
                        🔥 {item.streak} day{item.streak === 1 ? '' : 's'} in a row
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

            <View style={styles.card}>
              <SectionTitle>BY DAY OF WEEK</SectionTitle>
              <Text style={styles.sectionSubtitle}>
                When you most show up
              </Text>
              {!hasDayOfWeekData ? (
                <Text style={styles.emptyText}>
                  Not enough data yet to show patterns
                </Text>
              ) : (
                <>
                  <View style={styles.dowChartRow}>
                    {dayOfWeekStats.map((d) => (
                      <View key={d.label} style={styles.dowBarCol}>
                        <Text style={styles.dowPct}>
                          {d.rate != null ? `${d.rate}%` : '—'}
                        </Text>
                        <View style={styles.dowBarTrack}>
                          <View
                            style={[
                              styles.dowBarFill,
                              {
                                height:
                                  d.rate != null ? (d.rate / 100) * 120 : 0,
                              },
                            ]}
                          />
                        </View>
                        <Text style={styles.dowLabel}>{d.label}</Text>
                      </View>
                    ))}
                  </View>
                  {dayOfWeekInsight ? (
                    <Text style={styles.dowInsight}>
                      You show up most on {dayOfWeekInsight}s
                    </Text>
                  ) : null}
                </>
              )}
            </View>

            <View style={styles.card}>
              <SectionTitle>THIS PERIOD VS PREVIOUS</SectionTitle>
              <Text style={styles.sectionSubtitle}>
                How your practice is evolving
              </Text>
              {periodComparison.previousAvg == null ? (
                <Text style={styles.periodEmpty}>
                  Your practice is just beginning. Come back tomorrow.
                </Text>
              ) : (
                <>
                  <View style={styles.periodCompareRow}>
                    <View style={styles.periodCol}>
                      <Text style={styles.periodColLabel}>This period</Text>
                      <Text style={styles.periodBig}>
                        {periodComparison.currentAvg ?? 0}%
                      </Text>
                    </View>
                    <View style={styles.periodCol}>
                      <Text style={styles.periodColLabel}>Previous</Text>
                      <Text style={styles.periodBig}>
                        {periodComparison.previousAvg}%
                      </Text>
                    </View>
                  </View>
                  {periodComparison.delta != null ? (
                    <Text
                      style={[
                        styles.periodDelta,
                        {
                          color:
                            periodComparison.delta >= 0
                              ? COLORS.green
                              : COLORS.red,
                        },
                      ]}>
                      {periodComparison.delta >= 0 ? '↑' : '↓'}{' '}
                      {periodComparison.delta >= 0 ? '+' : ''}
                      {periodComparison.delta}%
                    </Text>
                  ) : null}
                </>
              )}
            </View>

            <View style={styles.card}>
              <SectionTitle>PATTERNS FROM YOUR JOURNAL</SectionTitle>
              <Text style={styles.sectionSubtitle}>
                Patterns in your reflection
              </Text>
              {journalPatterns.journaledDays === 0 ? (
                <>
                  <Text style={styles.journalCount}>
                    0 of {journalPatterns.totalDays} days journaled
                  </Text>
                  <View style={styles.journalBarTrack}>
                    <View
                      style={[styles.journalBarFill, { width: '0%' }]}
                    />
                  </View>
                  <Text style={styles.journalObservation}>
                    The more you reflect, the more you&apos;ll see about
                    yourself.
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.journalCount}>
                    {journalPatterns.journaledDays} of{' '}
                    {journalPatterns.totalDays} days journaled
                  </Text>
                  <View style={styles.journalBarTrack}>
                    <View
                      style={[
                        styles.journalBarFill,
                        { width: `${journalPatterns.journaledPct}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.journalObservation}>
                    {journalPatterns.observation}
                  </Text>
                </>
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
    backgroundColor: COLORS.bg,
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
    color: COLORS.text,
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
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
  },
  timeframePillLast: {
    marginRight: 0,
  },
  timeframePillSelected: {
    backgroundColor: COLORS.accent,
  },
  timeframePillText: {
    fontSize: 12,
    color: COLORS.mutedLight,
  },
  timeframePillTextSelected: {
    color: COLORS.text,
  },
  lifeWheelCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 16,
    alignItems: 'center',
  },
  lifeWheelTitle: {
    fontSize: 9,
    letterSpacing: 1.5,
    color: COLORS.accent,
    textTransform: 'uppercase',
    alignSelf: 'flex-start',
    fontFamily: FONTS.bodyMedium,
  },
  lifeWheelQuestion: {
    fontSize: 14,
    fontWeight: '300',
    fontStyle: 'italic',
    marginTop: 4,
    marginBottom: 16,
    color: COLORS.mutedLight,
    alignSelf: 'flex-start',
  },
  lifeWheelLegend: {
    fontSize: 9,
    color: COLORS.muted,
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
    color: COLORS.muted,
    paddingVertical: 24,
  },
  whoIAmSection: {
    marginBottom: 16,
    alignSelf: 'stretch',
  },
  identityRow: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderLeftWidth: 3,
  },
  identityAreaLabel: {
    fontSize: 12,
    letterSpacing: 1.5,
    marginBottom: 8,
    fontFamily: FONTS.bodyMedium,
  },
  identityStatement: {
    fontSize: 15,
    fontStyle: 'italic',
    fontWeight: '300',
    color: COLORS.text,
    marginBottom: 8,
  },
  identityEvidence: {
    fontSize: 13,
    color: COLORS.mutedLight,
    marginBottom: 4,
  },
  identityEvidenceCount: {
    color: COLORS.mutedLight,
  },
  identityEvidenceStar: {
    color: COLORS.accent,
  },
  identityRecent: {
    fontSize: 11,
    color: COLORS.muted,
  },
  identityNoActivity: {
    fontSize: 11,
    color: COLORS.muted,
  },
  identityEmpty: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 12,
  },
  identityEmptyText: {
    fontSize: 13,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 12,
  },
  identityEmptyLink: {
    fontSize: 14,
    color: COLORS.accent,
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
    backgroundColor: COLORS.surface,
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
    color: COLORS.accent,
    textAlign: 'center',
  },
  heroLabel: {
    fontSize: 11,
    color: COLORS.mutedLight,
    textAlign: 'center',
    marginTop: 4,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 9,
    letterSpacing: 1.5,
    color: COLORS.accent,
    textTransform: 'uppercase',
    fontFamily: FONTS.bodyMedium,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: COLORS.muted,
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
    color: COLORS.muted,
    marginRight: GAP,
  },
  heatmapSquare: {
    borderRadius: 3,
    marginHorizontal: 0,
    marginVertical: 1,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.muted,
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
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '500',
  },
  commitmentMeta: {
    color: COLORS.accent,
    fontSize: 13,
    marginTop: 2,
    fontWeight: '500',
  },
  commitmentStreak: {
    color: COLORS.mutedLight,
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
    backgroundColor: COLORS.accent + '18',
    borderLeftWidth: 3,
    borderLeftColor: COLORS.accent,
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
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '500',
    marginRight: 8,
  },
  areaRate: {
    color: COLORS.mutedLight,
    fontSize: 13,
    fontWeight: '600',
  },
  areaBarTrack: {
    height: 6,
    backgroundColor: COLORS.surface,
    borderRadius: 3,
    overflow: 'hidden',
  },
  areaBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  dowChartRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    marginTop: 8,
    marginBottom: 12,
  },
  dowBarCol: {
    width: 32,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  dowPct: {
    fontSize: 10,
    color: COLORS.mutedLight,
    marginBottom: 6,
  },
  dowBarTrack: {
    height: 120,
    width: 32,
    justifyContent: 'flex-end',
  },
  dowBarFill: {
    width: 32,
    backgroundColor: COLORS.accent,
    borderRadius: 4,
  },
  dowLabel: {
    fontSize: 10,
    color: COLORS.mutedLight,
    marginTop: 6,
  },
  dowInsight: {
    fontSize: 12,
    color: COLORS.muted,
    textAlign: 'center',
  },
  periodCompareRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
    marginBottom: 12,
  },
  periodCol: {
    alignItems: 'center',
    flex: 1,
  },
  periodColLabel: {
    fontSize: 11,
    color: COLORS.mutedLight,
    marginBottom: 8,
  },
  periodBig: {
    fontSize: 36,
    fontWeight: '600',
    color: COLORS.accent,
  },
  periodDelta: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  periodEmpty: {
    fontSize: 14,
    color: COLORS.muted,
    fontStyle: 'italic',
    marginTop: 8,
    lineHeight: 22,
  },
  journalCount: {
    fontSize: 14,
    color: COLORS.mutedLight,
    marginBottom: 10,
  },
  journalBarTrack: {
    height: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  journalBarFill: {
    height: '100%',
    backgroundColor: COLORS.accent,
    borderRadius: 4,
  },
  journalObservation: {
    fontSize: 13,
    color: COLORS.muted,
    lineHeight: 20,
  },
  legacyLink: {
    marginTop: 8,
    marginBottom: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  legacyLinkText: {
    color: COLORS.accent,
    fontSize: 15,
    fontWeight: '500',
  },
});
