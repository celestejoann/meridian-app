import React from 'react';
import { ScrollView, Text, StyleSheet, View, TouchableOpacity, Linking } from 'react-native';
import { COLORS, FONTS } from '../constants/theme';

export default function TermsScreen({ navigation }) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Terms of Service</Text>
      <Text style={styles.meta}>Last updated May 2026</Text>

      <Text style={styles.heading}>Not professional advice</Text>
      <Text style={styles.body}>Meridian is a personal growth tool. It is not a substitute for medical, mental health, financial, or legal advice. Always consult qualified professionals.</Text>

      <Text style={styles.heading}>Crisis resources</Text>
      <Text style={styles.body}>988 Suicide and Crisis Lifeline — call or text 988{'\n'}Crisis Text Line — text HOME to 741741</Text>

      <Text style={styles.heading}>Subscription</Text>
      <Text style={styles.body}>• Free plan: limited features{'\n'}• Pro plan: $12.99/month or $103.99/year{'\n'}• Auto-renews unless cancelled{'\n'}• 7-day refund on initial purchase{'\n'}• Cancel anytime; access until period ends{'\n'}• Early access pricing locked for active subscribers</Text>
      <TouchableOpacity onPress={() => Linking.openURL('mailto:hello@meridianlife.app')}>
        <Text style={styles.link}>hello@meridianlife.app for refunds</Text>
      </TouchableOpacity>

      <Text style={styles.heading}>Your content</Text>
      <Text style={styles.body}>You own all content you create in Meridian. We never sell your data.</Text>

      <Text style={styles.heading}>AI-generated content</Text>
      <Text style={styles.body}>AI insights may not always be accurate. Apply your own judgment. Meridian is not responsible for decisions based on AI insights.</Text>

      <Text style={styles.heading}>Governing law</Text>
      <Text style={styles.body}>Virginia, United States</Text>

      <Text style={styles.heading}>Contact</Text>
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
