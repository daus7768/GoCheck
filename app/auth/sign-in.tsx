import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
  Image,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from '../../src/lib/supabase';
import { colors, typography, fontSize, radius, spacing } from '../../src/theme/tokens';
import { GlowingCard } from '../../src/components/effects/GlowingCard';

WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  const [loading, setLoading] = useState(false);

  async function handleGoogleSignIn() {
    setLoading(true);
    try {
      const redirectTo = Platform.OS === 'web'
        ? window.location.origin + '/auth/callback'
        : makeRedirectUri({ scheme: 'gocheck', path: 'auth/callback' });

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;
      if (!data.url) throw new Error('No OAuth URL returned');

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

      if (result.type === 'success' && result.url) {
        const url = new URL(result.url);
        const accessToken = url.searchParams.get('access_token');
        const refreshToken = url.searchParams.get('refresh_token');

        if (accessToken && refreshToken) {
          await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        } else {
          // Try fragment params (hash)
          const hash = result.url.split('#')[1] ?? '';
          const params = new URLSearchParams(hash);
          const at = params.get('access_token');
          const rt = params.get('refresh_token');
          if (at && rt) {
            await supabase.auth.setSession({ access_token: at, refresh_token: rt });
          }
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Sign in failed. Please try again.';
      Alert.alert('Sign In Error', msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Background gradient */}
      <LinearGradient
        colors={['#312E81', '#4F46E5', '#6366F1']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Top decorative blobs */}
      <View style={styles.blobTopRight} />
      <View style={styles.blobBottomLeft} />

      {/* Content */}
      <View style={styles.content}>
        {/* Logo / Brand */}
        <View style={styles.logoContainer}>
          <Image source={require('../../assets/logo.png')} style={styles.logoIcon} />
          <Text style={styles.logoText}>GoCheck</Text>
          <Text style={styles.tagline}>Bill splitting made simple</Text>
        </View>

        {/* Hero section */}
        <View style={styles.heroSection}>
          <Text style={styles.heroTitle}>Welcome, Organizer</Text>
          <Text style={styles.heroSubtitle}>
            Sign in to create bills, track payments, and settle up with your group.
          </Text>
        </View>

        {/* Features list */}
        <View style={styles.features}>
          {FEATURES.map((f) => (
            <View key={f.text} style={styles.featureRow}>
              <View style={styles.featureDot}>
                <Feather name={f.icon as keyof typeof Feather.glyphMap} size={14} color={colors.primary} />
              </View>
              <Text style={styles.featureText}>{f.text}</Text>
            </View>
          ))}
        </View>

        {/* Sign-in card */}
        <GlowingCard radius={radius['2xl']} color={colors.white} background={colors.white} spread={70}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Get started</Text>
            <Text style={styles.cardSubtitle}>
              Use your Google account to sign in or create your organizer account.
            </Text>

            <TouchableOpacity
              style={[styles.googleBtn, loading && styles.googleBtnDisabled]}
              onPress={handleGoogleSignIn}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color={colors.textPrimary} />
              ) : (
                <>
                  <GoogleLogo />
                  <Text style={styles.googleBtnText}>Continue with Google</Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.terms}>
              By continuing you agree to our{' '}
              <Text style={styles.termsLink}>Terms of Service</Text>
              {' '}and{' '}
              <Text style={styles.termsLink}>Privacy Policy</Text>
            </Text>
          </View>
        </GlowingCard>
      </View>
    </View>
  );
}

function GoogleLogo() {
  return (
    <View style={styles.googleLogo}>
      <Text style={styles.googleLogoText}>G</Text>
    </View>
  );
}

const FEATURES = [
  { icon: 'users', text: 'Split bills with any group, instantly' },
  { icon: 'bell', text: 'Auto-reminders for unpaid members' },
  { icon: 'bar-chart-2', text: 'Track who owes what in real time' },
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  blobTopRight: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  blobBottomLeft: {
    position: 'absolute',
    bottom: -60,
    left: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing[6],
    paddingTop: Platform.OS === 'ios' ? 72 : 56,
    paddingBottom: spacing[8],
    justifyContent: 'space-between',
  },
  logoContainer: {
    alignItems: 'center',
  },
  logoIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: spacing[3],
  },
  logoText: {
    fontFamily: typography.sansBold,
    fontSize: fontSize['2xl'],
    color: colors.white,
    letterSpacing: -0.5,
  },
  tagline: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.7)',
    marginTop: spacing[1],
  },
  heroSection: {
    alignItems: 'center',
    paddingHorizontal: spacing[4],
  },
  heroTitle: {
    fontFamily: typography.sansBold,
    fontSize: fontSize['2xl'],
    color: colors.white,
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: spacing[3],
  },
  heroSubtitle: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.base,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    lineHeight: fontSize.base * 1.5,
  },
  features: {
    gap: spacing[3],
    paddingHorizontal: spacing[2],
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  featureDot: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    fontFamily: typography.sansMedium,
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.85)',
    flex: 1,
  },
  card: {
    padding: spacing[6],
    gap: spacing[4],
  },
  cardTitle: {
    fontFamily: typography.sansBold,
    fontSize: fontSize.md,
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  cardSubtitle: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: fontSize.sm * 1.5,
    marginTop: -spacing[2],
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[3],
    backgroundColor: colors.gray50,
    borderRadius: radius.lg,
    paddingVertical: spacing[4],
    borderWidth: 1,
    borderColor: colors.border,
  },
  googleBtnDisabled: {
    opacity: 0.6,
  },
  googleBtnText: {
    fontFamily: typography.sansMedium,
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },
  googleLogo: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleLogoText: {
    fontFamily: typography.sansBold,
    fontSize: fontSize.sm,
    color: colors.white,
  },
  terms: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize['2xs'],
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: fontSize['2xs'] * 1.6,
  },
  termsLink: {
    color: colors.primary,
    fontFamily: typography.sansMedium,
  },
});
