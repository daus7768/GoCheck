import { useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../../src/lib/supabase';
import { useProfileStore } from '../../src/store/profileStore';
import { useTheme, type ThemeColors } from '../../src/theme/ThemeContext';
import { typography, fontSize, spacing, radius } from '../../src/theme/tokens';

WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const continueAsGuest = useProfileStore(s => s.continueAsGuest);
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const styles = useMemo(() => makeStyles(colors), [colors]);

  async function handleGoogleSignIn() {
    setLoading(true);
    setError(null);
    try {
      const redirectTo = Linking.createURL('/auth/callback');
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (oauthError) throw oauthError;
      if (!data.url) throw new Error('No OAuth URL returned');

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type === 'success') {
        const { error: sessionError } = await supabase.auth.exchangeCodeForSession(result.url);
        if (sessionError) {
          // Session may still arrive via onAuthStateChange; log and continue.
          console.warn('[Auth] exchangeCodeForSession:', sessionError.message);
        }
      }
    } catch (e) {
      setError('Google sign-in is unavailable right now. You can continue as a guest.');
      console.error('[Auth] Google sign in error:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleGuest() {
    setGuestLoading(true);
    setError(null);
    try {
      await continueAsGuest();
      router.replace('/(tabs)');
    } finally {
      setGuestLoading(false);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Logo */}
      <View style={styles.logoArea}>
        <View style={styles.logoCircle}>
          <Feather name="check-circle" size={40} color="#FFFFFF" />
        </View>
        <Text style={styles.appName}>GoCheck</Text>
        <Text style={styles.tagline}>Split bills. Stay organized.</Text>
      </View>

      {/* Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Welcome</Text>
        <Text style={styles.cardSubtitle}>Sign in to manage and split bills with your group.</Text>

        {error ? (
          <View style={styles.errorBanner}>
            <Feather name="alert-circle" size={14} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.googleButton, loading && styles.buttonDisabled]}
          onPress={handleGoogleSignIn}
          disabled={loading || guestLoading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={colors.textInverse} size="small" />
          ) : (
            <>
              <View style={styles.googleIcon}>
                <Text style={styles.googleIconText}>G</Text>
              </View>
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity
          style={[styles.guestButton, guestLoading && styles.buttonDisabled]}
          onPress={handleGuest}
          disabled={loading || guestLoading}
          activeOpacity={0.85}
        >
          {guestLoading ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <>
              <Feather name="user" size={16} color={colors.primary} />
              <Text style={styles.guestButtonText}>Continue as guest</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          By continuing, you agree to GoCheck's Terms of Service and Privacy Policy.
        </Text>
      </View>

      {/* Bottom decoration */}
      <View style={styles.bottomDecoration}>
        <View style={[styles.decorDot, { backgroundColor: colors.primary }]} />
        <View style={[styles.decorDot, { backgroundColor: colors.primaryBorder }]} />
        <View style={[styles.decorDot, { backgroundColor: colors.primarySurface }]} />
      </View>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing[6],
    },
    logoArea: { alignItems: 'center', marginBottom: spacing[10] },
    logoCircle: {
      width: 80,
      height: 80,
      borderRadius: radius['2xl'],
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing[4],
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.35,
      shadowRadius: 24,
      elevation: 12,
    },
    appName: {
      fontFamily: typography.sansBold,
      fontSize: fontSize['3xl'],
      color: colors.textPrimary,
      letterSpacing: -0.5,
    },
    tagline: {
      fontFamily: typography.sansRegular,
      fontSize: fontSize.base,
      color: colors.textSecondary,
      marginTop: spacing[1],
    },
    card: {
      width: '100%',
      backgroundColor: colors.surface,
      borderRadius: radius['2xl'],
      padding: spacing[6],
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 16,
      elevation: 4,
    },
    cardTitle: {
      fontFamily: typography.sansBold,
      fontSize: fontSize.xl,
      color: colors.textPrimary,
      marginBottom: spacing[1],
    },
    cardSubtitle: {
      fontFamily: typography.sansRegular,
      fontSize: fontSize.sm,
      color: colors.textSecondary,
      marginBottom: spacing[5],
      lineHeight: fontSize.sm * 1.6,
    },
    errorBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[1.5],
      backgroundColor: colors.errorSurface,
      borderRadius: radius.md,
      padding: spacing[3],
      marginBottom: spacing[3],
    },
    errorText: {
      fontFamily: typography.sansRegular,
      fontSize: fontSize.sm,
      color: colors.error,
      flex: 1,
    },
    googleButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing[3],
      backgroundColor: colors.primary,
      borderRadius: radius.lg,
      paddingVertical: spacing[4],
      paddingHorizontal: spacing[5],
    },
    buttonDisabled: { opacity: 0.7 },
    googleIcon: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.white,
      alignItems: 'center',
      justifyContent: 'center',
    },
    googleIconText: {
      fontFamily: typography.sansBold,
      fontSize: 13,
      color: colors.primary,
    },
    googleButtonText: {
      fontFamily: typography.sansSemiBold,
      fontSize: fontSize.base,
      color: colors.textInverse,
    },
    dividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[3],
      marginVertical: spacing[4],
    },
    dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
    dividerText: {
      fontFamily: typography.sansRegular,
      fontSize: fontSize.xs,
      color: colors.textTertiary,
    },
    guestButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing[2],
      backgroundColor: colors.primarySurface,
      borderWidth: 1,
      borderColor: colors.primaryBorder,
      borderRadius: radius.lg,
      paddingVertical: spacing[4],
      paddingHorizontal: spacing[5],
    },
    guestButtonText: {
      fontFamily: typography.sansSemiBold,
      fontSize: fontSize.base,
      color: colors.primary,
    },
    disclaimer: {
      fontFamily: typography.sansRegular,
      fontSize: fontSize['2xs'],
      color: colors.textTertiary,
      textAlign: 'center',
      marginTop: spacing[4],
      lineHeight: fontSize['2xs'] * 1.6,
    },
    bottomDecoration: {
      flexDirection: 'row',
      gap: spacing[1.5],
      marginTop: spacing[8],
    },
    decorDot: { width: 6, height: 6, borderRadius: 3 },
  });
}
