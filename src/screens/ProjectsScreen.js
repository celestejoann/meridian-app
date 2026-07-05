import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import MeridianWordmark from '../components/MeridianWordmark';
import { COLORS, FONTS, AREA_COLORS } from '../constants/theme';

function areaDisplayName(area) {
  return (area || 'area').replace(/^\w/, (c) => c.toUpperCase());
}

function confirmDeletePursuit(onDelete) {
  Alert.alert(
    'Delete this pursuit?',
    "This can't be undone.",
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ]
  );
}

export default function ProjectsScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userIdentities, setUserIdentities] = useState([]);
  const [activeGoals, setActiveGoals] = useState([]);
  const [legacyGoals, setLegacyGoals] = useState([]);
  const [legacyExpanded, setLegacyExpanded] = useState(false);

  const getIdentityForArea = (areaSlug) => {
    const identity = userIdentities.find((i) => i.area_slug === areaSlug);
    return identity?.statement || null;
  };

  const load = useCallback(async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData?.user?.id;
    if (!uid) {
      setUserIdentities([]);
      setActiveGoals([]);
      setLegacyGoals([]);
      setLoading(false);
      return;
    }

    const [
      { data: activeData },
      { data: legacyData },
      { data: identitiesData },
    ] = await Promise.all([
      supabase
        .from('goals')
        .select('*')
        .eq('user_id', uid)
        .eq('status', 'active')
        .order('title', { ascending: true }),
      supabase
        .from('goals')
        .select('*')
        .eq('user_id', uid)
        .in('status', ['completed', 'archived'])
        .order('updated_at', { ascending: false }),
      supabase.from('user_identities').select('*').eq('user_id', uid),
    ]);

    setUserIdentities(identitiesData ?? []);
    setActiveGoals(activeData ?? []);
    setLegacyGoals(legacyData ?? []);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const deletePursuit = async (goalId) => {
    const { error } = await supabase.from('goals').delete().eq('id', goalId);
    if (error) {
      console.log('delete pursuit error:', error.message);
      Alert.alert('Could not delete', 'Please try again.');
      return;
    }
    await load();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          !loading && activeGoals.length === 0 && legacyGoals.length === 0 && { flexGrow: 1 },
        ]}
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
        <Text style={[styles.screenTitle, { fontFamily: 'PlayfairDisplay_300Light' }]}>
          Pursuits
        </Text>
        <MeridianWordmark />

        <View style={styles.titleRow}>
          <View style={styles.titleCol}>
            <Text style={styles.headerSubtitle}>Meaningful work in motion</Text>
          </View>
          <TouchableOpacity
            style={styles.newProjectBtn}
            onPress={() => navigation.navigate('NewPursuit')}>
            <Text style={styles.newProjectBtnText}>+ Add pursuit</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator color={COLORS.accent} size={32} />
          </View>
        ) : (
          <>
            {activeGoals.length === 0 && legacyGoals.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>◈</Text>
                <Text style={styles.emptyTitle}>No pursuits yet</Text>
                <Text style={styles.emptyBody}>
                  A pursuit is meaningful work connected to who you are. Add one when you&apos;re ready.
                </Text>
              </View>
            ) : null}

            {activeGoals.length === 0 && legacyGoals.length > 0 ? (
              <Text style={styles.sectionEmpty}>No pursuits in motion</Text>
            ) : null}

            {activeGoals.map((goal) => {
              const areaKey = (goal.area || '').toLowerCase();
              const barColor = AREA_COLORS[areaKey] || COLORS.accent;

              return (
                <TouchableOpacity
                  key={goal.id}
                  style={styles.pursuitCard}
                  onPress={() => navigation.navigate('PursuitDetail', { pursuitId: goal.id })}
                  onLongPress={() => confirmDeletePursuit(() => deletePursuit(goal.id))}
                  delayLongPress={400}
                  activeOpacity={0.85}>
                  {goal.area ? (
                    <View style={styles.pursuitAreaRow}>
                      <View
                        style={[
                          styles.pursuitAreaPill,
                          { backgroundColor: barColor + '22', borderColor: barColor },
                        ]}>
                        <Text style={[styles.pursuitAreaText, { color: barColor }]}>
                          {areaDisplayName(goal.area).toUpperCase()}
                        </Text>
                      </View>
                    </View>
                  ) : null}

                  {getIdentityForArea(goal.area) ? (
                    <Text style={styles.pursuitIdentity}>
                      I am someone who {getIdentityForArea(goal.area)}
                    </Text>
                  ) : null}

                  <View style={styles.pursuitTitleRow}>
                    <Text style={styles.pursuitTitle}>{goal.title}</Text>
                    <Text style={styles.pursuitChevron}>›</Text>
                  </View>

                  {goal.description ? (
                    <Text style={styles.pursuitDescription} numberOfLines={2}>
                      {goal.description}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              );
            })}

            {legacyGoals.length > 0 ? (
              <>
                <TouchableOpacity
                  style={styles.legacyHeader}
                  onPress={() => setLegacyExpanded((v) => !v)}>
                  <Text style={styles.legacyHeaderText}>
                    LEGACY ({legacyGoals.length})
                  </Text>
                  <Text style={styles.legacyChevron}>
                    {legacyExpanded ? '▾' : '▸'}
                  </Text>
                </TouchableOpacity>
                {legacyExpanded
                  ? legacyGoals.map((goal) => {
                      const areaKey = (goal.area || '').toLowerCase();
                      const barColor = AREA_COLORS[areaKey] || COLORS.accent;
                      return (
                        <TouchableOpacity
                          key={goal.id}
                          style={[styles.pursuitCard, styles.legacyCard]}
                          onPress={() =>
                            navigation.navigate('PursuitDetail', { pursuitId: goal.id })
                          }
                          onLongPress={() =>
                            confirmDeletePursuit(() => deletePursuit(goal.id))
                          }
                          delayLongPress={400}
                          activeOpacity={0.85}>
                          <Text style={styles.legacyTitle}>{goal.title}</Text>
                          {goal.area ? (
                            <View
                              style={[
                                styles.pursuitAreaPill,
                                {
                                  backgroundColor: barColor + '22',
                                  borderColor: barColor,
                                  alignSelf: 'flex-start',
                                },
                              ]}>
                              <Text style={[styles.pursuitAreaText, { color: barColor }]}>
                                {areaDisplayName(goal.area).toUpperCase()}
                              </Text>
                            </View>
                          ) : null}
                        </TouchableOpacity>
                      );
                    })
                  : null}
              </>
            ) : null}
          </>
        )}
      </ScrollView>
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
  screenTitle: {
    fontSize: 32,
    color: COLORS.text,
    paddingTop: 20,
    paddingBottom: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12,
  },
  titleCol: {
    flex: 1,
  },
  headerSubtitle: {
    fontSize: 14,
    color: COLORS.muted,
    marginTop: 6,
  },
  newProjectBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 6,
  },
  newProjectBtnText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
  },
  loaderWrap: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyState: {
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  emptyIcon: {
    fontSize: 40,
    color: COLORS.accent,
  },
  emptyTitle: {
    fontFamily: 'PlayfairDisplay_300Light',
    fontSize: 22,
    color: COLORS.text,
    textAlign: 'center',
    marginTop: 16,
  },
  emptyBody: {
    fontSize: 14,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 8,
    marginHorizontal: 32,
  },
  sectionEmpty: {
    fontSize: 14,
    color: COLORS.muted,
    marginBottom: 16,
  },
  pursuitCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  legacyCard: {
    opacity: 0.65,
  },
  pursuitAreaRow: {
    marginBottom: 10,
  },
  pursuitAreaPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  pursuitAreaText: {
    fontSize: 10,
    fontFamily: FONTS.bodyMedium,
    letterSpacing: 1.5,
  },
  pursuitIdentity: {
    fontSize: 13,
    color: COLORS.mutedLight,
    fontStyle: 'italic',
    marginBottom: 8,
    lineHeight: 18,
  },
  pursuitTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  pursuitTitle: {
    flex: 1,
    fontSize: 18,
    fontFamily: FONTS.bodyMedium,
    color: COLORS.text,
    lineHeight: 24,
  },
  pursuitChevron: {
    fontSize: 20,
    color: COLORS.muted,
  },
  pursuitDescription: {
    marginTop: 8,
    fontSize: 14,
    fontFamily: FONTS.body,
    color: COLORS.mutedLight,
    lineHeight: 20,
  },
  legacyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  legacyHeaderText: {
    fontSize: 11,
    letterSpacing: 1.5,
    color: COLORS.muted,
    fontFamily: FONTS.bodyMedium,
  },
  legacyChevron: {
    fontSize: 14,
    color: COLORS.muted,
  },
  legacyTitle: {
    color: COLORS.mutedLight,
    fontSize: 17,
    fontFamily: FONTS.bodyMedium,
    marginBottom: 8,
  },
});
