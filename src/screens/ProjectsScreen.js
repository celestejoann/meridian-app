import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
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
  return status === 'completed' || status === 'done';
}

function AreaPill({ area }) {
  const areaKey = (area || '').toLowerCase();
  const color = AREA_COLORS[areaKey] || COLORS.accent;
  return (
    <View style={[styles.areaPill, { backgroundColor: color }]}>
      <Text style={styles.areaPillText}>{areaDisplayName(area)}</Text>
    </View>
  );
}

export default function ProjectsScreen() {
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userAreas, setUserAreas] = useState([]);
  const [userIdentities, setUserIdentities] = useState([]);
  const [habits, setHabits] = useState([]);
  const [completions, setCompletions] = useState([]);
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
  const [newActionDate, setNewActionDate] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingTaskTitle, setEditingTaskTitle] = useState('');
  const [editingTaskDate, setEditingTaskDate] = useState(null);
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);

  const scrollRef = useRef(null);

  const getIdentityForArea = (areaSlug) => {
    const identity = userIdentities.find(i => i.area_slug === areaSlug);
    return identity?.statement || null;
  };

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
      setUserIdentities([]);
      setHabits([]);
      setCompletions([]);
      setActiveGoals([]);
      setLegacyGoals([]);
      setTasksByGoal(new Map());
      setLoading(false);
      return;
    }
    setUserId(uid);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoKey = sevenDaysAgo.toISOString().split('T')[0];

    const [
      { data: areasData },
      { data: activeData },
      { data: legacyData },
      { data: identitiesData },
      { data: habitsData },
      { data: completionsData },
    ] = await Promise.all([
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
      supabase
        .from('user_identities')
        .select('*')
        .eq('user_id', uid),
      supabase.from('habits').select('*').eq('user_id', uid).eq('status', 'active'),
      supabase
        .from('habit_completions')
        .select('*')
        .eq('user_id', uid)
        .gte('completed_date', sevenDaysAgoKey),
    ]);

    setUserAreas(areasData ?? []);
    setUserIdentities(identitiesData ?? []);
    setHabits(habitsData ?? []);
    setCompletions(completionsData ?? []);
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
    for (const [goalId, tasks] of taskMap.entries()) {
      tasks.sort((a, b) => {
        const aDone = isTaskComplete(a);
        const bDone = isTaskComplete(b);
        if (aDone && !bDone) return 1;
        if (!aDone && bDone) return -1;
        if (!a.due_date && b.due_date) return 1;
        if (a.due_date && !b.due_date) return -1;
        if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
        return 0;
      });
      taskMap.set(goalId, tasks);
    }
    setTasksByGoal(taskMap);
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
    const { error } = await supabase
      .from('tasks')
      .update({ status: nextComplete ? 'completed' : 'not_started' })
      .eq('id', task.id);
    console.log('toggleTask result', { error, nextComplete });
    if (!error) await load();
  };

  const addAction = async (goalId) => {
    if (!userId || !newActionTitle.trim()) return;
    console.log('addAction called', { goalId, title: newActionTitle.trim(), due_date: newActionDate ? newActionDate.toLocaleDateString('en-CA') : null });
    console.log('inserting task', { goal_id: goalId, user_id: userId, title: newActionTitle.trim() });
    const { error } = await supabase.from('tasks').insert({
      goal_id: goalId,
      user_id: userId,
      title: newActionTitle.trim(),
    });
    console.log('addAction insert result', { error });
    setNewActionTitle('');
    setNewActionDate(null);
    setShowDatePicker(false);
    setAddingActionFor(null);
    await load();
  };

  const editTask = async () => {
    if (!editingTaskTitle.trim()) return;
    const { error } = await supabase.from('tasks').update({
      title: editingTaskTitle.trim(),
      due_date: editingTaskDate ? editingTaskDate.toLocaleDateString('en-CA') : null,
    }).eq('id', editingTaskId);
    console.log('editTask result', { error });
    setEditingTaskId(null);
    setEditingTaskTitle('');
    setEditingTaskDate(null);
    setShowEditDatePicker(false);
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
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={90}>
      <ScrollView
        ref={scrollRef}
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
        <Text style={[styles.screenTitle, { fontFamily: 'PlayfairDisplay_300Light' }]}>
          Pursuits
        </Text>
        <MeridianWordmark />

        <View style={styles.titleRow}>
          <View style={styles.titleCol}>
            <Text style={styles.headerSubtitle}>Meaningful work in motion</Text>
          </View>
          {!showForm ? (
            <TouchableOpacity
              style={styles.newProjectBtn}
              onPress={() => setShowForm(true)}>
              <Text style={styles.newProjectBtnText}>+ Begin a pursuit</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {showForm ? (
          <View style={styles.formCard}>
            <Text style={styles.formSectionLabel}>LIFE AREA</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
              {areaOptions.map(area => {
                const areaKey = (area.key || area.area || area.slug || '').toLowerCase();
                const color = AREA_COLORS[areaKey] || COLORS.accent;
                const isSelected = selectedArea === areaKey;
                return (
                  <TouchableOpacity
                    key={areaKey}
                    style={[styles.areaChip, isSelected && { backgroundColor: color + '33', borderColor: color }]}
                    onPress={() => setSelectedArea(areaKey)}>
                    <Text style={[styles.areaChipText, isSelected && { color }]}>{area.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {selectedArea && getIdentityForArea(selectedArea) && (
              <View style={styles.identityHint}>
                <Text style={styles.identityHintText}>
                  I am someone who {getIdentityForArea(selectedArea)}
                </Text>
              </View>
            )}

            <Text style={styles.formSectionLabel}>PURSUIT</Text>
            <TextInput
              style={styles.formInput}
              placeholder="What are you working toward?"
              placeholderTextColor={COLORS.muted}
              value={title}
              onChangeText={setTitle}
            />

            <Text style={styles.formSectionLabel}>DESCRIPTION (optional)</Text>
            <TextInput
              style={[styles.formInput, { minHeight: 70, textAlignVertical: 'top' }]}
              placeholder="What this means to you..."
              placeholderTextColor={COLORS.muted}
              value={description}
              onChangeText={setDescription}
              multiline
            />

            <View style={styles.formActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { resetForm(); setShowForm(false); }}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.beginBtn, (!title.trim() || !selectedArea || saving) && styles.beginBtnDisabled]}
                onPress={handleCreateProject}
                disabled={!title.trim() || !selectedArea || saving}>
                <Text style={styles.beginBtnText}>{saving ? 'Saving...' : 'Begin pursuit'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator color={COLORS.accent} size={32} />
          </View>
        ) : (
          <>
            {activeGoals.length === 0 && legacyGoals.length === 0 ? (
              <Text style={styles.emptyText}>
                No pursuits in motion.{'\n'}Tap + Begin a pursuit to start what
                matters next.
              </Text>
            ) : null}

            {activeGoals.length === 0 && (legacyGoals.length > 0 || showForm) ? (
              <Text style={styles.sectionEmpty}>No pursuits in motion</Text>
            ) : null}

            {activeGoals.map((goal) => {
              const areaKey = (goal.area || '').toLowerCase();
              const barColor = AREA_COLORS[areaKey] || COLORS.accent;
              const expanded = expandedGoalId === goal.id;
              const tasks = tasksByGoal.get(goal.id) ?? [];

              return (
                <TouchableOpacity
                  key={goal.id}
                  style={[styles.pursuitCard, expanded && styles.pursuitCardExpanded]}
                  onPress={() => setExpandedGoalId(expanded ? null : goal.id)}
                  activeOpacity={0.85}>

                  <View style={styles.pursuitAreaRow}>
                    <View style={[styles.pursuitAreaPill, { backgroundColor: barColor + '22', borderColor: barColor }]}>
                      <Text style={[styles.pursuitAreaText, { color: barColor }]}>
                        {(goal.area || '').toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  {getIdentityForArea(goal.area) && (
                    <Text style={styles.pursuitIdentity}>
                      I am someone who {getIdentityForArea(goal.area)}
                    </Text>
                  )}

                  <View style={styles.pursuitTitleRow}>
                    <Text style={styles.pursuitTitle}>{goal.title}</Text>
                    <Text style={styles.pursuitChevron}>{expanded ? '▾' : '›'}</Text>
                  </View>

                  {goal.description ? (
                    <Text style={styles.pursuitDescription} numberOfLines={expanded ? undefined : 1}>
                      {goal.description}
                    </Text>
                  ) : null}

                  {(() => {
                    const pursuitTasks = tasksByGoal.get(goal.id) ?? [];
                    const total = pursuitTasks.length;
                    const done = pursuitTasks.filter(t => isTaskComplete(t)).length;
                    if (total === 0) return null;
                    const pct = total > 0 ? (done / total) * 100 : 0;
                    return (
                      <View style={styles.momentumSection}>
                        <Text style={styles.momentumLabel}>PROGRESS</Text>
                        <View style={styles.momentumBarBg}>
                          <View style={[styles.momentumBarFill, { width: `${pct}%`, backgroundColor: barColor }]} />
                        </View>
                        <Text style={styles.momentumText}>
                          {done === 0
                            ? 'No actions completed yet'
                            : done === total
                            ? 'All actions complete ✦'
                            : `${done} of ${total} actions complete`}
                        </Text>
                      </View>
                    );
                  })()}

                  {expanded && (
                    <View style={styles.actionsSection}>
                      <Text style={styles.actionsLabel}>ACTIONS</Text>
                      {tasks.length === 0 ? (
                        <Text style={styles.noActions}>No actions yet</Text>
                      ) : (
                        tasks.map(task => {
                          return editingTaskId === task.id ? (
                            <View key={task.id} style={styles.editTaskForm}>
                              <TextInput
                                style={styles.addActionInput}
                                value={editingTaskTitle}
                                onChangeText={setEditingTaskTitle}
                                autoFocus
                              />
                              <View style={styles.addActionDateButtons}>
                                <TouchableOpacity
                                  style={[styles.dateChip, editingTaskDate && editingTaskDate.toLocaleDateString('en-CA') === new Date().toLocaleDateString('en-CA') && styles.dateChipSelected]}
                                  onPress={() => { setEditingTaskDate(new Date()); setShowEditDatePicker(false); }}>
                                  <Text style={styles.dateChipText}>Today</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[styles.dateChip, showEditDatePicker && styles.dateChipSelected]}
                                  onPress={() => setShowEditDatePicker(!showEditDatePicker)}>
                                  <Text style={styles.dateChipText}>
                                    {editingTaskDate ? editingTaskDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Pick date'}
                                  </Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.dateChip} onPress={() => setEditingTaskDate(null)}>
                                  <Text style={styles.dateChipText}>No date</Text>
                                </TouchableOpacity>
                              </View>
                              {showEditDatePicker && (
                                <DateTimePicker
                                  value={editingTaskDate || new Date()}
                                  mode="date"
                                  display="spinner"
                                  onChange={(event, date) => { if (date) setEditingTaskDate(date); }}
                                  themeVariant="dark"
                                />
                              )}
                              <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                                <TouchableOpacity style={styles.cancelBtn} onPress={() => { setEditingTaskId(null); setShowEditDatePicker(false); }}>
                                  <Text style={styles.cancelBtnText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.addActionSaveBtn} onPress={editTask}>
                                  <Text style={styles.addActionSaveBtnText}>Save</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          ) : (
                            <View key={task.id} style={styles.actionRow}>
                              <TouchableOpacity
                                style={[styles.actionCheck, isTaskComplete(task) && { backgroundColor: barColor, borderColor: barColor }]}
                                onPress={() => toggleTask(task)}>
                                {isTaskComplete(task) && <Text style={styles.actionCheckMark}>✓</Text>}
                              </TouchableOpacity>
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.actionTitle, isTaskComplete(task) && styles.actionTitleDone]}>
                                  {task.title}
                                </Text>
                                {task.due_date ? (
                                  <Text style={styles.actionDueDate}>
                                    Due {new Date(task.due_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                  </Text>
                                ) : null}
                              </View>
                              <TouchableOpacity
                                style={styles.actionEditBtn}
                                onPress={() => {
                                  setEditingTaskId(task.id);
                                  setEditingTaskTitle(task.title);
                                  setEditingTaskDate(task.due_date ? new Date(task.due_date + 'T00:00:00') : null);
                                }}>
                                <Text style={styles.actionEditText}>Edit</Text>
                              </TouchableOpacity>
                            </View>
                          );
                        })
                      )}
                      <View style={styles.addActionRow}>
                        <TextInput
                          style={styles.addActionInput}
                          placeholder="+ Add action"
                          placeholderTextColor={COLORS.muted}
                          value={addingActionFor === goal.id ? newActionTitle : ''}
                          onFocus={() => {
                            setAddingActionFor(goal.id);
                            setNewActionDate(null);
                            setShowDatePicker(false);
                            setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
                          }}
                          onChangeText={setNewActionTitle}
                          onSubmitEditing={() => {}}
                        />
                      </View>

                      {addingActionFor === goal.id && newActionTitle.trim() ? (
                        <View style={styles.addActionDateRow}>
                          <Text style={styles.addActionDateLabel}>Due date (optional):</Text>
                          <View style={styles.addActionDateButtons}>
                            <TouchableOpacity
                              style={[styles.dateChip, newActionDate && newActionDate.toLocaleDateString('en-CA') === new Date().toLocaleDateString('en-CA') && styles.dateChipSelected]}
                              onPress={() => {
                                setNewActionDate(new Date());
                                setShowDatePicker(false);
                              }}>
                              <Text style={styles.dateChipText}>Today</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.dateChip, (() => {
                                if (!newActionDate) return false;
                                const d = newActionDate.toLocaleDateString('en-CA');
                                const today = new Date().toLocaleDateString('en-CA');
                                const sunday = new Date();
                                sunday.setDate(sunday.getDate() + (7 - sunday.getDay()));
                                return d === sunday.toLocaleDateString('en-CA') && d !== today;
                              })() && styles.dateChipSelected]}
                              onPress={() => {
                                const sunday = new Date();
                                sunday.setDate(sunday.getDate() + (7 - sunday.getDay()));
                                setNewActionDate(sunday);
                                setShowDatePicker(false);
                              }}>
                              <Text style={styles.dateChipText}>This week</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.dateChip, showDatePicker && styles.dateChipSelected]}
                              onPress={() => setShowDatePicker(!showDatePicker)}>
                              <Text style={styles.dateChipText}>
                                {newActionDate && !showDatePicker ? newActionDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Pick date'}
                              </Text>
                            </TouchableOpacity>
                          </View>

                          {showDatePicker && (
                            <DateTimePicker
                              value={newActionDate || new Date()}
                              mode="date"
                              display="spinner"
                              minimumDate={new Date()}
                              onChange={(event, date) => {
                                if (date) setNewActionDate(date);
                              }}
                              themeVariant="dark"
                            />
                          )}

                          <TouchableOpacity
                            style={styles.addActionSaveBtn}
                            onPress={() => addAction(goal.id)}>
                            <Text style={styles.addActionSaveBtnText}>Add action</Text>
                          </TouchableOpacity>
                        </View>
                      ) : null}
                    </View>
                  )}
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
                            {done} moments toward this
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
      </KeyboardAvoidingView>
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
    color: COLORS.text,
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
  inputMultiline: {
    minHeight: 80,
  },
  fieldLabel: {
    fontSize: 11,
    color: COLORS.muted,
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
    color: COLORS.mutedLight,
    fontWeight: '600',
  },
  areaPillBtnTextSelected: {
    color: COLORS.bg,
  },
  pillOutline: {
    backgroundColor: COLORS.borderLight,
    borderColor: COLORS.borderLight,
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
    borderColor: COLORS.borderLight,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: COLORS.mutedLight,
    fontSize: 15,
    fontWeight: '500',
  },
  createBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
  },
  createBtnDisabled: {
    opacity: 0.6,
  },
  createBtnText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
  },
  loaderWrap: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.muted,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  sectionEmpty: {
    fontSize: 14,
    color: COLORS.muted,
    marginBottom: 16,
  },
  projectCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
  },
  legacyCard: {
    opacity: 0.65,
  },
  projectTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '500',
  },
  projectTitleMuted: {
    color: COLORS.mutedLight,
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
    color: COLORS.bg,
    fontSize: 11,
    fontWeight: '700',
  },
  projectDesc: {
    marginTop: 8,
    fontSize: 13,
    color: COLORS.mutedLight,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.surface,
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
    color: COLORS.muted,
  },
  chevron: {
    fontSize: 18,
    color: COLORS.muted,
  },
  expandedSection: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  noTasks: {
    fontSize: 13,
    color: COLORS.muted,
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
    borderColor: COLORS.borderLight,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  taskCheckOn: {
    backgroundColor: COLORS.green,
    borderColor: COLORS.green,
  },
  taskCheckMark: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '700',
  },
  taskBody: {
    flex: 1,
    minWidth: 0,
  },
  taskTitle: {
    color: COLORS.text,
    fontSize: 15,
  },
  taskTitleDone: {
    opacity: 0.5,
    textDecorationLine: 'line-through',
  },
  taskDue: {
    marginTop: 2,
    fontSize: 12,
    color: COLORS.muted,
  },
  addActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  addActionInput: {
    flex: 1,
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    fontSize: 14,
  },
  addActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  addActionBtnText: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  addActionDateRow: { paddingTop: 8, paddingBottom: 4 },
  addActionDateLabel: { fontSize: 11, fontFamily: FONTS.bodyMedium, color: COLORS.muted, letterSpacing: 1, marginBottom: 8 },
  addActionDateButtons: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  dateChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surfaceLight },
  dateChipSelected: { borderColor: COLORS.accent, backgroundColor: COLORS.accent + '22' },
  dateChipText: { fontSize: 13, fontFamily: FONTS.body, color: COLORS.mutedLight },
  addActionSaveBtn: { backgroundColor: COLORS.accent, borderRadius: 10, padding: 10, alignItems: 'center', marginTop: 4 },
  addActionSaveBtnText: { color: COLORS.bg, fontFamily: FONTS.bodyMedium, fontSize: 14 },
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
    color: COLORS.accent,
    textTransform: 'uppercase',
  },
  legacyChevron: {
    color: COLORS.mutedLight,
    fontSize: 14,
  },
  screenTitle: {
    fontSize: 32,
    fontWeight: '300',
    color: COLORS.text,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 4,
  },
  pursuitCard: { backgroundColor: COLORS.surface, borderRadius: 20, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: COLORS.border },
  pursuitCardExpanded: { borderColor: COLORS.borderLight },
  pursuitAreaRow: { flexDirection: 'row', marginBottom: 6 },
  pursuitAreaPill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  pursuitAreaText: { fontSize: 10, fontFamily: FONTS.bodyMedium, letterSpacing: 1.5 },
  pursuitIdentity: { fontSize: 13, fontFamily: FONTS.body, color: COLORS.muted, fontStyle: 'italic', marginBottom: 8, lineHeight: 18 },
  pursuitTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  pursuitTitle: { fontSize: 18, fontFamily: FONTS.heading, color: COLORS.text, flex: 1 },
  pursuitChevron: { fontSize: 18, color: COLORS.muted, marginLeft: 8 },
  pursuitDescription: { fontSize: 14, fontFamily: FONTS.body, color: COLORS.mutedLight, lineHeight: 20, marginBottom: 10 },
  momentumSection: { marginTop: 10 },
  momentumLabel: { fontSize: 10, fontFamily: FONTS.bodyMedium, color: COLORS.muted, letterSpacing: 1.5, marginBottom: 6 },
  momentumBarBg: { height: 4, backgroundColor: COLORS.border, borderRadius: 2, marginBottom: 6 },
  momentumBarFill: { height: 4, borderRadius: 2 },
  momentumText: { fontSize: 12, fontFamily: FONTS.body, color: COLORS.muted },
  actionsSection: { marginTop: 14, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 14 },
  actionsLabel: { fontSize: 10, fontFamily: FONTS.bodyMedium, color: COLORS.muted, letterSpacing: 1.5, marginBottom: 10 },
  noActions: { fontSize: 14, fontFamily: FONTS.body, color: COLORS.muted, fontStyle: 'italic' },
  actionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  actionCheck: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.borderLight, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  actionCheckMark: { color: COLORS.bg, fontSize: 11, fontWeight: 'bold' },
  actionTitle: { fontSize: 15, fontFamily: FONTS.body, color: COLORS.text, flex: 1 },
  actionTitleDone: { textDecorationLine: 'line-through', color: COLORS.muted },
  actionDueDate: { fontSize: 11, fontFamily: FONTS.body, color: COLORS.muted, marginTop: 2 },
  actionEditBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  actionEditText: { fontSize: 12, fontFamily: FONTS.body, color: COLORS.accent },
  editTaskForm: { flex: 1, paddingVertical: 4 },
  identityHint: { backgroundColor: COLORS.bg, borderRadius: 10, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  identityHintText: { fontSize: 13, fontFamily: FONTS.body, color: COLORS.muted, fontStyle: 'italic' },
  areaChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surfaceLight, marginRight: 8 },
  areaChipText: { fontSize: 13, fontFamily: FONTS.body, color: COLORS.mutedLight },
  formSectionLabel: { fontSize: 10, fontFamily: FONTS.bodyMedium, color: COLORS.muted, letterSpacing: 1.5, marginBottom: 8, marginTop: 12 },
  formInput: { backgroundColor: COLORS.bg, color: COLORS.text, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: COLORS.borderLight, fontSize: 15, fontFamily: FONTS.body },
  beginBtn: { backgroundColor: COLORS.accent, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  beginBtnDisabled: { opacity: 0.4 },
  beginBtnText: { color: COLORS.bg, fontFamily: FONTS.bodyMedium, fontSize: 15 },
  formCard: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: COLORS.border },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10 },
  cancelBtnText: { color: COLORS.muted, fontFamily: FONTS.body, fontSize: 15 },
});
