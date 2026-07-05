import React from 'react';
import { ScrollView, Text, StyleSheet, View, TouchableOpacity, Linking } from 'react-native';
import { COLORS, FONTS } from '../constants/theme';

export default function PrivacyScreen({ navigation }) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Privacy Policy</Text>
      <Text style={styles.meta}>Last updated May 2026</Text>

      <Text style={styles.heading}>What we collect</Text>
      <Text style={styles.body}>• Email address for login{'\n'}• Daily reflections and evening notes{'\n'}• Mood, energy, and focus scores{'\n'}• Sleep hours and daily focus intention{'\n'}• Win of the day entries{'\n'}• Habit completion records{'\n'}• Identity statements and life areas{'\n'}• Project and action data</Text>

      <Text style={styles.heading}>How we use it</Text>
      <Text style={styles.body}>• To provide and operate Meridian{'\n'}• To generate AI insights via Anthropic's API{'\n'}• To calculate your Life Wheel and streaks{'\n'}• To process payments via Stripe{'\n'}• We never sell your data</Text>

      <Text style={styles.heading}>AI and your data</Text>
      <Text style={styles.body}>AI features use Claude by Anthropic. Your data is sent to Anthropic only to generate your requested response. Anthropic does not train on your data.</Text>
      <TouchableOpacity onPress={() => Linking.openURL('https://anthropic.com/privacy')}>
        <Text style={styles.link}>anthropic.com/privacy</Text>
      </TouchableOpacity>

      <Text style={styles.heading}>Your rights</Text>
      <Text style={styles.body}>Access, correct, or delete your data anytime. We respond within 30 days.</Text>
      <TouchableOpacity onPress={() => Linking.openURL('mailto:hello@meridianlife.app')}>
        <Text style={styles.link}>hello@meridianlife.app</Text>
      </TouchableOpacity>

      <Text style={styles.heading}>Contact</Text>
      <Text style={styles.body}>Meridian Life LLC, Virginia USA</Text>
      <TouchableOpacity onPress={() => Linking.openURL('mailto:hello@meridianlife.app')}>
        <Text style={styles.link}>hello@meridianlife.app</Text>
      </TouchableOpacity>

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
  link: { fontSize: 15, fontFamily: FONTS.body, color: COLORS.accent, marginTop: 6, textDecorationLine: 'underline' },
  spacer: { height: 48 },
});
