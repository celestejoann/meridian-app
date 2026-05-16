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

/** Consecutive days with at least one completion; allows “today” to be incomplete by starting from yesterday. */
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

function headerDateLabel(d) {
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function DashboardScreen() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const [habits, setHabits] = useState([]);
  const [completedTodayIds, setCompletedTodayIds] = useState(() => new Set());
  const [streak, setStreak] = useState(0);
  const [toggleBusyId, setToggleBusyId] = useState(null);

  const dateSubtitle = useMemo(() => headerDateLabel(new Date()), []);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      setUserId(null);
      setHabits([]);
      setCompletedTodayIds(new Set());
      setStreak(0);
      setLoading(false);
      return;
    }
    const uid = userData.user.id;
    setUserId(uid);

    const { data: habitsData, error: habitsErr } = await supabase
      .from('habits')
      .select('id, title, area')
      .eq('user_id', uid)
      .eq('is_active', true)
      .order('title', { ascending: true });

    if (habitsErr) {
      setHabits([]);
    } else {
      setHabits(habitsData ?? []);
    }

    const todayKey = formatLocalDateKey(new Date());

    const { data: todayRows } = await supabase
      .from('habit_completions')
      .select('habit_id')
      .eq('user_id', uid)
      .eq('completed_date', todayKey);

    const todaySet = new Set((todayRows ?? []).map((r) => r.habit_id));
    setCompletedTodayIds(todaySet);

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
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const todayPct = useMemo(() => {
    if (habits.length === 0) return 0;
    const done = habits.filter((h) => completedTodayIds.has(h.id)).length;
    return Math.round((done / habits.length) * 100);
  }, [habits, completedTodayIds]);

  const toggleHabit = async (habitId, nextChecked) => {
    if (!userId) return;
    const todayKey = formatLocalDateKey(new Date());
    const prev = new Set(completedTodayIds);
    const next = new Set(completedTodayIds);
    if (nextChecked) next.add(habitId);
    else next.delete(habitId);
    setCompletedTodayIds(next);
    setToggleBusyId(habitId);
    try {
      if (nextChecked) {
        const { error } = await supabase.from('habit_completions').insert({
          habit_id: habitId,
          user_id: userId,
          completed_date: todayKey,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('habit_completions')
          .delete()
          .eq('habit_id', habitId)
          .eq('user_id', userId)
          .eq('completed_date', todayKey);
        if (error) throw error;
      }
      await load();
    } catch {
      setCompletedTodayIds(prev);
    } finally {
      setToggleBusyId(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
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
            <View style={styles.card}>
              <Text style={styles.streakEmoji}>🔥</Text>
              <Text style={styles.streakNumber}>{streak}</Text>
              <Text style={styles.streakCaption}>days showing up</Text>
              <Text style={styles.todayRate}>
                Today: {todayPct}%
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>
                {"Today's commitments"}
              </Text>
              {habits.length === 0 ? (
                <Text style={styles.emptyText}>
                  No commitments due today
                </Text>
              ) : (
                habits.map((h) => {
                  const done = completedTodayIds.has(h.id);
                  const areaKey = (h.area || '').toLowerCase();
                  const tagColor =
                    AREA_COLORS[areaKey] || '#ffffff40';
                  const busy = toggleBusyId === h.id;
                  return (
                    <View key={h.id} style={styles.row}>
                      <TouchableOpacity
                        style={[styles.checkbox, done && styles.checkboxOn]}
                        onPress={() => toggleHabit(h.id, !done)}
                        disabled={busy}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: done, busy }}>
                        {done ? (
                          <Text style={styles.checkMark}>✓</Text>
                        ) : null}
                      </TouchableOpacity>
                      <Text style={styles.habitTitle}>{h.title}</Text>
                      <View
                        style={[
                          styles.areaPill,
                          { backgroundColor: tagColor },
                        ]}>
                        <Text style={styles.areaPillText}>
                          {(h.area || 'area').replace(/^\w/, (c) =>
                            c.toUpperCase()
                          )}
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
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
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  streakEmoji: {
    fontSize: 48,
    textAlign: 'center',
  },
  streakNumber: {
    fontSize: 40,
    fontWeight: '300',
    color: '#6366f1',
    textAlign: 'center',
    marginTop: 4,
  },
  streakCaption: {
    fontSize: 14,
    color: '#ffffff60',
    textAlign: 'center',
    marginTop: 4,
  },
  todayRate: {
    marginTop: 16,
    fontSize: 15,
    color: '#ffffff90',
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 15,
    color: '#ffffff55',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
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
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  checkMark: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  habitTitle: {
    flex: 1,
    color: '#ffffff',
    fontSize: 16,
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
