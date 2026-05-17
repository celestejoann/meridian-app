import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS } from '../constants/theme';
import { supabase } from '../lib/supabase';

const J = {
  bg: '#0f0d1a',
  surface: '#1a1628',
  text: '#f5f3ff',
  muted: '#6b5fa0',
  accent: '#a78bfa',
  prompt: '#e2d9f3',
  divider: '#2a2040',
  placeholder: '#3d3060',
};

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
  green: COLORS.green,
  gold: COLORS.gold,
  red: COLORS.red,
};

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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

function getDayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
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
    return { dot: null };
  }

  const doneSet = completionsOnDate(completions, dateKey);
  const completed = dueHabits.filter((h) => doneSet.has(h.id)).length;
  const due = dueHabits.length;
  const pct = completed / due;

  if (pct >= 0.5) return { dot: 'green' };
  if (completed > 0) return { dot: 'gold' };
  return { dot: 'red' };
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

function shiftMonth(dateKey, delta) {
  const d = parseDateKey(dateKey);
  const day = d.getDate();
  d.setMonth(d.getMonth() + delta);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return formatLocalDateKey(d);
}

function dayName(dateKey) {
  return parseDateKey(dateKey).toLocaleDateString('en-US', {
    weekday: 'long',
  });
}

function dateSubtitleUpper(dateKey) {
  return parseDateKey(dateKey)
    .toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
    .toUpperCase();
}

function isOtherNotesColumnError(error) {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  return (
    msg.includes('other_notes') ||
    msg.includes('column') ||
    error.code === '42703' ||
    error.code === 'PGRST204'
  );
}

function ThinDivider({ style }) {
  return <View style={[styles.thinDivider, style]} />;
}

function SacredDivider() {
  return (
    <View style={styles.sacredDividerRow}>
      <View style={styles.sacredDividerLine} />
      <Text style={styles.sacredDividerStar}>✦</Text>
      <View style={styles.sacredDividerLine} />
    </View>
  );
}

