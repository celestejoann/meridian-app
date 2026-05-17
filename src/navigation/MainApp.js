import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { COLORS, FONTS } from '../constants/theme';
import PagerView from 'react-native-pager-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Polygon, Line, Defs, LinearGradient, Stop } from 'react-native-svg';
import DashboardScreen from '../screens/DashboardScreen';
import JournalScreen from '../screens/JournalScreen';
import InsightsScreen from '../screens/InsightsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import MyLifeScreen from '../screens/MyLifeScreen';
import LegacyScreen from '../screens/LegacyScreen';
import { AppNavigationContext } from './AppNavigationContext';

const TOP_TABS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'journal', label: 'Journal' },
];

const BOTTOM_TABS = [
  { key: 'mylife', label: 'My Life', icon: 'layers', iconOutline: 'layers-outline' },
  { key: 'insights', label: 'Insights', icon: 'bar-chart', iconOutline: 'bar-chart-outline' },
  { key: 'settings', label: 'Settings', icon: 'settings', iconOutline: 'settings-outline' },
];

export default function MainApp() {
  const insets = useSafeAreaInsets();
  const pagerRef = useRef(null);
  const [topPage, setTopPage] = useState(0);
  const [bottomTab, setBottomTab] = useState(null);

  const showPager = bottomTab === null;

  const openLegacy = useCallback(() => {
    setBottomTab('legacy');
  }, []);

  const openInsights = useCallback(() => {
    setBottomTab('insights');
  }, []);

  const openSettings = useCallback(() => {
    setBottomTab('settings');
  }, []);

  const navContext = useMemo(
    () => ({ openLegacy, openInsights, openSettings }),
    [openLegacy, openInsights, openSettings]
  );

  const selectTopTab = useCallback((index) => {
    setBottomTab(null);
    setTopPage(index);
    pagerRef.current?.setPage(index);
  }, []);

  const onPageSelected = useCallback((e) => {
    const index = e.nativeEvent.position;
    setTopPage(index);
    setBottomTab(null);
  }, []);

  const selectBottomTab = useCallback((key) => {
    setBottomTab(key);
  }, []);

  const renderBottomContent = () => {
    switch (bottomTab) {
      case 'mylife':
        return <MyLifeScreen />;
      case 'insights':
        return <InsightsScreen />;
      case 'settings':
        return <SettingsScreen />;
      case 'legacy':
        return <LegacyScreen />;
      default:
        return null;
    }
  };

  return (
    <AppNavigationContext.Provider value={navContext}>
      <View style={styles.root}>
        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <View style={styles.brandingRow}>
            <Svg width="32" height="32" viewBox="0 0 512 512">
              <Defs>
                <LinearGradient id="lf" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor="#e8ecff" />
                  <Stop offset="0.5" stopColor="#a5b4fc" />
                  <Stop offset="1" stopColor="#4f46e5" />
                </LinearGradient>
                <LinearGradient id="rf" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor="#3730a3" />
                  <Stop offset="1" stopColor="#0f0e2a" />
                </LinearGradient>
              </Defs>
              <Polygon points="256,82 256,352 382,352" fill="url(#rf)" />
              <Polygon points="256,82 256,352 130,352" fill="url(#lf)" />
              <Line
                x1="256"
                y1="82"
                x2="256"
                y2="352"
                stroke="#f0f4ff"
                strokeWidth="2"
                opacity="0.7"
              />
            </Svg>
            <View style={styles.brandTextCol}>
              <Text style={styles.brandName}>Meridian</Text>
              <Text style={styles.brandTagline}>LIVE YOUR VALUES</Text>
            </View>
          </View>

          <View style={styles.topTabsRow}>
            {TOP_TABS.map((tab, index) => {
              const active = showPager && topPage === index;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[
                    styles.topTabBtn,
                    {
                      borderBottomColor: active ? COLORS.accent : 'transparent',
                    },
                  ]}
                  onPress={() => selectTopTab(index)}
                  activeOpacity={0.7}>
                  <Text
                    style={[
                      styles.topTabLabel,
                      { color: active ? COLORS.text : COLORS.muted },
                    ]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.content}>
          {showPager ? (
            <PagerView
              ref={pagerRef}
              style={styles.pager}
              initialPage={0}
              onPageSelected={onPageSelected}>
              <View key="dashboard" style={styles.pagerPage}>
                <DashboardScreen />
              </View>
              <View key="journal" style={styles.pagerPage}>
                <JournalScreen />
              </View>
            </PagerView>
          ) : (
            renderBottomContent()
          )}
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
