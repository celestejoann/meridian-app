import React, { useCallback } from 'react';
import { BackHandler, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Polygon } from 'react-native-svg';
import { COLORS, FONTS, AREA_COLORS } from '../../constants/theme';

export const NAME_STORAGE_KEY = 'meridian_user_name';

export const AREA_OPTIONS = [
  { slug: 'health', name: 'Health', icon: '♥', color: AREA_COLORS.health },
  { slug: 'finance', name: 'Finance', icon: '◈', color: AREA_COLORS.finance },
  { slug: 'career', name: 'Career', icon: '▲', color: AREA_COLORS.career },
  {
    slug: 'relationships',
    name: 'Relationships',
    icon: '✿',
    color: AREA_COLORS.relationships,
  },
  { slug: 'growth', name: 'Growth', icon: '◎', color: AREA_COLORS.growth },
  {
    slug: 'recreation',
    name: 'Recreation',
    icon: '★',
    color: AREA_COLORS.recreation,
  },
  {
    slug: 'spirituality',
    name: 'Spirituality',
    icon: '✦',
    color: AREA_COLORS.spirituality,
  },
];

export const onboardingStyles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  flex: {
    flex: 1,
  },
  center: {
    alignItems: 'center',
  },
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
  wordmarkText: {
    fontFamily: FONTS.headingBold,
    fontSize: 18,
    color: COLORS.text,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 12,
    paddingBottom: 8,
  },
  progressDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.border,
  },
  progressDotActive: {
    backgroundColor: COLORS.accent,
    width: 18,
  },
  primaryBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 48,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  primaryBtnDisabled: {
    backgroundColor: COLORS.surfaceLight,
  },
  primaryBtnText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 16,
    color: '#ffffff',
  },
  primaryBtnTextDisabled: {
    color: COLORS.muted,
  },
  playfairHeading: {
    fontFamily: FONTS.headingBold,
    color: COLORS.text,
  },
  bodySubtext: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.muted,
    lineHeight: 24,
  },
});

const styles = onboardingStyles;

export function MeridianLogo({ size = 80 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Polygon
        points="20,4 36,34 20,28 4,34"
        fill="none"
        stroke="#a78bfa"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Polygon
        points="20,4 28,34 20,28 12,34"
        fill="#a78bfa"
        fillOpacity={0.3}
        stroke="none"
      />
    </Svg>
  );
}

export function MeridianWordmarkSmall() {
  return (
    <View style={styles.wordmarkRow}>
      <MeridianLogo size={28} />
      <Text style={styles.wordmarkText}>Meridian</Text>
    </View>
  );
}

export function ProgressDots({ step, total = 6 }) {
  return (
    <View style={styles.progressRow}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[styles.progressDot, i + 1 === step && styles.progressDotActive]}
        />
      ))}
    </View>
  );
}

export function useBlockHardwareBack() {
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
      return () => sub.remove();
    }, [])
  );
}

export function PrimaryButton({ label, onPress, disabled, style }) {
  return (
    <TouchableOpacity
      style={[
        styles.primaryBtn,
        disabled && styles.primaryBtnDisabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}>
      <Text style={[styles.primaryBtnText, disabled && styles.primaryBtnTextDisabled]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}
