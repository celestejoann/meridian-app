import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Alert, ActivityIndicator, Switch, KeyboardAvoidingView, Platform
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { COLORS, FONTS } from '../constants/theme';

const COLOR_OPTIONS = [
  '#86efac', '#fbbf24', '#60a5fa', '#f472b6',
  '#c084fc', '#fb923c', '#38bdf8', '#f87171',
  '#34d399', '#a78bfa',
];

const ICON_OPTIONS = ['♥', '◆', '♡', '↑', '◉', '✦', '$', '★', '◎', '▲'];

const DEFAULT_AREAS = [
  { slug: 'health', name: 'Health', icon: '♥', color: '#86efac' },
  { slug: 'finance', name: 'Finance', icon: '◈', color: '#fbbf24' },
  { slug: 'career', name: 'Career', icon: '▲', color: '#60a5fa' },
  { slug: 'relationships', name: 'Relationships', icon: '✿', color: '#f472b6' },
  { slug: 'family', name: 'Family', icon: '⌂', color: '#fb7185' },
  { slug: 'growth', name: 'Growth', icon: '◎', color: '#c084fc' },
  { slug: 'recreation', name: 'Recreation', icon: '★', color: '#fb923c' },
  { slug: 'spirituality', name: 'Spirituality', icon: '✦', color: '#38bdf8' },
];

