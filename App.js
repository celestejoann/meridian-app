import 'react-native-url-polyfill/auto';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import * as Notifications from 'expo-notifications';
import {
  useFonts,
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_700Bold,
} from '@expo-google-fonts/playfair-display';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { supabase } from './src/lib/supabase';
import { COLORS } from './src/constants/theme';
import AuthScreen from './src/screens/AuthScreen';
import AppNavigator from './src/navigation/AppNavigator';
import OnboardingNavigator from './src/navigation/OnboardingNavigator';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const requestNotificationPermissions = async () => {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
};

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [appReady, setAppReady] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(null);

  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
    PlayfairDisplay_300Light: PlayfairDisplay_400Regular,
    PlayfairDisplay_700Bold,
  });

  useEffect(() => {
    requestNotificationPermissions();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAppReady(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;

    const checkOnboarding = async () => {
      const { data: areas } = await supabase
        .from('user_areas')
        .select('id')
        .eq('user_id', session.user.id)
        .limit(1);

      if (!areas || areas.length === 0) {
        setNeedsOnboarding(true);
      } else {
        setNeedsOnboarding(false);
      }
    };

    checkOnboarding();
  }, [session]);

  const handleOnboardingComplete = () => {
    setNeedsOnboarding(false);
  };

  if (loading || (!fontsLoaded && !appReady)) {
    return (
      <SafeAreaProvider>
        <View
          style={{
            flex: 1,
            backgroundColor: COLORS.bg,
            justifyContent: 'center',
            alignItems: 'center',
          }}>
          <ActivityIndicator color={COLORS.accent} size={32} />
        </View>
      </SafeAreaProvider>
    );
  }

  if (!session) {
    return (
      <SafeAreaProvider>
        <AuthScreen />
      </SafeAreaProvider>
    );
  }

  if (needsOnboarding === null) {
    return (
      <SafeAreaProvider>
        <View
          style={{
            flex: 1,
            backgroundColor: COLORS.bg,
            justifyContent: 'center',
            alignItems: 'center',
          }}>
          <ActivityIndicator color={COLORS.accent} size={32} />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        {needsOnboarding ? (
          <OnboardingNavigator onComplete={handleOnboardingComplete} />
        ) : (
          <AppNavigator />
        )}
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
