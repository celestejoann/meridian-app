import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import WelcomeScreen from '../screens/onboarding/WelcomeScreen';
import NameScreen from '../screens/onboarding/NameScreen';
import AreasScreen from '../screens/onboarding/AreasScreen';
import IdentityScreen from '../screens/onboarding/IdentityScreen';
import CommitmentScreen from '../screens/onboarding/CommitmentScreen';
import ReadyScreen from '../screens/onboarding/ReadyScreen';

const Stack = createStackNavigator();

export default function OnboardingNavigator({ onComplete }) {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        gestureEnabled: false,
        cardStyleInterpolator: ({ current }) => ({
          cardStyle: {
            opacity: current.progress,
          },
        }),
      }}>
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Name" component={NameScreen} />
      <Stack.Screen name="Areas" component={AreasScreen} />
      <Stack.Screen name="Identity" component={IdentityScreen} />
      <Stack.Screen name="Commitment" component={CommitmentScreen} />
      <Stack.Screen
        name="Ready"
        options={{ gestureEnabled: false }}>
        {(props) => <ReadyScreen {...props} onComplete={onComplete} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
