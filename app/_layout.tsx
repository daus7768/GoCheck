import { useEffect, useRef, useCallback } from 'react';
import { Platform, View, StyleSheet, AppState } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import * as SecureStore from 'expo-secure-store';
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
import { ThemeProvider, useTheme } from '../src/theme/ThemeContext';
import { useProfileStore } from '../src/store/profileStore';
import { SECURE_KEYS } from '../src/store/profileStore';

SplashScreen.preventAutoHideAsync();

function AppContent() {
  const { colors, isDark, setDark } = useTheme();
  const router = useRouter();
  const segments = useSegments();
  const session = useProfileStore(s => s.session);
  const isGuest = useProfileStore(s => s.isGuest);
  const profile = useProfileStore(s => s.profile);
  const isUnlocked = useProfileStore(s => s.isUnlocked);
  const security = useProfileStore(s => s.security);
  const initializeAuth = useProfileStore(s => s.initializeAuth);
  const setUnlocked = useProfileStore(s => s.setUnlocked);
  const lastActiveRef = useRef<number | null>(null);

  const [fontsLoaded, fontError] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
    DMMono_400Regular,
    DMMono_500Medium,
  });

  // Initialize Supabase auth listener once.
  useEffect(() => {
    const cleanup = initializeAuth();
    return cleanup;
  }, [initializeAuth]);

  // Sync dark mode preference from the active profile into the theme.
  useEffect(() => {
    if (profile) setDark(profile.darkMode);
  }, [profile?.darkMode, setDark]);

  // Auth + lock guard.
  useEffect(() => {
    if (!fontsLoaded && !fontError) return;
    const inAuthGroup = segments[0] === 'auth';
    const inLock = segments[0] === 'lock';
    const authed = !!session || isGuest;

    if (!authed) {
      if (!inAuthGroup) router.replace('/auth/sign-in');
      return;
    }

    const needsLock = (security.pinEnabled || security.biometricEnabled) && !isUnlocked;
    if (needsLock) {
      if (!inLock) router.replace('/lock');
      return;
    }

    if (inAuthGroup) router.replace('/(tabs)');
  }, [session, isGuest, segments, isUnlocked, security, fontsLoaded, fontError]);

  // Auto-lock when the app returns to the foreground after the idle window.
  const checkAutoLock = useCallback(async () => {
    if ((!session && !isGuest) || !isUnlocked) return;
    const durationStr = await SecureStore.getItemAsync(SECURE_KEYS.autoLockDuration);
    const duration = durationStr ? parseInt(durationStr, 10) : 300;
    if (duration === -1 || lastActiveRef.current === null) return;
    const elapsed = (Date.now() - lastActiveRef.current) / 1000;
    if (elapsed >= duration) {
      setUnlocked(false);
      router.replace('/lock');
    }
  }, [session, isGuest, isUnlocked, setUnlocked, router]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', nextState => {
      if (nextState === 'background' || nextState === 'inactive') {
        lastActiveRef.current = Date.now();
      } else if (nextState === 'active') {
        checkAutoLock();
      }
    });
    return () => sub.remove();
  }, [checkAutoLock]);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  const app = (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: Platform.OS === 'web' ? 'none' : 'default',
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="auth" options={{ headerShown: false }} />
      <Stack.Screen name="lock" options={{ headerShown: false, gestureEnabled: false }} />
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
        options={{ presentation: 'card', animation: Platform.OS === 'web' ? 'none' : 'slide_from_right', headerShown: false }}
      />
      <Stack.Screen
        name="(modals)/share/[code]"
        options={{ presentation: 'card', animation: Platform.OS === 'web' ? 'none' : 'slide_from_right', headerShown: false }}
      />
      <Stack.Screen
        name="(modals)/reminders"
        options={{ presentation: 'card', animation: Platform.OS === 'web' ? 'none' : 'slide_from_right', headerShown: false }}
      />
      <Stack.Screen
        name="(modals)/pin-setup"
        options={{ presentation: Platform.OS === 'web' ? 'transparentModal' : 'modal', animation: 'slide_from_bottom', headerShown: false }}
      />
      <Stack.Screen
        name="(modals)/auto-lock-settings"
        options={{ presentation: Platform.OS === 'web' ? 'transparentModal' : 'modal', animation: 'slide_from_bottom', headerShown: false }}
      />
    </Stack>
  );

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={colors.background} />
      {Platform.OS === 'web' ? (
        <View style={[styles.webContainer, { backgroundColor: isDark ? '#000' : '#E5E7EB' }]}>
          <View style={[styles.webPhone, { backgroundColor: colors.background }]}>{app}</View>
        </View>
      ) : (
        app
      )}
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  webContainer: { flex: 1, alignItems: 'center', justifyContent: 'flex-start' },
  webPhone: {
    width: '100%',
    maxWidth: 430,
    flex: 1,
    overflow: 'hidden',
    // @ts-ignore — web-only shadow
    boxShadow: '0 0 0 1px rgba(0,0,0,0.06), 0 8px 48px rgba(0,0,0,0.14)',
  },
});
