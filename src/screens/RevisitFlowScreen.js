import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { COLORS, FONTS } from '../constants/theme';

const QUESTION_SETS = {
  get_back_to: [
    'Is this still something you want, or has it quietly changed?',
    "What's been in the way — time, or something else?",
  ],
  working_toward: [
    "What's the smallest true thing you know about this so far?",
    'Do you want a next step right now, or just to keep noticing it?',
  ],
  messy_middle: [
    "What's felt hardest about this lately?",
    "What's one thing that's actually working, even if the rest is chaos?",
  ],
  someday: [
    'Does this still feel true for you?',
    'Is now closer to the right time than it used to be?',
  ],
  fallback: [
    'Is this still on your mind?',
    'Is there anything small you want to do about it, or are you just holding it right now?',
  ],
};

const DEFAULT_CLOSE_OPTIONS = [
  { label: 'Still holding it', momentContent: 'Revisit close: Still holding it' },
  {
    label: 'One small step',
    momentContent: 'Revisit close: One small step',
    promptCommitment: true,
  },
  { label: 'Let it go for now', momentContent: 'Revisit close: Let it go for now' },
];

const MESSY_CLOSE_OPTIONS = [
  { label: 'Still in it', momentContent: 'Revisit close: Still in it' },
  { label: 'Needs a breather', momentContent: 'Revisit close: Needs a breather' },
  {
    label: 'Became part of who I am now',
    momentContent: 'Revisit close: Became part of who I am now',
  },
];

function getQuestions(shape) {
  return QUESTION_SETS[shape] || QUESTION_SETS.fallback;
}

function getCloseOptions(shape) {
  return shape === 'messy_middle' ? MESSY_CLOSE_OPTIONS : DEFAULT_CLOSE_OPTIONS;
}

function ProgressDots({ total, current }) {
  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[styles.dot, i === current ? styles.dotActive : styles.dotInactive]}
        />
      ))}
    </View>
  );
}

