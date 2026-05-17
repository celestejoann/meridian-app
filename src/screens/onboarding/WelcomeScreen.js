import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, FONTS } from '../../constants/theme';
import {
  MeridianLogo,
  PrimaryButton,
  ProgressDots,
  onboardingStyles,
} from './shared';

export default function WelcomeScreen({ navigation }) {
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
    marginBottom: 60,
    paddingHorizontal: 48,
    minWidth: 200,
  },
});
