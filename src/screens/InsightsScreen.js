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

function getLast30DayKeys(todayKey) {
  const keys = [];
  let d = parseDateKey(todayKey);
  for (let i = 0; i < 30; i++) {
    keys.push(formatLocalDateKey(d));
    d = addDays(d, -1);
  }
  return keys;
}

function getLast12WeeksGrid(todayKey) {
  const today = parseDateKey(todayKey);
  const currentMonday = getMondayOfWeek(today);
  const startMonday = addDays(currentMonday, -11 * 7);
  const weeks = [];

  for (let w = 0; w < 12; w++) {
    const weekStart = addDays(startMonday, w * 7);
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push(addDays(weekStart, i));
    }
    weeks.push({ weekStart, days });
  }
  return weeks;
}

function weekLabel(d) {
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

export default function InsightsScreen() {
  const { openLegacy } = useAppNavigation();
  const screenWidth = Dimensions.get('window').width;
  const squareSize = Math.floor((screenWidth - 120) / 7) - 4;
  const squareGap = 2;
  const rowSquaresWidth = squareSize * 7 + squareGap * 6;
  console.log('HEATMAP', { screenWidth, squareSize, total: squareSize * 7 });
  const rowHeight = squareSize + 4;
  const visibleWeeks = 4;
  const heatmapHeight = rowHeight * visibleWeeks;

  const scrollRef = useRef(null);
  const todayKey = useMemo(() => formatLocalDateKey(new Date()), []);

  const [loading, setLoading] = useState(true);
  const [habits, setHabits] = useState([]);
  const [completions, setCompletions] = useState([]);
  const [userAreas, setUserAreas] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData?.user?.id;
    if (!uid) {
      setHabits([]);
      setCompletions([]);
      setUserAreas([]);
      setLoading(false);
      return;
    }

    const since84 = formatLocalDateKey(addDays(new Date(), -83));

    const [
      { data: habitsData },
      { data: completionData },
      { data: areasData },
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
        .gte('completed_date', since84)
        .lte('completed_date', todayKey),
      supabase.from('user_areas').select('*').eq('user_id', uid),
    ]);

    setHabits(habitsData ?? []);
    setCompletions(completionData ?? []);
    setUserAreas(areasData ?? []);
    setLoading(false);
  }, [todayKey]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const last30Keys = useMemo(() => getLast30DayKeys(todayKey), [todayKey]);

  const dailyScores30 = useMemo(() => {
    return last30Keys.map((key) => getDayScore(habits, completions, key, todayKey));
  }, [habits, completions, last30Keys, todayKey]);

  const currentStreak = useMemo(() => {
    const datesWithActivity = new Set(
      completions.map((r) => String(r.completed_date).slice(0, 10))
    );
    return computeShowUpStreak(datesWithActivity);
  }, [completions]);

  const avgScore30 = useMemo(() => {
    const scored = dailyScores30.filter((p) => p != null);
    if (scored.length === 0) return 0;
    return Math.round(scored.reduce((a, b) => a + b, 0) / scored.length);
  }, [dailyScores30]);

  const daysAtTarget = useMemo(() => {
    return dailyScores30.filter((p) => p != null && p >= 70).length;
  }, [dailyScores30]);

  const heatmapWeeks = useMemo(
    () => getLast12WeeksGrid(todayKey),
    [todayKey]
  );

  useEffect(() => {
    if (!loading) {
      scrollRef.current?.scrollToEnd({ animated: false });
    }
  }, [loading, heatmapWeeks, squareSize]);

  const topHabits = useMemo(() => {
    const stats = habits.map((habit) => {
      let dueDays = 0;
      let completedDays = 0;

      for (const key of last30Keys) {
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
  }, [habits, completions, last30Keys, todayKey]);

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

      for (const key of last30Keys) {
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
  }, [userAreas, habits, completions, last30Keys]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView
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
        <MeridianWordmark />

        {loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator color="#6366f1" size={32} />
          </View>
        ) : (
          <>
            <View style={styles.heroRow}>
              <HeroStatCard
                emoji="🔥"
                value={String(currentStreak)}
                label="day streak"
              />
              <HeroStatCard
                value={`${avgScore30}%`}
                label="last 30 days"
              />
              <HeroStatCard
                value={String(daysAtTarget)}
                label="days ≥70%"
              />
            </View>

            <View style={styles.card}>
              <SectionTitle>CONSISTENCY</SectionTitle>
              <Text style={styles.sectionSubtitle}>Last 12 weeks</Text>

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
                        const pct = getDayScore(
                          habits,
                          completions,
                          key,
                          todayKey
                        );
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

            <View style={styles.card}>
              <SectionTitle>BY AREA</SectionTitle>
              {areaStats.length === 0 ? (
                <Text style={styles.emptyText}>No area data yet</Text>
              ) : (
                areaStats.map((area) => (
                  <View key={area.key} style={styles.areaRow}>
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
