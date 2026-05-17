import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { COLORS, FONTS } from '../../constants/theme';
import {
  PrimaryButton,
  ProgressDots,
  onboardingStyles,
  useBlockHardwareBack,
} from './shared';

const DEFAULT_AREAS = [
  { slug: 'health', name: 'Health', icon: '♥', color: '#86efac' },
  { slug: 'finance', name: 'Finance', icon: '◈', color: '#fbbf24' },
  { slug: 'career', name: 'Career', icon: '▲', color: '#60a5fa' },
  {
    slug: 'relationships',
    name: 'Relationships',
    icon: '✿',
    color: '#f472b6',
  },
  { slug: 'family', name: 'Family', icon: '⌂', color: '#fb7185' },
  { slug: 'growth', name: 'Growth', icon: '◎', color: '#c084fc' },
  { slug: 'recreation', name: 'Recreation', icon: '★', color: '#fb923c' },
  { slug: 'spirituality', name: 'Spirituality', icon: '✦', color: '#38bdf8' },
];

const CUSTOM_SWATCHES = [
  '#86efac',
  '#fbbf24',
  '#60a5fa',
  '#f472b6',
  '#c084fc',
  '#fb923c',
  '#38bdf8',
  '#f87171',
];

function hexWithAlpha(hex, opacity) {
  const h = hex.replace('#', '').slice(0, 6);
  const a = Math.round(opacity * 255)
    .toString(16)
    .padStart(2, '0');
  return `#${h}${a}`;
}

function slugify(name) {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'custom'
  );
}

async function saveSelectedAreas(userId, selectedAreas) {
  await supabase.from('user_areas').delete().eq('user_id', userId);

  const areasToInsert = selectedAreas.map((area, index) => ({
    user_id: userId,
    name: area.name,
    slug: area.slug,
    color: area.color,
    icon: area.icon,
    is_active: true,
    is_custom: area.isCustom || false,
    display_order: index,
  }));

  const { error } = await supabase.from('user_areas').insert(areasToInsert);
  return error;
}

