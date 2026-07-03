import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, FONTS } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import {
  MeridianLogo,
  PrimaryButton,
  ProgressDots,
  onboardingStyles,
} from './shared';

export default function WelcomeScreen({ navigation }) {
  const handleSignIn = () => {
    supabase.auth.signOut();
  };

  return (
    <SafeAreaView style={onboardingStyles.safe} edges={['top', 'bottom']}>
      <ProgressDots step={1} />
      <View style={styles.content}>
        <View style={styles.topBlock}>
          <MeridianLogo size={80} />
          <Text style={styles.brandName}>Meridian</Text>
          <Text style={styles.tagline}>
            This is a space to know yourself{'\n'}
            and live your values.
          </Text>
        </View>
        <View style={styles.spacer} />
        <PrimaryButton
          label="Begin →"
          onPress={() => navigation.replace('Name')}
          style={styles.button}
        />
        <View style={styles.signInRow}>
          <Text style={styles.signInMuted}>Already have an account? </Text>
          <TouchableOpacity onPress={handleSignIn} activeOpacity={0.7}>
            <Text style={styles.signInLink}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: 32,
  },
  topBlock: {
    alignItems: 'center',
    marginTop: 48,
  },
  brandName: {
    fontFamily: FONTS.headingBold,
    fontSize: 36,
    color: COLORS.text,
    textAlign: 'center',
    marginTop: 16,
  },
  tagline: {
    fontFamily: FONTS.body,
    fontSize: 17,
    color: COLORS.mutedLight,
    lineHeight: 28,
    textAlign: 'center',
    paddingHorizontal: 8,
    marginTop: 24,
  },
  spacer: {
    flex: 1,
  },
  button: {
    alignSelf: 'center',
    marginBottom: 16,
    paddingHorizontal: 48,
    minWidth: 200,
  },
  signInRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  signInMuted: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#ffffff60',
  },
  signInLink: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#a78bfa',
  },
});
