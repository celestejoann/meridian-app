import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import PagerView from 'react-native-pager-view';
import { COLORS, FONTS } from '../constants/theme';
import AreasManagementScreen from './AreasManagementScreen';
import IdentityManagementScreen from './IdentityManagementScreen';
import CommitmentsScreen from './CommitmentsScreen';
import ProjectsScreen from './ProjectsScreen';

const TABS = [
  { key: 'areas', label: 'Areas' },
  { key: 'identity', label: 'Identity' },
  { key: 'commitments', label: 'Commitments' },
  { key: 'pursuits', label: 'Pursuits' },
];

export default function MyLifeScreen() {
  const [activeTab, setActiveTab] = useState(0);
  const pagerRef = useRef(null);

  const selectTab = (index) => {
    setActiveTab(index);
    pagerRef.current?.setPage(index);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Life</Text>

      <View style={styles.tabBar}>
        {TABS.map((tab, index) => (
          <TouchableOpacity
            key={tab.key}
            style={styles.tab}
            onPress={() => selectTab(index)}>
            <Text style={[styles.tabLabel, activeTab === index && styles.tabLabelActive]}>
              {tab.label}
            </Text>
            {activeTab === index && <View style={styles.tabIndicator} />}
          </TouchableOpacity>
        ))}
      </View>

      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={0}
        onPageSelected={e => setActiveTab(e.nativeEvent.position)}>
        <View key="areas" style={styles.page}>
          <AreasManagementScreen />
        </View>
        <View key="identity" style={styles.page}>
          <IdentityManagementScreen />
        </View>
        <View key="commitments" style={styles.page}>
          <CommitmentsScreen />
        </View>
        <View key="pursuits" style={styles.page}>
          <ProjectsScreen />
        </View>
      </PagerView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  title: {
    fontSize: 32,
    fontFamily: 'PlayfairDisplay_300Light',
    color: COLORS.text,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    position: 'relative',
  },
  tabLabel: {
    fontSize: 12,
    fontFamily: FONTS.bodyMedium,
    color: COLORS.muted,
    letterSpacing: 0.3,
  },
  tabLabelActive: {
    color: COLORS.accent,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 8,
    right: 8,
    height: 2,
    backgroundColor: COLORS.accent,
    borderRadius: 1,
  },
  pager: { flex: 1 },
  page: { flex: 1 },
});
