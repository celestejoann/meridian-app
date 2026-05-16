import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import MeridianWordmark from '../components/MeridianWordmark';

const AREA_COLORS = {
  health: '#4ade80',
  finance: '#facc15',
  career: '#60a5fa',
  relationships: '#f472b6',
  growth: '#c084fc',
  recreation: '#fb923c',
  spirituality: '#38bdf8',
};

function formatMonthYear(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function formatArchivedDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getGoalFromSnapshot(snapshot) {
  const g = snapshot.goals;
  if (Array.isArray(g)) return g[0] ?? {};
  return g ?? {};
}

function snapshotStat(snapshot, ...keys) {
  for (const key of keys) {
    const val = snapshot[key];
    if (val != null && val !== '') return val;
  }
  return null;
}

function SectionTitle({ children }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function AreaPill({ area }) {
  const areaKey = (area || '').toLowerCase();
  const color = AREA_COLORS[areaKey] || '#ffffff40';
  const label = (area || 'area').replace(/^\w/, (c) => c.toUpperCase());

  return (
    <View style={[styles.areaPill, { backgroundColor: color }]}>
      <Text style={styles.areaPillText}>{label}</Text>
    </View>
  );
}

function EmptyState({ children }) {
  return <Text style={styles.emptyText}>{children}</Text>;
}

export default function LegacyScreen() {
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [archivedHabits, setArchivedHabits] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData?.user?.id;
    if (!uid) {
      setProjects([]);
      setMilestones([]);
      setArchivedHabits([]);
      setLoading(false);
      return;
    }

    const [
      { data: snapshotsData },
      { data: milestonesData },
      { data: habitsData },
    ] = await Promise.all([
      supabase
        .from('goal_metrics_snapshots')
        .select('*, goals(title, area)')
        .eq('user_id', uid)
        .order('completed_at', { ascending: false }),
      supabase
        .from('identity_milestones')
        .select('*')
        .eq('user_id', uid)
        .order('achieved_at', { ascending: false }),
      supabase
        .from('habits')
        .select('*')
        .eq('user_id', uid)
        .eq('status', 'archived')
        .order('updated_at', { ascending: false }),
    ]);

    setProjects(snapshotsData ?? []);
    setMilestones(milestonesData ?? []);
    setArchivedHabits(habitsData ?? []);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <Text
          style={{
            fontSize: 32,
            fontWeight: '300',
            color: '#ffffff',
            paddingHorizontal: 20,
            paddingTop: 20,
            paddingBottom: 4,
          }}>
          Legacy
        </Text>
        <MeridianWordmark />
        <Text style={styles.headerSubtitle}>Your story so far</Text>

        {loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator color="#6366f1" size={32} />
          </View>
        ) : (
          <>
            <SectionTitle>COMPLETED PROJECTS</SectionTitle>
            {projects.length === 0 ? (
              <EmptyState>
                No completed projects yet. Your finished work will appear here.
              </EmptyState>
            ) : (
              projects.map((snapshot) => {
                const goal = getGoalFromSnapshot(snapshot);
                const title =
                  goal.title ||
                  snapshot.title ||
                  snapshot.project_title ||
                  'Untitled project';
                const area = goal.area || snapshot.area;
                const actions =
                  snapshotStat(
                    snapshot,
                    'actions_count',
                    'total_actions',
                    'actions'
                  ) ?? 0;
                const days =
                  snapshotStat(
                    snapshot,
                    'days_count',
                    'days_active',
                    'days'
                  ) ?? 0;
                const avgScore =
                  snapshotStat(
                    snapshot,
                    'avg_score',
                    'average_score',
                    'avg_completion_rate'
                  ) ?? 0;
                const avgLabel =
                  typeof avgScore === 'number'
                    ? `${Math.round(avgScore)}%`
                    : String(avgScore);

                return (
                  <View
                    key={String(snapshot.id)}
                    style={styles.card}>
                    <View style={styles.projectTopRow}>
                      <View style={styles.projectMain}>
                        <Text style={styles.projectTitle}>{title}</Text>
                        <View style={styles.projectMetaRow}>
                          <AreaPill area={area} />
                        </View>
                        <Text style={styles.projectDate}>
                          Completed {formatMonthYear(snapshot.completed_at)}
                        </Text>
                        <Text style={styles.projectStats}>
                          {actions} actions · {days} days · {avgLabel} avg score
                        </Text>
                      </View>
                      <Text style={styles.projectCheck}>✓</Text>
                    </View>
                  </View>
                );
              })
            )}

            <SectionTitle>IDENTITY MILESTONES</SectionTitle>
            {milestones.length === 0 ? (
              <EmptyState>
                Milestones appear as you build consistency in each life area.
              </EmptyState>
            ) : (
              milestones.map((m) => (
                <View key={String(m.id)} style={styles.card}>
                  <View style={styles.milestoneRow}>
                    <Text style={styles.milestoneEmoji}>⭐</Text>
                    <View style={styles.milestoneBody}>
                      <Text style={styles.milestoneText}>
                        {m.milestone_text ||
                          m.text ||
                          m.description ||
                          m.title ||
                          'Milestone'}
                      </Text>
                      <Text style={styles.milestoneDate}>
                        {formatMonthYear(m.achieved_at)}
                      </Text>
                    </View>
                  </View>
                </View>
              ))
            )}

            <SectionTitle>ARCHIVED COMMITMENTS</SectionTitle>
            {archivedHabits.length === 0 ? (
              <EmptyState>
                Archived commitments will appear here.
              </EmptyState>
            ) : (
              archivedHabits.map((habit) => {
                const daysCompleted =
                  habit.days_completed ??
                  habit.total_completions ??
                  habit.completion_count;

                return (
                  <View key={String(habit.id)} style={styles.card}>
                    <Text style={styles.habitTitle}>{habit.title}</Text>
                    <View style={styles.habitMetaRow}>
                      <AreaPill area={habit.area} />
                    </View>
                    <Text style={styles.habitArchived}>
                      Archived {formatArchivedDate(habit.updated_at)}
                    </Text>
                    {daysCompleted != null ? (
                      <Text style={styles.habitDays}>
                        {daysCompleted} day{daysCompleted === 1 ? '' : 's'}{' '}
                        completed
                      </Text>
                    ) : null}
                  </View>
                );
              })
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#080812',
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
    color: '#ffffff',
    marginTop: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#ffffff55',
    marginTop: 6,
    marginBottom: 24,
  },
  loaderWrap: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 9,
    letterSpacing: 2,
    color: '#6366f1',
    textTransform: 'uppercase',
    marginBottom: 12,
    marginTop: 8,
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      default: 'monospace',
    }),
  },
  card: {
    backgroundColor: '#0f0f1e',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#ffffff55',
    lineHeight: 20,
    marginBottom: 20,
  },
  projectTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  projectMain: {
    flex: 1,
    minWidth: 0,
    paddingRight: 12,
  },
  projectTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '500',
  },
  projectMetaRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  projectDate: {
    marginTop: 10,
    fontSize: 13,
    color: '#ffffff60',
  },
  projectStats: {
    marginTop: 4,
    fontSize: 12,
    color: '#ffffff45',
  },
  projectCheck: {
    color: '#4ade80',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 2,
  },
  areaPill: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  areaPillText: {
    color: '#080812',
    fontSize: 11,
    fontWeight: '700',
  },
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  milestoneEmoji: {
    fontSize: 22,
    marginRight: 12,
  },
  milestoneBody: {
    flex: 1,
    minWidth: 0,
  },
  milestoneText: {
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 22,
  },
  milestoneDate: {
    marginTop: 6,
    fontSize: 13,
    color: '#ffffff50',
  },
  habitTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  habitMetaRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  habitArchived: {
    marginTop: 10,
    fontSize: 13,
    color: '#ffffff50',
  },
  habitDays: {
    marginTop: 4,
    fontSize: 12,
    color: '#ffffff45',
  },
});
