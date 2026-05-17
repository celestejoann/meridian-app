import React, { useState } from 'react';
import {
  ActivityIndicator,
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
import { supabase } from '../../lib/supabase';
import { COLORS, FONTS } from '../../constants/theme';
import {
  PrimaryButton,
  ProgressDots,
  onboardingStyles,
  useBlockHardwareBack,
} from './shared';

const FREQUENCIES = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekdays', label: 'Weekdays' },
  { key: 'weekly', label: 'Weekly' },
];

export default function CommitmentScreen({ navigation, route }) {
  useBlockHardwareBack();
  const userName = route.params?.userName ?? '';
  const selectedAreas = route.params?.selectedAreas ?? [];
  const [title, setTitle] = useState('');
  const [areaSlug, setAreaSlug] = useState(
    selectedAreas[0]?.slug ?? 'health'
  );
  const [frequency, setFrequency] = useState('daily');
  const [saving, setSaving] = useState(false);

  const saveHabit = async () => {
    const { data: userData, error: userErr } =
      await supabase.auth.getUser();
    if (userErr || !userData?.user) return false;

    const payload = {
      user_id: userData.user.id,
      title: title.trim(),
      area: areaSlug,
      frequency,
      status: 'active',
      anchor: null,
      frequency_count:
        frequency === 'daily'
          ? 7
          : frequency === 'weekdays'
            ? 5
            : frequency === 'weekly'
              ? 1
              : 1,
      weekly_due_day: frequency === 'weekly' ? 1 : null,
    };

    const { error } = await supabase.from('habits').insert(payload);
    return !error;
  };

  const goReady = () => {
    navigation.replace('Ready', { userName });
  };

  const handleContinue = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    const ok = await saveHabit();
    setSaving(false);
    if (ok) goReady();
  };

  const handleSkip = () => {
    goReady();
  };

  return (
    <SafeAreaView style={onboardingStyles.safe} edges={['top', 'bottom']}>
      <ProgressDots step={5} />
      <KeyboardAvoidingView
        style={onboardingStyles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={onboardingStyles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Text style={styles.heading}>
            Identity without practice{'\n'}
            is just intention.
          </Text>
          <Text style={styles.subtext}>
            What&apos;s one commitment that expresses{'\n'}
            who you are?{'\n\n'}
            Something small. Something real.{'\n'}
            Something you can do today.
          </Text>
          <TextInput
            style={styles.titleInput}
            placeholder="I will..."
            placeholderTextColor={COLORS.border}
            value={title}
            onChangeText={setTitle}
            autoCapitalize="sentences"
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.areaScroll}>
            {selectedAreas.map((area) => {
              const on = areaSlug === area.slug;
              return (
                <TouchableOpacity
                  key={area.slug}
                  style={[
                    styles.areaPill,
                    on
                      ? {
                          borderColor: area.color,
                          backgroundColor: area.color + '20',
                        }
                      : styles.areaPillOff,
                  ]}
                  onPress={() => setAreaSlug(area.slug)}>
                  <Text
                    style={[
                      styles.areaPillText,
                      on ? { color: area.color } : styles.areaPillTextOff,
                    ]}>
                    {area.icon} {area.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <View style={styles.freqRow}>
            {FREQUENCIES.map((f) => {
              const on = frequency === f.key;
              return (
                <TouchableOpacity
                  key={f.key}
                  style={[styles.freqPill, on && styles.freqPillOn]}
                  onPress={() => setFrequency(f.key)}>
                  <Text style={[styles.freqText, on && styles.freqTextOn]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <PrimaryButton
            label={saving ? 'Saving…' : "I'm ready →"}
            onPress={handleContinue}
            disabled={!title.trim() || saving}
            style={styles.button}
          />
          <Text
            style={{
              fontSize: 12,
              color: COLORS.muted,
              fontStyle: 'italic',
              textAlign: 'center',
              marginTop: 16,
              marginBottom: 8,
              paddingHorizontal: 40,
            }}>
            You can add more once you&apos;re in. Most people do better starting
            with one.
          </Text>
          <TouchableOpacity onPress={handleSkip} hitSlop={{ top: 8, bottom: 8 }}>
            <Text style={styles.skip}>Skip for now →</Text>
          </TouchableOpacity>
          {saving ? (
            <ActivityIndicator color={COLORS.accent} style={styles.loader} />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontFamily: FONTS.headingBold,
    fontSize: 28,
    color: COLORS.text,
    lineHeight: 38,
    paddingHorizontal: 32,
    marginTop: 36,
    marginBottom: 8,
  },
  subtext: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.muted,
    lineHeight: 24,
    paddingHorizontal: 32,
    marginBottom: 40,
  },
  titleInput: {
    marginHorizontal: 32,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    fontSize: 18,
    fontFamily: FONTS.body,
    color: COLORS.text,
    marginBottom: 20,
  },
  areaScroll: {
    paddingHorizontal: 24,
    gap: 8,
    paddingBottom: 8,
  },
  areaPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    marginRight: 8,
  },
  areaPillOff: {
    borderColor: COLORS.border,
    backgroundColor: 'transparent',
  },
  areaPillText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 13,
  },
  areaPillTextOff: {
    color: COLORS.muted,
  },
  freqRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 28,
    marginTop: 16,
    marginBottom: 8,
    gap: 8,
  },
  freqPill: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  freqPillOn: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accent + '25',
  },
  freqText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 14,
    color: COLORS.muted,
  },
  freqTextOn: {
    color: COLORS.accent,
  },
  button: {
    marginTop: 32,
    marginHorizontal: 32,
  },
  skip: {
    fontSize: 12,
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 60,
    fontFamily: FONTS.body,
  },
  loader: {
    marginBottom: 24,
  },
});
