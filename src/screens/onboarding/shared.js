import React, { useCallback } from 'react';
import { BackHandler, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Polygon, Line, Defs, LinearGradient, Stop } from 'react-native-svg';
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

export function MeridianLogo({ size = 80, gradientId = 'logo' }) {
  const lf = `${gradientId}lf`;
  const rf = `${gradientId}rf`;
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512">
      <Defs>
        <LinearGradient id={lf} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#e8ecff" />
          <Stop offset="0.5" stopColor="#a5b4fc" />
          <Stop offset="1" stopColor="#4f46e5" />
        </LinearGradient>
        <LinearGradient id={rf} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#3730a3" />
          <Stop offset="1" stopColor="#0f0e2a" />
        </LinearGradient>
      </Defs>
      <Polygon points="256,82 256,352 382,352" fill={`url(#${rf})`} />
      <Polygon points="256,82 256,352 130,352" fill={`url(#${lf})`} />
      <Line
        x1="256"
        y1="82"
        x2="256"
        y2="352"
        stroke="#f0f4ff"
        strokeWidth="2"
        opacity="0.7"
      />
    </Svg>
  );
}

export function MeridianWordmarkSmall() {
  return (
    <View style={styles.wordmarkRow}>
      <MeridianLogo size={28} gradientId="wm" />
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