export default function RevisitFlowScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const pursuitId = route.params?.pursuitId;
  const shape = route.params?.shape ?? null;
  const pursuitArea = route.params?.pursuitArea ?? null;

  const inputRef = useRef(null);
  const questions = useMemo(() => getQuestions(shape), [shape]);
  const closeOptions = useMemo(() => getCloseOptions(shape), [shape]);

  const [userId, setUserId] = useState(null);
  const [phase, setPhase] = useState(0);
  const [answers, setAnswers] = useState(['', '']);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data?.user?.id ?? null);
    });
  }, []);

  useEffect(() => {
    if (phase < 2) {
      setDraft(answers[phase] || '');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [phase, answers]);

  const handleMicPress = () => {
    Alert.alert(
      'Voice input',
      'Speech-to-text is not set up yet. Type your note for now — we can wire up the mic in a follow-up.'
    );
  };

  const advanceQuestion = useCallback(() => {
    setAnswers((prev) => {
      const next = [...prev];
      next[phase] = draft.trim();
      return next;
    });
    setDraft('');
    setPhase((p) => p + 1);
  }, [draft, phase]);

  const skipQuestion = useCallback(() => {
    setAnswers((prev) => {
      const next = [...prev];
      next[phase] = '';
      return next;
    });
    setDraft('');
    setPhase((p) => p + 1);
  }, [phase]);

  const finishWithChoice = async (closeOption) => {
    if (!userId || !pursuitId || saving) return;

    setSaving(true);

    const rows = [];
    answers.forEach((answer) => {
      const trimmed = answer?.trim();
      if (trimmed) {
        rows.push({
          pursuit_id: pursuitId,
          user_id: userId,
          content: trimmed,
          source: 'revisit_answer',
        });
      }
    });
    rows.push({
      pursuit_id: pursuitId,
      user_id: userId,
      content: closeOption.momentContent,
      source: 'revisit_answer',
    });

    const { error } = await supabase.from('pursuit_moments').insert(rows);
    setSaving(false);

    if (error) {
      console.log('revisit save error:', error.message);
      Alert.alert('Could not save', 'Your revisit did not save. Please try again.');
      return;
    }

    if (closeOption.promptCommitment) {
      const prefill =
        [...answers].reverse().find((a) => a?.trim())?.trim() || '';
      Alert.alert(
        'Want to turn this into a commitment?',
        undefined,
        [
          {
            text: 'Not now',
            style: 'cancel',
            onPress: () => navigation.goBack(),
          },
          {
            text: 'Yes',
            onPress: () =>
              navigation.replace('NewCommitment', {
                initialTitle: prefill,
                initialArea: pursuitArea,
                returnPursuitId: pursuitId,
              }),
          },
        ]
      );
      return;
    }

    navigation.goBack();
  };

  if (!pursuitId) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Pursuit not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isClosePhase = phase >= 2;
  const progressIndex = isClosePhase ? 2 : phase;

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
          <ProgressDots total={3} current={progressIndex} />

          {isClosePhase ? (
            <View style={styles.closeSection}>
              <Text style={styles.closeIntro}>Where are you with this right now?</Text>
              <Text style={styles.closeSubtext}>Choose what feels most true — no wrong answer.</Text>

              {closeOptions.map((option) => (
                <TouchableOpacity
                  key={option.label}
                  style={[styles.closeOption, saving && styles.closeOptionDisabled]}
                  onPress={() => finishWithChoice(option)}
                  disabled={saving}
                  activeOpacity={0.85}>
                  <Text style={styles.closeOptionText}>{option.label}</Text>
                </TouchableOpacity>
              ))}

              {saving ? (
                <ActivityIndicator color={COLORS.accent} style={styles.savingSpinner} />
              ) : null}
            </View>
          ) : (
            <View style={styles.questionSection}>
              <Text style={styles.questionLabel}>A moment to reflect</Text>
              <Text style={styles.questionText}>{questions[phase]}</Text>

              <View style={styles.inputWrap}>
                <TextInput
                  ref={inputRef}
                  style={styles.input}
                  placeholder="Your thoughts..."
                  placeholderTextColor={COLORS.mutedLight}
                  value={draft}
                  onChangeText={setDraft}
                  multiline
                  textAlignVertical="top"
                />
                <TouchableOpacity
                  style={styles.micBtn}
                  onPress={handleMicPress}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="mic-outline" size={22} color={COLORS.mutedLight} />
                </TouchableOpacity>
              </View>

              <View style={styles.actions}>
                <TouchableOpacity style={styles.skipBtn} onPress={skipQuestion}>
                  <Text style={styles.skipText}>Skip</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.nextBtn}
                  onPress={advanceQuestion}
                  activeOpacity={0.85}>
                  <Text style={styles.nextBtnText}>Next</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
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
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  errorText: {
    fontSize: 15,
    fontFamily: FONTS.body,
    color: COLORS.mutedLight,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 32,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: COLORS.accent,
  },
  dotInactive: {
    backgroundColor: COLORS.border,
  },
  questionSection: {
    flex: 1,
  },
  questionLabel: {
    fontSize: 11,
    fontFamily: FONTS.bodyMedium,
    color: COLORS.muted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  questionText: {
    fontFamily: 'PlayfairDisplay_300Light',
    fontSize: 26,
    color: COLORS.text,
    lineHeight: 36,
    fontStyle: 'italic',
    marginBottom: 28,
  },
  inputWrap: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    minHeight: 140,
  },
  input: {
    flex: 1,
    minHeight: 96,
    fontSize: 16,
    fontFamily: FONTS.body,
    color: COLORS.text,
    lineHeight: 24,
    padding: 0,
    marginBottom: 12,
  },
  micBtn: {
    alignSelf: 'flex-start',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 28,
  },
  skipBtn: {
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  skipText: {
    fontSize: 15,
    fontFamily: FONTS.body,
    color: COLORS.mutedLight,
    fontStyle: 'italic',
  },
  nextBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  nextBtnText: {
    fontSize: 16,
    fontFamily: FONTS.bodyMedium,
    color: COLORS.bg,
  },
  closeSection: {
    flex: 1,
    paddingTop: 8,
  },
  closeIntro: {
    fontFamily: 'PlayfairDisplay_300Light',
    fontSize: 28,
    color: COLORS.text,
    lineHeight: 38,
    fontStyle: 'italic',
    marginBottom: 10,
  },
  closeSubtext: {
    fontSize: 15,
    fontFamily: FONTS.body,
    color: COLORS.mutedLight,
    lineHeight: 22,
    marginBottom: 28,
  },
  closeOption: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginBottom: 12,
  },
  closeOptionDisabled: {
    opacity: 0.6,
  },
  closeOptionText: {
    fontSize: 17,
    fontFamily: FONTS.bodyMedium,
    color: COLORS.text,
    textAlign: 'center',
  },
  savingSpinner: {
    marginTop: 16,
  },
});
