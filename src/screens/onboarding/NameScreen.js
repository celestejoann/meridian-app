import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, FONTS } from '../../constants/theme';
import {
  NAME_STORAGE_KEY,
  MeridianWordmarkSmall,
  PrimaryButton,
  ProgressDots,
  onboardingStyles,
  useBlockHardwareBack,
} from './shared';

export default function NameScreen({ navigation }) {
  useBlockHardwareBack();
  const [name, setName] = useState('');
  const trimmed = name.trim();
  const canContinue = trimmed.length > 0;

  const handleContinue = async () => {
    if (!canContinue) return;
    await AsyncStorage.setItem(NAME_STORAGE_KEY, trimmed);
    navigation.replace('Areas', { userName: trimmed });
  };

  return (
    <SafeAreaView style={onboardingStyles.safe} edges={['top', 'bottom']}>
      <ProgressDots step={2} />
      <KeyboardAvoidingView
        style={onboardingStyles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={onboardingStyles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <MeridianWordmarkSmall />
          <Text style={styles.heading}>What should we call you?</Text>
          <Text style={styles.subtext}>
            Every part of Meridian is yours.{'\n'}
            Starting with your name.
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Your name..."
            placeholderTextColor={COLORS.border}
            value={name}
            onChangeText={setName}
            autoFocus
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={handleContinue}
          />
          <View style={styles.spacer} />
          <PrimaryButton
            label="Continue →"
            onPress={handleContinue}
            disabled={!canContinue}
            style={styles.button}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontFamily: FONTS.headingBold,
    fontSize: 32,
    color: COLORS.text,
    paddingHorizontal: 32,
    marginTop: 44,
    marginBottom: 8,
  },
  subtext: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.muted,
    paddingHorizontal: 32,
    marginBottom: 48,
  },
  input: {
    marginHorizontal: 32,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    backgroundColor: 'transparent',
    fontSize: 24,
    fontFamily: FONTS.body,
    color: COLORS.text,
  },
  spacer: {
    flex: 1,
    minHeight: 24,
  },
  button: {
    marginBottom: 60,
    marginHorizontal: 32,
  },
});
