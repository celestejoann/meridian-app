import React, { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { COLORS, FONTS } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DashboardScreen from '../screens/DashboardScreen';
import CheckInScreen from '../screens/CheckInScreen';
import InsightsScreen from '../screens/InsightsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import MyLifeScreen from '../screens/MyLifeScreen';
import LegacyScreen from '../screens/LegacyScreen';
import { AppNavigationContext } from './AppNavigationContext';

const BOTTOM_TABS = [
  { key: 'dashboard', label: 'Dashboard', icon: 'home', iconOutline: 'home-outline' },
  { key: 'checkin', label: 'Check In', icon: 'checkbox', iconOutline: 'checkbox-outline' },
  { key: 'mylife', label: 'My Life', icon: 'layers', iconOutline: 'layers-outline' },
  { key: 'insights', label: 'Insights', icon: 'bar-chart', iconOutline: 'bar-chart-outline' },
  { key: 'settings', label: 'Settings', icon: 'settings', iconOutline: 'settings-outline' },
];

export default function MainApp() {
  const insets = useSafeAreaInsets();
  const [bottomTab, setBottomTab] = useState('dashboard');

  const openLegacy = useCallback(() => {
    setBottomTab('legacy');
  }, []);

  const openInsights = useCallback(() => {
    setBottomTab('insights');
  }, []);

  const openSettings = useCallback(() => {
    setBottomTab('settings');
  }, []);

  const openDashboard = useCallback(() => {
    setBottomTab('dashboard');
  }, []);

  const navContext = useMemo(
    () => ({ openLegacy, openInsights, openSettings, openDashboard }),
    [openLegacy, openInsights, openSettings, openDashboard]
  );

  const selectBottomTab = useCallback((key) => {
    setBottomTab(key);
  }, []);

  const renderBottomContent = () => {
    switch (bottomTab) {
      case 'dashboard':
        return <DashboardScreen />;
      case 'checkin':
        return <CheckInScreen />;
      case 'mylife':
        return <MyLifeScreen />;
      case 'insights':
        return <InsightsScreen />;
      case 'settings':
        return <SettingsScreen />;
      default:
        return <DashboardScreen />;
    }
  };

  return (
    <AppNavigationContext.Provider value={navContext}>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.content}>
          {renderBottomContent()}
        </View>

        <View
          style={[
            styles.bottomBar,
            { paddingBottom: Math.max(insets.bottom, 8) },
          ]}>
          {BOTTOM_TABS.map((tab) => {
            const active = bottomTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                style={styles.bottomTabBtn}
                onPress={() => selectBottomTab(tab.key)}>
                <Ionicons
                  name={active ? tab.icon : tab.iconOutline}
                  size={24}
                  color={active ? COLORS.accent : COLORS.muted}
                />
                <Text
                  style={[
                    styles.bottomTabLabel,
                    { color: active ? COLORS.accent : COLORS.muted },
                  ]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </AppNavigationContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  topBar: {
    backgroundColor: COLORS.bg,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 0,
  },
  brandingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 16,
  },
  brandTextCol: {
    marginLeft: 8,
  },
  brandName: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 24,
    color: COLORS.text,
  },
  brandTagline: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 9,
    color: COLORS.accent,
    letterSpacing: 3,
  },
  topTabsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  topTabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderBottomWidth: 3,
    borderRadius: 2,
  },
  topTabLabel: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: FONTS.bodyMedium,
  },
  content: {
    flex: 1,
  },
  pager: {
    flex: 1,
  },
  pagerPage: {
    flex: 1,
  },
  legacyWrap: {
    flex: 1,
  },
  legacyBack: {
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  legacyBackText: {
    color: COLORS.accent,
    fontSize: 15,
    fontWeight: '500',
    fontFamily: FONTS.bodyMedium,
  },
  legacyContent: {
    flex: 1,
  },
  bottomBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.bg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 8,
    paddingHorizontal: 4,
  },
  bottomTabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  bottomTabLabel: {
    fontSize: 10,
    marginTop: 2,
    marginBottom: 4,
    fontFamily: FONTS.body,
  },
});
