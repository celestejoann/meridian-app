import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import MainApp from './MainApp';
import PrivacyScreen from '../screens/PrivacyScreen';
import TermsScreen from '../screens/TermsScreen';
import DisclaimerScreen from '../screens/DisclaimerScreen';
import IdentityManagementScreen from '../screens/IdentityManagementScreen';
import AreasManagementScreen from '../screens/AreasManagementScreen';

const Stack = createStackNavigator();

export default function AppNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Main"
        component={MainApp}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Privacy"
        component={PrivacyScreen}
        options={{
          title: 'Privacy Policy',
          headerStyle: { backgroundColor: '#0f0d1a' },
          headerTintColor: '#f5f3ff',
          headerTitleStyle: { fontFamily: 'DMSans_500Medium' },
        }}
      />
      <Stack.Screen
        name="Terms"
        component={TermsScreen}
        options={{
          title: 'Terms of Service',
          headerStyle: { backgroundColor: '#0f0d1a' },
          headerTintColor: '#f5f3ff',
          headerTitleStyle: { fontFamily: 'DMSans_500Medium' },
        }}
      />
      <Stack.Screen
        name="Disclaimer"
        component={DisclaimerScreen}
        options={{
          title: 'Disclaimer',
          headerStyle: { backgroundColor: '#0f0d1a' },
          headerTintColor: '#f5f3ff',
          headerTitleStyle: { fontFamily: 'DMSans_500Medium' },
        }}
      />
      <Stack.Screen
        name="IdentityManagement"
        component={IdentityManagementScreen}
        options={{
          title: 'My Identities',
          headerStyle: { backgroundColor: '#0f0d1a' },
          headerTintColor: '#f5f3ff',
          headerTitleStyle: { fontFamily: 'DMSans_500Medium' },
        }}
      />
      <Stack.Screen
        name="AreasManagement"
        component={AreasManagementScreen}
        options={{
          title: 'Life Areas',
          headerStyle: { backgroundColor: '#0f0d1a' },
          headerTintColor: '#f5f3ff',
          headerTitleStyle: { fontFamily: 'DMSans_500Medium' },
        }}
      />
    </Stack.Navigator>
  );
}
