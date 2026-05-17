import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { COLORS, FONTS } from '../constants/theme';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) setError(error.message);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Meridian</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={COLORS.mutedLight}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor={COLORS.mutedLight}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TouchableOpacity style={styles.button} onPress={handleLogin}>
        <Text style={styles.buttonText}>Log In</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 36,
    color: COLORS.text,
    fontWeight: '300',
    fontFamily: FONTS.heading,
    marginBottom: 32,
    textAlign: 'center',
  },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 12,
    padding: 16,
    color: COLORS.text,
    marginBottom: 12,
  },
  error: {
    color: COLORS.red,
    marginBottom: 12,
    fontSize: 14,
  },
  button: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: COLORS.text,
    fontWeight: '700',
    fontSize: 16,
    fontFamily: FONTS.bodyMedium,
  },
});
