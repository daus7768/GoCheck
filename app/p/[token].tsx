import { useEffect, useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, ActivityIndicator, Pressable, Image } from 'react-native';
import { AppText } from '../../src/components/AppText';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { format } from 'date-fns';
import { colors, typography, fontSize, spacing, radius, shadow } from '../../src/theme/tokens';
import { supabase, getParticipantView, submitPayment } from '../../src/lib/supabase';
import { SlideToConfirm } from '../../src/components/payment/SlideToConfirm';
import { ProofUpload } from '../../src/components/payment/ProofUpload';
import { ColourfulText } from '../../src/components/effects/ColourfulText';
import { BeamBackdrop } from '../../src/components/effects/BeamBackdrop';
import { CURRENCY_SYMBOLS } from '../../src/types';
import type { ParticipantView, PaymentFlowStatus } from '../../src/types';

const paymentMethodLabel: Record<NonNullable<ParticipantView['bill']['paymentMethod']>, string> = {
  duitnow: 'DuitNow',
  bank_transfer: 'Bank transfer',
  ewallet: 'eWallet / TNG',
  cash: 'Cash',
};

function money(amount: number, currency: ParticipantView['bill']['currency']) {
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;
  return `${symbol}${amount.toFixed(2)}`;
}

function readableDate(value?: string, pattern = 'd MMM yyyy') {
  if (!value) return 'Not set';
  return format(new Date(value), pattern);
}

function statusCopy(status: PaymentFlowStatus) {
  if (status === 'pending') return 'Under review';
  if (status === 'confirmed') return 'Paid';
  if (status === 'rejected') return 'Needs resubmission';
  return 'Awaiting payment';
}

function statusTone(status: PaymentFlowStatus) {
  if (status === 'pending') return { bg: '#FFF7ED', fg: '#B45309', icon: 'clock' as const };
  if (status === 'confirmed') return { bg: '#ECFDF5', fg: '#059669', icon: 'check-circle' as const };
  if (status === 'rejected') return { bg: '#FEF2F2', fg: '#DC2626', icon: 'alert-circle' as const };
  return { bg: '#EEF2FF', fg: colors.primary, icon: 'credit-card' as const };
}


