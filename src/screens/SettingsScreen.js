import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';

function memberSinceLabel(createdAt) {
  if (!createdAt) return '';
  const d = new Date(createdAt);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function SectionLabel({ children }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

function SettingsRow({ label, onPress, isLast }) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        isLast && styles.rowLast,
        pressed && styles.rowPressed,
      ]}
      onPress={onPress}
      disabled={!onPress}>
      <Text style={styles.rowText}>{label}</Text>
      <Text style={styles.rowArrow}>›</Text>
    </Pressable>
  );
}

function SettingsCard({ children }) {
  return <View style={styles.card}>{children}</View>;
}

export default function SettingsScreen() {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [memberSince, setMemberSince] = useState('');

  const loadUser = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.auth.getUser();
    const user = data?.user;
    setEmail(user?.email ?? '');
    setMemberSince(memberSinceLabel(user?.created_at));
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadUser();
    }, [loadUser])
  );

  const openFeedback = () => {
    Linking.openURL('mailto:hello@meridianlife.app');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.headerTitle}>Settings</Text>

        {loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator color="#6366f1" size={32} />
          </View>
        ) : (
          <>
            <View style={styles.userCard}>
              <Text style={styles.userEmail}>{email || '—'}</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Free</Text>
              </View>
              {memberSince ? (
                <Text style={styles.memberSince}>
                  Member since {memberSince}
                </Text>
              ) : null}
            </View>

            <SectionLabel>ACCOUNT</SectionLabel>
            <SettingsCard>
              <SettingsRow label="Edit Profile" />
              <SettingsRow label="Notifications" />
              <SettingsRow label="Privacy & Security" isLast />
            </SettingsCard>

            <SectionLabel>LEGAL</SectionLabel>
            <SettingsCard>
              <SettingsRow label="Privacy Policy" />
              <SettingsRow label="Terms of Service" />
              <SettingsRow label="Disclaimer" isLast />
            </SettingsCard>

            <SectionLabel>SUPPORT</SectionLabel>
            <SettingsCard>
              <SettingsRow label="Send Feedback" onPress={openFeedback} />
              <SettingsRow label="Rate the App" isLast />
            </SettingsCard>

            <SectionLabel>DANGER ZONE</SectionLabel>
            <View style={styles.dangerCard}>
              <Pressable
                style={({ pressed }) => [
                  styles.signOutBtn,
                  pressed && styles.signOutBtnPressed,
                ]}
                onPress={() => supabase.auth.signOut()}>
                <Text style={styles.signOutText}>Sign Out</Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#080812',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '300',
    color: '#ffffff',
    marginTop: 8,
    marginBottom: 20,
  },
  loaderWrap: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  userCard: {
    backgroundColor: '#0f0f1e',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
  },
  userEmail: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '500',
  },
  badge: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#ffffff12',
    borderWidth: 1,
    borderColor: '#ffffff20',
  },
  badgeText: {
    color: '#ffffff90',
    fontSize: 12,
    fontWeight: '600',
  },
  memberSince: {
    marginTop: 10,
    fontSize: 13,
    color: '#ffffff50',
  },
  sectionLabel: {
    fontSize: 9,
    letterSpacing: 2,
    color: '#6366f1',
    textTransform: 'uppercase',
    marginBottom: 8,
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      default: 'monospace',
    }),
  },
  card: {
    backgroundColor: '#0f0f1e',
    borderRadius: 20,
    marginBottom: 16,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ffffff08',
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowPressed: {
    backgroundColor: '#ffffff06',
  },
  rowText: {
    color: '#ffffff',
    fontSize: 15,
  },
  rowArrow: {
    color: '#ffffff50',
    fontSize: 20,
    marginTop: -2,
  },
  dangerCard: {
    backgroundColor: '#1a1018',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f8717125',
  },
  signOutBtn: {
    borderWidth: 1,
    borderColor: '#f87171',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  signOutBtnPressed: {
    opacity: 0.85,
  },
  signOutText: {
    color: '#f87171',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
