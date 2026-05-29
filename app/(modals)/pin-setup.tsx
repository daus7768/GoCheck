import { useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Vibration, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { useTheme, type ThemeColors } from '../../src/theme/ThemeContext';
import { useProfileStore, SECURE_KEYS } from '../../src/store/profileStore';
import { typography, fontSize, spacing, radius } from '../../src/theme/tokens';

type Step = 'enter' | 'confirm';

export default function PinSetupModal() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const updateSecuritySetting = useProfileStore(s => s.updateSecuritySetting);
  const [step, setStep] = useState<Step>('enter');
  const [firstPin, setFirstPin] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const styles = useMemo(() => makeStyles(colors), [colors]);

  async function handleDigit(digit: string) {
    if (pin.length >= 4) return;
    const newPin = pin + digit;
    setPin(newPin);
    if (newPin.length === 4) {
      if (step === 'enter') {
        setFirstPin(newPin);
        setPin('');
        setStep('confirm');
        setError(null);
      } else {
        if (newPin === firstPin) {
          const hash = await Crypto.digestStringAsync(
            Crypto.CryptoDigestAlgorithm.SHA256,
            newPin,
          );
          try {
            await SecureStore.setItemAsync(SECURE_KEYS.pinHash, hash);
          } catch (e) {
            console.warn('[PIN] SecureStore unavailable:', e);
          }
          await updateSecuritySetting('pinEnabled', true);
          router.back();
        } else {
          Vibration.vibrate(300);
          setError('PINs do not match. Try again.');
          setPin('');
          setFirstPin('');
          setStep('enter');
        }
      }
    }
  }

  function handleDelete() {
    setPin(p => p.slice(0, -1));
  }

  function handleCancel() {
    Alert.alert('Cancel PIN Setup', 'Your PIN will not be saved.', [
      { text: 'Continue Setup', style: 'cancel' },
      { text: 'Cancel', style: 'destructive', onPress: () => router.back() },
    ]);
  }

  const numpad = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['', '0', 'del'],
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing[3], paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Set PIN</Text>
        <View style={{ width: 56 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.stepTitle}>
          {step === 'enter' ? 'Choose a 4-digit PIN' : 'Confirm your PIN'}
        </Text>
        <Text style={styles.stepSubtitle}>
          {step === 'enter'
            ? 'You will use this to unlock GoCheck'
            : 'Enter the same PIN again to confirm'}
        </Text>

        <View style={styles.stepIndicator}>
          <View style={[styles.stepDot, styles.stepDotActive]} />
          <View style={[styles.stepDot, step === 'confirm' && styles.stepDotActive]} />
        </View>

        <View style={styles.dotsRow}>
          {[0, 1, 2, 3].map(i => (
            <View key={i} style={[styles.dot, i < pin.length && styles.dotFilled]} />
          ))}
        </View>

        {error ? (
          <View style={styles.errorBanner}>
            <Feather name="alert-circle" size={14} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.numpad}>
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
                    activeOpacity={0.6}
                  >
                    <Text style={styles.numpadKeyText}>{key}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: spacing[5], paddingBottom: spacing[4],
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
    },
    cancelText: { fontFamily: typography.sansRegular, fontSize: fontSize.base, color: colors.primary },
    headerTitle: { fontFamily: typography.sansBold, fontSize: fontSize.base, color: colors.textPrimary },
    content: { flex: 1, alignItems: 'center', paddingTop: spacing[10] },
    stepTitle: { fontFamily: typography.sansBold, fontSize: fontSize.xl, color: colors.textPrimary, marginBottom: spacing[1] },
    stepSubtitle: { fontFamily: typography.sansRegular, fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing[5] },
    stepIndicator: { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[8] },
    stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
    stepDotActive: { backgroundColor: colors.primary },
    dotsRow: { flexDirection: 'row', gap: spacing[4], marginBottom: spacing[3] },
    dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface },
    dotFilled: { backgroundColor: colors.primary, borderColor: colors.primary },
    errorBanner: {
      flexDirection: 'row', alignItems: 'center', gap: spacing[1.5],
      backgroundColor: colors.errorSurface, borderRadius: radius.md,
      paddingHorizontal: spacing[3], paddingVertical: spacing[2], marginBottom: spacing[4],
    },
    errorText: { fontFamily: typography.sansRegular, fontSize: fontSize.sm, color: colors.error },
    numpad: { width: '100%', maxWidth: 280, marginTop: spacing[5] },
    numpadRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing[3] },
    numpadEmpty: { width: 72, height: 72 },
    numpadKey: {
      width: 72, height: 72, borderRadius: 36,
      backgroundColor: colors.surfaceElevated,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: colors.border,
    },
    numpadKeyText: { fontFamily: typography.sansMedium, fontSize: fontSize.xl, color: colors.textPrimary },
  });
}
