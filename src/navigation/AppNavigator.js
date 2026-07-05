import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import MainApp from './MainApp';
import PrivacyScreen from '../screens/PrivacyScreen';
import TermsScreen from '../screens/TermsScreen';
import DisclaimerScreen from '../screens/DisclaimerScreen';
import IdentityManagementScreen from '../screens/IdentityManagementScreen';
import AreasManagementScreen from '../screens/AreasManagementScreen';
import NewPursuitScreen from '../screens/NewPursuitScreen';
import PursuitDetailScreen from '../screens/PursuitDetailScreen';
import RevisitFlowScreen from '../screens/RevisitFlowScreen';
import NewCommitmentScreen from '../screens/NewCommitmentScreen';

const Stack = createStackNavigator();

const stackScreenOptions = {
  headerStyle: { backgroundColor: '#0f0d1a' },
  headerTintColor: '#f5f3ff',
  headerTitleStyle: { fontFamily: 'DMSans_500Medium' },
};

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
          ...stackScreenOptions,
        }}
      />
      <Stack.Screen
        name="NewPursuit"
        component={NewPursuitScreen}
        options={{
          title: 'New pursuit',
          ...stackScreenOptions,
        }}
      />
      <Stack.Screen
        name="PursuitDetail"
        component={PursuitDetailScreen}
        options={{
          title: 'Pursuit',
          ...stackScreenOptions,
        }}
      />
      <Stack.Screen
        name="RevisitFlow"
        component={RevisitFlowScreen}
        options={{
          title: 'Revisit',
          ...stackScreenOptions,
        }}
      />
      <Stack.Screen
        name="NewCommitment"
        component={NewCommitmentScreen}
        options={{
          title: 'New commitment',
          ...stackScreenOptions,
        }}
      />
    </Stack.Navigator>
  );
}
