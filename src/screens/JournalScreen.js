import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  LayoutAnimation,
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

function buildFallbackJournalSummary(entry) {
  const parts = [];
  if (entry.one_thing) parts.push(`you set an intention around ${entry.one_thing}`);
  if (entry.win_of_day) parts.push(`you noticed a win in ${entry.win_of_day}`);
  if (entry.journal_note) parts.push(`your morning reflection shows ${entry.journal_note}`);
  if (entry.evening_note) parts.push(`your evening reflection shows ${entry.evening_note}`);
  if (entry.other_notes) parts.push(`you left space for ${entry.other_notes}`);

  if (parts.length === 0) {
    return 'You are someone who returns to reflection — and that practice is already part of who you are.';
  }

  return `You are someone who shows up in your own words today: ${parts.join(', ')}. That is who you are, not who you are trying to become.`;
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
  const [sleepHours, setSleepHours] = useState('');
  const [eveningNote, setEveningNote] = useState('');
  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [journalSummary, setJournalSummary] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [journalReflectActive, setJournalReflectActive] = useState(false);
  const [otherNotes, setOtherNotes] = useState('');
  const [otherNotesExpanded, setOtherNotesExpanded] = useState(false);

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
    setReflectionAnswer(data?.journal_note ?? '');
    setMorningNote('');
    setOneWin(data?.win_of_day ?? '');
    setSleepHours(
      data?.sleep_hours != null && data?.sleep_hours !== ''
        ? String(data.sleep_hours)
        : ''
    );
    setEveningNote(data?.evening_note ?? '');
    setAiSummary(data?.ai_daily_summary ?? null);
    setOtherNotes(notes);
    setOtherNotesExpanded(false);
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
    setJournalReflectActive(false);
    setJournalSummary('');
    setSummaryLoading(false);
  }, [selectedDateKey]);

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

  const toggleOtherThoughts = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOtherNotesExpanded((v) => !v);
  };

  const generateJournalSummary = async (entry) => {
    const parts = [];
    if (entry.one_thing) parts.push(`Intention: ${entry.one_thing}`);
    if (entry.win_of_day) parts.push(`Win: ${entry.win_of_day}`);
    if (entry.journal_note) parts.push(`Morning reflection: ${entry.journal_note}`);
    if (entry.evening_note) parts.push(`Evening reflection: ${entry.evening_note}`);
    if (entry.other_notes) parts.push(`Other thoughts: ${entry.other_notes}`);
    if (parts.length === 0) return;

    const fallback = buildFallbackJournalSummary(entry);

    try {
      setSummaryLoading(true);
      const prompt = `You are Meridian, a warm life companion. Read this journal entry and write exactly 2 warm, specific sentences directly to this person. Be personal and grounded in what they actually wrote. Never end with a general statement about identity or who they are. Never summarize their character. Just reflect their day back to them warmly and specifically.

Journal entry: ${parts.join('. ')}`;

      const { data, error: invokeError } = await supabase.functions.invoke(
        'anthropic',
        {
          body: {
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 300,
            messages: [{ role: 'user', content: prompt }],
          },
        }
      );

      if (invokeError) {
        console.log('Journal summary error:', invokeError);
        setJournalSummary(fallback);
      } else {
        const summaryText = data?.content?.[0]?.text ?? null;
        setJournalSummary(summaryText || fallback);
      }
    } catch (e) {
      console.log('Journal summary error:', e);
      setJournalSummary(fallback);
    } finally {
      setSummaryLoading(false);
    }
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
      journal_note: reflectionAnswer.trim() || null,
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
        setJournalReflectActive(true);
        setSummaryLoading(true);
        generateJournalSummary({
          one_thing: payload.one_thing,
          win_of_day: payload.win_of_day,
          journal_note: payload.journal_note,
          evening_note: payload.evening_note,
          other_notes: payload.other_notes,
        });
        await loadEntry();
        if (eveningNote.trim()) {
          generateDailySummary();
        }
      }
      return;
    }

    setSaving(false);
    if (!error) {
      setSavedFlash(true);
      setJournalReflectActive(true);
      setSummaryLoading(true);
      generateJournalSummary({
        one_thing: payload.one_thing,
        win_of_day: payload.win_of_day,
        journal_note: payload.journal_note,
        evening_note: payload.evening_note,
        other_notes: payload.other_notes,
      });
      await loadEntry();
      if (eveningNote.trim()) {
        generateDailySummary();
      }
    }
  };

  const generateDailySummary = async () => {
    if (!userId || !selectedDateKey) return;
    setAiLoading(true);
    try {
      const { data: completions } = await supabase
        .from('habit_completions')
        .select('completion_type, habits(name)')
        .eq('user_id', userId)
        .eq('completed_date', selectedDateKey);

      const completed = (completions || [])
        .filter(c => c.completion_type === 'completed')
        .map(c => c.habits?.name)
        .filter(Boolean);

      const lifeHappens = (completions || [])
        .filter(c => c.completion_type === 'life_happens')
        .map(c => c.habits?.name)
        .filter(Boolean);

      const userMessage = `Here is what the user recorded today:
- One thing that mattered: ${oneThing || 'not recorded'}
- Win of the day: ${oneWin || 'not recorded'}
- Morning reflection: ${morningNote || 'not recorded'}
- Evening reflection: ${eveningNote || 'not recorded'}
- Commitments they showed up for: ${completed.length > 0 ? completed.join(', ') : 'none recorded'}
- Grace days (life happens): ${lifeHappens.length > 0 ? lifeHappens.join(', ') : 'none'}
- Sleep hours: ${sleepHours || 'not recorded'}

Write a 2-3 sentence Reflective Mirror summary of what today's data shows about who they are. Stick only to what they recorded. Do not give advice or suggestions.`;

      const { data, error: invokeError } = await supabase.functions.invoke(
        'anthropic',
        {
          body: {
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 300,
            system:
              'You are the Reflective Mirror — the voice of Meridian, an identity-first life app. Your only job is to reflect back what the user has already given you. You do not give advice, suggestions, or interpretations about health, relationships, finances, or any other area of life. You only summarize what they recorded, framed as identity evidence in present tense. Rules: Stick strictly to data the user provided. Never infer, advise, or extrapolate beyond what they wrote. Use present tense identity framing ("You are someone who..."). 2-3 sentences only. Warm but neutral. Never prescriptive. Never mention anything that could be construed as medical, mental health, financial, or relationship advice.',
            messages: [{ role: 'user', content: userMessage }],
          },
        }
      );

      if (invokeError) {
        console.log('AI summary error:', invokeError);
      } else {
        const summaryText = data?.content?.[0]?.text ?? null;

        if (summaryText) {
          await supabase
            .from('daily_entries')
            .update({ ai_daily_summary: summaryText })
            .eq('user_id', userId)
            .eq('entry_date', selectedDateKey);
          setAiSummary(summaryText);
        }
      }
    } catch (e) {
      console.log('AI summary error:', e);
    } finally {
      setAiLoading(false);
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

            <Text style={styles.fieldLabel}>Your reflection</Text>
            <TextInput
              style={[styles.textInput, styles.textInputMultiline, dimmed && styles.dimmed]}
              placeholder="Write your thoughts here..."
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

            <Text style={[styles.fieldLabel, styles.fieldLabelSpaced]}>Hours of sleep</Text>
            <TextInput
              style={[styles.textInput, dimmed && styles.dimmed]}
              placeholder="7.5"
              placeholderTextColor={J.placeholder}
              value={sleepHours}
              onChangeText={setSleepHours}
              keyboardType="decimal-pad"
              editable={inputEditable}
              maxLength={4}
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

            {journalReflectActive ? (
              <View style={styles.journalReflectCard}>
                <Text style={styles.journalReflectLabel}>
                  MERIDIAN REFLECTS
                </Text>
                {summaryLoading ? (
                  <Text style={styles.journalReflectLoadingText}>
                    Reflecting on your day...
                  </Text>
                ) : (
                  <Text style={styles.journalReflectText}>{journalSummary}</Text>
                )}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: J.bg,
  },
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingBottom: 8,
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
  journalReflectCard: {
    backgroundColor: '#231f35',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: J.accent,
    zIndex: 2,
    elevation: 2,
  },
  journalReflectLabel: {
    fontSize: 10,
    letterSpacing: 2,
    color: J.accent,
    marginBottom: 8,
    fontFamily: 'DMSans_500Medium',
  },
  journalReflectText: {
    fontSize: 15,
    color: J.text,
    fontStyle: 'italic',
    fontFamily: 'DMSans_400Regular',
    lineHeight: 24,
  },
  journalReflectLoadingText: {
    fontSize: 14,
    color: J.muted,
    fontStyle: 'italic',
    fontFamily: 'DMSans_400Regular',
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
});