function slugify(name) {
  return name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

export default function AreasManagementScreen() {
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLOR_OPTIONS[0]);
  const [selectedIcon, setSelectedIcon] = useState(ICON_OPTIONS[0]);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState(null);
  const [pendingArea, setPendingArea] = useState(null);
  const [pendingIdentity, setPendingIdentity] = useState('');
  const scrollRef = useRef(null);

  const loadAreas = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setUserId(user.id);
    const { data } = await supabase
      .from('user_areas')
      .select('*')
      .eq('user_id', user.id)
      .order('display_order');
    setAreas(data || []);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { loadAreas(); }, [loadAreas]));

  const toggleActive = async (area) => {
    await supabase
      .from('user_areas')
      .update({ is_active: !area.is_active })
      .eq('id', area.id);
    loadAreas();
  };

  const handleDelete = (area) => {
    Alert.alert(
      'Remove area',
      `Remove "${area.name}" from your life areas?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: async () => {
            await supabase.from('user_areas').delete().eq('id', area.id);
            loadAreas();
          },
        },
      ],
      { cancelable: true }
    );
  };

  const suggestedAreas = DEFAULT_AREAS.filter(
    d => !areas.some(a => a.slug === d.slug)
  );

  const handleAddSuggested = (area) => {
    setPendingArea(area);
    setPendingIdentity('');
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
  };

  const handleAdd = () => {
    if (!newName.trim()) return;
    const slug = slugify(newName.trim());
    setPendingArea({
      name: newName.trim(),
      slug,
      color: selectedColor,
      icon: selectedIcon,
      is_custom: true,
    });
    setPendingIdentity('');
    setShowAddForm(false);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
  };

  const handleConfirmAdd = async () => {
    if (!pendingArea) return;
    setSaving(true);
    const display_order = areas.length;
    const { error: areaError } = await supabase.from('user_areas').insert({
      user_id: userId,
      name: pendingArea.name,
      slug: pendingArea.slug,
      color: pendingArea.color,
      icon: pendingArea.icon,
      is_active: true,
      is_custom: pendingArea.is_custom || false,
      display_order,
    });
    if (!areaError && pendingIdentity.trim()) {
      await supabase.from('user_identities').insert({
        user_id: userId,
        area_slug: pendingArea.slug,
        statement: pendingIdentity.trim(),
      });
    }
    setSaving(false);
    setPendingArea(null);
    setPendingIdentity('');
    setNewName('');
    setSelectedColor(COLOR_OPTIONS[0]);
    setSelectedIcon(ICON_OPTIONS[0]);
    loadAreas();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.accent} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}>
      <ScrollView
        ref={scrollRef}
        style={styles.container}
        contentContainerStyle={styles.content}>

      <Text style={styles.hint}>Toggle areas on or off. Only custom areas can be removed.</Text>

      {areas.map(area => (
        <View key={area.id} style={[styles.areaCard, !area.is_active && styles.areaCardDimmed]}>
          <View style={[styles.iconBadge, { backgroundColor: area.color + '22' }]}>
            <Text style={[styles.icon, { color: area.color }]}>{area.icon}</Text>
          </View>
          <Text style={[styles.areaName, !area.is_active && styles.areaNameDimmed]}>{area.name}</Text>
          <View style={styles.areaActions}>
            {area.is_custom && (
              <TouchableOpacity onPress={() => handleDelete(area)} style={styles.removeBtn}>
                <Text style={styles.removeText}>Remove</Text>
              </TouchableOpacity>
            )}
            <Switch
              value={area.is_active}
              onValueChange={() => toggleActive(area)}
              trackColor={{ false: COLORS.border, true: COLORS.accentDim }}
              thumbColor={area.is_active ? COLORS.accent : COLORS.muted}
            />
          </View>
        </View>
      ))}

      {suggestedAreas.length > 0 && (
        <View style={styles.suggestedSection}>
          <Text style={styles.sectionLabel}>SUGGESTED</Text>
          {suggestedAreas.map(area => (
            <TouchableOpacity
              key={area.slug}
              style={styles.suggestedCard}
              onPress={() => handleAddSuggested(area)}>
              <View style={[styles.iconBadge, { backgroundColor: area.color + '22' }]}>
                <Text style={[styles.icon, { color: area.color }]}>{area.icon}</Text>
              </View>
              <Text style={styles.areaName}>{area.name}</Text>
              <Text style={styles.addText}>+ Add</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {pendingArea && (
        <View style={styles.formCard}>
          <View style={styles.pendingHeader}>
            <View style={[styles.iconBadge, { backgroundColor: pendingArea.color + '22' }]}>
              <Text style={[styles.icon, { color: pendingArea.color }]}>{pendingArea.icon}</Text>
            </View>
            <Text style={styles.pendingTitle}>{pendingArea.name}</Text>
          </View>
          <Text style={styles.formLabel}>WHO ARE YOU IN THIS AREA?</Text>
          <Text style={styles.prefix}>I am someone who...</Text>
          <TextInput
            style={styles.input}
            placeholder="takes care of their body"
            placeholderTextColor={COLORS.muted}
            value={pendingIdentity}
            onChangeText={setPendingIdentity}
            multiline
            autoFocus
          />
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleConfirmAdd}
            disabled={saving}>
            <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Add area'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setPendingArea(null)} style={styles.cancelLink}>
            <Text style={styles.cancelLinkText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => setShowAddForm(!showAddForm)}>
        <Text style={styles.addButtonText}>{showAddForm ? 'Cancel' : '+ Add custom area'}</Text>
      </TouchableOpacity>

      {showAddForm && (
        <View style={styles.formCard}>
          <Text style={styles.formLabel}>AREA NAME</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Creativity"
            placeholderTextColor={COLORS.muted}
            value={newName}
            onChangeText={setNewName}
          />

          <Text style={styles.formLabel}>COLOR</Text>
          <View style={styles.colorRow}>
            {COLOR_OPTIONS.map(color => (
              <TouchableOpacity
                key={color}
                style={[styles.colorSwatch, { backgroundColor: color }, selectedColor === color && styles.colorSwatchSelected]}
                onPress={() => setSelectedColor(color)}
              />
            ))}
          </View>

          <Text style={styles.formLabel}>ICON</Text>
          <View style={styles.iconRow}>
            {ICON_OPTIONS.map(icon => (
              <TouchableOpacity
                key={icon}
                style={[styles.iconOption, selectedIcon === icon && { backgroundColor: selectedColor + '33', borderColor: selectedColor }]}
                onPress={() => setSelectedIcon(icon)}>
                <Text style={[styles.iconOptionText, selectedIcon === icon && { color: selectedColor }]}>{icon}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.saveButton, (!newName.trim() || saving) && styles.saveButtonDisabled]}
            onPress={handleAdd}
            disabled={!newName.trim() || saving}>
            <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save area'}</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={{ height: 48 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 20 },
  center: { flex: 1, backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center' },
  hint: { color: COLORS.muted, fontFamily: FONTS.body, fontSize: 13, marginBottom: 16, lineHeight: 18 },
  areaCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border },
  areaCardDimmed: { opacity: 0.5 },
  iconBadge: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  icon: { fontSize: 16 },
  areaName: { flex: 1, color: COLORS.text, fontFamily: FONTS.bodyMedium, fontSize: 15 },
  areaNameDimmed: { color: COLORS.muted },
  areaActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  removeBtn: { paddingVertical: 2 },
  removeText: { color: '#fca5a5', fontFamily: FONTS.body, fontSize: 13 },
  suggestedSection: { marginTop: 8, marginBottom: 8 },
  sectionLabel: { color: COLORS.muted, fontSize: 11, fontFamily: FONTS.bodyMedium, letterSpacing: 1.5, marginBottom: 10 },
  suggestedCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border, borderStyle: 'dashed' },
  addText: { color: COLORS.accent, fontFamily: FONTS.bodyMedium, fontSize: 13 },
  addButton: { backgroundColor: COLORS.surface, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 8, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border },
  addButtonText: { color: COLORS.accent, fontFamily: FONTS.bodyMedium, fontSize: 15 },
  formCard: { backgroundColor: COLORS.surface, borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: COLORS.border },
  formLabel: { color: COLORS.muted, fontSize: 11, fontFamily: FONTS.bodyMedium, letterSpacing: 1.5, marginBottom: 8, marginTop: 12 },
  input: { backgroundColor: COLORS.bg, color: COLORS.text, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: COLORS.borderLight, fontSize: 15, fontFamily: FONTS.body },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorSwatch: { width: 28, height: 28, borderRadius: 14 },
  colorSwatchSelected: { borderWidth: 3, borderColor: COLORS.text },
  iconRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iconOption: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surfaceLight },
  iconOptionText: { fontSize: 18, color: COLORS.mutedLight },
  saveButton: { backgroundColor: COLORS.accent, borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 16 },
  saveButtonDisabled: { opacity: 0.4 },
  saveButtonText: { color: COLORS.bg, fontFamily: FONTS.bodyMedium, fontSize: 15 },
  pendingHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  pendingTitle: { color: COLORS.text, fontFamily: FONTS.headingBold, fontSize: 18, marginLeft: 10 },
  prefix: { color: COLORS.mutedLight, fontFamily: FONTS.bodyMedium, fontSize: 15, marginBottom: 6 },
  cancelLink: { alignItems: 'center', marginTop: 10 },
  cancelLinkText: { color: COLORS.muted, fontFamily: FONTS.body, fontSize: 14 },
});
