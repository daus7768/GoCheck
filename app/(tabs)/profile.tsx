import { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, Image, StyleSheet,
  TouchableOpacity, Alert, Switch, Modal, FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { useTheme, type ThemeColors } from '../../src/theme/ThemeContext';
import { useProfileStore, SECURE_KEYS } from '../../src/store/profileStore';
import {
  autoLockLabel,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHOD_SUBTITLES,
  SUPPORTED_CURRENCIES,
  CURRENCY_SYMBOLS,
  CURRENCY_LABELS,
  type PaymentMethodKey,
} from '../../src/types';
import { typography, fontSize, spacing, radius } from '../../src/theme/tokens';

// ─── Reusable Components ──────────────────────────────────────────────────────

function SectionHeader({ title, colors }: { title: string; colors: ThemeColors }) {
  return (
    <Text style={{
      fontFamily: typography.sansSemiBold,
      fontSize: fontSize.xs,
      color: colors.textTertiary,
      letterSpacing: 0.8,
      textTransform: 'uppercase' as const,
      paddingHorizontal: spacing[5],
      paddingTop: spacing[5],
      paddingBottom: spacing[2],
    }}>{title}</Text>
  );
}

function SettingsCard({ children, colors }: { children: React.ReactNode; colors: ThemeColors }) {
  return (
    <View style={{
      marginHorizontal: spacing[4],
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden' as const,
    }}>{children}</View>
  );
}

interface ToggleRowProps {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  colors: ThemeColors;
  badgeText?: string;
  divider?: boolean;
}

function ToggleRow({
  icon, label, subtitle, value, onValueChange, colors, badgeText, divider = true,
}: ToggleRowProps) {
  return (
    <>
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: spacing[4], paddingVertical: spacing[3.5],
      }}>
        <View style={{
          width: 34, height: 34, borderRadius: 10,
          backgroundColor: colors.iconSurface,
          alignItems: 'center', justifyContent: 'center',
          marginRight: spacing[3],
        }}>
          <Feather name={icon} size={16} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
            <Text style={{ fontFamily: typography.sansMedium, fontSize: fontSize.base, color: colors.textPrimary }}>
              {label}
            </Text>
            {badgeText ? (
              <View style={{
                paddingHorizontal: spacing[2], paddingVertical: 2,
                backgroundColor: colors.successSurface,
                borderRadius: radius.sm,
              }}>
                <Text style={{ fontFamily: typography.sansSemiBold, fontSize: fontSize['2xs'], color: colors.success }}>
                  {badgeText}
                </Text>
              </View>
            ) : null}
          </View>
          {subtitle ? (
            <Text style={{ fontFamily: typography.sansRegular, fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 1 }}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: colors.surfaceHighlight, true: colors.primary }}
          thumbColor={colors.white}
          ios_backgroundColor={colors.surfaceHighlight}
        />
      </View>
      {divider && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginLeft: spacing[4] + 34 + spacing[3] }} />}
    </>
  );
}

interface ChevronRowProps {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  subtitle?: string;
  value?: string;
  onPress: () => void;
  colors: ThemeColors;
  divider?: boolean;
}

function ChevronRow({ icon, label, subtitle, value, onPress, colors, divider = true }: ChevronRowProps) {
  return (
    <>
      <TouchableOpacity
        style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[4], paddingVertical: spacing[3.5] }}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View style={{
          width: 34, height: 34, borderRadius: 10,
          backgroundColor: colors.iconSurface,
          alignItems: 'center', justifyContent: 'center',
          marginRight: spacing[3],
        }}>
          <Feather name={icon} size={16} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: typography.sansMedium, fontSize: fontSize.base, color: colors.textPrimary }}>{label}</Text>
          {subtitle ? (
            <Text style={{ fontFamily: typography.sansRegular, fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 1 }}>{subtitle}</Text>
          ) : null}
        </View>
        {value ? (
          <Text style={{ fontFamily: typography.sansRegular, fontSize: fontSize.sm, color: colors.textSecondary, marginRight: spacing[2] }}>{value}</Text>
        ) : null}
        <Feather name="chevron-right" size={16} color={colors.textTertiary} />
      </TouchableOpacity>
      {divider && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginLeft: spacing[4] + 34 + spacing[3] }} />}
    </>
  );
}

