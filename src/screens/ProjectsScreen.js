import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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

const AREA_COLORS = {
  health: '#4ade80',
  finance: '#facc15',
  career: '#60a5fa',
  relationships: '#f472b6',
  growth: '#c084fc',
  recreation: '#fb923c',
  spirituality: '#38bdf8',
};

const DEFAULT_AREAS = [
  'health',
  'finance',
  'career',
  'relationships',
  'growth',
  'recreation',
  'spirituality',
];

function areaDisplayName(area) {
  return (area || 'area').replace(/^\w/, (c) => c.toUpperCase());
}

function formatDueDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function isTaskComplete(task) {
  const status = (task.status || '').toLowerCase();
  return task.is_complete === true || status === 'completed' || status === 'done';
}

function AreaPill({ area }) {
  const areaKey = (area || '').toLowerCase();
  const color = AREA_COLORS[areaKey] || '#6366f1';
  return (
    <View style={[styles.areaPill, { backgroundColor: color }]}>
      <Text style={styles.areaPillText}>{areaDisplayName(area)}</Text>
    </View>
  );
}

export default function ProjectsScreen() {
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userAreas, setUserAreas] = useState([]);
  const [activeGoals, setActiveGoals] = useState([]);
  const [legacyGoals, setLegacyGoals] = useState([]);
  const [tasksByGoal, setTasksByGoal] = useState(new Map());
  const [expandedGoalId, setExpandedGoalId] = useState(null);
  const [legacyExpanded, setLegacyExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedArea, setSelectedArea] = useState(null);
  const [newActionTitle, setNewActionTitle] = useState('');
  const [addingActionFor, setAddingActionFor] = useState(null);

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
      setActiveGoals([]);
      setLegacyGoals([]);
      setTasksByGoal(new Map());
      setLoading(false);
      return;
    }
    setUserId(uid);

    const [{ data: areasData }, { data: activeData }, { data: legacyData }] =
      await Promise.all([
        supabase.from('user_areas').select('*').eq('user_id', uid),
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
      ]);

    setUserAreas(areasData ?? []);
    const active = activeData ?? [];
    setActiveGoals(active);
    setLegacyGoals(legacyData ?? []);

    const goalIds = [
      ...active.map((g) => g.id),
      ...(legacyData ?? []).map((g) => g.id),
    ];

    let taskMap = new Map();
    if (goalIds.length > 0) {
      const { data: tasksData } = await supabase
        .from('tasks')
        .select('*')
        .in('goal_id', goalIds)
        .order('due_date', { ascending: true });

      for (const task of tasksData ?? []) {
        const list = taskMap.get(task.goal_id) ?? [];
        list.push(task);
        taskMap.set(task.goal_id, list);
      }
    }
    setTasksByGoal(taskMap);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    if (areaOptions.length > 0 && selectedArea == null) {
      setSelectedArea(areaOptions[0].key);
    }
  }, [areaOptions, selectedArea]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setShowForm(false);
    if (areaOptions.length > 0) {
      setSelectedArea(areaOptions[0].key);
    }
  };

  const handleCreateProject = async () => {
    if (!userId || !title.trim() || !selectedArea) return;
    setSaving(true);
    const { error } = await supabase.from('goals').insert({
      user_id: userId,
      title: title.trim(),
      area: selectedArea,
      description: description.trim() || null,
      status: 'active',
    });
    setSaving(false);
    if (!error) {
      resetForm();
      await load();
    }
  };

  const toggleTask = async (task) => {
    const nextComplete = !isTaskComplete(task);
    await supabase
      .from('tasks')
      .update({
        status: nextComplete ? 'completed' : 'active',
        is_complete: nextComplete,
      })
      .eq('id', task.id);
    await load();
  };

  const addAction = async (goalId) => {
    if (!userId || !newActionTitle.trim()) return;
    setAddingActionFor(goalId);
    await supabase.from('tasks').insert({
      goal_id: goalId,
      user_id: userId,
      title: newActionTitle.trim(),
      status: 'active',
    });
    setNewActionTitle('');
    setAddingActionFor(null);
    await load();
  };

  const getProgress = (goalId) => {
    const tasks = tasksByGoal.get(goalId) ?? [];
    if (tasks.length === 0) return { done: 0, total: 0, pct: 0 };
    const done = tasks.filter(isTaskComplete).length;
    return {
      done,
      total: tasks.length,
      pct: Math.round((done / tasks.length) * 100),
    };
  };

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
            color: '#ffffff',
            paddingHorizontal: 20,
            paddingTop: 20,
            paddingBottom: 4,
          }}>
          Projects
        </Text>
        <MeridianWordmark />

        <View style={styles.titleRow}>
          <View style={styles.titleCol}>
            <Text style={styles.headerSubtitle}>Your meaningful work</Text>
          </View>
          {!showForm ? (
            <TouchableOpacity
              style={styles.newProjectBtn}
              onPress={() => setShowForm(true)}>
              <Text style={styles.newProjectBtnText}>+ New Project</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {showForm ? (
          <View style={styles.formCard}>
            <TextInput
              style={styles.input}
              placeholder="Project title"
              placeholderTextColor="#ffffff40"
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
                const color = AREA_COLORS[area.key] || '#6366f1';
                return (
                  <TouchableOpacity
                    key={area.key}
                    style={[
                      styles.areaPillBtn,
                      selected
                        ? { backgroundColor: color, borderColor: color }
                        : styles.pillOutline,
                    ]}
                    onPress={() => setSelectedArea(area.key)}>
                    <Text
                      style={[
                        styles.areaPillBtnText,
                        selected && styles.areaPillBtnTextSelected,
                      ]}>
                      {area.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              placeholder="Description (optional)"
              placeholderTextColor="#ffffff40"
              value={description}
              onChangeText={setDescription}
              multiline
              textAlignVertical="top"
            />
            <View style={styles.formActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={resetForm}
                disabled={saving}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.createBtn, saving && styles.createBtnDisabled]}
                onPress={handleCreateProject}
                disabled={saving || !title.trim() || !selectedArea}>
                <Text style={styles.createBtnText}>
                  {saving ? 'Creating…' : 'Create Project'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator color="#6366f1" size={32} />
          </View>
        ) : (
          <>
            {activeGoals.length === 0 && legacyGoals.length === 0 ? (
              <Text style={styles.emptyText}>
                No active projects.{'\n'}Tap + New Project to begin your next
                meaningful pursuit.
              </Text>
            ) : null}

            {activeGoals.length === 0 && (legacyGoals.length > 0 || showForm) ? (
              <Text style={styles.sectionEmpty}>No active projects</Text>
            ) : null}

            {activeGoals.map((goal) => {
              const areaKey = (goal.area || '').toLowerCase();
              const barColor = AREA_COLORS[areaKey] || '#6366f1';
              const { done, total, pct } = getProgress(goal.id);
              const expanded = expandedGoalId === goal.id;
              const tasks = tasksByGoal.get(goal.id) ?? [];

              return (
                <View key={goal.id} style={styles.projectCard}>
                  <TouchableOpacity
                    onPress={() =>
                      setExpandedGoalId(expanded ? null : goal.id)
                    }
                    activeOpacity={0.8}>
                    <Text style={styles.projectTitle}>{goal.title}</Text>
                    <View style={styles.projectMetaRow}>
                      <AreaPill area={goal.area} />
                    </View>
                    {goal.description ? (
                      <Text style={styles.projectDesc} numberOfLines={1}>
                        {goal.description}
                      </Text>
                    ) : null}
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${pct}%`,
                            backgroundColor: barColor,
                          },
                        ]}
                      />
                    </View>
                    <View style={styles.progressLabelRow}>
                      <Text style={styles.progressLabel}>
                        {done} of {total} actions
                      </Text>
                      <Text style={styles.chevron}>
                        {expanded ? '▾' : '›'}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {expanded ? (
                    <View style={styles.expandedSection}>
                      {tasks.length === 0 ? (
                        <Text style={styles.noTasks}>No actions yet</Text>
                      ) : (
                        tasks.map((task) => {
                          const doneTask = isTaskComplete(task);
                          return (
                            <View key={task.id} style={styles.taskRow}>
                              <TouchableOpacity
                                style={[
                                  styles.taskCheck,
                                  doneTask && styles.taskCheckOn,
                                ]}
                                onPress={() => toggleTask(task)}>
                                {doneTask ? (
                                  <Text style={styles.taskCheckMark}>✓</Text>
                                ) : null}
                              </TouchableOpacity>
                              <View style={styles.taskBody}>
                                <Text
                                  style={[
                                    styles.taskTitle,
                                    doneTask && styles.taskTitleDone,
                                  ]}>
                                  {task.title}
                                </Text>
                                {task.due_date ? (
                                  <Text style={styles.taskDue}>
                                    Due {formatDueDate(task.due_date)}
                                  </Text>
                                ) : null}
                              </View>
                            </View>
                          );
                        })
                      )}
                      <View style={styles.addActionRow}>
                        <TextInput
                          style={styles.addActionInput}
                          placeholder="+ Add action"
                          placeholderTextColor="#ffffff40"
                          value={
                            addingActionFor === goal.id ? newActionTitle : ''
                          }
                          onFocus={() => setAddingActionFor(goal.id)}
                          onChangeText={setNewActionTitle}
                          onSubmitEditing={() => addAction(goal.id)}
                        />
                        {addingActionFor === goal.id &&
                        newActionTitle.trim() ? (
                          <TouchableOpacity
                            onPress={() => addAction(goal.id)}
                            style={styles.addActionBtn}>
                            <Text style={styles.addActionBtnText}>Add</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>
                  ) : null}
                </View>
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
                      const { done, total } = getProgress(goal.id);
                      return (
                        <View
                          key={goal.id}
                          style={[styles.projectCard, styles.legacyCard]}>
                          <Text style={styles.projectTitleMuted}>
                            {goal.title}
                          </Text>
                          <AreaPill area={goal.area} />
                          <Text style={styles.progressLabel}>
                            {done} of {total} actions completed
                          </Text>
                        </View>
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
    backgroundColor: '#080812',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 32,
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
  headerTitle: {
    fontSize: 32,
    fontWeight: '300',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#ffffff55',
    marginTop: 6,
  },
  newProjectBtn: {
    backgroundColor: '#6366f1',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 6,
  },
  newProjectBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  formCard: {
    backgroundColor: '#0f0f1e',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#1a1a2e',
    color: '#ffffff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ffffff15',
    fontSize: 15,
    marginBottom: 12,
  },
  inputMultiline: {
    minHeight: 80,
  },
  fieldLabel: {
    fontSize: 11,
    color: '#ffffff55',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  pillRow: {
    paddingBottom: 12,
    gap: 8,
  },
  areaPillBtn: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    marginRight: 8,
  },
  areaPillBtnText: {
    fontSize: 13,
    color: '#ffffff90',
    fontWeight: '600',
  },
  areaPillBtnTextSelected: {
    color: '#080812',
  },
  pillOutline: {
    backgroundColor: '#ffffff15',
    borderColor: '#ffffff20',
  },
  formActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ffffff20',
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#ffffff80',
    fontSize: 15,
    fontWeight: '500',
  },
  createBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#6366f1',
    alignItems: 'center',
  },
  createBtnDisabled: {
    opacity: 0.6,
  },
  createBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  loaderWrap: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#ffffff55',
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  sectionEmpty: {
    fontSize: 14,
    color: '#ffffff45',
    marginBottom: 16,
  },
  projectCard: {
    backgroundColor: '#0f0f1e',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
  },
  legacyCard: {
    opacity: 0.65,
  },
  projectTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '500',
  },
  projectTitleMuted: {
    color: '#ffffff90',
    fontSize: 17,
    fontWeight: '500',
    marginBottom: 8,
  },
  projectMetaRow: {
    flexDirection: 'row',
    marginTop: 8,
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
  projectDesc: {
    marginTop: 8,
    fontSize: 13,
    color: '#ffffff50',
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#1a1a2e',
    marginTop: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  progressLabel: {
    fontSize: 12,
    color: '#ffffff45',
  },
  chevron: {
    fontSize: 18,
    color: '#ffffff40',
  },
  expandedSection: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#ffffff08',
  },
  noTasks: {
    fontSize: 13,
    color: '#ffffff45',
    marginBottom: 12,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  taskCheck: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#ffffff35',
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  taskCheckOn: {
    backgroundColor: '#4ade80',
    borderColor: '#4ade80',
  },
  taskCheckMark: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  taskBody: {
    flex: 1,
    minWidth: 0,
  },
  taskTitle: {
    color: '#ffffff',
    fontSize: 15,
  },
  taskTitleDone: {
    opacity: 0.5,
    textDecorationLine: 'line-through',
  },
  taskDue: {
    marginTop: 2,
    fontSize: 12,
    color: '#ffffff45',
  },
  addActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  addActionInput: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    color: '#ffffff',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#ffffff15',
    fontSize: 14,
  },
  addActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  addActionBtnText: {
    color: '#6366f1',
    fontSize: 14,
    fontWeight: '600',
  },
  legacyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 12,
    paddingVertical: 8,
  },
  legacyHeaderText: {
    fontSize: 9,
    letterSpacing: 2,
    color: '#6366f1',
    textTransform: 'uppercase',
  },
  legacyChevron: {
    color: '#ffffff50',
    fontSize: 14,
  },
});
