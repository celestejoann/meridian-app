import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAppNavigation } from '../navigation/AppNavigationContext';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import {
  buildWeekCountMap,
  formatLocalDateKey,
  getMondayKey,
  isDueToday,
} from '../lib/habitDue';
import { calculateLoggingStreak } from '../lib/streak';
import { AREA_COLORS, COLORS, FONTS } from '../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = 100;
const CARD_WIDTH = SCREEN_WIDTH - 48;
const CARD_RADIUS = 26;

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

const DASHBOARD_AREA_COLORS = {
  health: '#86efac',
  finance: '#fbbf24',
  career: '#60a5fa',
  relationships: '#f472b6',
  growth: '#c084fc',
  recreation: '#fb923c',
  spirituality: '#38bdf8',
};

function getAreaColor(area) {
  const key = (area || '').toLowerCase();
  return DASHBOARD_AREA_COLORS[key] || AREA_COLORS[key] || COLORS.accent;
}

function areaLabel(area) {
  const key = (area || 'general').toLowerCase();
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function ProgressDots({ total, current }) {
  if (total <= 1) return null;
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

function SwipeCard({
  card,
  isTop,
  note,
  showNoteInput,
  onTapNote,
  onNoteChange,
  onSwipeRight,
  onSwipeLeft,
  wildcardText,
  onWildcardChange,
  onWildcardNoteFocus,
}) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const isWildcard = card.type === 'wildcard';
  const areaColor = isWildcard ? COLORS.accent : getAreaColor(card.area);

  const finishSwipe = useCallback(
    (direction) => {
      if (direction === 'right') {
        onSwipeRight();
      } else {
        onSwipeLeft();
      }
    },
    [onSwipeLeft, onSwipeRight]
  );

  const pan = Gesture.Pan()
    .enabled(isTop)
    .activeOffsetX([-20, 20])
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY * 0.12;
    })
    .onEnd((event) => {
      if (event.translationX > SWIPE_THRESHOLD) {
        translateX.value = withSpring(SCREEN_WIDTH * 1.2, { damping: 18, stiffness: 180 }, () => {
          runOnJS(finishSwipe)('right');
        });
      } else if (event.translationX < -SWIPE_THRESHOLD) {
        translateX.value = withSpring(-SCREEN_WIDTH * 1.2, { damping: 18, stiffness: 180 }, () => {
          runOnJS(finishSwipe)('left');
        });
      } else {
        translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
        translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
      }
    });

  const tap = Gesture.Tap()
    .enabled(isTop)
    .maxDuration(250)
    .maxDistance(12)
    .onEnd(() => {
      if (isWildcard) {
        runOnJS(onWildcardNoteFocus)();
      } else {
        runOnJS(onTapNote)();
      }
    });

  const composed = Gesture.Exclusive(pan, tap);

  const cardStyle = useAnimatedStyle(() => {
    const rotate = interpolate(translateX.value, [-SCREEN_WIDTH, 0, SCREEN_WIDTH], [-8, 0, 8]);
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotate}deg` },
      ],
    };
  });

  const rightHintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, SWIPE_THRESHOLD], [0, 0.35], 'clamp'),
  }));

  const leftHintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-SWIPE_THRESHOLD, 0], [0.3, 0], 'clamp'),
  }));

  const stackStyle = !isTop
    ? {
        transform: [{ scale: isTop ? 1 : 0.96 }, { translateY: isTop ? 0 : 10 }],
        opacity: isTop ? 1 : 0.55,
      }
    : undefined;

  const cardContent = (
    <Animated.View
      style={[
        styles.cardShell,
        stackStyle,
        isTop && cardStyle,
        !isTop && styles.cardBehind,
      ]}>
      {isTop ? <View style={styles.cardGlow} pointerEvents="none" /> : null}
      <LinearGradient
        colors={['#1a1730', '#2a2145', '#231d38']}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.35, y: 1 }}
        style={styles.card}>
        <AnimatedLinearGradient
          colors={[
            'rgba(167, 139, 250, 0)',
            'rgba(167, 139, 250, 0.28)',
            'rgba(196, 181, 253, 0.12)',
          ]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[styles.swipeHintRight, rightHintStyle]}
        />
        <AnimatedLinearGradient
          colors={[
            'rgba(156, 163, 175, 0)',
            'rgba(156, 163, 175, 0.22)',
            'rgba(107, 114, 128, 0.08)',
          ]}
          start={{ x: 1, y: 0.5 }}
          end={{ x: 0, y: 0.5 }}
          style={[styles.swipeHintLeft, leftHintStyle]}
        />

        <LinearGradient
          colors={['rgba(167, 139, 250, 0)', 'rgba(167, 139, 250, 0.35)', 'rgba(167, 139, 250, 0)']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.decorLine}
          pointerEvents="none"
        />
        <View style={styles.decorDots} pointerEvents="none">
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.decorDot} />
          ))}
        </View>

        {!isWildcard ? (
          <>
            <LinearGradient
              colors={[areaColor + '55', areaColor + '18']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.areaPill, { shadowColor: areaColor }]}>
              <Text style={[styles.areaPillText, { color: areaColor }]}>
                {areaLabel(card.area)}
              </Text>
            </LinearGradient>
            <Text style={styles.cardTitle}>{card.title}</Text>
            {showNoteInput && isTop ? (
              <TextInput
                style={styles.noteInput}
                placeholder="Optional note..."
                placeholderTextColor={COLORS.muted}
                value={note}
                onChangeText={onNoteChange}
                multiline
                autoFocus
              />
            ) : null}
          </>
        ) : (
          <>
            <Text style={styles.wildcardTitle}>Anything on your mind?</Text>
            {showNoteInput && isTop ? (
              <View style={styles.wildcardInputWrap}>
                <TextInput
                  style={styles.wildcardInput}
                  placeholder="Write freely..."
                  placeholderTextColor={COLORS.muted}
                  value={wildcardText}
                  onChangeText={onWildcardChange}
                  multiline
                  autoFocus
                />
                <TouchableOpacity
                  style={styles.micBtn}
                  onPress={() =>
                    Alert.alert(
                      'Voice input',
                      'Speech-to-text is not set up yet. Type your note for now — we can wire up the mic in a follow-up.'
                    )
                  }
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="mic-outline" size={22} color={COLORS.mutedLight} />
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.wildcardHint}>Tap to write · swipe to continue</Text>
            )}
          </>
        )}
      </LinearGradient>
    </Animated.View>
  );

  if (!isTop) {
    return cardContent;
  }

  return <GestureDetector gesture={composed}>{cardContent}</GestureDetector>;
}

export default function CheckInScreen(props) {
  if (props.gate) {
    return <CheckInScreenGate {...props} />;
  }
  return <CheckInScreenWithNav {...props} />;
}

function CheckInScreenGate({ onGateComplete, ...rest }) {
  const exitCheckIn = useCallback(() => {
    onGateComplete?.();
  }, [onGateComplete]);
  return <CheckInScreenContent {...rest} gate exitCheckIn={exitCheckIn} />;
}

function CheckInScreenWithNav(props) {
  const navigation = useNavigation();
  const { openDashboard } = useAppNavigation();
  const exitCheckIn = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    openDashboard();
  }, [navigation, openDashboard]);
  return <CheckInScreenContent {...props} exitCheckIn={exitCheckIn} />;
}

function CheckInScreenContent({ gate = false, exitCheckIn }) {
  const todayKey = useMemo(() => formatLocalDateKey(new Date()), []);

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const [cards, setCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState('stack');
  const [noteDraft, setNoteDraft] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [wildcardText, setWildcardText] = useState('');
  const [wildcardInputOpen, setWildcardInputOpen] = useState(false);
  const [skipMessage, setSkipMessage] = useState(false);
  const skipTimerRef = useRef(null);

  const loadStack = useCallback(async () => {
    setLoading(true);
    const { data: authData } = await supabase.auth.getUser();
    const uid = authData?.user?.id;
    if (!uid) {
      setUserId(null);
      setCards([{ type: 'wildcard', id: 'wildcard' }]);
      setLoading(false);
      return;
    }

    setUserId(uid);

    const { isTodayLogged } = await calculateLoggingStreak(uid);
    if (isTodayLogged) {
      setPhase('already-logged');
      setLoading(false);
      return;
    }

    const mondayStr = getMondayKey();

    const [{ data: habitsData }, { data: todayRows }, { data: weekRows }] =
      await Promise.all([
        supabase
          .from('habits')
          .select('*')
          .eq('user_id', uid)
          .eq('status', 'active')
          .order('title', { ascending: true }),
        supabase
          .from('habit_completions')
          .select('habit_id')
          .eq('user_id', uid)
          .eq('completed_date', todayKey),
        supabase
          .from('habit_completions')
          .select('habit_id, completed_date')
          .eq('user_id', uid)
          .gte('completed_date', mondayStr)
          .lte('completed_date', todayKey),
      ]);

    const completedToday = new Set((todayRows ?? []).map((r) => r.habit_id));
    const weekCountMap = buildWeekCountMap(weekRows ?? []);

    const dueHabits = (habitsData ?? []).filter(
      (habit) =>
        isDueToday(habit, weekCountMap, todayKey) && !completedToday.has(habit.id)
    );

    setCards([
      ...dueHabits.map((habit) => ({ ...habit, type: 'habit' })),
      { type: 'wildcard', id: 'wildcard' },
    ]);
    setCurrentIndex(0);
    setPhase('stack');
    setNoteDraft('');
    setShowNoteInput(false);
    setWildcardText('');
    setWildcardInputOpen(false);
    setLoading(false);
  }, [todayKey]);

  useEffect(() => {
    loadStack();
  }, [loadStack]);

  useEffect(() => {
    return () => {
      if (skipTimerRef.current) clearTimeout(skipTimerRef.current);
    };
  }, []);

  const showSkipMicroResponse = useCallback(() => {
    setSkipMessage(true);
    if (skipTimerRef.current) clearTimeout(skipTimerRef.current);
    skipTimerRef.current = setTimeout(() => setSkipMessage(false), 1000);
  }, []);

  const advanceCard = useCallback(() => {
    setNoteDraft('');
    setShowNoteInput(false);
    setWildcardInputOpen(false);
    setCurrentIndex((prev) => {
      const next = prev + 1;
      if (next >= cards.length) {
        setPhase('done');
      }
      return next;
    });
  }, [cards.length]);

  const saveHabitCompletion = async (habitId, completionType, note) => {
    if (!userId) return;

    await supabase
      .from('habit_completions')
      .delete()
      .eq('user_id', userId)
      .eq('habit_id', habitId)
      .eq('completed_date', todayKey);

    const payload = {
      habit_id: habitId,
      user_id: userId,
      completed_date: todayKey,
      completion_type: completionType,
    };
    if (note?.trim()) {
      payload.note = note.trim();
    }

    let { error } = await supabase.from('habit_completions').insert(payload);
    if (error && payload.note) {
      const { note: _note, ...withoutNote } = payload;
      ({ error } = await supabase.from('habit_completions').insert(withoutNote));
    }
    if (error) {
      console.log('check-in save error:', error.message);
    }
  };

  const saveGeneralNote = async (content) => {
    if (!userId || !content?.trim()) return;
    const { error } = await supabase.from('general_notes').insert({
      user_id: userId,
      content: content.trim(),
    });
    if (error) {
      console.log('general note save error:', error.message);
    }
  };

  const handleHabitSwipeRight = (habit) => {
    const note = noteDraft;
    advanceCard();
    saveHabitCompletion(habit.id, 'completed', note);
  };

  const handleHabitSwipeLeft = (habit) => {
    const note = noteDraft;
    showSkipMicroResponse();
    advanceCard();
    saveHabitCompletion(habit.id, 'life_happens', note);
  };

  const handleWildcardSwipeRight = () => {
    const text = wildcardText;
    advanceCard();
    if (text.trim()) {
      saveGeneralNote(text);
    }
  };

  const handleWildcardSwipeLeft = async () => {
    advanceCard();
  };

  const currentCard = cards[currentIndex];
  const visibleCards = cards.slice(currentIndex, currentIndex + 2);

  const onSwipeRight = useCallback(() => {
    if (!currentCard) return;
    if (currentCard.type === 'wildcard') {
      handleWildcardSwipeRight();
    } else {
      handleHabitSwipeRight(currentCard);
    }
  }, [currentCard, noteDraft, wildcardText]);

  const onSwipeLeft = useCallback(() => {
    if (!currentCard) return;
    if (currentCard.type === 'wildcard') {
      handleWildcardSwipeLeft();
    } else {
      handleHabitSwipeLeft(currentCard);
    }
  }, [currentCard, noteDraft]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loaderWrap}>
          <ActivityIndicator color={COLORS.accent} size={32} />
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'already-logged') {
    return (
      <SafeAreaView style={styles.safe}>
        <TouchableOpacity
          style={styles.alreadyLoggedWrap}
          activeOpacity={0.95}
          onPress={exitCheckIn}>
          <LinearGradient
            colors={['#1a1730', '#2a2145', '#231d38']}
            locations={[0, 0.55, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.35, y: 1 }}
            style={styles.alreadyLoggedCard}>
            <Text style={styles.alreadyLoggedTitle}>
              Today&apos;s evidence: logged ✓
            </Text>
            <Text style={styles.alreadyLoggedSub}>See you tomorrow</Text>
            <Text style={styles.alreadyLoggedContinue}>Continue</Text>
          </LinearGradient>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (phase === 'done' || currentIndex >= cards.length) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.doneWrap}>
          <Text style={styles.doneLine}>Today&apos;s evidence: logged.</Text>
          <TouchableOpacity
            style={styles.doneBtn}
            onPress={exitCheckIn}
            activeOpacity={0.85}>
            <Text style={styles.doneBtnText}>
              {gate ? 'Continue to Dashboard' : 'Back to Dashboard'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.flex}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {!gate ? (
            <View style={styles.header}>
              <TouchableOpacity onPress={exitCheckIn} hitSlop={12}>
                <Text style={styles.backText}>← Back</Text>
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Check in</Text>
              <View style={styles.headerSpacer} />
            </View>
          ) : (
            <View style={styles.headerGate}>
              <Text style={styles.headerTitle}>Check in</Text>
            </View>
          )}

          <ProgressDots total={cards.length} current={currentIndex} />

          <View style={styles.stackArea}>
            {visibleCards
              .slice()
              .reverse()
              .map((card, reverseIdx) => {
                const stackIdx = visibleCards.length - 1 - reverseIdx;
                const isTop = stackIdx === 0;
                return (
                  <View
                    key={`${card.id ?? card.type}-${currentIndex + stackIdx}`}
                    style={[styles.cardSlot, !isTop && styles.cardSlotBehind]}>
                    <SwipeCard
                      card={card}
                      isTop={isTop}
                      note={noteDraft}
                      showNoteInput={
                        card.type === 'wildcard' ? wildcardInputOpen : showNoteInput
                      }
                      onTapNote={() => setShowNoteInput(true)}
                      onNoteChange={setNoteDraft}
                      onSwipeRight={onSwipeRight}
                      onSwipeLeft={onSwipeLeft}
                      wildcardText={wildcardText}
                      onWildcardChange={setWildcardText}
                      onWildcardNoteFocus={() => setWildcardInputOpen(true)}
                    />
                  </View>
                );
              })}
          </View>

          {skipMessage ? (
            <Text style={styles.skipMessage}>Noted. Tomorrow&apos;s a new rep.</Text>
          ) : (
            <Text style={styles.swipeGuide}>
              Swipe right · showed up · Swipe left · not today
            </Text>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  loaderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backText: {
    color: COLORS.mutedLight,
    fontSize: 15,
    fontFamily: FONTS.bodyMedium,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontFamily: FONTS.bodyMedium,
  },
  headerSpacer: { width: 48 },
  headerGate: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 12,
  },
  alreadyLoggedWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  alreadyLoggedCard: {
    borderRadius: 26,
    padding: 32,
    minHeight: 200,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.12)',
  },
  alreadyLoggedTitle: {
    fontSize: 24,
    color: COLORS.text,
    fontFamily: 'PlayfairDisplay_300Light',
    textAlign: 'center',
    lineHeight: 32,
  },
  alreadyLoggedSub: {
    fontSize: 15,
    color: COLORS.mutedLight,
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    marginTop: 12,
    textAlign: 'center',
  },
  alreadyLoggedContinue: {
    fontSize: 14,
    color: COLORS.muted,
    fontFamily: FONTS.bodyMedium,
    marginTop: 28,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
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
  stackArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    minHeight: 420,
  },
  cardSlot: {
    position: 'absolute',
    width: CARD_WIDTH,
  },
  cardSlotBehind: {
    zIndex: 0,
  },
  cardShell: {
    width: CARD_WIDTH,
    minHeight: 380,
    borderRadius: CARD_RADIUS,
  },
  cardGlow: {
    position: 'absolute',
    top: 10,
    left: 8,
    right: 8,
    bottom: -6,
    borderRadius: CARD_RADIUS + 6,
    backgroundColor: 'rgba(167, 139, 250, 0.12)',
    shadowColor: '#a78bfa',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 28,
    elevation: 14,
  },
  card: {
    width: CARD_WIDTH,
    minHeight: 380,
    borderRadius: CARD_RADIUS,
    padding: 34,
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.08)',
  },
  cardBehind: {
    zIndex: -1,
  },
  swipeHintRight: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: CARD_RADIUS,
  },
  swipeHintLeft: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: CARD_RADIUS,
  },
  decorLine: {
    position: 'absolute',
    top: 28,
    left: 34,
    right: 34,
    height: 1,
  },
  decorDots: {
    position: 'absolute',
    bottom: 28,
    right: 34,
    flexDirection: 'row',
    gap: 6,
    opacity: 0.35,
  },
  decorDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.accent,
  },
  areaPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 28,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 10,
    elevation: 4,
  },
  areaPillText: {
    fontSize: 11,
    fontFamily: FONTS.bodyMedium,
    letterSpacing: 0.8,
  },
  cardTitle: {
    fontSize: 28,
    lineHeight: 38,
    color: COLORS.text,
    fontFamily: 'PlayfairDisplay_300Light',
    textAlign: 'center',
    fontWeight: '300',
  },
  noteInput: {
    marginTop: 24,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 16,
    color: COLORS.text,
    fontSize: 15,
    fontFamily: FONTS.body,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  wildcardTitle: {
    fontSize: 24,
    lineHeight: 32,
    color: COLORS.text,
    fontFamily: FONTS.bodyMedium,
    textAlign: 'center',
    marginBottom: 16,
  },
  wildcardHint: {
    fontSize: 14,
    color: COLORS.mutedLight,
    fontFamily: FONTS.body,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  wildcardInputWrap: {
    marginTop: 8,
  },
  wildcardInput: {
    color: COLORS.text,
    fontSize: 16,
    fontFamily: FONTS.body,
    minHeight: 120,
    textAlignVertical: 'top',
    paddingRight: 36,
  },
  micBtn: {
    position: 'absolute',
    right: 0,
    bottom: 8,
  },
  swipeGuide: {
    textAlign: 'center',
    color: COLORS.muted,
    fontSize: 13,
    fontFamily: FONTS.body,
    paddingHorizontal: 24,
    paddingBottom: 24,
    fontStyle: 'italic',
  },
  skipMessage: {
    textAlign: 'center',
    color: COLORS.mutedLight,
    fontSize: 14,
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  doneWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  doneLine: {
    fontSize: 28,
    color: COLORS.text,
    fontFamily: 'PlayfairDisplay_300Light',
    textAlign: 'center',
    lineHeight: 38,
  },
  doneBtn: {
    marginTop: 32,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  doneBtnText: {
    color: COLORS.mutedLight,
    fontSize: 15,
    fontFamily: FONTS.bodyMedium,
  },
});