export default function ParticipantPage() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<ParticipantView | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    setLoading(true);
    try {
      const v = await getParticipantView(token);
      if (!v) {
        setError('This link is no longer valid.');
      } else {
        setView(v);
      }
    } catch {
      setError('Unable to load. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  // Realtime: react to participant row updates
  useEffect(() => {
    if (!view?.participant.id) return;
    const channel = supabase
      .channel(`participant:${view.participant.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'participants',
        filter: `id=eq.${view.participant.id}`,
      }, () => { load(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [view?.participant.id, load]);

  const handleConfirm = useCallback(async () => {
    if (!token || submitting) return;
    setSubmitting(true);
    try {
      await submitPayment(token);
      await load();
    } catch {
      setError('Could not submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [token, submitting, load]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <BeamBackdrop />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !view) {
    return (
      <View style={styles.centered}>
        <BeamBackdrop />
        <Feather name="alert-circle" size={48} color={colors.error} />
        <AppText style={styles.errorTitle}>Link unavailable</AppText>
        <AppText style={styles.errorText}>{error ?? 'This link is no longer valid.'}</AppText>
        <Pressable style={styles.retry} onPress={load}>
          <AppText style={styles.retryText}>Try again</AppText>
        </Pressable>
      </View>
    );
  }

  const { participant, bill, organizer } = view;
  const canSwipe = participant.paymentStatus === 'unpaid' || participant.paymentStatus === 'rejected';
  const tone = statusTone(participant.paymentStatus);
  const paidCount = view.socialProof?.paidCount ?? 0;
  const totalCount = view.socialProof?.totalCount ?? 0;

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
        <Animated.View entering={FadeIn.duration(300)} style={styles.brand}>
          <View style={styles.brandLeft}>
            <Image source={require('../../assets/logo.png')} style={styles.logo} />
            <View style={styles.brandTextBlock}>
              <ColourfulText
                text="GoCheck"
                style={styles.brandName}
                palette={['#FFFFFF', '#A5B4FC', '#67E8F9', '#86EFAC', '#FDE68A']}
                duration={3600}
                containerStyle={styles.brandNameRow}
              />
              <AppText style={styles.brandSub}>Secure payment request</AppText>
            </View>
          </View>
          <View style={[styles.statusPill, { backgroundColor: tone.bg }]}>
            <Feather name={tone.icon} size={13} color={tone.fg} />
            <AppText style={[styles.statusPillText, { color: tone.fg }]} numberOfLines={1}>
              {statusCopy(participant.paymentStatus)}
            </AppText>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(80).duration(350)} style={styles.invoiceCard}>
          <View style={styles.invoiceHeader}>
            <View style={styles.invoiceHeaderText}>
              <AppText style={styles.invoiceLabel}>PAYMENT INVOICE</AppText>
              <AppText style={styles.invoiceTitle} numberOfLines={2}>{bill.title}</AppText>
              {bill.description && (
                <AppText style={styles.invoiceDescription} numberOfLines={3}>{bill.description}</AppText>
              )}
            </View>
            <View style={styles.invoiceNumberBlock}>
              <AppText style={styles.invoiceNumberLabel}>Invoice</AppText>
              <AppText style={styles.invoiceNumber} numberOfLines={1}>
                {bill.invoiceNumber ?? 'Pending'}
              </AppText>
            </View>
          </View>

          <LinearGradient
            colors={['#111827', '#312E81', '#0F766E']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.amountPanel}
          >
            <View style={styles.amountTopRow}>
              <AppText style={styles.amountLabel}>Amount due</AppText>
              <AppText style={styles.amountDate}>{readableDate(bill.dueDate)}</AppText>
            </View>
            <AppText style={styles.amount}>{money(participant.amount, bill.currency)}</AppText>
            {participant.confirmedAt ? (
              <AppText style={styles.amountSub}>Confirmed on {readableDate(participant.confirmedAt, 'd MMM yyyy, HH:mm')}</AppText>
            ) : participant.rejectedReason ? (
              <AppText style={styles.amountSub}>{participant.rejectedReason}</AppText>
            ) : (
              <AppText style={styles.amountSub}>Your share for {organizer.displayName}'s bill</AppText>
            )}
          </LinearGradient>

          <View style={styles.metaGrid}>
            <View style={styles.metaItem}>
              <AppText style={styles.metaLabel}>From</AppText>
              <AppText style={styles.metaValue} numberOfLines={1}>{organizer.displayName}</AppText>
            </View>
            <View style={styles.metaItem}>
              <AppText style={styles.metaLabel}>Invoice to</AppText>
              <AppText style={styles.metaValue} numberOfLines={1}>{participant.name}</AppText>
            </View>
            <View style={styles.metaItem}>
              <AppText style={styles.metaLabel}>Due date</AppText>
              <AppText style={styles.metaValue}>{readableDate(bill.dueDate)}</AppText>
            </View>
            <View style={styles.metaItem}>
              <AppText style={styles.metaLabel}>Group progress</AppText>
              <AppText style={styles.metaValue}>{paidCount}/{totalCount} paid</AppText>
            </View>
          </View>

          {(bill.paymentMethod || bill.paymentDetails) && (
            <>
              <View style={styles.divider} />
              <View style={styles.paymentHeader}>
                <View style={styles.paymentIcon}>
                  <Feather name="credit-card" size={16} color={colors.primary} />
                </View>
                <View style={styles.paymentHeaderText}>
                  <AppText style={styles.sectionLabel}>Payment method</AppText>
                  {bill.paymentMethod && (
                    <AppText style={styles.paymentMethod}>{paymentMethodLabel[bill.paymentMethod]}</AppText>
                  )}
                </View>
              </View>
              {bill.paymentDetails && (
                <AppText style={styles.paymentDetails}>{bill.paymentDetails}</AppText>
              )}
            </>
          )}
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(180).duration(350)} style={styles.proofSection}>
          <ProofUpload
            token={token!}
            organizerName={organizer.displayName}
            proofUrl={participant.proofUrl}
            proofSummary={participant.proofSummary}
            proofExtracted={participant.proofExtracted}
            onChanged={load}
          />
        </Animated.View>

        {canSwipe && (
          <Animated.View entering={FadeInUp.delay(240).duration(350)} style={styles.swipeBlock}>
            <SlideToConfirm onConfirm={handleConfirm} disabled={submitting} />
            <AppText style={styles.swipeHint}>
              By confirming, you're telling {organizer.displayName} you've paid your share.
            </AppText>
          </Animated.View>
        )}

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
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
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
    borderRadius: radius.full,
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1.5],
    maxWidth: 160,
  },
  statusPillText: { fontFamily: typography.sansBold, fontSize: fontSize.xs, flexShrink: 1 },
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
  invoiceNumberBlock: {
    alignItems: 'flex-end',
    maxWidth: 124,
    paddingTop: spacing[0.5],
  },
  invoiceNumberLabel: { fontFamily: typography.sansBold, fontSize: 10, color: colors.textSecondary, textTransform: 'uppercase' },
  invoiceNumber: { fontFamily: typography.monoMedium, fontSize: fontSize.xs, color: colors.textPrimary, marginTop: 2 },
  amountPanel: { borderRadius: radius.xl, padding: spacing[4], overflow: 'hidden' },
  amountTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing[2] },
  amountLabel: { fontFamily: typography.sansBold, fontSize: fontSize.xs, color: 'rgba(255,255,255,0.72)', textTransform: 'uppercase' },
  amountDate: { fontFamily: typography.monoMedium, fontSize: fontSize.xs, color: 'rgba(255,255,255,0.76)', flexShrink: 1, textAlign: 'right' },
  amount: { fontFamily: typography.sansBold, fontSize: fontSize['4xl'], color: '#FFFFFF', marginTop: spacing[2] },
  amountSub: { fontFamily: typography.sansRegular, fontSize: fontSize.sm, color: 'rgba(255,255,255,0.78)', marginTop: spacing[1], lineHeight: fontSize.sm * 1.45 },
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
  proofSection: { ...shadow.sm },
  swipeBlock: {
    gap: spacing[3],
    alignItems: 'center',
    marginTop: spacing[1],
    backgroundColor: 'rgba(255,255,255,0.86)',
    borderRadius: radius['2xl'],
    padding: spacing[4],
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    ...shadow.sm,
  },
  swipeHint: { fontFamily: typography.sansRegular, fontSize: fontSize.xs, color: colors.textSecondary, textAlign: 'center' },
  footer: { fontFamily: typography.sansRegular, fontSize: fontSize.xs, color: colors.textSecondary, textAlign: 'center', marginTop: spacing[4] },
});
