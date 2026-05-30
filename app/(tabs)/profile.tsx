import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { colors, typography, fontSize, spacing, radius, shadow } from '../../src/theme/tokens';
import { useSettingsStore, type PaymentMethodKey } from '../../src/store/settingsStore';
import { useBillStore } from '../../src/store/billStore';
import { SettingSection } from '../../src/components/profile/SettingSection';
import { SettingRow } from '../../src/components/profile/SettingRow';
import { ToggleV2 } from '../../src/components/profile/ToggleV2';
import { haptic, NotificationFeedbackType } from '../../src/lib/haptics';
import { CURRENCY_SYMBOLS, SUPPORTED_CURRENCIES } from '../../src/types';

const APP_VERSION = '2.0';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const {
    profileName,
    defaultCurrency,
    darkMode,
    notifications,
    security,
    paymentMethods,
    offline,
    setDefaultCurrency,
    setDarkMode,
    setNotification,
    setSecurity,
    setPaymentMethodEnabled,
    setOffline,
    reset,
  } = useSettingsStore();
  const bills = useBillStore((s) => s.bills);

  const recurringCount = bills.filter((b) => b.isRecurring).length;
  const symbol = CURRENCY_SYMBOLS[defaultCurrency];
  const initial = (profileName.trim()[0] ?? 'Y').toUpperCase();

  function cycleCurrency() {
    const idx = SUPPORTED_CURRENCIES.indexOf(defaultCurrency);
    const next = SUPPORTED_CURRENCIES[(idx + 1) % SUPPORTED_CURRENCIES.length] ?? 'MYR';
    haptic.selection();
    setDefaultCurrency(next);
  }

  function confirmReset() {
    Alert.alert(
      'Reset demo data?',
      'This restores all settings to their defaults. Your bills are not affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            haptic.notification(NotificationFeedbackType.Success);
            reset();
          },
        },
      ]
    );
  }

  const PAYMENT_ICON: Record<PaymentMethodKey, React.ComponentProps<typeof Feather>['name']> = {
    duitnow: 'smartphone',
    card: 'credit-card',
    paypal: 'dollar-sign',
    bank: 'home',
  };
  const paymentOrder: PaymentMethodKey[] = ['duitnow', 'card', 'paypal', 'bank'];

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing[2] }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile header */}
        <View style={styles.profileHeader}>
          <LinearGradient
            colors={[colors.primaryLight, colors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.avatar}
          >
            <Text style={styles.avatarInitial}>{initial}</Text>
          </LinearGradient>
          <Text style={styles.profileName}>{profileName}</Text>
          <Text style={styles.profileSub}>
            Organizer · {paymentMethods.duitnow.id}
          </Text>
        </View>

        {/* Security */}
        <SettingSection title="Security">
          <SettingRow
            icon="lock"
            label="Biometric unlock"
            sub="Face ID / Touch ID on launch"
            right={
              <ToggleV2
                on={security.biometric}
                onChange={(v) => setSecurity('biometric', v)}
                accessibilityLabel="Biometric unlock"
              />
            }
          />
          <SettingRow
            icon="key"
            label="PIN code"
            sub={security.pinSet ? '4-digit PIN set' : 'Set a 4-digit PIN'}
            right={
              <View style={[styles.badge, security.pinSet && styles.badgeActive]}>
                <Text style={[styles.badgeText, security.pinSet && styles.badgeTextActive]}>
                  {security.pinSet ? 'Active' : 'Set'}
                </Text>
              </View>
            }
            onPress={() => setSecurity('pinSet', !security.pinSet)}
          />
          <SettingRow
            icon="clock"
            label="Auto-lock"
            sub={`After ${security.autoLockMinutes} min idle`}
            right={<Feather name="chevron-right" size={16} color={colors.gray400} />}
            onPress={() =>
              setSecurity('autoLockMinutes', security.autoLockMinutes >= 15 ? 1 : security.autoLockMinutes + 4)
            }
            last
          />
        </SettingSection>

        {/* Notifications */}
        <SettingSection title="Notifications">
          <SettingRow
            icon="bell"
            label="Push notifications"
            right={
              <ToggleV2
                on={notifications.push}
                onChange={(v) => setNotification('push', v)}
                accessibilityLabel="Push notifications"
              />
            }
          />
          <SettingRow
            icon="mail"
            label="Email alerts"
            right={
              <ToggleV2
                on={notifications.email}
                onChange={(v) => setNotification('email', v)}
                accessibilityLabel="Email alerts"
              />
            }
          />
          <SettingRow
            icon="message-circle"
            label="WhatsApp linked"
            sub="Send reminders via WhatsApp"
            right={
              <ToggleV2
                on={notifications.whatsapp}
                onChange={(v) => setNotification('whatsapp', v)}
                accessibilityLabel="WhatsApp reminders"
              />
            }
          />
          <SettingRow
            icon="calendar"
            label="Due-soon alerts"
            sub="3 days before each bill is due"
            right={
              <ToggleV2
                on={notifications.dueSoon}
                onChange={(v) => setNotification('dueSoon', v)}
                accessibilityLabel="Due-soon alerts"
              />
            }
          />
          <SettingRow
            icon="alert-circle"
            label="Overdue alerts"
            right={
              <ToggleV2
                on={notifications.overdue}
                onChange={(v) => setNotification('overdue', v)}
                accessibilityLabel="Overdue alerts"
              />
            }
          />
          <SettingRow
            icon="file-text"
            label="Weekly digest"
            sub="Sundays at 6 PM"
            right={
              <ToggleV2
                on={notifications.weeklyDigest}
                onChange={(v) => setNotification('weeklyDigest', v)}
                accessibilityLabel="Weekly digest"
              />
            }
            last
          />
        </SettingSection>

        {/* Payment methods */}
        <SettingSection title="Payment methods">
          {paymentOrder.map((key, i) => {
            const m = paymentMethods[key];
            return (
              <SettingRow
                key={key}
                icon={PAYMENT_ICON[key]}
                label={m.label}
                sub={m.id}
                last={i === paymentOrder.length - 1}
                right={
                  <ToggleV2
                    on={m.enabled}
                    onChange={(v) => setPaymentMethodEnabled(key, v)}
                    accessibilityLabel={`${m.label} payment method`}
                  />
                }
              />
            );
          })}
        </SettingSection>

        {/* Bills */}
        <SettingSection title="Bills">
          <SettingRow
            icon="repeat"
            label="Recurring bills"
            sub={`${recurringCount} active recurring ${recurringCount === 1 ? 'bill' : 'bills'}`}
            right={<Feather name="chevron-right" size={16} color={colors.gray400} />}
          />
          <SettingRow
            icon="globe"
            label="Default currency"
            right={
              <Text style={styles.valueText}>
                {defaultCurrency} {symbol}
              </Text>
            }
            onPress={cycleCurrency}
          />
          <SettingRow
            icon="moon"
            label="Dark mode"
            right={
              <ToggleV2
                on={darkMode}
                onChange={setDarkMode}
                accessibilityLabel="Dark mode"
              />
            }
            last
          />
        </SettingSection>

        {/* Connectivity */}
        <SettingSection title="Connectivity">
          <SettingRow
            icon="wifi-off"
            label="Offline mode"
            sub="Queue actions until back online"
            right={
              <ToggleV2 on={offline} onChange={setOffline} accessibilityLabel="Offline mode" />
            }
            last
          />
        </SettingSection>

        {/* Reset */}
        <Pressable
          style={({ pressed }) => [styles.resetBtn, pressed && { opacity: 0.85 }]}
          onPress={confirmReset}
          accessibilityRole="button"
          accessibilityLabel="Reset demo data"
        >
          <Feather name="rotate-ccw" size={16} color={colors.textSecondary} />
          <Text style={styles.resetText}>Reset Demo Data</Text>
        </Pressable>

        <Text style={styles.footer}>
          GoCheck v{APP_VERSION} · Split it. Share it. Settle it.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: {
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[12],
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: spacing[5],
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.white,
    ...shadow.lg,
  },
  avatarInitial: {
    fontFamily: typography.sansBold,
    fontSize: fontSize['2xl'],
    color: colors.white,
  },
  profileName: {
    fontFamily: typography.sansBold,
    fontSize: fontSize.md,
    color: colors.textPrimary,
    marginTop: spacing[3],
  },
  profileSub: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  badge: {
    backgroundColor: colors.gray100,
    borderRadius: radius.full,
    paddingHorizontal: spacing[2.5],
    paddingVertical: 3,
  },
  badgeActive: { backgroundColor: colors.secondarySurface },
  badgeText: {
    fontFamily: typography.sansSemiBold,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  badgeTextActive: { color: colors.secondaryDark },
  valueText: {
    fontFamily: typography.sansMedium,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingVertical: spacing[3.5],
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    ...shadow.sm,
    marginBottom: spacing[4],
  },
  resetText: {
    fontFamily: typography.sansSemiBold,
    fontSize: fontSize.base,
    color: colors.textSecondary,
  },
  footer: {
    textAlign: 'center',
    fontFamily: typography.sansRegular,
    fontSize: fontSize['2xs'],
    color: colors.textTertiary,
  },
});
