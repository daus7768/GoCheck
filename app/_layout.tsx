import { useEffect } from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
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

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
    DMMono_400Regular,
    DMMono_500Medium,
  });

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
        contentStyle: { backgroundColor: colors.background },
        animation: Platform.OS === 'web' ? 'none' : 'default',
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
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
    </Stack>
  );

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="dark" backgroundColor={colors.background} />
      {Platform.OS === 'web' ? (
        <View style={styles.webContainer}>
          <View style={styles.webPhone}>{app}</View>
        </View>
      ) : (
        app
      )}
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
    backgroundColor: colors.background,
    overflow: 'hidden',
    // @ts-ignore — web-only shadow
    boxShadow: '0 0 0 1px rgba(0,0,0,0.06), 0 8px 48px rgba(0,0,0,0.14)',
  },
});
