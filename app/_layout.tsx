import { useEffect } from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import { Stack, useRouter, useSegments, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import { BackgroundBeams } from '../src/components/effects/BackgroundBeams';
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
import { ColourfulClockProvider } from '../src/theme/ColourfulClockContext';
import { useProfileStore } from '../src/store/profileStore';
import { supabase } from '../src/lib/supabase';
import * as Notifications from 'expo-notifications';
import {
  ThemeProvider as NavigationThemeProvider,
  DarkTheme as NavigationDarkTheme,
  DefaultTheme as NavigationLightTheme,
} from '@react-navigation/native';
import { LightBackgroundBeams } from '../src/components/effects/LightBackgroundBeams';

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

function AnimatedThemeRoot({ children }: { children: React.ReactNode }) {
  const { isDark } = useTheme();

  const LIGHT_BG = '#FAFBFF';
  const DARK_BG  = '#070710';

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const prevHtml = document.documentElement.style.backgroundColor;
    const prevBody = document.body.style.backgroundColor;
    document.documentElement.style.backgroundColor = isDark ? '#03030D' : '#F0F4FF';
    document.body.style.backgroundColor = isDark ? '#03030D' : '#F0F4FF';
    return () => {
      document.documentElement.style.backgroundColor = prevHtml;
      document.body.style.backgroundColor = prevBody;
    };
  }, [isDark]);

  const navTheme = isDark
    ? { ...NavigationDarkTheme,  colors: { ...NavigationDarkTheme.colors,  background: 'transparent', card: 'transparent' } }
    : { ...NavigationLightTheme, colors: { ...NavigationLightTheme.colors, background: 'transparent', card: 'transparent' } };

  const Background = isDark ? BackgroundBeams : LightBackgroundBeams;

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.webContainer, { backgroundColor: isDark ? '#03030D' : '#F0F4FF' }]}>
        <View style={[styles.webPhone, { backgroundColor: isDark ? DARK_BG : LIGHT_BG }]}>
          <Background opacityScale={1} showBase />
          <NavigationThemeProvider value={navTheme}>
            {children}
          </NavigationThemeProvider>
        </View>
      </View>
    );
  }
  return (
    <View style={[styles.nativeRoot, { backgroundColor: isDark ? DARK_BG : LIGHT_BG }]}>
      <Background opacityScale={0.95} showBase />
      <NavigationThemeProvider value={navTheme}>
        {children}
      </NavigationThemeProvider>
    </View>
  );
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

  const app = (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: 'transparent' },
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
        <ColourfulClockProvider>
          <AuthGuard>
            <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor="transparent" />
            <AnimatedThemeRoot>{app}</AnimatedThemeRoot>
          </AuthGuard>
        </ColourfulClockProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // Native: rich dark fallback under the BackgroundBeams (prevents a flash
  // of white before the SVG paints on first layout).
  nativeRoot: { flex: 1, backgroundColor: '#070710' },
  webContainer: {
    flex: 1,
    // Rich dark void — gradient isn't available here so we use a very deep indigo-black
    backgroundColor: '#03030D',
    alignItems: 'center',
    justifyContent: 'flex-start',
    // @ts-ignore — web-only background gradient on the void area
    background: 'radial-gradient(ellipse 80% 60% at 50% 30%, rgba(79,70,229,0.07) 0%, rgba(3,3,13,1) 70%)',
  },
  webPhone: {
    width: '100%',
    maxWidth: 430,
    maxHeight: 932,
    flex: 1,
    overflow: 'hidden',
    // Dark fallback so the cosmic beams have something to paint over the
    // very first frame (the SVG runs an onLayout pass before drawing paths).
    backgroundColor: '#070710',
    // @ts-ignore — web-only properties
    borderRadius: 28,
    boxShadow:
      '0 0 0 1.5px rgba(99,102,241,0.15), 0 0 60px rgba(99,102,241,0.06), 0 32px 80px rgba(0,0,0,0.65)',
  },
});
