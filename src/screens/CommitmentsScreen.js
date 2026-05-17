import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
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
import { COLORS, FONTS, AREA_COLORS } from '../constants/theme';

const DEFAULT_AREAS = [
  'health',
  'finance',
  'career',
  'relationships',
  'growth',
  'recreation',
  'spirituality',
];

const FREQUENCIES = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekdays', label: 'Weekdays' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'xperweek', label: 'X per week' },
];

const WEEKDAY_PICKER = [
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
  { label: 'Sun', value: 0 },
];

const DAY_NAMES_FULL = [
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

function computeHabitStreak(habitId, completions, todayKey) {
  let d = new Date();
  const key = todayKey;
  const todayDone = completions.some(
    (r) =>
      r.habit_id === habitId &&
      String(r.completed_date).slice(0, 10) === key
  );
  if (!todayDone) {
    d.setDate(d.getDate() - 1);
  }
  let streak = 0;
  while (true) {
    const k = formatLocalDateKey(d);
    const done = completions.some(
      (r) =>
        r.habit_id === habitId &&
        String(r.completed_date).slice(0, 10) === k
    );
    if (!done) break;
    streak += 1;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function frequencyLabel(habit) {
  const freq = (habit.frequency || 'daily').toLowerCase();
  switch (freq) {
    case 'daily':
      return 'Daily';
    case 'weekdays':
      return 'Weekdays';
    case 'weekly': {
      const dow =
        habit.weekly_due_day != null
          ? habit.weekly_due_day
          : new Date(habit.created_at).getDay();
      return `On ${DAY_NAMES_FULL[dow]}s`;
    }
    case 'xperweek': {
      const n = habit.frequency_count ?? 3;
      return `${n}× a week`;
    }
    default:
      return 'Daily';
  }
}

function areaDisplayName(area) {
  return (area || 'area').replace(/^\w/, (c) => c.toUpperCase());
}

function SectionTitle({ children }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export default function CommitmentsScreen() {
  const todayKey = useMemo(() => formatLocalDateKey(new Date()), []);

  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userAreas, setUserAreas] = useState([]);
  const [activeHabits, setActiveHabits] = useState([]);
  const [archivedHabits, setArchivedHabits] = useState([]);
  const [completions, setCompletions] = useState([]);
  const [archivedExpanded, setArchivedExpanded] = useState(false);
  const [menuHabit, setMenuHabit] = useState(null);

  const [title, setTitle] = useState('');
  const [selectedArea, setSelectedArea] = useState(null);
  const [frequency, setFrequency] = useState('daily');
  const [weeklyDueDay, setWeeklyDueDay] = useState(1);
  const [frequencyCount, setFrequencyCount] = useState(3);
  const [anchor, setAnchor] = useState('');

  const areaOptions = useMemo(() => {
    if (userAreas.length > 0) {
      return userAreas.map((ua) => ({
        key: (ua.area || ua.name || '').toLowerCase(),
        name:
          ua.name ||
          ua.display_name ||
          areaDisplayName(ua.area || ua.name),
      }));
    }
    return DEFAULT_AREAS.map((key) => ({
      key,
      name: areaDisplayName(key),
    }));
  }, [userAreas]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData?.user?.id;
    if (!uid) {
      setUserId(null);
      setUserAreas([]);
      setActiveHabits([]);
      setArchivedHabits([]);
      setCompletions([]);
      setLoading(false);
      return;
    }
    setUserId(uid);

    const since = formatLocalDateKey(
      new Date(Date.now() - 400 * 86400000)
    );

    const [
      { data: areasData },
      { data: activeData },
      { data: archivedData },
      { data: completionData },
    ] = await Promise.all([
      supabase.from('user_areas').select('*').eq('user_id', uid),
      supabase
        .from('habits')
        .select('*')
        .eq('user_id', uid)
        .eq('status', 'active')
        .order('title', { ascending: true }),
      supabase
        .from('habits')
        .select('*')
        .eq('user_id', uid)
        .eq('status', 'archived')
        .order('updated_at', { ascending: false }),
      supabase
        .from('habit_completions')
        .select('*')
        .eq('user_id', uid)
        .gte('completed_date', since),
    ]);

    setUserAreas(areasData ?? []);
    setActiveHabits(activeData ?? []);
    setArchivedHabits(archivedData ?? []);
    setCompletions(completionData ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (areaOptions.length > 0 && selectedArea == null) {
      setSelectedArea(areaOptions[0].key);
    }
  }, [areaOptions, selectedArea]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const resetForm = () => {
    setTitle('');
    setAnchor('');
    setFrequency('daily');
    setWeeklyDueDay(1);
    setFrequencyCount(3);
    if (areaOptions.length > 0) {
      setSelectedArea(areaOptions[0].key);
    }
  };

  const handleAdd = async () => {
    if (!userId || !title.trim() || !selectedArea) return;
    setSaving(true);

    const payload = {
      user_id: userId,
      title: title.trim(),
      area: selectedArea,
      frequency,
      anchor: anchor.trim() || null,
      status: 'active',
      frequency_count: frequency === 'xperweek' ? frequencyCount : null,
      weekly_due_day: frequency === 'weekly' ? weeklyDueDay : null,
    };

    const { error } = await supabase.from('habits').insert(payload);
    setSaving(false);
    if (!error) {
      resetForm();
      await load();
    }
  };

  const archiveHabit = async (habit) => {
    setMenuHabit(null);
    await supabase
      .from('habits')
      .update({ status: 'archived' })
      .eq('id', habit.id);
    await load();
  };

  const deleteHabit = async (habit) => {
    setMenuHabit(null);
    await supabase.from('habits').delete().eq('id', habit.id);
    await load();
  };

  const hasAnyHabits = activeHabits.length > 0 || archivedHabits.length > 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <Text
          style={{
            fontSize: 32,
            fontWeight: '300',
            fontFamily: 'PlayfairDisplay_300Light',
            color: COLORS.text,
            paddingHorizontal: 20,
            paddingTop: 20,
            paddingBottom: 4,
          }}>
          Commitments
        </Text>
        <MeridianWordmark />
        <Text style={styles.headerSubtitle}>What you&apos;ve committed to</Text>

        <View style={styles.formCard}>
          <TextInput
            style={styles.input}
            placeholder="New commitment..."
            placeholderTextColor={COLORS.muted}
            value={title}
            onChangeText={setTitle}
          />

          <Text style={styles.fieldLabel}>Area</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillRow}>
            {areaOptions.map((area) => {
              const selected = selectedArea === area.key;
              const color = AREA_COLORS[area.key] || COLORS.accent;
              return (
                <TouchableOpacity
                  key={area.key}
                  style={[
                    styles.areaPill,
                    selected
                      ? { backgroundColor: color, borderColor: color }
                      : styles.pillOutline,
                  ]}
                  onPress={() => setSelectedArea(area.key)}>
                  <Text
                    style={[
                      styles.areaPillText,
                      selected && styles.areaPillTextSelected,
                    ]}>
                    {area.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={styles.fieldLabel}>Frequency</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillRow}>
            {FREQUENCIES.map((f) => {
              const selected = frequency === f.key;
              return (
                <TouchableOpacity
                  key={f.key}
                  style={[
                    styles.freqPill,
                    selected ? styles.freqPillSelected : styles.pillOutline,
                  ]}
                  onPress={() => setFrequency(f.key)}>
                  <Text
                    style={[
                      styles.freqPillText,
                      selected && styles.freqPillTextSelected,
                    ]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {frequency === 'weekly' ? (
            <>
              <Text style={styles.fieldLabel}>Due day</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.pillRow}>
                {WEEKDAY_PICKER.map((d) => {
                  const selected = weeklyDueDay === d.value;
                  return (
                    <TouchableOpacity
                      key={d.label}
                      style={[
                        styles.freqPill,
                        selected ? styles.freqPillSelected : styles.pillOutline,
                      ]}
                      onPress={() => setWeeklyDueDay(d.value)}>
                      <Text
                        style={[
                          styles.freqPillText,
                          selected && styles.freqPillTextSelected,
                        ]}>
                        {d.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </>
          ) : null}

          {frequency === 'xperweek' ? (
            <>
              <Text style={styles.fieldLabel}>Times per week</Text>
              <View style={styles.stepperRow}>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() =>
                    setFrequencyCount((n) => Math.max(1, n - 1))
                  }>
                  <Text style={styles.stepperBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.stepperValue}>{frequencyCount}</Text>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() =>
                    setFrequencyCount((n) => Math.min(7, n + 1))
                  }>
                  <Text style={styles.stepperBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : null}

          <Text style={styles.fieldLabel}>Anchor (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="After I..."
            placeholderTextColor={COLORS.muted}
            value={anchor}
            onChangeText={setAnchor}
          />

          <TouchableOpacity
            style={[styles.addBtn, saving && styles.addBtnDisabled]}
            onPress={handleAdd}
            disabled={saving || !title.trim() || !selectedArea}>
            <Text style={styles.addBtnText}>
              {saving ? 'Adding…' : 'Add to my practice'}
            </Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator color={COLORS.accent} size={32} />
          </View>
        ) : (
          <>
            {!hasAnyHabits ? (
              <Text style={styles.emptyText}>
                No commitments yet.{'\n'}Add your first commitment above to start
                building your practice.
              </Text>
            ) : null}

            <SectionTitle>SHOWING UP FOR</SectionTitle>
            {activeHabits.length === 0 ? (
              <Text style={styles.sectionEmpty}>
                Nothing you&apos;re showing up for yet
              </Text>
            ) : (
              activeHabits.map((habit) => {
                const areaKey = (habit.area || '').toLowerCase();
                const barColor = AREA_COLORS[areaKey] || COLORS.accent;
                const streak = computeHabitStreak(
                  habit.id,
                  completions,
                  todayKey
                );

                return (
                  <View key={habit.id} style={styles.commitmentCard}>
                    <View
                      style={[styles.areaBar, { backgroundColor: barColor }]}
                    />
                    <View style={styles.commitmentBody}>
                      <Text style={styles.commitmentTitle}>{habit.title}</Text>
                      <Text style={styles.commitmentMeta}>
                        {(habit.area || 'area').toUpperCase()} ·{' '}
                        {frequencyLabel(habit)}
                      </Text>
                    </View>
                    <View style={styles.commitmentRight}>
                      <TouchableOpacity
                        style={styles.menuBtn}
                        onPress={() => setMenuHabit(habit)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Text style={styles.menuBtnText}>⋯</Text>
                      </TouchableOpacity>
                      <Text style={styles.streakText}>🔥 {streak}</Text>
                      <Text style={styles.streakLabel}>in a row</Text>
                    </View>
                  </View>
                );
              })
            )}

            {archivedHabits.length > 0 ? (
              <>
                <TouchableOpacity
                  style={styles.archivedHeader}
                  onPress={() => setArchivedExpanded((v) => !v)}>
                  <Text style={styles.archivedHeaderText}>
                    NO LONGER IN PRACTICE ({archivedHabits.length})
                  </Text>
                  <Text style={styles.archivedChevron}>
                    {archivedExpanded ? '▾' : '▸'}
                  </Text>
                </TouchableOpacity>
                {archivedExpanded
                  ? archivedHabits.map((habit) => {
                      const areaKey = (habit.area || '').toLowerCase();
                      const barColor = AREA_COLORS[areaKey] || COLORS.accent;
                      return (
                        <View
                          key={habit.id}
                          style={[styles.commitmentCard, styles.archivedCard]}>
                          <View
                            style={[
                              styles.areaBar,
                              { backgroundColor: barColor },
                            ]}
                          />
                          <View style={styles.commitmentBody}>
                            <Text style={styles.archivedTitle}>
                              {habit.title}
                            </Text>
                            <Text style={styles.commitmentMeta}>
                              {(habit.area || 'area').toUpperCase()} ·{' '}
                              {frequencyLabel(habit)}
                            </Text>
                          </View>
                        </View>
                      );
                    })
                  : null}
              </>
            ) : null}
          </>
        )}
      </ScrollView>

      <Modal
        visible={menuHabit != null}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuHabit(null)}>
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setMenuHabit(null)}>
          <View style={styles.menuSheet}>
            <Pressable
              style={styles.menuItem}
              onPress={() => setMenuHabit(null)}>
              <Text style={styles.menuItemText}>Edit</Text>
            </Pressable>
            <Pressable
              style={styles.menuItem}
              onPress={() => archiveHabit(menuHabit)}>
              <Text style={styles.menuItemText}>Archive</Text>
            </Pressable>
            <Pressable
              style={[styles.menuItem, styles.menuItemLast]}
              onPress={() => deleteHabit(menuHabit)}>
              <Text style={[styles.menuItemText, styles.menuItemDanger]}>
                Delete
              </Text>
            </Pressable>
          </View>
        </Pressable>
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
  headerTitle: {
    fontSize: 32,
    fontWeight: '300',
    color: COLORS.text,
    marginTop: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: COLORS.muted,
    marginTop: 6,
    marginBottom: 16,
  },
  formCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
  },
  input: {
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    fontSize: 15,
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 11,
    color: COLORS.muted,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  pillRow: {
    gap: 8,
    paddingBottom: 12,
  },
  areaPill: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    marginRight: 8,
  },
  areaPillText: {
    fontSize: 13,
    color: COLORS.mutedLight,
    fontWeight: '600',
  },
  areaPillTextSelected: {
    color: COLORS.bg,
  },
  pillOutline: {
    backgroundColor: COLORS.borderLight,
    borderColor: COLORS.borderLight,
  },
  freqPill: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    marginRight: 8,
  },
  freqPillSelected: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  freqPillText: {
    fontSize: 13,
    color: COLORS.mutedLight,
    fontWeight: '500',
  },
  freqPillTextSelected: {
    color: COLORS.text,
    fontWeight: '600',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 16,
  },
  stepperBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnText: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '300',
  },
  stepperValue: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '600',
    minWidth: 24,
    textAlign: 'center',
  },
  addBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  addBtnDisabled: {
    opacity: 0.6,
  },
  addBtnText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
  loaderWrap: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 9,
    letterSpacing: 2,
    color: COLORS.accent,
    textTransform: 'uppercase',
    marginBottom: 12,
    marginTop: 8,
    fontFamily: FONTS.bodyMedium,
    letterSpacing: 1.5,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.muted,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
    marginTop: 8,
  },
  sectionEmpty: {
    fontSize: 14,
    color: COLORS.muted,
    marginBottom: 16,
  },
  commitmentCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    marginBottom: 8,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  archivedCard: {
    opacity: 0.65,
  },
  areaBar: {
    width: 4,
  },
  commitmentBody: {
    flex: 1,
    padding: 14,
    minWidth: 0,
  },
  commitmentTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '500',
  },
  archivedTitle: {
    color: COLORS.mutedLight,
    fontSize: 16,
    fontWeight: '500',
  },
  commitmentMeta: {
    marginTop: 8,
    color: COLORS.mutedLight,
    fontSize: 12,
  },
  commitmentRight: {
    paddingRight: 12,
    paddingVertical: 12,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  menuBtn: {
    marginBottom: 6,
  },
  menuBtnText: {
    color: COLORS.mutedLight,
    fontSize: 20,
    fontWeight: '700',
  },
  streakText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
  },
  streakLabel: {
    color: COLORS.muted,
    fontSize: 10,
    marginTop: 2,
  },
  archivedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 12,
    paddingVertical: 8,
  },
  archivedHeaderText: {
    fontSize: 9,
    letterSpacing: 2,
    color: COLORS.accent,
    textTransform: 'uppercase',
    fontFamily: FONTS.bodyMedium,
    letterSpacing: 1.5,
  },
  archivedChevron: {
    color: COLORS.mutedLight,
    fontSize: 14,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: '#00000080',
    justifyContent: 'flex-end',
    padding: 24,
  },
  menuSheet: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    overflow: 'hidden',
  },
  menuItem: {
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuItemText: {
    color: COLORS.text,
    fontSize: 16,
    textAlign: 'center',
  },
  menuItemDanger: {
    color: COLORS.red,
  },
});
