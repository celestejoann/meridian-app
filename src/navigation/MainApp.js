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
import ProjectsScreen from '../screens/ProjectsScreen';
import { AppNavigationContext } from './AppNavigationContext';

const BOTTOM_TABS = [
  { key: 'dashboard', label: 'Dashboard', icon: 'home', iconOutline: 'home-outline' },
  { key: 'pursuits', label: 'Pursuits', icon: 'flag', iconOutline: 'flag-outline' },
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

  const openCheckIn = useCallback(() => {
    setBottomTab('checkin');
  }, []);

  const openMyLife = useCallback(() => {
    setBottomTab('mylife');
  }, []);

  const navContext = useMemo(
    () => ({
      openLegacy,
      openInsights,
      openSettings,
      openDashboard,
      openCheckIn,
      openMyLife,
    }),
    [openLegacy, openInsights, openSettings, openDashboard, openCheckIn, openMyLife]
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
      case 'pursuits':
        return <ProjectsScreen />;
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

  const isBottomTabActive = (key) => bottomTab === key;

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
            const active = isBottomTabActive(tab.key);
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
  content: {
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
