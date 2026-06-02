import { useState } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
  Image,
  ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { BlurView } from 'expo-blur';
import { supabase } from '../../src/lib/supabase';
import { typography, fontSize, radius, spacing } from '../../src/theme/tokens';
import { AuroraBackground } from '../../src/components/effects/AuroraBackground';
import { FadeInUp } from '../../src/components/effects/FadeInUp';
import { GlowingCard } from '../../src/components/effects/GlowingCard';
import { GlareCard } from '../../src/components/effects/GlareCard';
import { NoiseBackground } from '../../src/components/effects/NoiseBackground';
import { AppText } from '../../src/components/AppText';

WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  const [loading, setLoading] = useState(false);

  async function handleGoogleSignIn() {
    setLoading(true);
    try {
      if (Platform.OS === 'web') {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: window.location.origin + '/auth/callback' },
        });
        if (error) throw error;
        return;
      }

      const redirectTo = makeRedirectUri({ scheme: 'gocheck', path: 'auth/callback' });
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });

      if (error) throw error;
      if (!data.url) throw new Error('No OAuth URL returned');

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

      if (result.type === 'success' && result.url) {
        const hash = result.url.split('#')[1] ?? '';
        const params = new URLSearchParams(hash);
        const at = params.get('access_token') ?? new URL(result.url).searchParams.get('access_token');
        const rt = params.get('refresh_token') ?? new URL(result.url).searchParams.get('refresh_token');
        if (at && rt) {
          await supabase.auth.setSession({ access_token: at, refresh_token: rt });
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
    <AuroraBackground>
      <StatusBar style="light" />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.content}>
          {/* Brand */}
          <FadeInUp index={0} style={styles.logoContainer}>
            <View style={styles.logoGlow}>
              <Image source={require('../../assets/logo_v2.png')} style={styles.logoIcon} />
            </View>
            <AppText style={styles.logoText}>GoCheck</AppText>
            <AppText style={styles.tagline}>Bill splitting, beautifully simple</AppText>
          </FadeInUp>

          {/* Hero */}
          <FadeInUp index={1} style={styles.heroSection}>
            <AppText style={styles.heroTitle}>
              Welcome,{' '}
              <AppText style={styles.heroTitleAccent}>Organizer</AppText>
            </AppText>
            <AppText style={styles.heroSubtitle}>
              Create bills, track payments, and settle up with your group — all in one place.
            </AppText>
          </FadeInUp>

          {/* Features */}
          <FadeInUp index={2} style={styles.features}>
            {FEATURES.map((f, i) => (
              <FadeInUp key={f.text} index={3 + i}>
                <GlowingCard
                  radius={radius.lg}
                  color="#A5B4FC"
                  background="rgba(255,255,255,0.05)"
                  spread={50}
                  borderWidth={1}
                >
                  <View style={styles.featureRow}>
                    <View style={styles.featureDot}>
                      <Feather
                        name={f.icon as keyof typeof Feather.glyphMap}
                        size={14}
                        color="#A5B4FC"
                      />
                    </View>
                    <AppText style={styles.featureText}>{f.text}</AppText>
                    <GlareCard radius={radius.lg} intensity={0.3} />
                  </View>
                </GlowingCard>
              </FadeInUp>
            ))}
          </FadeInUp>

          {/* Sign-in card — GlowingCard rim + glass surface + glare overlay */}
          <FadeInUp index={6} style={styles.cardWrap}>
            <GlowingCard
              radius={radius['2xl']}
              color="#A5B4FC"
              background="transparent"
              spread={70}
              borderWidth={1.5}
            >
              <View style={styles.cardInner}>
                <GlassCard>
                  <AppText style={styles.cardTitle}>Get started</AppText>
                  <AppText style={styles.cardSubtitle}>
                    Use your Google account to sign in or create your organizer account.
                  </AppText>

                  <NoiseBackground
                    radius={999}
                    padding={2}
                    gradientColors={['#6366F1', '#A5B4FC', '#22D3EE', '#8B5CF6', '#6366F1']}
                    containerStyle={styles.googleBtnFrame}
                    disabled={loading}
                  >
                    <TouchableOpacity
                      style={[styles.googleBtn, loading && styles.googleBtnDisabled]}
                      onPress={handleGoogleSignIn}
                      disabled={loading}
                      activeOpacity={0.9}
                    >
                      {loading ? (
                        <ActivityIndicator color="#111827" />
                      ) : (
                        <>
                          <GoogleLogo />
                          <AppText style={styles.googleBtnText} numberOfLines={1}>Continue with Google</AppText>
                          <Feather name="arrow-right" size={18} color="#111827" style={styles.googleBtnArrow} />
                        </>
                      )}
                    </TouchableOpacity>
                  </NoiseBackground>

                  <AppText style={styles.terms}>
                    By continuing you agree to our{' '}
                    <AppText style={styles.termsLink}>Terms of Service</AppText>
                    {' '}and{' '}
                    <AppText style={styles.termsLink}>Privacy Policy</AppText>
                  </AppText>
                </GlassCard>
                <GlareCard radius={radius['2xl']} />
              </View>
            </GlowingCard>
          </FadeInUp>
        </View>
      </ScrollView>
    </AuroraBackground>
  );
}

// ─── Glass card ─────────────────────────────────────────────────────────────
// expo-blur on native; subtle backdrop-filter on web via inline style.

