import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, FONTS } from '../../constants/theme';
import {
  MeridianLogo,
  PrimaryButton,
  ProgressDots,
  onboardingStyles,
  useBlockHardwareBack,
} from './shared';

export default function ReadyScreen({ route, onComplete }) {
  useBlockHardwareBack();
  const userName = route.params?.userName ?? 'friend';

  return (
    <SafeAreaView style={onboardingStyles.safe} edges={['top', 'bottom']}>
      <ProgressDots step={6} />
      <View style={styles.content}>
        <View style={styles.topBlock}>
          <MeridianLogo size={80} />
          <Text style={styles.heading}>{userName}, you&apos;re ready.</Text>
          <Text style={styles.subtext}>Your practice begins today.</Text>
        </View>
        <View style={styles.spacer} />
        <Text style={styles.quote}>
          You are already who you need to be.{'\n'}
          This is simply the evidence.
        </Text>
        <PrimaryButton
          label="Enter Meridian →"
          onPress={onComplete}
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
  heading: {
    fontFamily: FONTS.headingBold,
    fontSize: 36,
    color: COLORS.text,
    textAlign: 'center',
    marginTop: 24,
  },
  subtext: {
    fontFamily: FONTS.body,
    fontSize: 17,
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 12,
  },
  spacer: {
    flex: 1,
  },
  quote: {
    fontSize: 14,
    color: COLORS.muted + '80',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingHorizontal: 16,
    marginBottom: 32,
    fontFamily: FONTS.body,
    lineHeight: 22,
  },
  button: {
    marginBottom: 60,
  },
});