const PAYMENT_METHODS: { key: PaymentMethodKey; icon: React.ComponentProps<typeof Feather>['name'] }[] = [
  { key: 'duitnow', icon: 'smartphone' },
  { key: 'card', icon: 'credit-card' },
  { key: 'paypal', icon: 'dollar-sign' },
  { key: 'bank', icon: 'server' },
];

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { colors, isDark, toggleDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const profile = useProfileStore(s => s.profile);
  const security = useProfileStore(s => s.security);
  const isGuest = useProfileStore(s => s.isGuest);
  const signOut = useProfileStore(s => s.signOut);
  const updateProfile = useProfileStore(s => s.updateProfile);
  const updateSecuritySetting = useProfileStore(s => s.updateSecuritySetting);
  const [currencySheetOpen, setCurrencySheetOpen] = useState(false);
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const avatarChar = (profile?.displayName ?? 'U').charAt(0).toUpperCase();
  const paymentMethods = profile?.paymentMethods ?? [];

  function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
    ]);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.navHeader}>
        <Text style={styles.navTitle}>Profile</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing[8] }}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar + name */}
        <View style={styles.avatarSection}>
          {profile?.avatarUrl ? (
            <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarChar}>{avatarChar}</Text>
            </View>
          )}
          <Text style={styles.displayName}>{profile?.displayName ?? 'Loading…'}</Text>
          <Text style={styles.emailText}>
            {isGuest ? 'Guest organizer · Local only' : 'Organizer · Connected'}
          </Text>
        </View>

        {/* SECURITY */}
        <SectionHeader title="Security" colors={colors} />
        <SettingsCard colors={colors}>
          <ToggleRow
            icon="activity"
            label="Biometric unlock"
            subtitle="Face ID / Touch ID on launch"
            value={security.biometricEnabled}
            colors={colors}
            onValueChange={async (val) => {
              if (val) {
                const compatible = await LocalAuthentication.hasHardwareAsync();
                const enrolled = await LocalAuthentication.isEnrolledAsync();
                if (!compatible || !enrolled) {
                  Alert.alert('Not Available', 'Biometric authentication is not set up on this device.');
                  return;
                }
                const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Confirm to enable biometric unlock' });
                if (!result.success) return;
              }
              await updateSecuritySetting('biometricEnabled', val);
            }}
          />
          <ToggleRow
            icon="lock"
            label="PIN code"
            subtitle={security.pinEnabled ? '4-digit PIN set' : 'Tap to set up a PIN'}
            value={security.pinEnabled}
            badgeText={security.pinEnabled ? 'Active' : undefined}
            colors={colors}
            onValueChange={async (val) => {
              if (val) {
                router.push('/(modals)/pin-setup');
              } else {
                Alert.alert('Remove PIN', 'Are you sure you want to remove your PIN?', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Remove', style: 'destructive', onPress: async () => {
                      try {
                        await SecureStore.deleteItemAsync(SECURE_KEYS.pinHash);
                      } catch (e) {
                        console.warn('[PIN] SecureStore unavailable:', e);
                      }
                      await updateSecuritySetting('pinEnabled', false);
                    },
                  },
                ]);
              }
            }}
          />
          <ChevronRow
            icon="clock"
            label="Auto-lock"
            subtitle={autoLockLabel(security.autoLockDuration)}
            onPress={() => router.push('/(modals)/auto-lock-settings')}
            colors={colors}
            divider={false}
          />
        </SettingsCard>

        {/* NOTIFICATIONS */}
        <SectionHeader title="Notifications" colors={colors} />
        <SettingsCard colors={colors}>
          <ToggleRow
            icon="bell"
            label="Push notifications"
            value={profile?.notifPush ?? true}
            colors={colors}
            onValueChange={async (val) => {
              if (val) {
                const { status } = await Notifications.requestPermissionsAsync();
                if (status !== 'granted') {
                  Alert.alert('Permission Denied', 'Enable notifications in your device settings.');
                  return;
                }
              }
              await updateProfile({ notifPush: val });
            }}
          />
          <ToggleRow
            icon="mail"
            label="Email alerts"
            value={profile?.notifEmail ?? true}
            colors={colors}
            onValueChange={(val) => updateProfile({ notifEmail: val })}
          />
          <ToggleRow
            icon="message-circle"
            label="WhatsApp linked"
            subtitle="Send reminders via WhatsApp"
            value={profile?.notifWhatsapp ?? false}
            colors={colors}
            onValueChange={(val) => updateProfile({ notifWhatsapp: val })}
          />
          <ToggleRow
            icon="calendar"
            label="Due-soon alerts"
            subtitle="3 days before each bill is due"
            value={profile?.notifDueSoon ?? true}
            colors={colors}
            onValueChange={(val) => updateProfile({ notifDueSoon: val })}
          />
          <ToggleRow
            icon="alert-circle"
            label="Overdue alerts"
            value={profile?.notifOverdue ?? true}
            colors={colors}
            onValueChange={(val) => updateProfile({ notifOverdue: val })}
          />
          <ToggleRow
            icon="refresh-cw"
            label="Weekly digest"
            subtitle="Sundays at 6 PM"
            value={profile?.notifWeeklyDigest ?? false}
            colors={colors}
            onValueChange={(val) => updateProfile({ notifWeeklyDigest: val })}
            divider={false}
          />
        </SettingsCard>

        {/* PAYMENT METHODS */}
        <SectionHeader title="Payment Methods" colors={colors} />
        <SettingsCard colors={colors}>
          {PAYMENT_METHODS.map((method, idx, arr) => (
            <ToggleRow
              key={method.key}
              icon={method.icon}
              label={PAYMENT_METHOD_LABELS[method.key]}
              subtitle={PAYMENT_METHOD_SUBTITLES[method.key]}
              value={paymentMethods.includes(method.key)}
              colors={colors}
              divider={idx < arr.length - 1}
              onValueChange={(val) => {
                const next = val
                  ? [...paymentMethods, method.key]
                  : paymentMethods.filter(k => k !== method.key);
                updateProfile({ paymentMethods: next });
              }}
            />
          ))}
        </SettingsCard>

        {/* BILLS */}
        <SectionHeader title="Bills" colors={colors} />
        <SettingsCard colors={colors}>
          <ChevronRow
            icon="repeat"
            label="Recurring bills"
            subtitle="Manage reminders & recurring bills"
            onPress={() => router.push('/(modals)/reminders')}
            colors={colors}
          />
          <ChevronRow
            icon="globe"
            label="Default currency"
            value={profile?.defaultCurrency ?? 'MYR'}
            onPress={() => setCurrencySheetOpen(true)}
            colors={colors}
          />
          <ToggleRow
            icon="moon"
            label="Dark mode"
            value={isDark}
            colors={colors}
            divider={false}
            onValueChange={(val) => {
              toggleDark();
              updateProfile({ darkMode: val });
            }}
          />
        </SettingsCard>

        {/* CONNECTIVITY */}
        <SectionHeader title="Connectivity" colors={colors} />
        <SettingsCard colors={colors}>
          <ToggleRow
            icon="wifi-off"
            label="Offline mode"
            subtitle="Queue actions until back online"
            value={profile?.offlineMode ?? false}
            colors={colors}
            divider={false}
            onValueChange={(val) => updateProfile({ offlineMode: val })}
          />
        </SettingsCard>

        {/* Sign out */}
        <View style={{ paddingHorizontal: spacing[4], marginTop: spacing[6] }}>
          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut} activeOpacity={0.8}>
            <Feather name="log-out" size={16} color={colors.error} />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.versionText}>GoCheck v1.0.0</Text>
      </ScrollView>

      {/* Currency picker */}
      <Modal
        visible={currencySheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setCurrencySheetOpen(false)}
      >
        <View style={styles.sheetOverlay}>
          <View style={[styles.sheet, { backgroundColor: colors.surfaceElevated }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Default Currency</Text>
            <FlatList
              data={SUPPORTED_CURRENCIES}
              keyExtractor={c => c}
              renderItem={({ item }) => {
                const isSelected = (profile?.defaultCurrency ?? 'MYR') === item;
                return (
                  <TouchableOpacity
                    style={[styles.currencyRow, isSelected && { backgroundColor: colors.primarySurface }]}
                    onPress={() => {
                      updateProfile({ defaultCurrency: item });
                      setCurrencySheetOpen(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.currencyCode, isSelected && { color: colors.primary }]}>
                      {item}
                    </Text>
                    <Text style={styles.currencyLabel}>{CURRENCY_LABELS[item]}</Text>
                    <Text style={[styles.currencySymbol, isSelected && { color: colors.primary }]}>
                      {CURRENCY_SYMBOLS[item]}
                    </Text>
                    {isSelected && <Feather name="check" size={16} color={colors.primary} />}
                  </TouchableOpacity>
                );
              }}
            />
            <TouchableOpacity style={[styles.sheetCancel, { backgroundColor: colors.surface }]} onPress={() => setCurrencySheetOpen(false)}>
              <Text style={{ fontFamily: typography.sansMedium, fontSize: fontSize.base, color: colors.textPrimary }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    navHeader: {
      paddingHorizontal: spacing[5],
      paddingVertical: spacing[5],
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    navTitle: {
      fontFamily: typography.sansBold,
      fontSize: fontSize.xl,
      color: colors.textPrimary,
    },
    scroll: { flex: 1 },
    avatarSection: {
      alignItems: 'center',
      paddingTop: spacing[8],
      paddingBottom: spacing[6],
    },
    avatar: { width: 80, height: 80, borderRadius: 40, marginBottom: spacing[3] },
    avatarFallback: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    avatarChar: { fontFamily: typography.sansBold, fontSize: fontSize['3xl'], color: '#FFF' },
    displayName: {
      fontFamily: typography.sansBold,
      fontSize: fontSize.lg,
      color: colors.textPrimary,
      marginBottom: spacing[0.5],
    },
    emailText: {
      fontFamily: typography.sansRegular,
      fontSize: fontSize.sm,
      color: colors.textSecondary,
    },
    signOutButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing[2],
      paddingVertical: spacing[4],
      borderRadius: radius.lg,
      borderWidth: 1.5,
      borderColor: colors.error,
      backgroundColor: colors.errorSurface,
    },
    signOutText: {
      fontFamily: typography.sansSemiBold,
      fontSize: fontSize.base,
      color: colors.error,
    },
    versionText: {
      fontFamily: typography.sansRegular,
      fontSize: fontSize.xs,
      color: colors.textTertiary,
      textAlign: 'center',
      marginTop: spacing[5],
    },
    sheetOverlay: {
      flex: 1, justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.4)',
    },
    sheet: {
      borderTopLeftRadius: radius['2xl'],
      borderTopRightRadius: radius['2xl'],
      paddingTop: spacing[2],
      paddingBottom: spacing[6],
      maxHeight: '70%',
    },
    sheetHandle: {
      width: 36, height: 4, borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: 'center', marginBottom: spacing[4],
    },
    sheetTitle: {
      fontFamily: typography.sansBold, fontSize: fontSize.lg,
      color: colors.textPrimary,
      paddingHorizontal: spacing[5], marginBottom: spacing[3],
    },
    currencyRow: {
      flexDirection: 'row', alignItems: 'center', gap: spacing[3],
      paddingHorizontal: spacing[5], paddingVertical: spacing[3.5],
    },
    currencyCode: {
      fontFamily: typography.sansSemiBold, fontSize: fontSize.base,
      color: colors.textPrimary, width: 40,
    },
    currencyLabel: {
      fontFamily: typography.sansRegular, fontSize: fontSize.sm,
      color: colors.textSecondary, flex: 1,
    },
    currencySymbol: {
      fontFamily: typography.sansMedium, fontSize: fontSize.base,
      color: colors.textSecondary,
    },
    sheetCancel: {
      marginHorizontal: spacing[4], marginTop: spacing[3],
      paddingVertical: spacing[4], borderRadius: radius.lg,
      alignItems: 'center', borderWidth: 1, borderColor: colors.border,
    },
  });
}