export default function AreasScreen({ navigation, route }) {
  useBlockHardwareBack();
  const userName = route.params?.userName ?? '';
  const [areas, setAreas] = useState(() => [...DEFAULT_AREAS]);
  const [selected, setSelected] = useState(() => new Set());
  const [saving, setSaving] = useState(false);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customColor, setCustomColor] = useState(CUSTOM_SWATCHES[0]);

  const toggle = (slug) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const selectedAreas = useMemo(
    () => areas.filter((a) => selected.has(a.slug)),
    [areas, selected]
  );
  const canContinue = selected.size >= 3;

  const handleAddCustomArea = () => {
    const name = customName.trim();
    if (!name) return;

    let slug = slugify(name);
    if (areas.some((a) => a.slug === slug)) {
      let n = 2;
      while (areas.some((a) => a.slug === `${slug}_${n}`)) n += 1;
      slug = `${slug}_${n}`;
    }

    const customArea = {
      name,
      slug,
      color: customColor,
      icon: '◎',
      isCustom: true,
    };

    setAreas((prev) => [...prev, customArea]);
    setSelected((prev) => new Set([...prev, slug]));
    setCustomName('');
    setCustomColor(CUSTOM_SWATCHES[0]);
    setShowCustomForm(false);
  };

  const handleContinue = async () => {
    if (!canContinue || saving) return;
    setSaving(true);

    const areasPayload = selectedAreas.map((area) => ({ ...area }));

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      setSaving(false);
      Alert.alert('Something went wrong', 'Please sign in again and retry.');
      return;
    }

    const saveError = await saveSelectedAreas(userData.user.id, areasPayload);
    setSaving(false);

    if (saveError) {
      Alert.alert(
        'Could not save areas',
        saveError.message || 'Please try again.'
      );
      return;
    }

    navigation.navigate('Identity', {
      userName,
      selectedAreas: areasPayload,
    });
  };

  return (
    <SafeAreaView style={onboardingStyles.safe} edges={['top', 'bottom']}>
      <ProgressDots step={3} />
      <ScrollView
        contentContainerStyle={onboardingStyles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.greeting}>Good to meet you, {userName}.</Text>
        <Text style={styles.subtext}>
          Your life is made of different areas —{'\n'}
          each one an expression of who you are.{'\n\n'}
          Choose the ones that matter to you.
        </Text>
        <View style={styles.grid}>
          {areas.map((area) => {
            const isOn = selected.has(area.slug);
            const iconColor = isOn ? area.color : hexWithAlpha(area.color, 0.6);
            const textColor = isOn ? area.color : hexWithAlpha(area.color, 0.6);
            const borderColor = isOn
              ? area.color
              : hexWithAlpha(area.color, 0.3);
            return (
              <TouchableOpacity
                key={area.slug}
                style={[
                  styles.pill,
                  {
                    borderColor,
                    backgroundColor: isOn ? area.color + '20' : 'transparent',
                  },
                ]}
                onPress={() => toggle(area.slug)}
                activeOpacity={0.8}>
                <View style={styles.pillInner}>
                  <Text style={[styles.pillIcon, { color: iconColor }]}>
                    {area.icon}
                  </Text>
                  <Text style={[styles.pillText, { color: textColor }]}>
                    {area.name}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            style={styles.addOwnBtn}
            onPress={() => setShowCustomForm((v) => !v)}
            activeOpacity={0.8}>
            <Text style={styles.addOwnText}>+ Add your own</Text>
          </TouchableOpacity>
        </View>
        {showCustomForm ? (
          <View style={styles.customForm}>
            <TextInput
              style={styles.customNameInput}
              placeholder="Area name..."
              placeholderTextColor={COLORS.border}
              value={customName}
              onChangeText={setCustomName}
              autoCapitalize="words"
            />
            <Text style={styles.colorLabel}>COLOR</Text>
            <View style={styles.swatchRow}>
              {CUSTOM_SWATCHES.map((c) => {
                const isSwatchOn = customColor === c;
                return (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setCustomColor(c)}
                    style={[
                      styles.swatchOuter,
                      isSwatchOn && styles.swatchOuterOn,
                    ]}>
                    <View style={[styles.swatch, { backgroundColor: c }]} />
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity
              style={styles.addAreaBtn}
              onPress={handleAddCustomArea}
              disabled={!customName.trim()}
              activeOpacity={0.85}>
              <Text style={styles.addAreaBtnText}>Add Area</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        <Text style={styles.hint}>Select at least 3</Text>
        <PrimaryButton
          label={saving ? 'Saving…' : 'These feel right →'}
          onPress={handleContinue}
          disabled={!canContinue || saving}
          style={styles.button}
        />
        {saving ? (
          <ActivityIndicator
            color={COLORS.accent}
            style={styles.loader}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  greeting: {
    fontFamily: FONTS.headingBold,
    fontSize: 28,
    color: COLORS.text,
    paddingHorizontal: 32,
    marginTop: 36,
    marginBottom: 8,
  },
  subtext: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.muted,
    lineHeight: 24,
    paddingHorizontal: 32,
    marginBottom: 32,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  pill: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    margin: 6,
    borderWidth: 1.5,
  },
  pillInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pillIcon: {
    fontSize: 14,
  },
  pillText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 14,
  },
  addOwnBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
    margin: 6,
    marginTop: 8,
  },
  addOwnText: {
    color: COLORS.muted,
    fontSize: 14,
    fontFamily: FONTS.body,
  },
  customForm: {
    marginHorizontal: 32,
    marginTop: 16,
    padding: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
  },
  customNameInput: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    fontSize: 16,
    fontFamily: FONTS.body,
    color: COLORS.text,
    paddingVertical: 8,
    marginBottom: 16,
  },
  colorLabel: {
    fontSize: 10,
    letterSpacing: 1,
    color: COLORS.muted,
    fontFamily: FONTS.bodyMedium,
    marginBottom: 10,
  },
  swatchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  swatchOuter: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchOuterOn: {
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  addAreaBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 16,
    alignItems: 'center',
  },
  addAreaBtnText: {
    color: '#ffffff',
    fontFamily: FONTS.bodyMedium,
    fontSize: 15,
  },
  hint: {
    fontSize: 11,
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 8,
  },
  button: {
    marginTop: 32,
    marginBottom: 60,
    marginHorizontal: 32,
  },
  loader: {
    marginTop: 12,
  },
});