function GlassCard({ children }: { children: React.ReactNode }) {
  if (Platform.OS === 'web') {
    const webStyle: any = {
      borderRadius: radius['2xl'],
      overflow: 'hidden',
      backgroundColor: 'rgba(255,255,255,0.08)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.18)',
      backdropFilter: 'blur(24px) saturate(140%)',
      WebkitBackdropFilter: 'blur(24px) saturate(140%)',
      boxShadow: '0 20px 60px -20px rgba(15, 23, 42, 0.6), inset 0 1px 0 rgba(255,255,255,0.18)',
    };
    return (
      <View style={webStyle as any}>
        <View style={styles.card}>{children}</View>
      </View>
    );
  }
  return (
    <View style={styles.glassWrap}>
      <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.glassTint} pointerEvents="none" />
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function GoogleLogo() {
  return (
    <View style={styles.googleLogo}>
      <AppText style={styles.googleLogoG}>G</AppText>
    </View>
  );
}

const FEATURES = [
  { icon: 'users', text: 'Split bills with any group, instantly' },
  { icon: 'bell', text: 'Auto-reminders for unpaid members' },
  { icon: 'bar-chart-2', text: 'Track who owes what in real time' },
];

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    minHeight: Platform.OS === 'web' ? ('100vh' as unknown as number) : undefined,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing[6],
    paddingTop: Platform.OS === 'ios' ? 80 : Platform.OS === 'web' ? 64 : 56,
    paddingBottom: spacing[10],
    gap: spacing[8],
    maxWidth: 460,
    width: '100%',
    alignSelf: 'center',
  },

  // Brand
  logoContainer: {
    alignItems: 'center',
    gap: spacing[2],
  },
  logoGlow: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(99,102,241,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(165,180,252,0.35)',
    marginBottom: spacing[2],
    ...Platform.select({
      web: {
        // @ts-ignore web-only
        boxShadow: '0 0 40px rgba(99,102,241,0.45), inset 0 0 24px rgba(165,180,252,0.18)',
      },
      default: {
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 24,
        elevation: 12,
      },
    }),
  },
  logoIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  logoText: {
    fontFamily: typography.sansBold,
    fontSize: fontSize['3xl'],
    color: '#FFFFFF',
    letterSpacing: -0.8,
  },
  tagline: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.sm,
    color: 'rgba(226,232,255,0.7)',
    letterSpacing: 0.2,
  },

  // Hero
  heroSection: {
    alignItems: 'center',
    paddingHorizontal: spacing[2],
    gap: spacing[3],
  },
  heroTitle: {
    fontFamily: typography.sansBold,
    fontSize: fontSize['2xl'],
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  heroTitleAccent: {
    color: '#A5B4FC',
  },
  heroSubtitle: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.base,
    color: 'rgba(226,232,255,0.78)',
    textAlign: 'center',
    lineHeight: fontSize.base * 1.55,
    maxWidth: 360,
  },

  // Features
  features: {
    gap: spacing[3],
    paddingHorizontal: spacing[1],
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
    position: 'relative',
  },
  featureDot: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: 'rgba(99,102,241,0.20)',
    borderWidth: 1,
    borderColor: 'rgba(165,180,252,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    fontFamily: typography.sansMedium,
    fontSize: fontSize.sm,
    color: 'rgba(241,245,255,0.92)',
    flex: 1,
    letterSpacing: 0.1,
  },

  // Glass card
  cardWrap: {
    marginTop: spacing[2],
  },
  cardInner: {
    position: 'relative',
    borderRadius: radius['2xl'],
    overflow: 'hidden',
  },
  glassWrap: {
    borderRadius: radius['2xl'],
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.45,
    shadowRadius: 30,
    elevation: 18,
  },
  glassTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.30)',
  },
  card: {
    padding: spacing[6],
    gap: spacing[4],
  },
  cardTitle: {
    fontFamily: typography.sansBold,
    fontSize: fontSize.lg,
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  cardSubtitle: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.sm,
    color: 'rgba(226,232,255,0.72)',
    lineHeight: fontSize.sm * 1.55,
    marginTop: -spacing[2],
  },

  // Google button — sits inside the NoiseBackground gradient ring
  googleBtnFrame: {
    marginTop: spacing[2],
    alignSelf: 'stretch',
    ...Platform.select({
      web: {
        // @ts-ignore web-only
        boxShadow: '0 10px 30px -8px rgba(99,102,241,0.55)',
      },
      default: {
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.4,
        shadowRadius: 20,
        elevation: 10,
      },
    }),
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[3],
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[5],
    minHeight: 52,
  },
  googleBtnDisabled: {
    opacity: 0.65,
  },
  googleBtnText: {
    fontFamily: typography.sansBold,
    fontSize: fontSize.base,
    color: '#111827',
  },
  googleBtnArrow: {
    marginLeft: spacing[1],
  },
  googleLogo: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleLogoG: {
    fontFamily: typography.sansBold,
    fontSize: fontSize.sm,
    color: '#FFFFFF',
  },
  terms: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize['2xs'],
    color: 'rgba(226,232,255,0.55)',
    textAlign: 'center',
    lineHeight: fontSize['2xs'] * 1.7,
    marginTop: spacing[2],
  },
  termsLink: {
    color: '#A5B4FC',
    fontFamily: typography.sansMedium,
  },
});
