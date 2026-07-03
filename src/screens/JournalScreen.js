import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  RefreshControl,
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
import { Ionicons } from '@expo/vector-icons';
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

function isFutureDate(dateKey, todayKey) {
  return dateKey > todayKey;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_HEADERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

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

function isWithinEditableWindow(dateKey, todayKey) {
  if (dateKey > todayKey) return false;
  const today = parseDateKey(todayKey);
  const d = parseDateKey(dateKey);
  const diffDays = Math.round((today - d) / 86400000);
  return diffDays <= 7;
}

function shiftDay(dateKey, delta) {
  const d = parseDateKey(dateKey);
  d.setDate(d.getDate() + delta);
  return formatLocalDateKey(d);
}

function dayName(dateKey) {
  return parseDateKey(dateKey).toLocaleDateString('en-US', {
    weekday: 'long',
  });
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

export default function JournalScreen() {
  const todayKey = useMemo(() => formatLocalDateKey(new Date()), []);

  const [userId, setUserId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey);

  const [entryLoading, setEntryLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [otherNotesSupported, setOtherNotesSupported] = useState(true);

  const [reflectionPrompt, setReflectionPrompt] = useState(null);
  const [reflectionTheme, setReflectionTheme] = useState(null);

  const [oneThing, setOneThing] = useState('');
  const [reflectionAnswer, setReflectionAnswer] = useState('');
  const [morningNote, setMorningNote] = useState('');
  const [oneWin, setOneWin] = useState('');
  const [eveningNote, setEveningNote] = useState('');
  const [otherNotes, setOtherNotes] = useState('');
  const [otherNotesExpanded, setOtherNotesExpanded] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [modalYear, setModalYear] = useState(() => new Date().getFullYear());
  const [modalMonth, setModalMonth] = useState(() => new Date().getMonth());
  const [monthEntryDates, setMonthEntryDates] = useState(new Set());
  const [calendarLoading, setCalendarLoading] = useState(false);

  const otherNotesDebounceRef = useRef(null);

  const isFuture = isFutureDate(selectedDateKey, todayKey);
  const isToday = selectedDateKey === todayKey;
  const isEditable = isWithinEditableWindow(selectedDateKey, todayKey);
  const isReadOnly = !isFuture && !isEditable;
  const inputEditable = isEditable && !entryLoading;
  const dimmed = isReadOnly;

  const dateNavLabel = useMemo(() => {
    if (selectedDateKey === todayKey) return 'Today';
    return parseDateKey(selectedDateKey).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  }, [selectedDateKey, todayKey]);

  const reflectionHeaderTitle = useMemo(() => {
    if (selectedDateKey === todayKey) return "Today's Reflection";
    return `${dayName(selectedDateKey)}'s Reflection`;
  }, [selectedDateKey, todayKey]);

  const loadUser = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    setUserId(userData?.user?.id ?? null);
  }, []);

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
    setReflectionAnswer(data?.reflection_answer ?? '');
    setMorningNote('');
    setOneWin(data?.win_of_day ?? '');
    setEveningNote(data?.evening_note ?? '');
    setOtherNotes(notes);
    setOtherNotesExpanded(false);
    setEntryLoading(false);
  }, [userId, selectedDateKey]);

  const loadMonthEntryDates = useCallback(async () => {
    if (!userId) return;
    setCalendarLoading(true);
    const { start, end } = getMonthRangeKeys(modalYear, modalMonth);
    const { data } = await supabase
      .from('daily_entries')
      .select('entry_date')
      .eq('user_id', userId)
      .gte('entry_date', start)
      .lte('entry_date', end);
    setMonthEntryDates(
      new Set((data || []).map((row) => String(row.entry_date).slice(0, 10)))
    );
    setCalendarLoading(false);
  }, [userId, modalYear, modalMonth]);

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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadUser();
    await loadReflectionPrompt();
    await loadEntry();
    setRefreshing(false);
  }, [loadUser, loadReflectionPrompt, loadEntry]);

  useFocusEffect(
    useCallback(() => {
      loadUser();
      loadReflectionPrompt();
    }, [loadUser, loadReflectionPrompt])
  );

  useEffect(() => {
    if (userId) loadEntry();
  }, [userId, selectedDateKey, loadEntry]);

  useEffect(() => {
    if (calendarOpen) {
      loadMonthEntryDates();
    }
  }, [calendarOpen, modalYear, modalMonth, loadMonthEntryDates]);

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

  const goPrevDay = () => {
    setSelectedDateKey((k) => shiftDay(k, -1));
  };

  const goNextDay = () => {
    const next = shiftDay(selectedDateKey, 1);
    if (!isFutureDate(next, todayKey)) {
      setSelectedDateKey(next);
    }
  };

  const openCalendar = () => {
    const d = parseDateKey(selectedDateKey);
    setModalYear(d.getFullYear());
    setModalMonth(d.getMonth());
    setCalendarOpen(true);
  };

  const goPrevMonth = () => {
    if (modalMonth === 0) {
      setModalMonth(11);
      setModalYear((y) => y - 1);
    } else {
      setModalMonth((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    if (modalMonth === 11) {
      setModalMonth(0);
      setModalYear((y) => y + 1);
    } else {
      setModalMonth((m) => m + 1);
    }
  };

  const selectCalendarDate = (key) => {
    if (isFutureDate(key, todayKey)) return;
    setSelectedDateKey(key);
    setCalendarOpen(false);
  };

  const calendarDays = useMemo(
    () => getCalendarGridDays(modalYear, modalMonth),
    [modalYear, modalMonth]
  );

  const toggleOtherThoughts = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOtherNotesExpanded((v) => !v);
  };

  const handleSave = async () => {
    if (!userId || !isEditable) return;
    setSaving(true);

    try {
    const payload = {
      user_id: userId,
      entry_date: selectedDateKey,
      one_thing: oneThing.trim() || null,
      reflection_answer: reflectionAnswer,
      win_of_day: oneWin.trim() || null,
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
            reflection_answer: payload.reflection_answer,
            win_of_day: payload.win_of_day,
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
    } catch (error) {
      console.log('save error:', error);
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={90}>
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
        <View style={styles.dateNavWrap}>
          <View style={styles.dateNav}>
            <TouchableOpacity
              onPress={goPrevDay}
              style={styles.dateNavBtn}
              activeOpacity={0.7}
              accessibilityLabel="Previous day">
              <Text style={styles.dateNavArrow}>←</Text>
            </TouchableOpacity>
            <Text style={styles.dateNavLabel}>{dateNavLabel}</Text>
            <TouchableOpacity
              onPress={goNextDay}
              style={styles.dateNavBtn}
              activeOpacity={0.7}
              disabled={isToday}
              accessibilityLabel="Next day">
              <Text style={[styles.dateNavArrow, isToday && styles.dateNavArrowDisabled]}>→</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            onPress={openCalendar}
            style={styles.calendarBtn}
            activeOpacity={0.7}
            accessibilityLabel="Open calendar">
            <Ionicons name="calendar-outline" size={22} color={J.accent} />
          </TouchableOpacity>
        </View>

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
            <Text style={styles.reflectionHeader}>{reflectionHeaderTitle}</Text>

            <View style={styles.promptCard}>
              <Text style={styles.promptText}>
                {reflectionPrompt ||
                  (reflectionTheme
                    ? `Theme: ${reflectionTheme}`
                    : 'Take a breath. What is true for you right now?')}
              </Text>
            </View>

            <Text style={styles.accentFieldLabel}>YOUR REFLECTION</Text>
            <TextInput
              style={[styles.textInput, styles.textInputMultiline, dimmed && styles.dimmed]}
              placeholder="Write your reflection here..."
              placeholderTextColor={J.placeholder}
              value={reflectionAnswer}
              onChangeText={setReflectionAnswer}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              editable={inputEditable}
            />

            <Text style={[styles.sectionLabel, styles.sectionSpaced]}>MORNING</Text>

            <Text style={styles.fieldLabel}>My intention for today</Text>
            <TextInput
              style={[styles.textInput, dimmed && styles.dimmed]}
              placeholder="I intend to..."
              placeholderTextColor={J.placeholder}
              value={oneThing}
              onChangeText={setOneThing}
              editable={inputEditable}
            />

            <Text style={[styles.fieldLabel, styles.fieldLabelSpaced]}>Morning reflection</Text>
            <TextInput
              style={[styles.textInput, styles.textInputMultiline, dimmed && styles.dimmed]}
              placeholder="What's on your mind..."
              placeholderTextColor={J.placeholder}
              value={morningNote}
              onChangeText={setMorningNote}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              editable={inputEditable}
            />

            <Text style={[styles.sectionLabel, styles.sectionSpaced]}>EVENING</Text>

            <Text style={styles.fieldLabel}>A win from today</Text>
            <TextInput
              style={[styles.textInput, dimmed && styles.dimmed]}
              placeholder="Today I showed up by..."
              placeholderTextColor={J.placeholder}
              value={oneWin}
              onChangeText={setOneWin}
              editable={inputEditable}
            />

            <Text style={[styles.fieldLabel, styles.fieldLabelSpaced]}>Evening reflection</Text>
            <TextInput
              style={[styles.textInput, styles.textInputMultiline, dimmed && styles.dimmed]}
              placeholder="How did today feel..."
              placeholderTextColor={J.placeholder}
              value={eveningNote}
              onChangeText={setEveningNote}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              editable={inputEditable}
            />

            {!otherNotesExpanded ? (
              <TouchableOpacity
                style={styles.otherThoughtsLinkWrap}
                onPress={toggleOtherThoughts}
                activeOpacity={0.7}
                disabled={isFuture}>
                <Text style={styles.otherThoughtsLink}>+ Other thoughts</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.otherNotesExpanded}>
                <TextInput
                  style={[styles.textInput, styles.textInputMultiline, dimmed && styles.dimmed]}
                  placeholder="Anything else on your mind..."
                  placeholderTextColor={J.placeholder}
                  value={otherNotes}
                  onChangeText={handleOtherNotesChange}
                  multiline
                  textAlignVertical="top"
                  editable={inputEditable && otherNotesSupported}
                />
              </View>
            )}

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
      </KeyboardAvoidingView>

      <Modal
        visible={calendarOpen}
        animationType="slide"
        onRequestClose={() => setCalendarOpen(false)}>
        <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>
          <View style={styles.modalTopRow}>
            <View style={styles.modalTopSpacer} />
            <TouchableOpacity
              onPress={() => setCalendarOpen(false)}
              style={styles.modalCancelBtn}
              activeOpacity={0.7}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalMonthNav}>
            <TouchableOpacity
              onPress={goPrevMonth}
              style={styles.modalNavBtn}
              activeOpacity={0.7}>
              <Text style={styles.modalNavArrow}>←</Text>
            </TouchableOpacity>
            <Text style={styles.modalMonthTitle}>
              {MONTH_NAMES[modalMonth]} {modalYear}
            </Text>
            <TouchableOpacity
              onPress={goNextMonth}
              style={styles.modalNavBtn}
              activeOpacity={0.7}>
              <Text style={styles.modalNavArrow}>→</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalWeekHeader}>
            {DAY_HEADERS.map((label, index) => (
              <Text key={`${label}-${index}`} style={styles.modalWeekDay}>
                {label}
              </Text>
            ))}
          </View>

          {calendarLoading ? (
            <ActivityIndicator color={J.accent} style={styles.modalLoader} />
          ) : (
            <View style={styles.modalGrid}>
              {calendarDays.map((day) => {
                const isToday = day.key === todayKey;
                const isSelected = day.key === selectedDateKey;
                const isFutureDay = isFutureDate(day.key, todayKey);
                const hasEntry = monthEntryDates.has(day.key);
                const showHighlight = isToday || isSelected;

                return (
                  <TouchableOpacity
                    key={day.key}
                    style={styles.modalDayCell}
                    onPress={() => selectCalendarDate(day.key)}
                    activeOpacity={0.7}
                    disabled={isFutureDay}>
                    <View
                      style={[
                        styles.modalDayCircle,
                        showHighlight && styles.modalDayCircleActive,
                      ]}>
                      <Text
                        style={[
                          styles.modalDayNumber,
                          !day.inMonth && styles.modalDayNumberOutMonth,
                          isFutureDay && styles.modalDayNumberFuture,
                          showHighlight && styles.modalDayNumberActive,
                        ]}>
                        {day.date.getDate()}
                      </Text>
                    </View>
                    {hasEntry && !isFutureDay ? (
                      <View style={styles.modalEntryDot} />
                    ) : (
                      <View style={styles.modalEntryDotSpacer} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: J.bg,
  },
  dateNavWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateNav: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingBottom: 8,
  },
  calendarBtn: {
    padding: 8,
    marginLeft: 4,
  },
  dateNavBtn: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    minWidth: 44,
    alignItems: 'center',
  },
  dateNavArrow: {
    color: J.accent,
    fontSize: 22,
  },
  dateNavArrowDisabled: {
    opacity: 0.25,
  },
  dateNavLabel: {
    flex: 1,
    fontSize: 16,
    color: J.text,
    fontFamily: 'PlayfairDisplay_300Light',
    textAlign: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  reflectionHeader: {
    fontSize: 28,
    fontFamily: 'PlayfairDisplay_300Light',
    color: J.text,
    marginBottom: 4,
  },
  promptCard: {
    backgroundColor: J.surface,
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 3,
    borderLeftColor: J.accent,
    marginBottom: 24,
  },
  promptText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    color: J.accent,
    lineHeight: 24,
    fontStyle: 'italic',
  },
  sectionLabel: {
    fontSize: 10,
    letterSpacing: 3,
    color: J.muted,
    fontFamily: 'DMSans_500Medium',
    marginBottom: 12,
  },
  sectionSpaced: {
    marginTop: 24,
  },
  fieldLabel: {
    fontSize: 12,
    color: '#9d8ec0',
    fontFamily: 'DMSans_500Medium',
    marginBottom: 6,
  },
  accentFieldLabel: {
    fontSize: 9,
    letterSpacing: 2,
    color: J.accent,
    textTransform: 'uppercase',
    fontFamily: 'DMSans_500Medium',
    marginBottom: 6,
  },
  fieldLabelSpaced: {
    marginTop: 16,
  },
  textInput: {
    backgroundColor: J.surface,
    borderRadius: 12,
    padding: 16,
    color: J.text,
    fontSize: 15,
    fontFamily: 'DMSans_400Regular',
    borderWidth: 1,
    borderColor: J.divider,
  },
  textInputMultiline: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  otherThoughtsLinkWrap: {
    marginTop: 24,
    alignItems: 'center',
  },
  otherThoughtsLink: {
    color: J.muted,
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
  },
  otherNotesExpanded: {
    marginTop: 24,
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
    marginTop: 24,
    marginBottom: 8,
  },
  saveBtn: {
    backgroundColor: J.accent,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    width: '100%',
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f0d1a',
    fontFamily: 'DMSans_500Medium',
    textAlign: 'center',
  },
  savedFlash: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: J.accent,
    textAlign: 'center',
    marginTop: 8,
  },
  modalSafe: {
    flex: 1,
    backgroundColor: J.bg,
    paddingHorizontal: 24,
  },
  modalTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingTop: 8,
    paddingBottom: 4,
  },
  modalTopSpacer: {
    flex: 1,
  },
  modalCancelBtn: {
    padding: 8,
  },
  modalCancelText: {
    fontSize: 15,
    color: J.accent,
    fontFamily: 'DMSans_400Regular',
  },
  modalMonthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  modalMonthTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    color: J.text,
    fontFamily: 'PlayfairDisplay_300Light',
  },
  modalNavBtn: {
    padding: 8,
    minWidth: 40,
    alignItems: 'center',
  },
  modalNavArrow: {
    color: J.accent,
    fontSize: 22,
    fontFamily: 'DMSans_400Regular',
  },
  modalWeekHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  modalWeekDay: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    color: '#ffffff45',
    textTransform: 'uppercase',
    fontFamily: 'DMSans_400Regular',
    letterSpacing: 1,
  },
  modalLoader: {
    marginTop: 32,
  },
  modalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  modalDayCell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    paddingVertical: 8,
  },
  modalDayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDayCircleActive: {
    backgroundColor: J.accent,
  },
  modalDayNumber: {
    fontSize: 15,
    color: J.text,
    fontFamily: 'DMSans_400Regular',
  },
  modalDayNumberOutMonth: {
    color: '#ffffff45',
  },
  modalDayNumberFuture: {
    color: '#ffffff25',
  },
  modalDayNumberActive: {
    color: '#0f0d1a',
  },
  modalEntryDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: J.accent,
    marginTop: 4,
  },
  modalEntryDotSpacer: {
    width: 4,
    height: 4,
    marginTop: 4,
  },
});
