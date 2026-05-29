import { useState, useEffect, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, Alert, StyleSheet,
  Vibration, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as LocalAuthentication from 'expo-local-authentication';
import { Feather } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { useTheme, type ThemeColors } from '../src/theme/ThemeContext';
import { useProfileStore, SECURE_KEYS } from '../src/store/profileStore';
import { typography, fontSize, spacing, radius } from '../src/theme/tokens';

const MAX_ATTEMPTS = 5;
const COOLDOWN_SECONDS = 30;

export default function LockScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const profile = useProfileStore(s => s.profile);
  const security = useProfileStore(s => s.security);
  const setUnlocked = useProfileStore(s => s.setUnlocked);
  const signOut = useProfileStore(s => s.signOut);
  const [pin, setPin] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [bioLoading, setBioLoading] = useState(false);
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // Offer biometric immediately when enabled.
  useEffect(() => {
    if (security.biometricEnabled) {
      triggerBiometric();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cooldown countdown.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function triggerBiometric() {
    setBioLoading(true);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock GoCheck',
        fallbackLabel: 'Use PIN',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });
      if (result.success) {
        setUnlocked(true);
        router.replace('/(tabs)');
      }
    } catch (e) {
      console.warn('[Lock] Biometric error:', e);
    } finally {
      setBioLoading(false);
    }
  }

  async function handleDigit(digit: string) {
    if (cooldown > 0 || pin.length >= 4) return;
    const newPin = pin + digit;
    setPin(newPin);
    if (newPin.length === 4) {
      await verifyPin(newPin);
    }
  }

  async function verifyPin(enteredPin: string) {
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      enteredPin,
    );
    const storedHash = await SecureStore.getItemAsync(SECURE_KEYS.pinHash);
    if (hash === storedHash) {
      setPin('');
      setAttempts(0);
      setUnlocked(true);
      router.replace('/(tabs)');
    } else {
      Vibration.vibrate(300);
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setPin('');
      if (newAttempts >= MAX_ATTEMPTS) {
        setCooldown(COOLDOWN_SECONDS);
        setAttempts(0);
      }
    }
  }

  function handleDelete() {
    setPin(p => p.slice(0, -1));
  }

  function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
    ]);
  }

  const dots = [0, 1, 2, 3].map(i => (
    <View key={i} style={[styles.dot, i < pin.length && styles.dotFilled]} />
  ));

  const numpad = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['', '0', 'del'],
  ];

  const remaining = MAX_ATTEMPTS - attempts;

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.logoRow}>
        <View style={styles.logoCircle}>
          <Feather name="lock" size={24} color="#FFFFFF" />
        </View>
      </View>

      <Text style={styles.greeting}>
        Welcome back{profile?.displayName ? `, ${profile.displayName.split(' ')[0]}` : ''}
      </Text>
      <Text style={styles.subtitle}>Enter your PIN to continue</Text>

      <View style={styles.dotsRow}>{dots}</View>

      {attempts > 0 && attempts < MAX_ATTEMPTS && (
        <Text style={styles.attemptsText}>
          Incorrect PIN — {remaining} attempt{remaining !== 1 ? 's' : ''} left
        </Text>
      )}

      {cooldown > 0 && (
        <Text style={styles.cooldownText}>Too many attempts. Try again in {cooldown}s</Text>
      )}

      <View style={[styles.numpad, cooldown > 0 && styles.numpadDisabled]}>
        {numpad.map((row, ri) => (
          <View key={ri} style={styles.numpadRow}>
            {row.map((key, ki) => {
              if (key === '') return <View key={ki} style={styles.numpadEmpty} />;
              if (key === 'del') {
                return (
                  <TouchableOpacity key={ki} style={styles.numpadKey} onPress={handleDelete} activeOpacity={0.6}>
                    <Feather name="delete" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                );
              }
              return (
                <TouchableOpacity
                  key={ki}
                  style={styles.numpadKey}
                  onPress={() => handleDigit(key)}
                  disabled={cooldown > 0}
                  activeOpacity={0.6}
                >
                  <Text style={styles.numpadKeyText}>{key}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>

      {security.biometricEnabled && (
        <TouchableOpacity style={styles.bioButton} onPress={triggerBiometric} disabled={bioLoading}>
          {bioLoading
            ? <ActivityIndicator color={colors.primary} size="small" />
            : <Feather name="aperture" size={22} color={colors.primary} />
          }
          <Text style={styles.bioText}>Use Face / Touch ID</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.signOutLink} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1, backgroundColor: colors.background,
      alignItems: 'center', justifyContent: 'center',
      paddingHorizontal: spacing[6],
    },
    logoRow: { marginBottom: spacing[6] },
    logoCircle: {
      width: 60, height: 60, borderRadius: 30,
      backgroundColor: colors.primary,
      alignItems: 'center', justifyContent: 'center',
    },
    greeting: {
      fontFamily: typography.sansBold,
      fontSize: fontSize.xl,
      color: colors.textPrimary,
      marginBottom: spacing[1],
    },
    subtitle: {
      fontFamily: typography.sansRegular,
      fontSize: fontSize.sm,
      color: colors.textSecondary,
      marginBottom: spacing[8],
    },
    dotsRow: { flexDirection: 'row', gap: spacing[4], marginBottom: spacing[3] },
    dot: {
      width: 14, height: 14, borderRadius: 7,
      borderWidth: 2, borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    dotFilled: { backgroundColor: colors.primary, borderColor: colors.primary },
    attemptsText: {
      fontFamily: typography.sansRegular,
      fontSize: fontSize.xs,
      color: colors.error,
      marginBottom: spacing[4],
    },
    cooldownText: {
      fontFamily: typography.sansMedium,
      fontSize: fontSize.sm,
      color: colors.warning,
      marginBottom: spacing[4],
    },
    numpad: { width: '100%', maxWidth: 280, marginTop: spacing[4] },
    numpadDisabled: { opacity: 0.4 },
    numpadRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing[3] },
    numpadEmpty: { width: 72, height: 72 },
    numpadKey: {
      width: 72, height: 72, borderRadius: 36,
      backgroundColor: colors.surfaceElevated,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: colors.border,
    },
    numpadKeyText: {
      fontFamily: typography.sansMedium,
      fontSize: fontSize.xl,
      color: colors.textPrimary,
    },
    bioButton: {
      flexDirection: 'row', alignItems: 'center', gap: spacing[2],
      marginTop: spacing[8],
      paddingVertical: spacing[3], paddingHorizontal: spacing[5],
      borderRadius: radius.lg,
      backgroundColor: colors.primarySurface,
      borderWidth: 1, borderColor: colors.primaryBorder,
    },
    bioText: {
      fontFamily: typography.sansMedium,
      fontSize: fontSize.sm,
      color: colors.primary,
    },
    signOutLink: { marginTop: spacing[6] },
    signOutText: {
      fontFamily: typography.sansRegular,
      fontSize: fontSize.sm,
      color: colors.textTertiary,
      textDecorationLine: 'underline',
    },
  });
}
