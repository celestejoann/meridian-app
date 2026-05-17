import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Alert, ActivityIndicator, RefreshControl
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { COLORS, FONTS } from '../constants/theme';

const AREA_COLORS = {
  health: '#86efac',
  finance: '#fbbf24',
  career: '#60a5fa',
  relationships: '#f472b6',
  growth: '#c084fc',
  recreation: '#fb923c',
  spirituality: '#38bdf8',
};

export default function IdentityManagementScreen() {
  const [identities, setIdentities] = useState([]);
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newStatement, setNewStatement] = useState('');
  const [selectedAreaSlug, setSelectedAreaSlug] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [saving, setSaving] = useState(false);
  const [addError, setAddError] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const [{ data: identityData }, { data: areaData }] = await Promise.all([
      supabase.from('user_identities').select('*').eq('user_id', user.id).order('area_slug'),
      supabase.from('user_areas').select('*').eq('user_id', user.id).eq('is_active', true).order('display_order'),
    ]);

    setIdentities(identityData || []);
    // areas without an identity are the only ones available to add
    const takenSlugs = (identityData || []).map(i => i.area_slug);
    const availableAreas = (areaData || []).filter(a => !takenSlugs.includes(a.slug));
    setAreas(availableAreas);
    if (availableAreas.length > 0) {
      setSelectedAreaSlug(availableAreas[0].slug);
    } else {
      setSelectedAreaSlug(null);
    }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleAdd = async () => {
    if (!newStatement.trim() || !selectedAreaSlug) return;
    setSaving(true);
    setAddError(null);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('user_identities').insert({
      user_id: user.id,
      area_slug: selectedAreaSlug,
      statement: newStatement.trim(),
    });
    setSaving(false);
    if (error) {
      console.log('insert error:', JSON.stringify(error));
      if (error.code === '23505') {
        setAddError('You already have an identity for this area. Remove the existing one first, or choose a different area.');
      } else {
        setAddError('Something went wrong. Please try again.');
      }
    } else {
      setNewStatement('');
      setShowAddForm(false);
      setAddError(null);
      loadData();
    }
  };

  const handleDelete = async (id) => {
    Alert.alert(
      'Remove identity',
      'Are you sure you want to remove this identity statement?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('user_identities').delete().eq('id', id);
            if (!error) loadData();
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleEditSave = async (id) => {
    if (!editingText.trim()) return;
    setSaving(true);
    await supabase.from('user_identities').update({ statement: editingText.trim() }).eq('id', id);
    setSaving(false);
    setEditingId(null);
    setEditingText('');
    loadData();
  };

  const getAreaColor = (slug) => AREA_COLORS[slug] || COLORS.accent;
  const getAreaName = (slug) => {
    const area = areas.find(a => a.slug === slug);
    return area?.name || slug;
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.accent} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#a78bfa"
          colors={['#a78bfa']}
        />
      }>

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => setShowAddForm(!showAddForm)}>
        <Text style={styles.addButtonText}>{showAddForm ? 'Cancel' : '+ Add identity'}</Text>
      </TouchableOpacity>

      {showAddForm && (
        <View style={styles.formCard}>
          {areas.length === 0 ? (
            <Text style={styles.allDoneText}>All your life areas have identity statements. Add a new area in Life Areas settings to add more.</Text>
          ) : (
            <>
              <Text style={styles.formLabel}>LIFE AREA</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.areaRow}>
                {areas.map(area => (
                  <TouchableOpacity
                    key={area.slug}
                    style={[styles.areaChip, selectedAreaSlug === area.slug && { backgroundColor: getAreaColor(area.slug) + '33', borderColor: getAreaColor(area.slug) }]}
                    onPress={() => setSelectedAreaSlug(area.slug)}>
                    <View style={[styles.areaDot, { backgroundColor: getAreaColor(area.slug) }]} />
                    <Text style={[styles.areaChipText, selectedAreaSlug === area.slug && { color: getAreaColor(area.slug) }]}>{area.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.formLabel}>IDENTITY STATEMENT</Text>
              <Text style={styles.prefix}>I am someone who...</Text>
              <TextInput
                style={styles.input}
                placeholder="takes care of their body"
                placeholderTextColor={COLORS.muted}
                value={newStatement}
                onChangeText={setNewStatement}
                multiline
              />

              {addError && (
                <Text style={styles.errorText}>{addError}</Text>
              )}

              <TouchableOpacity
                style={[styles.saveButton, (!newStatement.trim() || saving) && styles.saveButtonDisabled]}
                onPress={handleAdd}
                disabled={!newStatement.trim() || saving}>
                <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save identity'}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {identities.length === 0 && !showAddForm && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No identity statements yet.</Text>
          <Text style={styles.emptySubtext}>Tap + Add identity to define who you are.</Text>
        </View>
      )}

      {identities.map(identity => (
        <View key={identity.id} style={styles.identityCard}>
          <View style={styles.identityHeader}>
            <View style={[styles.areaDot, { backgroundColor: getAreaColor(identity.area_slug) }]} />
            <Text style={[styles.areaLabel, { color: getAreaColor(identity.area_slug) }]}>
              {getAreaName(identity.area_slug).toUpperCase()}
            </Text>
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => {
                  setEditingId(identity.id);
                  setEditingText(identity.statement);
                }}>
                <Text style={styles.actionEdit}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => handleDelete(identity.id)}>
                <Text style={styles.actionDelete}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>

          {editingId === identity.id ? (
            <View>
              <TextInput
                style={styles.input}
                value={editingText}
                onChangeText={setEditingText}
                multiline
                autoFocus
              />
              <TouchableOpacity
                style={styles.saveButton}
                onPress={() => handleEditSave(identity.id)}>
                <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.statement}>I am someone who {identity.statement}</Text>
          )}
        </View>
      ))}

      <View style={{ height: 48 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 20 },
  center: { flex: 1, backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center' },
  addButton: { backgroundColor: COLORS.surface, borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: COLORS.border },
  addButtonText: { color: COLORS.accent, fontFamily: FONTS.bodyMedium, fontSize: 15 },
  formCard: { backgroundColor: COLORS.surface, borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: COLORS.border },
  formLabel: { color: COLORS.muted, fontSize: 11, fontFamily: FONTS.bodyMedium, letterSpacing: 1.5, marginBottom: 8, marginTop: 12 },
  areaRow: { marginBottom: 4 },
  areaChip: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surfaceLight },
  areaChipText: { color: COLORS.mutedLight, fontFamily: FONTS.body, fontSize: 13 },
  areaDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  prefix: { color: COLORS.mutedLight, fontFamily: FONTS.bodyMedium, fontSize: 15, marginBottom: 6, marginTop: 4 },
  input: { backgroundColor: COLORS.bg, color: COLORS.text, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: COLORS.borderLight, fontSize: 15, fontFamily: FONTS.body, marginTop: 4, minHeight: 80, textAlignVertical: 'top' },
  errorText: { color: '#fca5a5', fontFamily: FONTS.body, fontSize: 13, marginTop: 8, lineHeight: 18 },
  saveButton: { backgroundColor: COLORS.accent, borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 12 },
  saveButtonDisabled: { opacity: 0.4 },
  saveButtonText: { color: COLORS.bg, fontFamily: FONTS.bodyMedium, fontSize: 15 },
  emptyState: { alignItems: 'center', paddingTop: 48 },
  emptyText: { color: COLORS.text, fontFamily: FONTS.body, fontSize: 16, marginBottom: 8 },
  emptySubtext: { color: COLORS.muted, fontFamily: FONTS.body, fontSize: 14 },
  identityCard: { backgroundColor: COLORS.surface, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  identityHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  areaLabel: { fontSize: 11, fontFamily: FONTS.bodyMedium, letterSpacing: 1.5, flex: 1 },
  actions: { flexDirection: 'row', gap: 12 },
  actionBtn: { paddingVertical: 2 },
  actionEdit: { color: COLORS.accent, fontFamily: FONTS.body, fontSize: 13 },
  actionDelete: { color: '#fca5a5', fontFamily: FONTS.body, fontSize: 13 },
  statement: { color: COLORS.text, fontFamily: FONTS.body, fontSize: 15, lineHeight: 22 },
  allDoneText: { color: COLORS.mutedLight, fontFamily: FONTS.body, fontSize: 14, lineHeight: 22, textAlign: 'center', paddingVertical: 16 },
});