function MonthCalendar({
  year,
  month,
  todayKey,
  selectedDateKey,
  habits,
  completions,
  loading,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
  onClose,
}) {
  const calendarDays = useMemo(
    () => getCalendarGridDays(year, month),
    [year, month]
  );

  const dotByDate = useMemo(() => {
    const map = new Map();
    for (const day of calendarDays) {
      if (!day.inMonth || isFutureDate(day.key, todayKey)) {
        map.set(day.key, null);
        continue;
      }
      const stats = getDayHabitStats(habits, completions, day.key);
      map.set(day.key, stats.dot);
    }
    return map;
  }, [calendarDays, habits, completions, todayKey]);

  const monthTitle = `${MONTH_NAMES[month]} ${year}`;

  return (
    <View style={styles.modalCalendar}>
      <View style={styles.modalTopRow}>
        <View style={styles.modalTopSpacer} />
        <TouchableOpacity
          onPress={onClose}
          style={styles.modalCloseBtn}
          accessibilityLabel="Close calendar">
          <Text style={styles.modalCloseText}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.modalCalHeader}>
        <TouchableOpacity
          onPress={onPrevMonth}
          style={styles.calNavBtn}
          accessibilityLabel="Previous month">
          <Text style={styles.calNavArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.modalCalTitle}>{monthTitle}</Text>
        <TouchableOpacity
          onPress={onNextMonth}
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

      {loading ? (
        <ActivityIndicator color={J.accent} style={styles.calLoader} size="small" />
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
                onPress={() => onSelectDate(day.key)}
                activeOpacity={0.7}
                disabled={isFutureDay}>
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
                    style={[styles.dayDot, { backgroundColor: DOT_COLORS[dot] }]}
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
  );
}

export default function JournalScreen() {
  const todayKey = useMemo(() => formatLocalDateKey(new Date()), []);

  const [userId, setUserId] = useState(null);
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [modalYear, setModalYear] = useState(() => new Date().getFullYear());
  const [modalMonth, setModalMonth] = useState(() => new Date().getMonth());

  const [habits, setHabits] = useState([]);
  const [monthCompletions, setMonthCompletions] = useState([]);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [entryLoading, setEntryLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [otherNotesSupported, setOtherNotesSupported] = useState(true);

  const [reflectionPrompt, setReflectionPrompt] = useState(null);
  const [reflectionTheme, setReflectionTheme] = useState(null);

  const [oneThing, setOneThing] = useState('');
  const [morningNote, setMorningNote] = useState('');
  const [oneWin, setOneWin] = useState('');
  const [sleepHours, setSleepHours] = useState('');
  const [eveningNote, setEveningNote] = useState('');
  const [otherNotes, setOtherNotes] = useState('');
  const [otherNotesExpanded, setOtherNotesExpanded] = useState(false);

  const otherNotesDebounceRef = useRef(null);

  const selectedYear = useMemo(
    () => parseDateKey(selectedDateKey).getFullYear(),
    [selectedDateKey]
  );
  const selectedMonth = useMemo(
    () => parseDateKey(selectedDateKey).getMonth(),
    [selectedDateKey]
  );

  const isFuture = isFutureDate(selectedDateKey, todayKey);
  const isEditable = isWithinEditableWindow(selectedDateKey, todayKey);
  const isReadOnly = !isFuture && !isEditable;
  const inputEditable = isEditable && !entryLoading;
  const dimmed = isReadOnly;

  const sleepDisplay = useMemo(() => {
    if (sleepHours === '') return '— hrs';
    const n = parseFloat(sleepHours);
    if (Number.isNaN(n)) return sleepHours;
    return `${n} hrs`;
  }, [sleepHours]);

  const topBarMonthLabel = useMemo(() => {
    const d = parseDateKey(selectedDateKey);
    return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
  }, [selectedDateKey]);

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

    const year = calendarOpen ? modalYear : selectedYear;
    const month = calendarOpen ? modalMonth : selectedMonth;
    const { start, end } = getMonthRangeKeys(year, month);

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
  }, [calendarOpen, modalYear, modalMonth, selectedYear, selectedMonth]);

  const loadReflectionPrompt = useCallback(async () => {
    const today = new Date();
    const dayOfYear = getDayOfYear(today);
    const { data } = await supabase
      .from('reflection_prompts')
      .select('prompt, theme')
      .eq('day_of_year', dayOfYear)
      .maybeSingle();

    setReflectionPrompt(data?.prompt ?? null);
    setReflectionTheme(data?.theme ?? null);
  }, []);

  const loadEntry = useCallback(async () => {
    if (!userId || !selectedDateKey) return;
    setEntryLoading(true);
    const { data, error } = await supabase
      .from('daily_entries')
      .select('*')
      .eq('user_id', userId)
      .eq('entry_date', selectedDateKey)
      .maybeSingle();

    if (error && isOtherNotesColumnError(error)) {
      setOtherNotesSupported(false);
    }

    const notes = data?.other_notes ?? '';
    setOneThing(data?.one_thing ?? '');
    setMorningNote(data?.journal_note ?? '');
    setOneWin(data?.win_of_day ?? '');
    setSleepHours(
      data?.sleep_hours != null && data?.sleep_hours !== ''
        ? String(data.sleep_hours)
        : ''
    );
    setEveningNote(data?.evening_note ?? '');
    setOtherNotes(notes);
    setOtherNotesExpanded(Boolean(notes?.trim()));
    setEntryLoading(false);
  }, [userId, selectedDateKey]);

  const saveOtherNotes = useCallback(
    async (text) => {
      if (!userId || !isEditable || !otherNotesSupported) return;

      const payload = {
        user_id: userId,
        entry_date: selectedDateKey,
        other_notes: text.trim() || null,
      };

      const { error } = await supabase
        .from('daily_entries')
        .upsert(payload, { onConflict: 'user_id,entry_date' });

      if (error && isOtherNotesColumnError(error)) {
        setOtherNotesSupported(false);
      }
    },
    [userId, selectedDateKey, isEditable, otherNotesSupported]
  );

  const handleOtherNotesChange = (text) => {
    setOtherNotes(text);
    if (!inputEditable || !otherNotesSupported) return;
    if (otherNotesDebounceRef.current) {
      clearTimeout(otherNotesDebounceRef.current);
    }
    otherNotesDebounceRef.current = setTimeout(() => {
      saveOtherNotes(text);
    }, 500);
  };

  useFocusEffect(
    useCallback(() => {
      loadCalendarData();
      loadReflectionPrompt();
    }, [loadCalendarData, loadReflectionPrompt])
  );

  useEffect(() => {
    if (userId) loadEntry();
  }, [userId, selectedDateKey, loadEntry]);

  useEffect(() => {
    if (calendarOpen) {
      loadCalendarData();
    }
  }, [calendarOpen, modalYear, modalMonth, loadCalendarData]);

  useEffect(() => {
    if (userId && !calendarOpen) {
      loadCalendarData();
    }
  }, [userId, selectedYear, selectedMonth, calendarOpen, loadCalendarData]);

  useEffect(() => {
    if (!savedFlash) return undefined;
    const t = setTimeout(() => setSavedFlash(false), 2000);
    return () => clearTimeout(t);
  }, [savedFlash]);

  useEffect(
    () => () => {
      if (otherNotesDebounceRef.current) {
        clearTimeout(otherNotesDebounceRef.current);
      }
    },
    []
  );

  const openCalendar = () => {
    const d = parseDateKey(selectedDateKey);
    setModalYear(d.getFullYear());
    setModalMonth(d.getMonth());
    setCalendarOpen(true);
  };

  const selectDateFromCalendar = (key) => {
    if (isFutureDate(key, todayKey)) return;
    setSelectedDateKey(key);
    setCalendarOpen(false);
  };

  const goPrevMonthTop = () => {
    setSelectedDateKey((k) => shiftMonth(k, -1));
  };

  const goNextMonthTop = () => {
    const next = shiftMonth(selectedDateKey, 1);
    if (!isFutureDate(next, todayKey)) {
      setSelectedDateKey(next);
    }
  };

  const goPrevMonthModal = () => {
    if (modalMonth === 0) {
      setModalMonth(11);
      setModalYear((y) => y - 1);
    } else {
      setModalMonth((m) => m - 1);
    }
  };

  const goNextMonthModal = () => {
    if (modalMonth === 11) {
      setModalMonth(0);
      setModalYear((y) => y + 1);
    } else {
      setModalMonth((m) => m + 1);
    }
  };

  const adjustSleep = (delta) => {
    if (!inputEditable) return;
    const current = sleepHours === '' ? 0 : parseFloat(sleepHours);
    const next = Math.min(12, Math.max(0, Math.round((current + delta) * 2) / 2));
    setSleepHours(String(next));
  };

  const toggleOtherThoughts = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOtherNotesExpanded((v) => !v);
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

    if (otherNotesSupported) {
      payload.other_notes = otherNotes.trim() || null;
    }

    const { error } = await supabase
      .from('daily_entries')
      .upsert(payload, { onConflict: 'user_id,entry_date' });

    if (error && isOtherNotesColumnError(error)) {
      setOtherNotesSupported(false);
      const { error: retryError } = await supabase
        .from('daily_entries')
        .upsert(
          {
            user_id: userId,
            entry_date: selectedDateKey,
            one_thing: payload.one_thing,
            journal_note: payload.journal_note,
            win_of_day: payload.win_of_day,
            sleep_hours: payload.sleep_hours,
            evening_note: payload.evening_note,
          },
          { onConflict: 'user_id,entry_date' }
        );
      setSaving(false);
      if (!retryError) {
        setSavedFlash(true);
        await loadEntry();
      }
      return;
    }

    setSaving(false);
    if (!error) {
      setSavedFlash(true);
      await loadEntry();
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={goPrevMonthTop}
          style={styles.topBarNavBtn}
          activeOpacity={0.7}
          accessibilityLabel="Previous month">
          <Text style={styles.topBarArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.topBarMonth}>{topBarMonthLabel}</Text>
        <TouchableOpacity
          onPress={goNextMonthTop}
          style={styles.topBarNavBtn}
          activeOpacity={0.7}
          accessibilityLabel="Next month">
          <Text style={styles.topBarArrow}>→</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={openCalendar}
          style={styles.calendarBtn}
          activeOpacity={0.7}
          accessibilityLabel="Open calendar">
          <Text style={styles.calendarIcon}>▦</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <Text style={styles.dayName}>{dayName(selectedDateKey)}</Text>
        <Text style={styles.dateLine}>{dateSubtitleUpper(selectedDateKey)}</Text>

        <View style={styles.headerDivider} />

        {isFuture ? (
          <Text style={styles.futureMessage}>This day is still ahead of you.</Text>
        ) : entryLoading ? (
          <ActivityIndicator
            color={J.accent}
            style={styles.entryLoader}
            size="small"
          />
        ) : (
          <>
            <Text style={styles.sectionLabel}>THIS MORNING</Text>

            <Text style={[styles.fieldLabel, styles.padH]}>REST</Text>
            <View style={[styles.sleepRow, dimmed && styles.dimmed]}>
              <TouchableOpacity
                style={styles.sleepBtn}
                onPress={() => adjustSleep(-0.5)}
                disabled={!inputEditable}>
                <Text style={styles.sleepBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.sleepValue}>{sleepDisplay}</Text>
              <TouchableOpacity
                style={styles.sleepBtn}
                onPress={() => adjustSleep(0.5)}
                disabled={!inputEditable}>
                <Text style={styles.sleepBtnText}>+</Text>
              </TouchableOpacity>
            </View>

            <ThinDivider style={styles.dividerTight} />

            <Text style={[styles.accentFieldLabel, styles.padH, styles.reflectionLabelTop]}>
              TODAY&apos;S REFLECTION
            </Text>
            <Text style={[styles.promptText, styles.padH]}>
              {reflectionPrompt ||
                (reflectionTheme
                  ? `Theme: ${reflectionTheme}`
                  : 'Take a breath. What is true for you right now?')}
            </Text>

            <Text style={[styles.fieldLabel, styles.padH]}>YOUR REFLECTION</Text>
            <TextInput
              style={[styles.multilineInput, styles.padH, dimmed && styles.dimmed]}
              placeholder="Write your response..."
              placeholderTextColor={J.placeholder}
              value={morningNote}
              onChangeText={setMorningNote}
              multiline
              textAlignVertical="top"
              editable={inputEditable}
            />

            <ThinDivider style={styles.dividerSection} />

            <Text style={[styles.fieldLabel, styles.padH]}>WHAT MATTERS MOST TODAY</Text>
            <TextInput
              style={[styles.lineInput, styles.padH, dimmed && styles.dimmed]}
              placeholder="The one thing..."
              placeholderTextColor={J.placeholder}
              value={oneThing}
              onChangeText={setOneThing}
              editable={inputEditable}
            />

            <SacredDivider />

            <Text style={styles.sectionLabel}>THIS EVENING</Text>

            <Text style={[styles.fieldLabel, styles.padH]}>A MOMENT THAT MATTERED</Text>
            <TextInput
              style={[
                styles.multilineInput,
                styles.multilineMoment,
                styles.padH,
                dimmed && styles.dimmed,
              ]}
              placeholder="A moment of showing up today..."
              placeholderTextColor={J.placeholder}
              value={oneWin}
              onChangeText={setOneWin}
              multiline
              textAlignVertical="top"
              editable={inputEditable}
            />

            <ThinDivider style={styles.dividerSection} />

            <Text style={[styles.fieldLabel, styles.padH]}>EVENING REFLECTION</Text>
            <TextInput
              style={[styles.multilineInput, styles.padH, dimmed && styles.dimmed]}
              placeholder="How did today unfold?"
              placeholderTextColor={J.placeholder}
              value={eveningNote}
              onChangeText={setEveningNote}
              multiline
              textAlignVertical="top"
              editable={inputEditable}
            />

            <View style={styles.otherThoughtsWrap}>
              <TouchableOpacity
                style={styles.otherThoughtsToggle}
                onPress={toggleOtherThoughts}
                activeOpacity={0.7}
                disabled={isFuture}>
                <Text style={styles.otherThoughtsToggleText}>
                  · · ·  other thoughts  · · ·
                </Text>
              </TouchableOpacity>
            </View>

            {otherNotesExpanded ? (
              <View>
                <Text style={[styles.fieldLabel, styles.padH]}>OTHER THOUGHTS</Text>
                <TextInput
                  style={[
                    styles.multilineInput,
                    styles.multilineTall,
                    styles.padH,
                    dimmed && styles.dimmed,
                  ]}
                  placeholder="Anything else on your mind..."
                  placeholderTextColor={J.placeholder}
                  value={otherNotes}
                  onChangeText={handleOtherNotesChange}
                  multiline
                  textAlignVertical="top"
                  editable={inputEditable && otherNotesSupported}
                />
              </View>
            ) : null}

            {isReadOnly ? (
              <Text style={styles.readOnlyHint}>
                Entries older than 7 days are read only.
              </Text>
            ) : null}

            {isEditable ? (
              <View style={styles.saveWrap}>
                <TouchableOpacity
                  style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                  onPress={handleSave}
                  disabled={saving}>
                  <Text style={styles.saveBtnText}>
                    {saving ? 'Saving…' : 'Save reflection'}
                  </Text>
                </TouchableOpacity>
                {savedFlash ? (
                  <Text style={styles.savedFlash}>Saved ✦</Text>
                ) : null}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      <Modal
        visible={calendarOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCalendarOpen(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setCalendarOpen(false)}
          />
          <View style={styles.modalSheet}>
            <MonthCalendar
              year={modalYear}
              month={modalMonth}
              todayKey={todayKey}
              selectedDateKey={selectedDateKey}
              habits={habits}
              completions={monthCompletions}
              loading={calendarLoading}
              onSelectDate={selectDateFromCalendar}
              onPrevMonth={goPrevMonthModal}
              onNextMonth={goNextMonthModal}
              onClose={() => setCalendarOpen(false)}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: J.bg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  topBarNavBtn: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  topBarArrow: {
    color: J.accent,
    fontSize: 16,
    fontFamily: 'DMSans_400Regular',
  },
  topBarMonth: {
    color: J.muted,
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    marginHorizontal: 8,
    flex: 1,
    textAlign: 'center',
  },
  calendarBtn: {
    padding: 4,
    marginLeft: 4,
  },
  calendarIcon: {
    color: J.muted,
    fontSize: 18,
    fontFamily: 'DMSans_400Regular',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  dayName: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 40,
    color: J.text,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  dateLine: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 11,
    color: J.muted,
    letterSpacing: 3,
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  headerDivider: {
    height: 1,
    backgroundColor: J.divider,
    marginHorizontal: 24,
    marginBottom: 24,
  },
  padH: {
    paddingHorizontal: 24,
  },
  sectionLabel: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 10,
    color: J.accent,
    letterSpacing: 2,
    textTransform: 'uppercase',
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  fieldLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 10,
    color: J.muted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  accentFieldLabel: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 10,
    color: J.accent,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  reflectionLabelTop: {
    marginTop: 24,
  },
  thinDivider: {
    height: 1,
    backgroundColor: J.divider,
    marginHorizontal: 24,
  },
  dividerTight: {
    marginVertical: 4,
  },
  dividerSection: {
    marginVertical: 20,
  },
  promptText: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 18,
    color: J.prompt,
    lineHeight: 28,
    paddingHorizontal: 24,
    marginBottom: 20,
    fontStyle: 'italic',
  },
  lineInput: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: J.divider,
    color: J.text,
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    fontStyle: 'italic',
    marginBottom: 0,
  },
  multilineInput: {
    minHeight: 160,
    paddingHorizontal: 24,
    backgroundColor: 'transparent',
    color: J.text,
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    lineHeight: 24,
    borderWidth: 0,
    textAlignVertical: 'top',
    marginBottom: 0,
  },
  multilineMoment: {
    minHeight: 100,
  },
  multilineTall: {
    minHeight: 200,
  },
  sleepRow: {
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginBottom: 24,
  },
  sleepBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: J.accent + '50',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  sleepBtnText: {
    color: J.accent,
    fontSize: 18,
  },
  sleepValue: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    color: J.text,
  },
  sacredDividerRow: {
    marginVertical: 40,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sacredDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: J.divider,
  },
  sacredDividerStar: {
    color: J.muted + '80',
    fontSize: 10,
    letterSpacing: 4,
    marginHorizontal: 16,
    fontFamily: 'DMSans_400Regular',
  },
  otherThoughtsWrap: {
    marginTop: 32,
    marginBottom: 8,
    alignItems: 'center',
  },
  otherThoughtsToggle: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  otherThoughtsToggleText: {
    fontFamily: 'DMSans_400Regular',
    color: J.muted,
    fontSize: 11,
    letterSpacing: 4,
  },
  futureMessage: {
    fontSize: 15,
    color: J.muted,
    fontStyle: 'italic',
    fontFamily: 'DMSans_400Regular',
    paddingHorizontal: 24,
    marginTop: 8,
  },
  entryLoader: {
    marginTop: 32,
    marginBottom: 32,
  },
  dimmed: {
    opacity: 0.45,
  },
  readOnlyHint: {
    fontSize: 11,
    color: J.muted,
    textAlign: 'center',
    marginTop: 16,
    fontFamily: 'DMSans_400Regular',
    letterSpacing: 1,
    paddingHorizontal: 24,
  },
  saveWrap: {
    marginHorizontal: 24,
    marginTop: 40,
    marginBottom: 60,
  },
  saveBtn: {
    backgroundColor: J.accent,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    color: '#ffffff',
    textAlign: 'center',
  },
  savedFlash: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: J.accent,
    textAlign: 'center',
    marginTop: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: '#000000cc',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalSheet: {
    backgroundColor: J.bg,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: J.divider,
  },
  modalCalendar: {},
  modalTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTopSpacer: {
    flex: 1,
  },
  modalCloseBtn: {
    padding: 8,
  },
  modalCloseText: {
    color: J.muted,
    fontSize: 18,
    fontFamily: 'DMSans_400Regular',
  },
  modalCalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalCalTitle: {
    flex: 1,
    textAlign: 'center',
    color: J.text,
    fontSize: 14,
    fontFamily: 'DMSans_500Medium',
    letterSpacing: 1,
  },
  calNavBtn: {
    padding: 8,
    minWidth: 40,
    alignItems: 'center',
  },
  calNavArrow: {
    color: J.accent,
    fontSize: 18,
    fontFamily: 'DMSans_400Regular',
  },
  weekHeaderRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekHeader: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    color: J.muted,
    fontFamily: 'DMSans_400Regular',
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
    backgroundColor: J.accent,
  },
  daySelectedRing: {
    borderWidth: 1,
    borderColor: J.muted + '80',
  },
  dayNumber: {
    fontSize: 14,
    color: J.text,
    fontFamily: 'DMSans_400Regular',
  },
  dayNumberOutMonth: {
    color: J.muted,
    opacity: 0.4,
  },
  dayNumberFuture: {
    opacity: 0.35,
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
});
