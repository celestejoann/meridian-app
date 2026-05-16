import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

export default function SettingsScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Coming soon</Text>

        <Pressable
          style={({ pressed }) => [
            styles.logout,
            pressed && styles.logoutPressed,
          ]}
          onPress={() => supabase.auth.signOut()}>
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#080812',
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  title: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '300',
  },
  subtitle: {
    marginTop: 8,
    color: '#ffffff80',
    fontSize: 16,
  },
  logout: {
    marginTop: 32,
    alignSelf: 'flex-start',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#ffffff12',
    borderWidth: 1,
    borderColor: '#ffffff20',
  },
  logoutPressed: {
    opacity: 0.85,
  },
  logoutText: {
    color: '#f87171',
    fontSize: 16,
    fontWeight: '600',
  },
});
