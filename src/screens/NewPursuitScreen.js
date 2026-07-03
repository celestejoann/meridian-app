import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
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

const SHAPE_OPTIONS = [
  { value: 'get_back_to', label: 'Keep meaning to get back to' },
  { value: 'working_toward', label: 'Working toward, no plan' },
  { value: 'messy_middle', label: 'In the middle, messy' },
  { value: 'someday', label: 'Someday, eventually' },
];

function areaDisplayName(area) {
  return (area || 'area').replace(/^\w/, (c) => c.toUpperCase());
}

export default function NewPursuitScreen() {
  const navigation = useNavigation();
  const [userId, setUserId] = useState(null);
  const [userAreas, setUserAreas] = useState([]);
  const [userIdentities, setUserIdentities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [selectedArea, setSelectedArea] = useState(null);
  const [selectedShape, setSelectedShape] = useState(null);
  const [nameHint, setNameHint] = useState(null);
  const nameInputRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      if (!uid) {
        if (mounted) {
          setUserId(null);
          setLoading(false);
        }
        return;
      }
      const [{ data: areasData }, { data: identitiesData }] = await Promise.all([
        supabase.from('user_areas').select('*').eq('user_id', uid),
        supabase.from('user_identities').select('*').eq('user_id', uid),
      ]);
      if (mounted) {
        setUserId(uid);
        setUserAreas(areasData ?? []);
        setUserIdentities(identitiesData ?? []);
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const areaOptions = useMemo(() => {
    if (userAreas.length > 0) {
      return userAreas.map((ua) => ({
        key: (ua.area || ua.slug || ua.name || '').toLowerCase(),
        name:
          ua.name ||
          ua.display_name ||
          areaDisplayName(ua.area || ua.slug || ua.name),
      }));
    }
    return DEFAULT_AREAS.map((key) => ({
      key,
      name: areaDisplayName(key),
    }));
  }, [userAreas]);

  const getIdentityForArea = useCallback(
    (areaSlug) => {
      const identity = userIdentities.find(
        (i) => (i.area_slug || i.area || '').toLowerCase() === areaSlug
      );
      return identity?.statement || null;
    },
    [userIdentities]
  );

  const toggleArea = (areaKey) => {
    setSelectedArea((current) => (current === areaKey ? null : areaKey));
  };

  const toggleShape = (shapeValue) => {
    setSelectedShape((current) => (current === shapeValue ? null : shapeValue));
  };

  const handleTitleChange = (value) => {
    setTitle(value);
    if (value.trim()) {
      setNameHint(null);
    }
  };

  const handleSave = async () => {
    if (saving) return;

    if (!title.trim()) {
      setNameHint('Give it a name to get started');
      nameInputRef.current?.focus();
      return;
    }

    if (!userId) return;

    setSaving(true);
    setNameHint(null);

    const payload = {
      user_id: userId,
      title: title.trim(),
      status: 'active',
    };
    if (selectedArea) payload.area = selectedArea;
    if (selectedShape) payload.shape = selectedShape;

    const { data, error } = await supabase
      .from('goals')
      .insert(payload)
      .select('id')
      .single();

    setSaving(false);

    if (error) {
      console.log('create pursuit error:', error.message);
      return;
    }

    navigation.replace('PursuitDetail', { pursuitId: data.id });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loaderWrap}>
          <ActivityIndicator color={COLORS.accent} size={32} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Text style={styles.promptTitle}>What are you holding right now?</Text>

          <View style={styles.formCard}>
            <Text style={styles.fieldLabel}>Name it</Text>
            <Text style={styles.nameFieldHint}>
              Something you&apos;re working toward, or keep meaning to get back to
            </Text>
            <TextInput
              ref={nameInputRef}
              style={[
                styles.nameInput,
                nameHint && styles.nameInputHighlighted,
              ]}
              placeholder="Getting back into painting"
              placeholderTextColor={COLORS.mutedLight}
              value={title}
              onChangeText={handleTitleChange}
              autoFocus
            />
            {nameHint ? (
              <Text style={styles.nameHint}>{nameHint}</Text>
            ) : null}

            <Text style={styles.optionalLabel}>Life area (optional)</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}>
              {areaOptions.map((area) => {
                const areaKey = area.key;
                const color = AREA_COLORS[areaKey] || COLORS.accent;
                const isSelected = selectedArea === areaKey;
                return (
                  <TouchableOpacity
                    key={areaKey}
                    style={[
                      styles.areaChip,
                      isSelected && {
                        backgroundColor: color + '33',
                        borderColor: color,
                      },
                    ]}
                    onPress={() => toggleArea(areaKey)}>
                    <Text
                      style={[
                        styles.areaChipText,
                        isSelected && { color },
                      ]}>
                      {area.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {selectedArea && getIdentityForArea(selectedArea) ? (
              <View style={styles.identityHint}>
                <Text style={styles.identityHintText}>
                  I am someone who {getIdentityForArea(selectedArea)}
                </Text>
              </View>
            ) : null}

            <Text style={styles.shapeQuestion}>
              What does this feel like right now?
            </Text>
            <View style={styles.shapeWrap}>
              {SHAPE_OPTIONS.map((option) => {
                const isSelected = selectedShape === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.shapeChip,
                      isSelected && styles.shapeChipSelected,
                    ]}
                    onPress={() => toggleShape(option.value)}>
                    <Text
                      style={[
                        styles.shapeChipText,
                        isSelected && styles.shapeChipTextSelected,
                      ]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.formActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => navigation.goBack()}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={saving}>
                <Text style={styles.saveBtnText}>
                  {saving ? 'Saving...' : 'Add pursuit'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
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
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 32,
  },
  loaderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promptTitle: {
    fontFamily: 'PlayfairDisplay_300Light',
    fontSize: 28,
    color: COLORS.text,
    lineHeight: 36,
    marginBottom: 20,
  },
  formCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  fieldLabel: {
    fontSize: 10,
    fontFamily: FONTS.bodyMedium,
    color: COLORS.muted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  nameFieldHint: {
    fontSize: 13,
    fontFamily: FONTS.body,
    color: COLORS.mutedLight,
    lineHeight: 18,
    marginBottom: 10,
  },
  nameInput: {
    backgroundColor: COLORS.bg,
    color: COLORS.text,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    fontSize: 16,
    fontFamily: FONTS.body,
  },
  nameInputHighlighted: {
    borderColor: COLORS.accent,
  },
  nameHint: {
    marginTop: 8,
    fontSize: 13,
    fontFamily: FONTS.body,
    color: COLORS.mutedLight,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  optionalLabel: {
    fontSize: 10,
    fontFamily: FONTS.bodyMedium,
    color: COLORS.muted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: 18,
    marginBottom: 10,
  },
  chipRow: {
    paddingRight: 8,
  },
  areaChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceLight,
    marginRight: 8,
  },
  areaChipText: {
    fontSize: 13,
    fontFamily: FONTS.body,
    color: COLORS.mutedLight,
  },
  identityHint: {
    backgroundColor: COLORS.bg,
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  identityHintText: {
    fontSize: 13,
    fontFamily: FONTS.body,
    color: COLORS.muted,
    fontStyle: 'italic',
  },
  shapeQuestion: {
    marginTop: 18,
    marginBottom: 10,
    fontSize: 13,
    fontFamily: FONTS.body,
    color: COLORS.mutedLight,
    fontStyle: 'italic',
  },
  shapeWrap: {
    gap: 8,
  },
  shapeChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  shapeChipSelected: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accent + '18',
  },
  shapeChipText: {
    fontSize: 14,
    fontFamily: FONTS.body,
    color: COLORS.mutedLight,
    lineHeight: 20,
  },
  shapeChipTextSelected: {
    color: COLORS.text,
    fontFamily: FONTS.bodyMedium,
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 22,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  cancelBtnText: {
    color: COLORS.muted,
    fontFamily: FONTS.body,
    fontSize: 15,
  },
  saveBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnText: {
    color: COLORS.bg,
    fontFamily: FONTS.bodyMedium,
    fontSize: 15,
  },
});
