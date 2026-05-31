import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Image,
  Modal,
  TextInput,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors, typography, fontSize, spacing, radius, shadow } from '../../src/theme/tokens';
import { useTheme } from '../../src/theme/ThemeContext';
import { useProfileStore } from '../../src/store/profileStore';
import { SettingSection } from '../../src/components/profile/SettingSection';
import { SettingRow } from '../../src/components/profile/SettingRow';
import { ToggleV2 } from '../../src/components/profile/ToggleV2';
import { GlowingCard } from '../../src/components/effects/GlowingCard';
import { haptic } from '../../src/lib/haptics';
import { uploadAvatarPhoto } from '../../src/lib/supabase';
import {
  CURRENCY_SYMBOLS,
  CURRENCY_LABELS,
  SUPPORTED_CURRENCIES,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHOD_SUBTITLES,
  type Currency,
  type PaymentMethodKey,
} from '../../src/types';

const APP_VERSION = '2.0';

const ALL_PAYMENT_METHODS: PaymentMethodKey[] = ['duitnow', 'card', 'paypal', 'bank_transfer'];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { colors: c } = useTheme();
  const { session, profile, updateProfile, signOut } = useProfileStore();

  const [editingName, setEditingName] = useState(false);
  const [pickingCurrency, setPickingCurrency] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [avatarBusy, setAvatarBusy] = useState(false);

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

  function openCurrencyPicker() {
    haptic.selection();
    setPickingCurrency(true);
  }

  function selectCurrency(next: Currency) {
    haptic.selection();
    setPickingCurrency(false);
    if (next !== defaultCurrency) {
      void updateProfile({ defaultCurrency: next }).catch((err) => {
        Alert.alert('Could not save', String(err?.message ?? err));
      });
    }
  }

  function openNameEditor() {
    haptic.selection();
    setNameDraft(displayName);
    setEditingName(true);
  }

  async function saveDisplayName() {
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      setEditingName(false);
      return;
    }
    setEditingName(false);
    try {
      await updateProfile({ displayName: trimmed });
    } catch (err) {
      Alert.alert('Could not save', String((err as Error)?.message ?? err));
    }
  }

  async function pickAvatar() {
    if (!session?.user?.id || avatarBusy) return;
    haptic.selection();
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert('Permission needed', 'Allow photo access to change your avatar.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (result.canceled || !result.assets[0]) return;
      setAvatarBusy(true);
      const url = await uploadAvatarPhoto(session.user.id, result.assets[0].uri);
      await updateProfile({ avatarUrl: url });
    } catch (err) {
      Alert.alert('Could not update avatar', String((err as Error)?.message ?? err));
    } finally {
      setAvatarBusy(false);
    }
  }

  function togglePaymentMethod(key: PaymentMethodKey) {
    haptic.selection();
    const next = paymentMethods.includes(key)
      ? paymentMethods.filter((k) => k !== key)
      : [...paymentMethods, key];
    void updateProfile({ paymentMethods: next }).catch((err) => {
      Alert.alert('Could not save', String(err?.message ?? err));
    });
  }

  function setBoolPref(patch: Record<string, boolean>) {
    haptic.selection();
    void updateProfile(patch).catch((err) => {
      Alert.alert('Could not save', String(err?.message ?? err));
    });
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
            void signOut();
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

      {/* Profile card with glowing border */}
      <View style={styles.profileCardWrap}>
        <GlowingCard radius={radius.xl} color={colors.primary} background={c.surface} innerPadding={0}>
          <View style={styles.profileCardInner}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Change avatar"
              onPress={pickAvatar}
              style={styles.avatarWrapper}
              disabled={avatarBusy}
            >
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatarFallback, { backgroundColor: colors.primary }]}>
                  <Text style={styles.avatarInitial}>{initial}</Text>
                </View>
              )}
              <View style={[styles.avatarBadge, { backgroundColor: colors.primary }]}>
                {avatarBusy ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Feather name="camera" size={11} color={colors.white} />
                )}
              </View>
              <View style={[styles.organizerBadge, { backgroundColor: c.primarySurface }]}>
                <Feather name="shield" size={10} color={colors.primary} />
                <Text style={styles.organizerBadgeText}>Organizer</Text>
              </View>
            </Pressable>

            <View style={styles.profileInfo}>
              <Pressable
                onPress={openNameEditor}
                accessibilityRole="button"
                accessibilityLabel="Edit display name"
                style={styles.namePressable}
              >
                <Text style={[styles.profileName, { color: c.textPrimary }]} numberOfLines={1}>
                  {displayName}
                </Text>
                <Feather name="edit-2" size={13} color={c.textSecondary} />
              </Pressable>
              {email ? (
                <Text style={[styles.profileEmail, { color: c.textSecondary }]} numberOfLines={1}>
                  {email}
                </Text>
              ) : null}
            </View>
          </View>
        </GlowingCard>
      </View>

      {/* Account section */}
      <SettingSection title="Account">
        <SettingRow
          label="Default Currency"
          sub={`${CURRENCY_LABELS[defaultCurrency]} (${symbol})`}
          onPress={openCurrencyPicker}
          icon="dollar-sign"
          right={<Text style={[styles.rowValue, { color: c.textSecondary }]}>{symbol}</Text>}
        />
        <SettingRow
          label="Dark Mode"
          icon="moon"
          last
          right={
            <ToggleV2
              on={darkMode}
              onChange={(v) => setBoolPref({ darkMode: v })}
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
              onChange={(v) => setBoolPref({ notifPush: v })}
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
              onChange={(v) => setBoolPref({ notifEmail: v })}
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
              onChange={(v) => setBoolPref({ notifWhatsapp: v })}
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
              onChange={(v) => setBoolPref({ notifDueSoon: v })}
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
              onChange={(v) => setBoolPref({ notifOverdue: v })}
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
              onChange={(v) => setBoolPref({ notifWeeklyDigest: v })}
              accessibilityLabel="Toggle weekly digest"
            />
          }
        />
      </SettingSection>

      {/* App info + sign out */}
      <SettingSection title="App" accent={colors.error}>
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

      {/* Display name editor */}
      <Modal
        visible={editingName}
        transparent
        animationType={Platform.OS === 'web' ? 'fade' : 'fade'}
        onRequestClose={() => setEditingName(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setEditingName(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: c.surface }]} onPress={() => {}}>
            <Text style={[styles.modalTitle, { color: c.textPrimary }]}>Display name</Text>
            <Text style={[styles.modalSub, { color: c.textSecondary }]}>
              Shown to people you split bills with.
            </Text>
            <TextInput
              value={nameDraft}
              onChangeText={setNameDraft}
              placeholder="Your name"
              placeholderTextColor={c.textTertiary}
              autoFocus
              maxLength={50}
              style={[styles.modalInput, { borderColor: c.border, color: c.textPrimary }]}
              onSubmitEditing={saveDisplayName}
              returnKeyType="done"
            />
            <View style={styles.modalRow}>
              <Pressable style={styles.modalBtnGhost} onPress={() => setEditingName(false)}>
                <Text style={[styles.modalBtnText, { color: c.textSecondary }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtnPrimary, { backgroundColor: colors.primary }]}
                onPress={saveDisplayName}
              >
                <Text style={[styles.modalBtnText, { color: colors.white }]}>Save</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Currency picker */}
      <Modal
        visible={pickingCurrency}
        transparent
        animationType="fade"
        onRequestClose={() => setPickingCurrency(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setPickingCurrency(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: c.surface }]} onPress={() => {}}>
            <Text style={[styles.modalTitle, { color: c.textPrimary }]}>Default currency</Text>
            <Text style={[styles.modalSub, { color: c.textSecondary }]}>
              Used as the default when you create a new bill.
            </Text>
            <View style={styles.currencyList}>
              {SUPPORTED_CURRENCIES.map((cur, i) => {
                const isActive = cur === defaultCurrency;
                return (
                  <Pressable
                    key={cur}
                    onPress={() => selectCurrency(cur)}
                    style={[
                      styles.currencyRow,
                      i !== SUPPORTED_CURRENCIES.length - 1 && {
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: c.divider,
                      },
                    ]}
                  >
                    <View style={[styles.currencyBadge, { backgroundColor: c.primarySurface }]}>
                      <Text style={[styles.currencySymbol, { color: colors.primary }]}>
                        {CURRENCY_SYMBOLS[cur]}
                      </Text>
                    </View>
                    <View style={styles.currencyTextWrap}>
                      <Text style={[styles.currencyName, { color: c.textPrimary }]}>
                        {CURRENCY_LABELS[cur]}
                      </Text>
                      <Text style={[styles.currencyCode, { color: c.textSecondary }]}>{cur}</Text>
                    </View>
                    {isActive && <Feather name="check" size={18} color={colors.primary} />}
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  profileCardWrap: {
    marginHorizontal: spacing[4],
    marginBottom: spacing[4],
    ...shadow.sm,
  },
  profileCardInner: {
    padding: spacing[5],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
  },
  avatarWrapper: {
    alignItems: 'center',
    gap: spacing[1],
    position: 'relative',
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
  avatarBadge: {
    position: 'absolute',
    top: 44,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  organizerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: radius.full,
    marginTop: 4,
  },
  organizerBadgeText: {
    fontFamily: typography.sansMedium,
    fontSize: fontSize['2xs'],
    color: colors.primary,
  },
  profileInfo: {
    flex: 1,
    gap: spacing[1],
    minWidth: 0,
  },
  namePressable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  profileName: {
    fontFamily: typography.sansBold,
    fontSize: fontSize.md,
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  profileEmail: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.sm,
  },
  rowValue: {
    fontFamily: typography.sansMedium,
    fontSize: fontSize.base,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[5],
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radius.xl,
    padding: spacing[5],
    gap: spacing[3],
    ...shadow.lg,
  },
  modalTitle: {
    fontFamily: typography.sansBold,
    fontSize: fontSize.md,
  },
  modalSub: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.sm,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    fontFamily: typography.sansMedium,
    fontSize: fontSize.base,
    marginTop: spacing[1],
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing[2],
    marginTop: spacing[2],
  },
  modalBtnGhost: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2.5],
    borderRadius: radius.md,
  },
  modalBtnPrimary: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2.5],
    borderRadius: radius.md,
  },
  modalBtnText: {
    fontFamily: typography.sansMedium,
    fontSize: fontSize.base,
  },
  currencyList: {
    marginTop: spacing[2],
  },
  currencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
  },
  currencyBadge: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currencySymbol: {
    fontFamily: typography.sansBold,
    fontSize: fontSize.base,
  },
  currencyTextWrap: {
    flex: 1,
  },
  currencyName: {
    fontFamily: typography.sansMedium,
    fontSize: fontSize.base,
  },
  currencyCode: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.xs,
    marginTop: 1,
  },
});
