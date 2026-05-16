import React from 'react';
import { StyleSheet, Text } from 'react-native';

export default function MeridianWordmark() {
  return <Text style={styles.wordmark}>Meridian</Text>;
}

const styles = StyleSheet.create({
  wordmark: {
    fontSize: 13,
    color: '#ffffff20',
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 4,
  },
});
