import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import DashboardScreen from '../screens/DashboardScreen';
import CommitmentsScreen from '../screens/CommitmentsScreen';
import JournalScreen from '../screens/JournalScreen';
import InsightsScreen from '../screens/InsightsScreen';
import LegacyScreen from '../screens/LegacyScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Tab = createBottomTabNavigator();

const ICON_SIZE = 24;

function tabBarIconName(routeName, focused) {
  switch (routeName) {
    case 'Dashboard':
      return focused ? 'home' : 'home-outline';
    case 'Commitments':
      return focused ? 'list' : 'list-outline';
    case 'Journal':
      return focused ? 'book' : 'book-outline';
    case 'Insights':
      return focused ? 'bar-chart' : 'bar-chart-outline';
    case 'Legacy':
      return focused ? 'trophy' : 'trophy-outline';
    case 'Settings':
      return focused ? 'settings' : 'settings-outline';
    default:
      return 'ellipse-outline';
  }
}

export default function AppNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0d0d1f',
          borderTopColor: '#ffffff10',
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 4,
        },
        tabBarActiveTintColor: '#6366f1',
        tabBarInactiveTintColor: '#ffffff40',
        tabBarIcon: ({ focused, color }) => (
          <Ionicons
            name={tabBarIconName(route.name, focused)}
            size={ICON_SIZE}
            color={color}
          />
        ),
      })}>
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Commitments" component={CommitmentsScreen} />
      <Tab.Screen name="Journal" component={JournalScreen} />
      <Tab.Screen name="Insights" component={InsightsScreen} />
      <Tab.Screen name="Legacy" component={LegacyScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
