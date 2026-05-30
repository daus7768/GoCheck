import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, typography, fontSize, spacing, radius, shadow } from '../../src/theme/tokens';
import { useTheme } from '../../src/theme/ThemeContext';
import { useProfileStore } from '../../src/store/profileStore';
import { SettingSection } from '../../src/components/profile/SettingSection';
import { SettingRow } from '../../src/components/profile/SettingRow';
import { ToggleV2 } from '../../src/components/profile/ToggleV2';
import { haptic } from '../../src/lib/haptics';
import {
  CURRENCY_SYMBOLS,
  SUPPORTED_CURRENCIES,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHOD_SUBTITLES,
  type PaymentMethodKey,
} from '../../src/types';

const APP_VERSION = '2.0';

const ALL_PAYMENT_METHODS: PaymentMethodKey[] = ['duitnow', 'card', 'paypal', 'bank_transfer'];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { colors: c } = useTheme();
  const { session, profile, updateProfile, signOut } = useProfileStore();

  const displayName = profile?.displayName ?? session?.user?.email?.split('@')[0] ?? 'Organizer';
  const email = session?.user?.email ?? '';
  const avatarUrl = profile?.avatarUrl ?? null;
  const initial = (displayName.trim()[0] ?? 'O').toUpperCase();

  const defaultCurrency = profile?.defaultCurrency ?? 'MYR';
  const darkMode = profile?.darkMode ?? false;
  const paymentMethods = profile?.paymentMethods ?? [];
  const notifPush = profile?.notifPush ?? true;
  const notifEmail = profile?.notifEmail ?? true;
  const notifWhatsapp = profile?.notifWhatsapp ?? false;
  const notifDueSoon = profile?.notifDueSoon ?? true;
  const notifOverdue = profile?.notifOverdue ?? true;
  const notifWeeklyDigest = profile?.notifWeeklyDigest ?? false;

  const symbol = CURRENCY_SYMBOLS[defaultCurrency];

  function cycleCurrency() {
    const idx = SUPPORTED_CURRENCIES.indexOf(defaultCurrency);
    const next = SUPPORTED_CURRENCIES[(idx + 1) % SUPPORTED_CURRENCIES.length] ?? 'MYR';
    haptic.selection();
    updateProfile({ defaultCurrency: next });
  }

  function togglePaymentMethod(key: PaymentMethodKey) {
    haptic.selection();
    const next = paymentMethods.includes(key)
      ? paymentMethods.filter((k) => k !== key)
      : [...paymentMethods, key];
    updateProfile({ paymentMethods: next });
  }

  function confirmSignOut() {
    Alert.alert(
      'Sign out?',
      'You will need to sign in again to manage your bills.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => {
            haptic.selection();
            signOut();
          },
        },
      ]
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: c.background }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + spacing[8] }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing[5] }]}>
        <Text style={[styles.headerTitle, { color: c.textPrimary }]}>Profile</Text>
      </View>

      {/* Profile card */}
      <View style={[styles.profileCard, { backgroundColor: c.surface }]}>
        <View style={styles.avatarWrapper}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarFallback, { backgroundColor: colors.primary }]}>
              <Text style={styles.avatarInitial}>{initial}</Text>
            </View>
          )}
          <View style={[styles.organizerBadge, { backgroundColor: colors.primarySurface }]}>
            <Feather name="shield" size={10} color={colors.primary} />
            <Text style={styles.organizerBadgeText}>Organizer</Text>
          </View>
        </View>

        <View style={styles.profileInfo}>
          <Text style={[styles.profileName, { color: c.textPrimary }]}>{displayName}</Text>
          {email ? (
            <Text style={[styles.profileEmail, { color: c.textSecondary }]}>{email}</Text>
          ) : null}
        </View>
      </View>

      {/* Account section */}
      <SettingSection title="Account">
        <SettingRow
          label="Default Currency"
          sub={`${symbol} ${defaultCurrency} — tap to change`}
          onPress={cycleCurrency}
          icon="dollar-sign"
          right={
            <Text style={styles.rowValue}>{symbol}</Text>
          }
        />
        <SettingRow
          label="Dark Mode"
          icon="moon"
          last
          right={
            <ToggleV2
              on={darkMode}
              onChange={(v) => updateProfile({ darkMode: v })}
              accessibilityLabel="Toggle dark mode"
            />
          }
        />
      </SettingSection>

      {/* Payment Methods */}
      <SettingSection title="Payment Methods">
        {ALL_PAYMENT_METHODS.map((key, i) => (
          <SettingRow
            key={key}
            label={PAYMENT_METHOD_LABELS[key]}
            sub={PAYMENT_METHOD_SUBTITLES[key]}
            icon="credit-card"
            last={i === ALL_PAYMENT_METHODS.length - 1}
            right={
              <ToggleV2
                on={paymentMethods.includes(key)}
                onChange={() => togglePaymentMethod(key)}
                accessibilityLabel={`Toggle ${PAYMENT_METHOD_LABELS[key]}`}
              />
            }
          />
        ))}
      </SettingSection>

      {/* Notifications */}
      <SettingSection title="Notifications">
        <SettingRow
          label="Push Notifications"
          icon="bell"
          right={
            <ToggleV2
              on={notifPush}
              onChange={(v) => updateProfile({ notifPush: v })}
              accessibilityLabel="Toggle push notifications"
            />
          }
        />
        <SettingRow
          label="Email Notifications"
          icon="mail"
          right={
            <ToggleV2
              on={notifEmail}
              onChange={(v) => updateProfile({ notifEmail: v })}
              accessibilityLabel="Toggle email notifications"
            />
          }
        />
        <SettingRow
          label="WhatsApp Reminders"
          icon="message-circle"
          right={
            <ToggleV2
              on={notifWhatsapp}
              onChange={(v) => updateProfile({ notifWhatsapp: v })}
              accessibilityLabel="Toggle WhatsApp reminders"
            />
          }
        />
        <SettingRow
          label="Due Soon Alerts"
          icon="clock"
          right={
            <ToggleV2
              on={notifDueSoon}
              onChange={(v) => updateProfile({ notifDueSoon: v })}
              accessibilityLabel="Toggle due soon alerts"
            />
          }
        />
        <SettingRow
          label="Overdue Alerts"
          icon="alert-circle"
          right={
            <ToggleV2
              on={notifOverdue}
              onChange={(v) => updateProfile({ notifOverdue: v })}
              accessibilityLabel="Toggle overdue alerts"
            />
          }
        />
        <SettingRow
          label="Weekly Digest"
          icon="calendar"
          last
          right={
            <ToggleV2
              on={notifWeeklyDigest}
              onChange={(v) => updateProfile({ notifWeeklyDigest: v })}
              accessibilityLabel="Toggle weekly digest"
            />
          }
        />
      </SettingSection>

      {/* App info + sign out */}
      <SettingSection title="App">
        <SettingRow label="Version" sub={`GoCheck v${APP_VERSION}`} icon="info" />
        <Pressable
          style={({ pressed }) => [styles.signOutRow, pressed && styles.pressed]}
          onPress={confirmSignOut}
        >
          <View style={styles.signOutIconWrap}>
            <Feather name="log-out" size={18} color={colors.error} />
          </View>
          <Text style={styles.signOutLabel}>Sign Out</Text>
        </Pressable>
      </SettingSection>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[4],
  },
  headerTitle: {
    fontFamily: typography.sansBold,
    fontSize: fontSize.xl,
    letterSpacing: -0.5,
  },
  profileCard: {
    marginHorizontal: spacing[4],
    marginBottom: spacing[4],
    borderRadius: radius.xl,
    padding: spacing[5],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    ...shadow.sm,
  },
  avatarWrapper: {
    alignItems: 'center',
    gap: spacing[1],
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  avatarFallback: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: typography.sansBold,
    fontSize: fontSize.xl,
    color: colors.white,
  },
  organizerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  organizerBadgeText: {
    fontFamily: typography.sansMedium,
    fontSize: fontSize['2xs'],
    color: colors.primary,
  },
  profileInfo: {
    flex: 1,
    gap: spacing[1],
  },
  profileName: {
    fontFamily: typography.sansBold,
    fontSize: fontSize.md,
    letterSpacing: -0.3,
  },
  profileEmail: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.sm,
  },
  rowValue: {
    fontFamily: typography.sansMedium,
    fontSize: fontSize.base,
    color: colors.textSecondary,
  },
  signOutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3.5],
    gap: spacing[3],
  },
  pressed: {
    backgroundColor: colors.errorSurface,
  },
  signOutIconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: colors.errorSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutLabel: {
    fontFamily: typography.sansMedium,
    fontSize: fontSize.base,
    color: colors.error,
    flex: 1,
  },
});
