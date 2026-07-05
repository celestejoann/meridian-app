import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CommonActions, useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
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

function areaDisplayName(area) {
  return (area || 'area').replace(/^\w/, (c) => c.toUpperCase());
}

export default function NewCommitmentScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const initialTitle = route.params?.initialTitle ?? '';
  const initialArea = route.params?.initialArea ?? null;
  const returnPursuitId = route.params?.returnPursuitId ?? null;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState(null);
  const [userAreas, setUserAreas] = useState([]);

  const [title, setTitle] = useState(initialTitle);
  const [selectedArea, setSelectedArea] = useState(null);
  const [frequency, setFrequency] = useState('daily');
  const [weeklyDueDay, setWeeklyDueDay] = useState(1);
  const [frequencyCount, setFrequencyCount] = useState(3);
  const [anchor, setAnchor] = useState('');

  const areaOptions = useMemo(() => {
    if (userAreas.length > 0) {
      return userAreas.map((ua) => ({
        key: (ua.area || ua.name || '').toLowerCase(),
        name: ua.name || ua.display_name || areaDisplayName(ua.area || ua.name),
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
    const uid = userData?.user?.id ?? null;
    setUserId(uid);

    if (uid) {
      const { data: areasData } = await supabase
        .from('user_areas')
        .select('*')
        .eq('user_id', uid);
      setUserAreas(areasData ?? []);
    } else {
      setUserAreas([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (areaOptions.length === 0 || selectedArea != null) return;

    const preferred = initialArea ? String(initialArea).toLowerCase() : null;
    const match = preferred
      ? areaOptions.find((a) => a.key === preferred)
      : null;
    setSelectedArea(match ? match.key : areaOptions[0].key);
  }, [areaOptions, initialArea, selectedArea]);

  const navigateAfterSave = () => {
    if (returnPursuitId) {
      navigation.dispatch(
        CommonActions.reset({
          index: 1,
          routes: [
            { name: 'Main' },
            { name: 'PursuitDetail', params: { pursuitId: returnPursuitId } },
          ],
        })
      );
      return;
    }
    navigation.goBack();
  };

  const handleSave = async () => {
    if (!userId || !title.trim() || !selectedArea || saving) return;

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

    if (error) {
      console.log('new commitment error:', error.message);
      Alert.alert('Could not save', 'Your commitment did not save. Please try again.');
      return;
    }

    navigateAfterSave();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
        <View style={styles.loaderWrap}>
          <ActivityIndicator color={COLORS.accent} size={32} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Text style={styles.intro}>
            Something small and real — you can always adjust it later.
          </Text>

          <View style={styles.formCard}>
            <Text style={styles.fieldLabel}>Commitment</Text>
            <TextInput
              style={styles.input}
              placeholder="I will..."
              placeholderTextColor={COLORS.muted}
              value={title}
              onChangeText={setTitle}
              autoFocus={!initialTitle}
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
                    onPress={() => setFrequencyCount((n) => Math.max(1, n - 1))}>
                    <Text style={styles.stepperBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.stepperValue}>{frequencyCount}</Text>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => setFrequencyCount((n) => Math.min(7, n + 1))}>
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
              style={[styles.saveBtn, (saving || !title.trim() || !selectedArea) && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saving || !title.trim() || !selectedArea}>
              <Text style={styles.saveBtnText}>
                {saving ? 'Adding…' : 'Add to my practice'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 40,
  },
  loaderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  intro: {
    fontSize: 15,
    fontFamily: FONTS.body,
    color: COLORS.mutedLight,
    lineHeight: 22,
    fontStyle: 'italic',
    marginBottom: 20,
  },
  formCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 16,
  },
  fieldLabel: {
    fontSize: 11,
    color: COLORS.muted,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontFamily: FONTS.bodyMedium,
  },
  input: {
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    fontSize: 15,
    fontFamily: FONTS.body,
    marginBottom: 12,
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
    color: COLORS.bg,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 12,
  },
  stepperBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnText: {
    fontSize: 20,
    color: COLORS.text,
    lineHeight: 22,
  },
  stepperValue: {
    fontSize: 18,
    fontFamily: FONTS.bodyMedium,
    color: COLORS.text,
    minWidth: 24,
    textAlign: 'center',
  },
  saveBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  saveBtnDisabled: {
    opacity: 0.45,
  },
  saveBtnText: {
    fontSize: 16,
    fontFamily: FONTS.bodyMedium,
    color: COLORS.bg,
  },
});
