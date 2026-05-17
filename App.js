import 'react-native-url-polyfill/auto';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
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

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [appReady, setAppReady] = useState(false);

  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
    PlayfairDisplay_300Light: PlayfairDisplay_400Regular,
    PlayfairDisplay_700Bold,
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setAppReady(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
  }, []);

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

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
