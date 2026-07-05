import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { scheduleDailyNotifications, cancelAllNotifications } from '../lib/notifications';
import { COLORS, FONTS } from '../constants/theme';
import { useAppNavigation } from '../navigation/AppNavigationContext';

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
  const { openMyLife } = useAppNavigation();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [memberSince, setMemberSince] = useState('');
  const [morningTime, setMorningTime] = useState({ hour: 8, minute: 0 });
  const [eveningTime, setEveningTime] = useState({ hour: 20, minute: 0 });
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  useEffect(() => {
    const loadNotificationSettings = async () => {
      try {
        const saved = await AsyncStorage.getItem('notificationSettings');
        if (saved) {
          const { morningTime: morning, eveningTime: evening, enabled } = JSON.parse(saved);
          setMorningTime(morning);
          setEveningTime(evening);
          setNotificationsEnabled(enabled);
        }
      } catch (e) {}
    };
    loadNotificationSettings();
  }, []);

  const saveNotificationSettings = async (morning, evening, enabled) => {
    try {
      await AsyncStorage.setItem('notificationSettings', JSON.stringify({
        morningTime: morning,
        eveningTime: evening,
        enabled,
      }));
      if (enabled) {
        await scheduleDailyNotifications(
          morning.hour,
          morning.minute,
          evening.hour,
          evening.minute
        );
      } else {
        await cancelAllNotifications();
      }
    } catch (e) {}
  };

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

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <Text
          style={{
            fontSize: 32,
            fontWeight: '300',
            fontFamily: 'PlayfairDisplay_300Light',
            color: COLORS.text,
            paddingTop: 20,
            paddingBottom: 4,
          }}>
          Settings
        </Text>

        {loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator color={COLORS.accent} size={32} />
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
                  With Meridian since {memberSince}
                </Text>
              ) : null}
            </View>

            <SectionLabel>MY LIFE</SectionLabel>
            <SettingsCard>
              <SettingsRow
                label="My Life"
                onPress={openMyLife}
                isLast
              />
            </SettingsCard>

            <SectionLabel>YOUR ACCOUNT</SectionLabel>
            <SettingsCard>
              <SettingsRow
                label="Your profile"
                onPress={() =>
                  Alert.alert('Coming Soon', 'Profile editing will be available soon.')
                }
              />
              <SettingsRow
                label="Notifications"
                onPress={() =>
                  Alert.alert('Coming Soon', 'Notification settings are below.')
                }
              />
              <SettingsRow
                label="Privacy & Security"
                isLast
                onPress={() =>
                  Alert.alert('Privacy & Security', 'Choose an option', [
                    {
                      text: 'Change Password',
                      onPress: () =>
                        Linking.openURL(
                          'mailto:hello@meridianlife.app?subject=Change Password Request'
                        ),
                    },
                    {
                      text: 'Delete Account',
                      style: 'destructive',
                      onPress: () =>
                        Alert.alert(
                          'Delete Account',
                          'To delete your account please email hello@meridianlife.app'
                        ),
                    },
                    { text: 'Cancel', style: 'cancel' },
                  ])
                }
              />
            </SettingsCard>

            <SectionLabel>LEGAL</SectionLabel>
            <SettingsCard>
              <SettingsRow
                label="Privacy Policy"
                onPress={() =>
                  WebBrowser.openBrowserAsync('https://meridianlife.app/privacy.html')
                }
              />
              <SettingsRow
                label="Terms of Service"
                onPress={() =>
                  WebBrowser.openBrowserAsync('https://meridianlife.app/terms.html')
                }
              />
              <SettingsRow
                label="Disclaimer"
                isLast
                onPress={() =>
                  WebBrowser.openBrowserAsync('https://meridianlife.app/disclaimer.html')
                }
              />
            </SettingsCard>

            <SectionLabel>SUPPORT</SectionLabel>
            <SettingsCard>
              <SettingsRow
                label="Send Feedback"
                onPress={() =>
                  Linking.openURL(
                    'mailto:hello@meridianlife.app?subject=Meridian Feedback'
                  )
                }
              />
              <SettingsRow
                label="Rate the App"
                isLast
                onPress={() => Linking.openURL('https://meridianlife.app')}
              />
            </SettingsCard>

            <View style={{
              backgroundColor: '#1a1628',
              borderRadius: 16,
              padding: 20,
              marginHorizontal: 16,
              marginBottom: 16,
            }}>
              <Text style={{
                fontSize: 11,
                letterSpacing: 2,
                color: '#a78bfa',
                marginBottom: 16,
                fontFamily: 'DMSans_500Medium',
              }}>NOTIFICATIONS</Text>

              <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 20,
              }}>
                <Text style={{
                  fontSize: 15,
                  color: '#f5f3ff',
                  fontFamily: 'DMSans_400Regular',
                }}>Daily reminders</Text>
                <Switch
                  value={notificationsEnabled}
                  onValueChange={(val) => {
                    console.log('Toggle pressed, new value:', val);
                    setNotificationsEnabled(val);
                    saveNotificationSettings(morningTime, eveningTime, val);
                  }}
                  trackColor={{ false: '#2a2040', true: '#a78bfa' }}
                  thumbColor={notificationsEnabled ? '#f5f3ff' : '#6b5fa0'}
                />
              </View>

              {notificationsEnabled && (
                <>
                  <View style={{ marginBottom: 16 }}>
                    <Text style={{
                      fontSize: 13,
                      color: '#9d8ec0',
                      fontFamily: 'DMSans_400Regular',
                      marginBottom: 8,
                    }}>Morning check-in</Text>
                    <View style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                    }}>
                      {[6, 7, 8, 9, 10].map(h => (
                        <TouchableOpacity
                          key={h}
                          onPress={() => {
                            const newTime = { ...morningTime, hour: h };
                            setMorningTime(newTime);
                            saveNotificationSettings(newTime, eveningTime, true);
                          }}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            borderRadius: 20,
                            backgroundColor: morningTime.hour === h ? '#a78bfa' : '#2a2040',
                          }}>
                          <Text style={{
                            fontSize: 13,
                            color: morningTime.hour === h ? '#0f0d1a' : '#9d8ec0',
                            fontFamily: 'DMSans_500Medium',
                          }}>{h}:00</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View>
                    <Text style={{
                      fontSize: 13,
                      color: '#9d8ec0',
                      fontFamily: 'DMSans_400Regular',
                      marginBottom: 8,
                    }}>Evening reflection</Text>
                    <View style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                    }}>
                      {[18, 19, 20, 21, 22].map(h => (
                        <TouchableOpacity
                          key={h}
                          onPress={() => {
                            const newTime = { ...eveningTime, hour: h };
                            setEveningTime(newTime);
                            saveNotificationSettings(morningTime, newTime, true);
                          }}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            borderRadius: 20,
                            backgroundColor: eveningTime.hour === h ? '#a78bfa' : '#2a2040',
                          }}>
                          <Text style={{
                            fontSize: 13,
                            color: eveningTime.hour === h ? '#0f0d1a' : '#9d8ec0',
                            fontFamily: 'DMSans_500Medium',
                          }}>{h}:00</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </>
              )}
            </View>

            <SectionLabel>DANGER ZONE</SectionLabel>
            <View style={styles.dangerCard}>
              <Pressable
                style={({ pressed }) => [
                  styles.signOutBtn,
                  pressed && styles.signOutBtnPressed,
                ]}
                onPress={() => {
                  Alert.alert(
                    'Sign Out',
                    "You'll need to sign back in to access your account.",
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Sign Out',
                        style: 'destructive',
                        onPress: () => supabase.auth.signOut(),
                      },
                    ]
                  );
                }}>
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
    backgroundColor: COLORS.bg,
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
    color: COLORS.text,
    marginTop: 8,
    marginBottom: 20,
  },
  loaderWrap: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  userCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
  },
  userEmail: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '500',
  },
  badge: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: COLORS.border,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  badgeText: {
    color: COLORS.mutedLight,
    fontSize: 12,
    fontWeight: '600',
  },
  memberSince: {
    marginTop: 10,
    fontSize: 13,
    color: COLORS.mutedLight,
  },
  sectionLabel: {
    fontSize: 9,
    letterSpacing: 2,
    color: COLORS.accent,
    textTransform: 'uppercase',
    marginBottom: 8,
    fontFamily: FONTS.bodyMedium,
    letterSpacing: 1.5,
  },
  card: {
    backgroundColor: COLORS.surface,
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
    borderBottomColor: COLORS.border,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowPressed: {
    backgroundColor: COLORS.border,
  },
  rowText: {
    color: COLORS.text,
    fontSize: 15,
  },
  rowArrow: {
    color: COLORS.mutedLight,
    fontSize: 20,
    marginTop: -2,
  },
  dangerCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.red + '25',
  },
  signOutBtn: {
    borderWidth: 1,
    borderColor: COLORS.red,
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  signOutBtnPressed: {
    opacity: 0.85,
  },
  signOutText: {
    color: COLORS.red,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
