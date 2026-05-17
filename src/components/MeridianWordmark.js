import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { COLORS, FONTS } from '../constants/theme';

export default function MeridianWordmark() {
  return <Text style={styles.wordmark}>Meridian</Text>;
}

const styles = StyleSheet.create({
  wordmark: {
    fontSize: 13,
    color: COLORS.borderLight,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 4,
    fontFamily: FONTS.bodyMedium,
  },
});
