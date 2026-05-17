import React from 'react';
import { ScrollView, Text, StyleSheet, View, TouchableOpacity, Linking } from 'react-native';
import { COLORS, FONTS } from '../constants/theme';

export default function DisclaimerScreen({ navigation }) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Disclaimer</Text>
      <Text style={styles.meta}>Not Professional Advice</Text>

      <Text style={styles.heading}>What Meridian is</Text>
      <Text style={styles.body}>Meridian is a personal growth and habit tracking tool. Insights and suggestions are for informational and motivational purposes only.</Text>

      <Text style={styles.heading}>What Meridian is not</Text>
      <Text style={styles.body}>Meridian is not a substitute for:{'\n'}• Medical or mental health advice or treatment{'\n'}• Financial, investment, or legal advice{'\n'}• Therapy or clinical coaching{'\n\n'}Always consult qualified professionals.</Text>

      <Text style={styles.heading}>If you are in crisis</Text>
      <Text style={styles.body}>988 Suicide and Crisis Lifeline — call or text 988{'\n'}Crisis Text Line — text HOME to 741741{'\n'}Emergency services — call 911</Text>

      <View style={styles.spacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 24 },
  title: { fontSize: 28, fontFamily: FONTS.heading, color: COLORS.text, marginBottom: 4 },
  meta: { fontSize: 13, fontFamily: FONTS.body, color: COLORS.muted, marginBottom: 28 },
  heading: { fontSize: 15, fontFamily: FONTS.bodyMedium, color: COLORS.accent, marginTop: 24, marginBottom: 8, letterSpacing: 0.3 },
  body: { fontSize: 15, fontFamily: FONTS.body, color: COLORS.mutedLight, lineHeight: 24 },
  spacer: { height: 48 },
});
