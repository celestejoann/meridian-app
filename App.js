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
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { supabase } from './src/lib/supabase';
import { calculateLoggingStreak } from './src/lib/streak';
import { COLORS } from './src/constants/theme';
import AuthScreen from './src/screens/AuthScreen';
import AppNavigator from './src/navigation/AppNavigator';
import OnboardingNavigator from './src/navigation/OnboardingNavigator';
import CheckInScreen from './src/screens/CheckInScreen';

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
  const [checkInGateResolved, setCheckInGateResolved] = useState(false);
  const [checkInGateComplete, setCheckInGateComplete] = useState(false);

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
    if (!session) {
      setNeedsOnboarding(null);
      setCheckInGateResolved(false);
      setCheckInGateComplete(false);
      return;
    }

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

  useEffect(() => {
    if (!session || needsOnboarding !== false) {
      return;
    }

    let cancelled = false;

    const resolveCheckInGate = async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data?.user?.id;

      if (cancelled) return;

      if (!uid) {
        setCheckInGateComplete(true);
        setCheckInGateResolved(true);
        return;
      }

      const { isTodayLogged } = await calculateLoggingStreak(uid);

      if (cancelled) return;

      setCheckInGateComplete(isTodayLogged);
      setCheckInGateResolved(true);
    };

    setCheckInGateResolved(false);
    setCheckInGateComplete(false);
    resolveCheckInGate();

    return () => {
      cancelled = true;
    };
  }, [session, needsOnboarding]);

  const handleOnboardingComplete = () => {
    setNeedsOnboarding(false);
    setCheckInGateResolved(false);
    setCheckInGateComplete(false);
  };

  if (loading || (!fontsLoaded && !appReady)) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
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
      </GestureHandlerRootView>
    );
  }

  if (!session) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <AuthScreen />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  if (needsOnboarding === null) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
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
      </GestureHandlerRootView>
    );
  }

  if (needsOnboarding === false && !checkInGateResolved) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
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
      </GestureHandlerRootView>
    );
  }

  if (needsOnboarding === false && checkInGateResolved && !checkInGateComplete) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <CheckInScreen gate onGateComplete={() => setCheckInGateComplete(true)} />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer>
          {needsOnboarding ? (
            <OnboardingNavigator onComplete={handleOnboardingComplete} />
          ) : (
            <AppNavigator />
          )}
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
