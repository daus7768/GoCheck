import { useEffect } from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import { Stack, useRouter, useSegments, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import {
  DMMono_400Regular,
  DMMono_500Medium,
} from '@expo-google-fonts/dm-mono';
import { colors } from '../src/theme/tokens';
import { ThemeProvider } from '../src/theme/ThemeContext';
import { useProfileStore } from '../src/store/profileStore';
import { supabase } from '../src/lib/supabase';
import * as Notifications from 'expo-notifications';

SplashScreen.preventAutoHideAsync();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();
  const { session, sessionInitialized, setSession, loadProfile, loadSecurity } = useProfileStore();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) loadProfile();
    });

    loadSecurity();

    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!sessionInitialized) return;
    const inAuth = (segments as string[])[0] === 'auth';
    const isPublicRoute = pathname.startsWith('/p/') || pathname.startsWith('/share/');
    if (!session && !inAuth && !isPublicRoute) {
      // On web, router.replace dispatches against the tabs navigator and
      // cannot escape to the auth layout group — use location.replace instead
      // so the browser fully navigates out of the (tabs) stack.
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.replace('/auth/sign-in');
      } else {
        router.replace('/auth/sign-in' as any);
      }
    } else if (session && inAuth) {
      router.replace('/(tabs)' as any);
    }
  }, [session, sessionInitialized, segments, pathname]);

  return <>{children}</>;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
    DMMono_400Regular,
    DMMono_500Medium,
  });

  const profile = useProfileStore((s) => s.profile);
  const isDark = profile?.darkMode ?? false;

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  const bgColor = isDark ? '#0A0A0F' : colors.background;

  const app = (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: bgColor },
        animation: Platform.OS === 'web' ? 'none' : 'default',
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="auth" options={{ headerShown: false }} />
      <Stack.Screen
        name="(modals)/create"
        options={{
          presentation: Platform.OS === 'web' ? 'transparentModal' : 'modal',
          animation: Platform.OS === 'web' ? 'fade' : 'slide_from_bottom',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="(modals)/bill/[id]"
        options={{
          presentation: 'card',
          animation: Platform.OS === 'web' ? 'none' : 'slide_from_right',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="(modals)/share/[code]"
        options={{
          presentation: 'card',
          animation: Platform.OS === 'web' ? 'none' : 'slide_from_right',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="(modals)/reminders"
        options={{
          presentation: 'card',
          animation: Platform.OS === 'web' ? 'none' : 'slide_from_right',
          headerShown: false,
        }}
      />
    </Stack>
  );

  return (
    <GestureHandlerRootView style={styles.root}>
      <ThemeProvider isDark={isDark}>
        <AuthGuard>
          <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={bgColor} />
          {Platform.OS === 'web' ? (
            <View style={styles.webContainer}>
              <View style={[styles.webPhone, { backgroundColor: bgColor }]}>{app}</View>
            </View>
          ) : (
            app
          )}
        </AuthGuard>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  webContainer: {
    flex: 1,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  webPhone: {
    width: '100%',
    maxWidth: 430,
    flex: 1,
    overflow: 'hidden',
    // @ts-ignore — web-only shadow
    boxShadow: '0 0 0 1px rgba(0,0,0,0.06), 0 8px 48px rgba(0,0,0,0.14)',
  },
});
