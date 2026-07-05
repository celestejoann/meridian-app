import React, { useCallback, useRef, useState } from 'react';
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
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { COLORS, FONTS, AREA_COLORS } from '../constants/theme';

const SHAPE_LABELS = {
  get_back_to: 'Keep meaning to get back to',
  working_toward: 'Working toward, no plan',
  messy_middle: 'In the middle, messy',
  someday: 'Someday, eventually',
};

function areaDisplayName(area) {
  return (area || 'area').replace(/^\w/, (c) => c.toUpperCase());
}

function formatMomentDate(isoString) {
  if (!isoString) return '';
  const created = new Date(isoString);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfCreated = new Date(
    created.getFullYear(),
    created.getMonth(),
    created.getDate()
  );
  const diffDays = Math.round((startOfToday - startOfCreated) / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays <= 7) return `${diffDays} days ago`;
  return created.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: created.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function MomentEntry({ moment, onMakeCommitment }) {
  return (
    <View style={styles.momentCard}>
      <Text style={styles.momentContent}>{moment.content}</Text>
      <View style={styles.momentFooter}>
        <Text style={styles.momentDate}>{formatMomentDate(moment.created_at)}</Text>
        <TouchableOpacity
          onPress={() => onMakeCommitment(moment.content)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.makeCommitmentLink}>+ Make this a commitment</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function PursuitDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const pursuitId = route.params?.pursuitId;
  const momentInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [pursuit, setPursuit] = useState(null);
  const [moments, setMoments] = useState([]);
  const [userId, setUserId] = useState(null);
  const [addingMoment, setAddingMoment] = useState(false);
  const [momentText, setMomentText] = useState('');
  const [savingMoment, setSavingMoment] = useState(false);

  const load = useCallback(async () => {
    if (!pursuitId) {
      setPursuit(null);
      setMoments([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data: userData } = await supabase.auth.getUser();
    const uid = userData?.user?.id ?? null;
    setUserId(uid);

    const [{ data: goalData, error: goalError }, { data: momentsData, error: momentsError }] =
      await Promise.all([
        supabase.from('goals').select('*').eq('id', pursuitId).maybeSingle(),
        supabase
          .from('pursuit_moments')
          .select('*')
          .eq('pursuit_id', pursuitId)
          .order('created_at', { ascending: false }),
      ]);

    if (goalError) {
      console.log('load pursuit error:', goalError.message);
    }
    if (momentsError) {
      console.log('load moments error:', momentsError.message);
    }

    setPursuit(goalData ?? null);
    setMoments(momentsData ?? []);
    setLoading(false);
  }, [pursuitId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const openMomentInput = () => {
    setAddingMoment(true);
    setTimeout(() => momentInputRef.current?.focus(), 50);
  };

  const handleRevisit = () => {
    if (!pursuitId || !pursuit) return;
    navigation.navigate('RevisitFlow', {
      pursuitId,
      shape: pursuit.shape,
      pursuitArea: pursuit.area,
    });
  };

  const handleMakeCommitment = (content) => {
    navigation.navigate('NewCommitment', {
      initialTitle: content,
      initialArea: pursuit?.area || null,
      returnPursuitId: pursuitId,
    });
  };

  const handleDeletePursuit = () => {
    Alert.alert(
      'Delete this pursuit?',
      "This can't be undone.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('goals').delete().eq('id', pursuitId);
            if (error) {
              console.log('delete pursuit error:', error.message);
              Alert.alert('Could not delete', 'Please try again.');
              return;
            }
            navigation.goBack();
          },
        },
      ]
    );
  };

  const handleMicPress = () => {
    Alert.alert(
      'Voice input',
      'Speech-to-text is not set up yet. Type your note for now — we can wire up the mic in a follow-up.'
    );
  };

  const handleAddMoment = async () => {
    const content = momentText.trim();
    if (!content || !userId || !pursuitId || savingMoment) return;

    const optimisticId = `temp-${Date.now()}`;
    const optimisticMoment = {
      id: optimisticId,
      pursuit_id: pursuitId,
      user_id: userId,
      content,
      source: 'manual',
      created_at: new Date().toISOString(),
    };

    setMoments((prev) => [optimisticMoment, ...prev]);
    setMomentText('');
    setAddingMoment(false);
    setSavingMoment(true);

    const { data, error } = await supabase
      .from('pursuit_moments')
      .insert({
        pursuit_id: pursuitId,
        user_id: userId,
        content,
        source: 'manual',
      })
      .select('*')
      .single();

    setSavingMoment(false);

    if (error) {
      console.log('add moment error:', error.message);
      setMoments((prev) => prev.filter((m) => m.id !== optimisticId));
      setMomentText(content);
      setAddingMoment(true);
      Alert.alert('Could not save', 'Your moment did not save. Please try again.');
      return;
    }

    setMoments((prev) =>
      prev.map((m) => (m.id === optimisticId ? data : m))
    );
  };

  const areaKey = (pursuit?.area || '').toLowerCase();
  const areaColor = AREA_COLORS[areaKey] || COLORS.accent;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator color={COLORS.accent} size={32} />
        </View>
      ) : !pursuit ? (
        <View style={styles.loaderWrap}>
          <Text style={styles.emptyFeedText}>Pursuit not found.</Text>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
              {pursuit.area ? (
                <View
                  style={[
                    styles.areaPill,
                    {
                      backgroundColor: areaColor + '22',
                      borderColor: areaColor,
                    },
                  ]}>
                  <Text style={[styles.areaPillText, { color: areaColor }]}>
                    {areaDisplayName(pursuit.area).toUpperCase()}
                  </Text>
                </View>
              ) : null}

              <Text style={styles.title}>{pursuit.title}</Text>

              {pursuit.shape ? (
                <Text style={styles.shapeLabel}>{SHAPE_LABELS[pursuit.shape]}</Text>
              ) : null}
            </View>

            <View style={styles.actionArea}>
              {addingMoment ? (
                <View style={styles.momentComposer}>
                  <TextInput
                    ref={momentInputRef}
                    style={styles.momentInput}
                    placeholder="What came up?"
                    placeholderTextColor={COLORS.mutedLight}
                    value={momentText}
                    onChangeText={setMomentText}
                    multiline
                    textAlignVertical="top"
                  />
                  <View style={styles.composerActions}>
                    <TouchableOpacity
                      style={styles.micBtn}
                      onPress={handleMicPress}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="mic-outline" size={22} color={COLORS.mutedLight} />
                    </TouchableOpacity>
                    <View style={styles.composerRight}>
                      <TouchableOpacity
                        style={styles.cancelComposerBtn}
                        onPress={() => {
                          setAddingMoment(false);
                          setMomentText('');
                        }}>
                        <Text style={styles.cancelComposerText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.saveMomentBtn,
                          (!momentText.trim() || savingMoment) && styles.saveMomentBtnDisabled,
                        ]}
                        onPress={handleAddMoment}
                        disabled={!momentText.trim() || savingMoment}>
                        <Text style={styles.saveMomentBtnText}>
                          {savingMoment ? 'Saving...' : 'Save moment'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.addMomentBtn}
                  onPress={openMomentInput}
                  activeOpacity={0.85}>
                  <Text style={styles.addMomentBtnText}>+ Add a moment</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.revisitBtn}
                onPress={handleRevisit}
                activeOpacity={0.7}>
                <Text style={styles.revisitBtnText}>Revisit this</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.feedSection}>
              {moments.length === 0 ? (
                <View style={styles.emptyFeed}>
                  <Text style={styles.emptyFeedText}>
                    Nothing logged yet — add a moment whenever something comes to mind
                  </Text>
                </View>
              ) : (
                moments.map((moment) => (
                  <MomentEntry
                    key={moment.id}
                    moment={moment}
                    onMakeCommitment={handleMakeCommitment}
                  />
                ))
              )}
            </View>

            <TouchableOpacity
              style={styles.deletePursuitBtn}
              onPress={handleDeletePursuit}
              activeOpacity={0.7}>
              <Text style={styles.deletePursuitText}>Delete pursuit</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
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
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
  },
  loaderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  header: {
    marginBottom: 28,
  },
  areaPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 14,
  },
  areaPillText: {
    fontSize: 10,
    fontFamily: FONTS.bodyMedium,
    letterSpacing: 1.5,
  },
  title: {
    fontFamily: 'PlayfairDisplay_300Light',
    fontSize: 32,
    color: COLORS.text,
    lineHeight: 40,
    marginBottom: 6,
  },
  shapeLabel: {
    fontSize: 14,
    fontFamily: FONTS.body,
    color: COLORS.mutedLight,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  actionArea: {
    marginBottom: 32,
    gap: 12,
  },
  addMomentBtn: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    alignItems: 'center',
  },
  addMomentBtnText: {
    fontSize: 16,
    fontFamily: FONTS.bodyMedium,
    color: COLORS.accent,
    letterSpacing: 0.2,
  },
  momentComposer: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  momentInput: {
    minHeight: 96,
    fontSize: 16,
    fontFamily: FONTS.body,
    color: COLORS.text,
    lineHeight: 24,
    padding: 0,
  },
  composerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  micBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  composerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cancelComposerBtn: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  cancelComposerText: {
    fontSize: 14,
    fontFamily: FONTS.body,
    color: COLORS.muted,
  },
  saveMomentBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  saveMomentBtnDisabled: {
    opacity: 0.45,
  },
  saveMomentBtnText: {
    fontSize: 14,
    fontFamily: FONTS.bodyMedium,
    color: COLORS.bg,
  },
  revisitBtn: {
    alignSelf: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  revisitBtnText: {
    fontSize: 14,
    fontFamily: FONTS.body,
    color: COLORS.mutedLight,
    fontStyle: 'italic',
    textDecorationLine: 'underline',
  },
  feedSection: {
    gap: 14,
  },
  emptyFeed: {
    paddingVertical: 32,
    paddingHorizontal: 12,
  },
  emptyFeedText: {
    fontSize: 15,
    fontFamily: FONTS.body,
    color: COLORS.mutedLight,
    lineHeight: 24,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  momentCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  momentContent: {
    fontSize: 16,
    fontFamily: FONTS.body,
    color: COLORS.text,
    lineHeight: 26,
    marginBottom: 10,
  },
  momentFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  momentDate: {
    fontSize: 12,
    fontFamily: FONTS.body,
    color: COLORS.muted,
    letterSpacing: 0.3,
    flexShrink: 0,
  },
  makeCommitmentLink: {
    fontSize: 12,
    fontFamily: FONTS.body,
    color: COLORS.mutedLight,
    fontStyle: 'italic',
  },
  deletePursuitBtn: {
    alignSelf: 'center',
    marginTop: 32,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  deletePursuitText: {
    fontSize: 13,
    fontFamily: FONTS.body,
    color: COLORS.muted,
    fontStyle: 'italic',
  },
});
