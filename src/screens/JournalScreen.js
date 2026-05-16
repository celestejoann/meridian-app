import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import MeridianWordmark from '../components/MeridianWordmark';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const WEEKDAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const DOT_COLORS = {
  green: '#4ade80',
  yellow: '#facc15',
  red: '#f87171',
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

function habitCreatedDateKey(habit) {
  return String(habit.created_at).slice(0, 10);
}

function getWeeklyDueDay(habit) {
  if (habit.weekly_due_day != null) {
    return habit.weekly_due_day;
  }
  return new Date(habit.created_at).getDay();
}

function getMondayKey(dateKey) {
  const x = parseDateKey(dateKey);
  const dow = x.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  x.setDate(x.getDate() + diff);
  return formatLocalDateKey(x);
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

function getDayHabitStats(habits, completions, dateKey) {
  const dueHabits = habits.filter((h) =>
    isHabitDueOnDate(h, dateKey, completions)
  );
  if (dueHabits.length === 0) {
    return { due: 0, completed: 0, pct: null, dot: null };
  }

  const doneSet = completionsOnDate(completions, dateKey);
  const completed = dueHabits.filter((h) => doneSet.has(h.id)).length;
  const due = dueHabits.length;
  const pct = Math.round((completed / due) * 100);

  let dot = 'red';
  if (completed === due) dot = 'green';
  else if (completed > 0) dot = 'yellow';

  return { due, completed, pct, dot };
}

function getCalendarGridDays(year, month) {
  const firstOfMonth = new Date(year, month, 1);
  const start = new Date(firstOfMonth);
  const dow = start.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  start.setDate(start.getDate() + diff);

  const days = [];
  const cursor = new Date(start);
  for (let i = 0; i < 42; i++) {
    days.push({
      date: new Date(cursor),
      key: formatLocalDateKey(cursor),
      inMonth: cursor.getMonth() === month,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function getMonthRangeKeys(year, month) {
  const grid = getCalendarGridDays(year, month);
  return { start: grid[0].key, end: grid[grid.length - 1].key };
}

function headerDateLabel(dateKey) {
  const d = parseDateKey(dateKey);
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function isFutureDate(dateKey, todayKey) {
  return dateKey > todayKey;
}

function isWithinEditableWindow(dateKey, todayKey) {
  if (dateKey > todayKey) return false;
  const today = parseDateKey(todayKey);
  const d = parseDateKey(dateKey);
  const diffDays = Math.round((today - d) / 86400000);
  return diffDays <= 7;
}

function scorePillColor(pct, hasDue) {
  if (!hasDue || pct == null) return '#ffffff40';
  if (pct >= 100) return '#4ade80';
  if (pct > 0) return '#facc15';
  return '#f87171';
}

function SectionLabel({ children }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

export default function JournalScreen() {
  const todayKey = useMemo(() => formatLocalDateKey(new Date()), []);

  const [userId, setUserId] = useState(null);
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey);

  const [habits, setHabits] = useState([]);
  const [monthCompletions, setMonthCompletions] = useState([]);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [entryLoading, setEntryLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [oneThing, setOneThing] = useState('');
  const [morningNote, setMorningNote] = useState('');
  const [oneWin, setOneWin] = useState('');
  const [sleepHours, setSleepHours] = useState('');
  const [eveningNote, setEveningNote] = useState('');

  const calendarDays = useMemo(
    () => getCalendarGridDays(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  const dotByDate = useMemo(() => {
    const map = new Map();
    for (const day of calendarDays) {
      if (!day.inMonth || isFutureDate(day.key, todayKey)) {
        map.set(day.key, null);
        continue;
      }
      const stats = getDayHabitStats(habits, monthCompletions, day.key);
      map.set(day.key, stats.dot);
    }
    return map;
  }, [calendarDays, habits, monthCompletions, todayKey]);

  const selectedStats = useMemo(
    () => getDayHabitStats(habits, monthCompletions, selectedDateKey),
    [habits, monthCompletions, selectedDateKey]
  );

  const isFuture = isFutureDate(selectedDateKey, todayKey);
  const isEditable = isWithinEditableWindow(selectedDateKey, todayKey);
  const isReadOnly = !isFuture && !isEditable;

  const loadCalendarData = useCallback(async () => {
    setCalendarLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData?.user?.id;
    if (!uid) {
      setUserId(null);
      setHabits([]);
      setMonthCompletions([]);
      setCalendarLoading(false);
      return;
    }
    setUserId(uid);

    const { start, end } = getMonthRangeKeys(viewYear, viewMonth);

    const [{ data: habitsData }, { data: completionData }] = await Promise.all([
      supabase
        .from('habits')
        .select('*')
        .eq('user_id', uid)
        .eq('status', 'active'),
      supabase
        .from('habit_completions')
        .select('*')
        .eq('user_id', uid)
        .gte('completed_date', start)
        .lte('completed_date', end),
    ]);

    setHabits(habitsData ?? []);
    setMonthCompletions(completionData ?? []);
    setCalendarLoading(false);
  }, [viewYear, viewMonth]);

  const loadEntry = useCallback(async () => {
    if (!userId || !selectedDateKey) return;
    setEntryLoading(true);
    const { data } = await supabase
      .from('daily_entries')
      .select('*')
      .eq('user_id', userId)
      .eq('entry_date', selectedDateKey)
      .maybeSingle();

    setOneThing(data?.one_thing ?? '');
    setMorningNote(data?.journal_note ?? '');
    setOneWin(data?.win_of_day ?? '');
    setSleepHours(
      data?.sleep_hours != null && data?.sleep_hours !== ''
        ? String(data.sleep_hours)
        : ''
    );
    setEveningNote(data?.evening_note ?? '');
    setEntryLoading(false);
  }, [userId, selectedDateKey]);

  useFocusEffect(
    useCallback(() => {
      loadCalendarData();
    }, [loadCalendarData])
  );

  useEffect(() => {
    if (userId) loadEntry();
  }, [userId, selectedDateKey, loadEntry]);

  const goPrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const adjustSleep = (delta) => {
    const current = sleepHours === '' ? 0 : parseFloat(sleepHours);
    const next = Math.min(12, Math.max(0, Math.round((current + delta) * 2) / 2));
    setSleepHours(String(next));
  };

  const handleSave = async () => {
    if (!userId || !isEditable) return;
    setSaving(true);
    const sleepVal =
      sleepHours.trim() === '' ? null : parseFloat(sleepHours);

    const payload = {
      user_id: userId,
      entry_date: selectedDateKey,
      one_thing: oneThing.trim() || null,
      journal_note: morningNote.trim() || null,
      win_of_day: oneWin.trim() || null,
      sleep_hours: sleepVal,
      evening_note: eveningNote.trim() || null,
    };

    const { error } = await supabase
      .from('daily_entries')
      .upsert(payload, { onConflict: 'user_id,entry_date' });

    setSaving(false);
    if (!error) await loadEntry();
  };

  const monthTitle = `${MONTH_NAMES[viewMonth]} ${viewYear}`;
  const inputEditable = isEditable && !entryLoading;

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
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
          Journal
        </Text>
        <MeridianWordmark />

        <View style={styles.card}>
          <View style={styles.calHeader}>
            <TouchableOpacity
              onPress={goPrevMonth}
              style={styles.calNavBtn}
              accessibilityLabel="Previous month">
              <Text style={styles.calNavArrow}>←</Text>
            </TouchableOpacity>
            <Text style={styles.calMonthTitle}>{monthTitle}</Text>
            <TouchableOpacity
              onPress={goNextMonth}
              style={styles.calNavBtn}
              accessibilityLabel="Next month">
              <Text style={styles.calNavArrow}>→</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.weekHeaderRow}>
            {WEEKDAY_HEADERS.map((label) => (
              <Text key={label} style={styles.weekHeader}>
                {label}
              </Text>
            ))}
          </View>

          {calendarLoading ? (
            <ActivityIndicator
              color="#6366f1"
              style={styles.calLoader}
              size="small"
            />
          ) : (
            <View style={styles.calGrid}>
              {calendarDays.map((day) => {
                const isToday = day.key === todayKey;
                const isSelected = day.key === selectedDateKey;
                const isFutureDay = isFutureDate(day.key, todayKey);
                const dot = dotByDate.get(day.key);

                return (
                  <TouchableOpacity
                    key={day.key}
                    style={styles.dayCell}
                    onPress={() => setSelectedDateKey(day.key)}
                    activeOpacity={0.7}>
                    <View
                      style={[
                        styles.dayNumberWrap,
                        isToday && styles.dayTodayCircle,
                        isSelected && !isToday && styles.daySelectedRing,
                      ]}>
                      <Text
                        style={[
                          styles.dayNumber,
                          !day.inMonth && styles.dayNumberOutMonth,
                          isFutureDay && styles.dayNumberFuture,
                        ]}>
                        {day.date.getDate()}
                      </Text>
                    </View>
                    {dot ? (
                      <View
                        style={[
                          styles.dayDot,
                          { backgroundColor: DOT_COLORS[dot] },
                        ]}
                      />
                    ) : (
                      <View style={styles.dayDotPlaceholder} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.dayDetailHeader}>
            <Text style={styles.dayDetailTitle}>
              {headerDateLabel(selectedDateKey)}
            </Text>
            {!isFuture && selectedStats.pct != null ? (
              <View
                style={[
                  styles.scorePill,
                  {
                    backgroundColor:
                      scorePillColor(selectedStats.pct, selectedStats.due > 0) +
                      '22',
                    borderColor: scorePillColor(
                      selectedStats.pct,
                      selectedStats.due > 0
                    ),
                  },
                ]}>
                <Text
                  style={[
                    styles.scorePillText,
                    {
                      color: scorePillColor(
                        selectedStats.pct,
                        selectedStats.due > 0
                      ),
                    },
                  ]}>
                  {selectedStats.pct}%
                </Text>
              </View>
            ) : null}
          </View>

          {isFuture ? (
            <Text style={styles.futureMessage}>Nothing yet</Text>
          ) : entryLoading ? (
            <ActivityIndicator
              color="#6366f1"
              style={styles.entryLoader}
              size="small"
            />
          ) : (
            <>
              <SectionLabel>MORNING</SectionLabel>

              <Text style={styles.fieldTitle}>THE ONE THING</Text>
              <TextInput
                style={styles.input}
                placeholder="What matters most today?"
                placeholderTextColor="#ffffff40"
                value={oneThing}
                onChangeText={setOneThing}
                editable={inputEditable}
              />

              <Text style={styles.fieldTitle}>MORNING NOTE</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                placeholder="Morning reflections..."
                placeholderTextColor="#ffffff40"
                value={morningNote}
                onChangeText={setMorningNote}
                multiline
                textAlignVertical="top"
                editable={inputEditable}
              />

              <SectionLabel>EVENING</SectionLabel>

              <Text style={styles.fieldTitle}>ONE WIN</Text>
              <TextInput
                style={styles.input}
                placeholder="Something that went well..."
                placeholderTextColor="#ffffff40"
                value={oneWin}
                onChangeText={setOneWin}
                editable={inputEditable}
              />

              <Text style={styles.fieldTitle}>HOURS SLEPT</Text>
              <View style={styles.sleepRow}>
                <TouchableOpacity
                  style={styles.sleepBtn}
                  onPress={() => adjustSleep(-0.5)}
                  disabled={!inputEditable}>
                  <Text style={styles.sleepBtnText}>−</Text>
                </TouchableOpacity>
                <TextInput
                  style={[styles.input, styles.sleepInput]}
                  value={sleepHours}
                  onChangeText={setSleepHours}
                  keyboardType="decimal-pad"
                  editable={inputEditable}
                  placeholder="0"
                  placeholderTextColor="#ffffff40"
                />
                <TouchableOpacity
                  style={styles.sleepBtn}
                  onPress={() => adjustSleep(0.5)}
                  disabled={!inputEditable}>
                  <Text style={styles.sleepBtnText}>+</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldTitle}>EVENING NOTE</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                placeholder="Evening reflections..."
                placeholderTextColor="#ffffff40"
                value={eveningNote}
                onChangeText={setEveningNote}
                multiline
                textAlignVertical="top"
                editable={inputEditable}
              />

              {isReadOnly ? (
                <Text style={styles.readOnlyHint}>
                  Entries older than 7 days are read only.
                </Text>
              ) : null}

              {isEditable ? (
                <TouchableOpacity
                  style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                  onPress={handleSave}
                  disabled={saving}>
                  <Text style={styles.saveBtnText}>
                    {saving ? 'Saving…' : 'Save'}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </>
          )}
        </View>
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
  card: {
    backgroundColor: '#0f0f1e',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
  },
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  calNavBtn: {
    padding: 8,
    minWidth: 40,
    alignItems: 'center',
  },
  calNavArrow: {
    color: '#ffffff',
    fontSize: 20,
  },
  calMonthTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '500',
  },
  weekHeaderRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekHeader: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    color: '#ffffff50',
  },
  calLoader: {
    paddingVertical: 24,
  },
  calGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    paddingVertical: 6,
  },
  dayNumberWrap: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  dayTodayCircle: {
    backgroundColor: '#6366f1',
  },
  daySelectedRing: {
    borderWidth: 1,
    borderColor: '#ffffff30',
  },
  dayNumber: {
    fontSize: 14,
    color: '#ffffff',
  },
  dayNumberOutMonth: {
    color: '#ffffff30',
  },
  dayNumberFuture: {
    opacity: 0.4,
  },
  dayDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 4,
  },
  dayDotPlaceholder: {
    width: 5,
    height: 5,
    marginTop: 4,
  },
  dayDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 12,
  },
  dayDetailTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '300',
    color: '#ffffff',
    fontFamily: Platform.select({
      ios: 'Georgia',
      android: 'serif',
      default: 'serif',
    }),
  },
  scorePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  scorePillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  futureMessage: {
    fontSize: 15,
    color: '#ffffff55',
    textAlign: 'center',
    paddingVertical: 24,
  },
  entryLoader: {
    paddingVertical: 24,
  },
  sectionLabel: {
    fontSize: 9,
    letterSpacing: 2,
    color: '#6366f1',
    textTransform: 'uppercase',
    marginBottom: 12,
    marginTop: 4,
  },
  fieldTitle: {
    fontSize: 11,
    letterSpacing: 1,
    color: '#ffffff70',
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#1a1a2e',
    color: '#ffffff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ffffff15',
    fontSize: 15,
    marginBottom: 12,
  },
  inputMultiline: {
    minHeight: 88,
  },
  sleepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sleepBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#ffffff15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sleepBtnText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '300',
  },
  sleepInput: {
    flex: 1,
    marginBottom: 0,
    textAlign: 'center',
  },
  readOnlyHint: {
    fontSize: 12,
    color: '#ffffff45',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  saveBtn: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
