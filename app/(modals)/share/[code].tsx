import { useEffect, useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
  Image,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { format } from 'date-fns';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { getBillByShareLink, supabase } from '../../../src/lib/supabase';
import { colors, typography, fontSize, spacing, radius, shadow } from '../../../src/theme/tokens';
import type { Currency, PaymentFlowStatus } from '../../../src/types';
import { CURRENCY_SYMBOLS } from '../../../src/types';
import { AppText } from '../../../src/components/AppText';
import { BeamBackdrop } from '../../../src/components/effects/BeamBackdrop';
import { ColourfulText } from '../../../src/components/effects/ColourfulText';
import { participantUrl } from '../../../src/lib/urls';
import { getCanonicalBase } from '../../../src/lib/share';
import { setOgTags } from '../../../src/lib/ogTags';

interface BillData {
  id: string;
  title: string;
  description: string | null;
  total_amount: number;
  currency: Currency;
  due_date: string;
  status: string;
  share_link: string;
  invoice_number: string | null;
  payment_method: string | null;
  payment_details: string | null;
  organizer_display_name: string;
  participants: Array<{
    id: string;
    name: string;
    amount: number;
    is_paid: boolean;
    paid_at: string | null;
    avatar_color: string;
    access_token: string | null;
    payment_status: PaymentFlowStatus;
  }>;
}

const paymentMethodLabel: Record<string, string> = {
  duitnow: 'DuitNow',
  bank_transfer: 'Bank transfer',
  ewallet: 'eWallet / TNG',
  cash: 'Cash',
};

function readableDate(value?: string, pattern = 'd MMM yyyy'): string {
  if (!value) return 'Not set';
  return format(new Date(value), pattern);
}

function statusTone(status: PaymentFlowStatus) {
  if (status === 'pending') return { bg: '#FFF7ED', fg: '#B45309', icon: 'clock' as const, label: 'Under review' };
  if (status === 'confirmed') return { bg: '#ECFDF5', fg: '#059669', icon: 'check-circle' as const, label: 'Paid' };
  if (status === 'rejected') return { bg: '#FEF2F2', fg: '#DC2626', icon: 'alert-circle' as const, label: 'Needs resubmission' };
  return { bg: '#EEF2FF', fg: colors.primary, icon: 'credit-card' as const, label: 'Unpaid' };
}

export default function ShareBillScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const insets = useSafeAreaInsets();
  const [bill, setBill] = useState<BillData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!code) return;
    setError(null);
    setLoading(true);
    try {
      const data = await getBillByShareLink(code);
      setBill(data as BillData);
    } catch {
      setError('Bill not found or link is invalid.');
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => { load(); }, [load]);

  // Realtime: when any participant of this bill changes, refresh.
  useEffect(() => {
    if (!bill?.id) return;
    const channel = supabase
      .channel(`group-share:${bill.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'participants',
        filter: `bill_id=eq.${bill.id}`,
      }, () => { load(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [bill?.id, load]);

  // OpenGraph tags for link previews (web only).
  useEffect(() => {
    if (!bill || Platform.OS !== 'web') return;
    const symbol = CURRENCY_SYMBOLS[bill.currency] ?? bill.currency;
    const paidCount = bill.participants.filter((p) => p.payment_status === 'confirmed').length;
    const totalCount = bill.participants.length;
    // Use the canonical base (not window.location.origin) so Vercel preview
    // deployments don't poison crawler caches with their preview host.
    const canonical = getCanonicalBase();
    setOgTags({
      title: `${bill.title} — Split with ${bill.organizer_display_name} · GoCheck`,
      description: `${paidCount}/${totalCount} paid · ${symbol}${bill.total_amount.toFixed(2)} due ${readableDate(bill.due_date)}`,
      image: `${canonical}/assets/og-banner.png`,
      url: `${canonical}/share/${bill.share_link}`,
    });
  }, [bill]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <BeamBackdrop />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !bill) {
    return (
      <View style={styles.centered}>
        <BeamBackdrop />
        <Feather name="alert-circle" size={48} color={colors.error} />
        <AppText style={styles.errorTitle}>Bill not found</AppText>
        <AppText style={styles.errorText}>{error ?? 'This link is no longer valid.'}</AppText>
        <Pressable style={styles.retry} onPress={() => router.back()}>
          <AppText style={styles.retryText}>Go back</AppText>
        </Pressable>
      </View>
    );
  }

  const symbol = CURRENCY_SYMBOLS[bill.currency] ?? bill.currency;
  const paidCount = bill.participants.filter((p) => p.payment_status === 'confirmed').length;
  const totalCount = bill.participants.length;
  const amountCollected = bill.participants
    .filter((p) => p.payment_status === 'confirmed')
    .reduce((sum, p) => sum + p.amount, 0);
  const percent = totalCount > 0 ? Math.round((paidCount / totalCount) * 100) : 0;

  function openParticipantPage(token: string) {
    const url = participantUrl(token);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.href = url;
    } else {
      router.push(`/p/${token}` as any);
    }
  }

  return (
    <View style={styles.root}>
      <BeamBackdrop />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + spacing[5], paddingBottom: insets.bottom + spacing[8] },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Brand header */}
        <Animated.View entering={FadeIn.duration(300)} style={styles.brand}>
          <View style={styles.brandLeft}>
            <Image source={require('../../../assets/logo_v2.png')} style={styles.logo} />
            <View style={styles.brandTextBlock}>
              <ColourfulText
                text="GoCheck"
                style={styles.brandName}
                palette={['#FFFFFF', '#A5B4FC', '#67E8F9', '#86EFAC', '#FDE68A']}
                duration={3600}
                containerStyle={styles.brandNameRow}
              />
              <AppText style={styles.brandSub}>Group bill</AppText>
            </View>
          </View>
          <View style={styles.statusPill}>
            <Feather name="users" size={13} color={colors.primary} />
            <AppText style={styles.statusPillText} numberOfLines={1}>
              {totalCount} participant{totalCount === 1 ? '' : 's'}
            </AppText>
          </View>
        </Animated.View>

        {/* Invoice card */}
        <Animated.View entering={FadeInUp.delay(80).duration(350)} style={styles.invoiceCard}>
          <View style={styles.invoiceHeader}>
            <View style={styles.invoiceHeaderText}>
              <AppText style={styles.invoiceLabel}>BILL INVOICE</AppText>
              <AppText style={styles.invoiceTitle} numberOfLines={2}>{bill.title}</AppText>
              {bill.description ? (
                <AppText style={styles.invoiceDescription} numberOfLines={3}>{bill.description}</AppText>
              ) : null}
            </View>
            <View style={styles.invoiceNumberBlock}>
              <AppText style={styles.invoiceNumberLabel}>Invoice</AppText>
              <AppText style={styles.invoiceNumber} numberOfLines={1}>
                {bill.invoice_number ?? bill.share_link.slice(0, 8).toUpperCase()}
              </AppText>
            </View>
          </View>

          {/* Amount panel */}
          <LinearGradient
            colors={['#111827', '#312E81', '#0F766E']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.amountPanel}
          >
            <View style={styles.amountTopRow}>
              <AppText style={styles.amountLabel}>Total amount</AppText>
              <AppText style={styles.amountDate}>{readableDate(bill.due_date)}</AppText>
            </View>
            <AppText style={styles.amount}>{symbol}{bill.total_amount.toFixed(2)}</AppText>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${percent}%` }]} />
            </View>
            <View style={styles.progressMeta}>
              <AppText style={styles.progressMetaText}>
                {symbol}{amountCollected.toFixed(2)} collected
              </AppText>
              <AppText style={styles.progressMetaText}>{percent}%</AppText>
            </View>
          </LinearGradient>

          {/* Meta grid */}
          <View style={styles.metaGrid}>
            <View style={styles.metaItem}>
              <AppText style={styles.metaLabel}>Organizer</AppText>
              <AppText style={styles.metaValue} numberOfLines={1}>{bill.organizer_display_name}</AppText>
            </View>
            <View style={styles.metaItem}>
              <AppText style={styles.metaLabel}>Due date</AppText>
              <AppText style={styles.metaValue}>{readableDate(bill.due_date)}</AppText>
            </View>
            <View style={styles.metaItem}>
              <AppText style={styles.metaLabel}>Currency</AppText>
              <AppText style={styles.metaValue}>{bill.currency}</AppText>
            </View>
            <View style={styles.metaItem}>
              <AppText style={styles.metaLabel}>Progress</AppText>
              <AppText style={styles.metaValue}>{paidCount}/{totalCount} paid</AppText>
            </View>
          </View>

          {/* Payment method (display-only) */}
          {(bill.payment_method || bill.payment_details) ? (
            <>
              <View style={styles.divider} />
              <View style={styles.paymentHeader}>
                <View style={styles.paymentIcon}>
                  <Feather name="credit-card" size={16} color={colors.primary} />
                </View>
                <View style={styles.paymentHeaderText}>
                  <AppText style={styles.sectionLabel}>Payment method</AppText>
                  {bill.payment_method ? (
                    <AppText style={styles.paymentMethod}>
                      {paymentMethodLabel[bill.payment_method] ?? bill.payment_method}
                    </AppText>
                  ) : null}
                </View>
              </View>
              {bill.payment_details ? (
                <AppText style={styles.paymentDetails}>{bill.payment_details}</AppText>
              ) : null}
            </>
          ) : null}
        </Animated.View>

        {/* Participants list */}
        <Animated.View entering={FadeInUp.delay(160).duration(350)} style={styles.participantsCard}>
          <AppText style={styles.participantsTitle}>Participants</AppText>
          {bill.participants.map((p) => {
            const tone = statusTone(p.payment_status);
            const isPaidLike = p.payment_status === 'confirmed' || p.payment_status === 'pending';
            return (
              <View key={p.id} style={styles.participantRow}>
                <View style={[styles.avatar, { backgroundColor: p.avatar_color }]}>
                  <AppText style={styles.avatarText}>{p.name.slice(0, 1).toUpperCase()}</AppText>
                  {p.payment_status === 'confirmed' ? (
                    <View style={styles.avatarPaidBadge}>
                      <Feather name="check" size={9} color={colors.white} />
                    </View>
                  ) : null}
                </View>
                <View style={styles.participantInfo}>
                  <AppText style={styles.participantName} numberOfLines={1}>{p.name}</AppText>
                  <AppText style={styles.participantAmount}>{symbol}{p.amount.toFixed(2)}</AppText>
                </View>
                <View style={styles.participantRight}>
                  <View style={[styles.toneChip, { backgroundColor: tone.bg }]}>
                    <Feather name={tone.icon} size={11} color={tone.fg} />
                    <AppText style={[styles.toneChipText, { color: tone.fg }]}>{tone.label}</AppText>
                  </View>
                  {!isPaidLike && p.access_token ? (
                    <Pressable
                      style={({ pressed }) => [styles.payMyShareBtn, pressed && { opacity: 0.85 }]}
                      onPress={() => openParticipantPage(p.access_token!)}
                      accessibilityRole="button"
                      accessibilityLabel={`Pay my share as ${p.name}`}
                    >
                      <Feather name="arrow-right" size={12} color={colors.white} />
                      <AppText style={styles.payMyShareText}>This is me — pay</AppText>
                    </Pressable>
                  ) : !isPaidLike ? (
                    <AppText style={styles.noLinkHint}>Ask organizer for your link</AppText>
                  ) : null}
                </View>
              </View>
            );
          })}
        </Animated.View>

        <AppText style={styles.footer}>Secure record by GoCheck</AppText>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#070A16' },
  scrollView: { flex: 1 },
  scroll: { paddingHorizontal: spacing[4], gap: spacing[4], width: '100%', maxWidth: 460, alignSelf: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[3], padding: spacing[6], backgroundColor: '#070A16' },
  errorTitle: { fontFamily: typography.sansBold, fontSize: fontSize.lg, color: '#FFFFFF' },
  errorText: { fontFamily: typography.sansRegular, fontSize: fontSize.base, color: 'rgba(255,255,255,0.72)', textAlign: 'center' },
  retry: { backgroundColor: colors.primary, borderRadius: radius.xl, paddingHorizontal: spacing[6], paddingVertical: spacing[3] },
  retryText: { fontFamily: typography.sansSemiBold, fontSize: fontSize.base, color: '#FFF' },

  brand: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[3] },
  brandLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], flex: 1, minWidth: 0 },
  logo: { width: 38, height: 38, borderRadius: 19 },
  brandTextBlock: { flex: 1, minWidth: 0 },
  brandNameRow: { alignSelf: 'flex-start' },
  brandName: { fontFamily: typography.sansBold, fontSize: fontSize.lg },
  brandSub: { fontFamily: typography.sansRegular, fontSize: fontSize.xs, color: 'rgba(255,255,255,0.68)' },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    backgroundColor: '#EEF2FF',
    borderRadius: radius.full,
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1.5],
    maxWidth: 180,
  },
  statusPillText: { fontFamily: typography.sansBold, fontSize: fontSize.xs, color: colors.primary, flexShrink: 1 },

  invoiceCard: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.84)',
    padding: spacing[4],
    gap: spacing[4],
    ...shadow.md,
  },
  invoiceHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing[3] },
  invoiceHeaderText: { flex: 1, minWidth: 0 },
  invoiceLabel: { fontFamily: typography.sansBold, fontSize: 10, color: colors.primary, letterSpacing: 1 },
  invoiceTitle: { fontFamily: typography.sansBold, fontSize: fontSize.xl, color: colors.textPrimary, marginTop: spacing[1] },
  invoiceDescription: { fontFamily: typography.sansRegular, fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: fontSize.sm * 1.45, marginTop: spacing[1] },
  invoiceNumberBlock: { alignItems: 'flex-end', maxWidth: 124, paddingTop: spacing[0.5] },
  invoiceNumberLabel: { fontFamily: typography.sansBold, fontSize: 10, color: colors.textSecondary, textTransform: 'uppercase' },
  invoiceNumber: { fontFamily: typography.monoMedium, fontSize: fontSize.xs, color: colors.textPrimary, marginTop: 2 },

  amountPanel: { borderRadius: radius.xl, padding: spacing[4], overflow: 'hidden', gap: spacing[2] },
  amountTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing[2] },
  amountLabel: { fontFamily: typography.sansBold, fontSize: fontSize.xs, color: 'rgba(255,255,255,0.72)', textTransform: 'uppercase' },
  amountDate: { fontFamily: typography.monoMedium, fontSize: fontSize.xs, color: 'rgba(255,255,255,0.76)' },
  amount: { fontFamily: typography.sansBold, fontSize: fontSize['4xl'], color: '#FFFFFF', marginTop: spacing[1] },
  progressTrack: { height: 8, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: radius.full, overflow: 'hidden', marginTop: spacing[2] },
  progressFill: { height: '100%', backgroundColor: '#86EFAC', borderRadius: radius.full },
  progressMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing[1] },
  progressMetaText: { fontFamily: typography.sansMedium, fontSize: fontSize.xs, color: 'rgba(255,255,255,0.85)' },

  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  metaItem: {
    flexGrow: 1,
    flexBasis: '47%',
    minWidth: 132,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
    padding: spacing[3],
    gap: spacing[1],
  },
  metaLabel: { fontFamily: typography.sansBold, fontSize: 10, color: colors.textSecondary, textTransform: 'uppercase' },
  metaValue: { fontFamily: typography.sansSemiBold, fontSize: fontSize.sm, color: colors.textPrimary },

  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  paymentHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  paymentIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primarySurface, alignItems: 'center', justifyContent: 'center' },
  paymentHeaderText: { flex: 1, minWidth: 0 },
  sectionLabel: { fontFamily: typography.sansBold, fontSize: 10, color: colors.textSecondary, letterSpacing: 1, textTransform: 'uppercase' },
  paymentMethod: { fontFamily: typography.sansBold, fontSize: fontSize.base, color: colors.textPrimary, marginTop: 2 },
  paymentDetails: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: fontSize.sm * 1.55,
    backgroundColor: colors.gray50,
    borderRadius: radius.lg,
    padding: spacing[3],
  },

  participantsCard: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.84)',
    padding: spacing[4],
    gap: spacing[2],
    ...shadow.md,
  },
  participantsTitle: { fontFamily: typography.sansBold, fontSize: fontSize.base, color: colors.textPrimary, marginBottom: spacing[1] },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[2.5],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  avatar: { width: 38, height: 38, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: typography.sansBold, fontSize: 15, color: colors.white },
  avatarPaidBadge: {
    position: 'absolute', bottom: -2, right: -2,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: colors.secondary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#FFFFFF',
  },
  participantInfo: { flex: 1, minWidth: 0 },
  participantName: { fontFamily: typography.sansSemiBold, fontSize: fontSize.sm, color: colors.textPrimary },
  participantAmount: { fontFamily: typography.monoMedium, fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  participantRight: { alignItems: 'flex-end', gap: spacing[1.5], maxWidth: 160 },
  toneChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.full, paddingHorizontal: spacing[2], paddingVertical: 3 },
  toneChipText: { fontFamily: typography.sansBold, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.3 },
  payMyShareBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing[2.5], paddingVertical: 5,
    borderRadius: radius.full,
  },
  payMyShareText: { fontFamily: typography.sansSemiBold, fontSize: 11, color: colors.white },
  noLinkHint: { fontFamily: typography.sansRegular, fontSize: 10, color: colors.textSecondary, textAlign: 'right', maxWidth: 140 },

  footer: { fontFamily: typography.sansRegular, fontSize: fontSize.xs, color: colors.textSecondary, textAlign: 'center', marginTop: spacing[4] },
});
