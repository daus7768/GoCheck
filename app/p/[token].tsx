import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Pressable, Image, useWindowDimensions } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Path } from 'react-native-svg';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeInUp,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { format } from 'date-fns';
import { colors, typography, fontSize, spacing, radius, shadow } from '../../src/theme/tokens';
import { supabase, getParticipantView, submitPayment } from '../../src/lib/supabase';
import { SlideToConfirm } from '../../src/components/payment/SlideToConfirm';
import { ProofUpload } from '../../src/components/payment/ProofUpload';
import { ColourfulText } from '../../src/components/effects/ColourfulText';
import { CURRENCY_SYMBOLS } from '../../src/types';
import type { ParticipantView, PaymentFlowStatus } from '../../src/types';

const AnimatedPath = Animated.createAnimatedComponent(Path);

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

function BeamBackdrop() {
  const { width, height } = useWindowDimensions();
  const sweep = useSharedValue(0);
  const pulse = useSharedValue(0.55);

  useEffect(() => {
    sweep.value = withRepeat(
      withTiming(1, { duration: 9000, easing: Easing.linear }),
      -1,
      false
    );
    pulse.value = withRepeat(
      withTiming(0.95, { duration: 4200, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
    return () => {
      cancelAnimation(sweep);
      cancelAnimation(pulse);
    };
  }, [pulse, sweep]);

  const svgW = Math.max(width, 390);
  const svgH = Math.max(height, 780);
  const pathA = `M -80 ${svgH * 0.18} C ${svgW * 0.18} ${svgH * 0.02}, ${svgW * 0.34} ${svgH * 0.44}, ${svgW + 90} ${svgH * 0.14}`;
  const pathB = `M -70 ${svgH * 0.54} C ${svgW * 0.2} ${svgH * 0.32}, ${svgW * 0.52} ${svgH * 0.76}, ${svgW + 80} ${svgH * 0.46}`;
  const pathC = `M ${svgW + 70} ${svgH * 0.82} C ${svgW * 0.72} ${svgH * 0.58}, ${svgW * 0.22} ${svgH * 0.96}, -80 ${svgH * 0.68}`;

  const beamAProps = useAnimatedProps(() => ({
    strokeDashoffset: interpolate(sweep.value, [0, 1], [980, -980]),
    opacity: pulse.value,
  }));
  const beamBProps = useAnimatedProps(() => ({
    strokeDashoffset: interpolate(sweep.value, [0, 1], [520, -1320]),
    opacity: interpolate(pulse.value, [0.55, 0.95], [0.35, 0.8]),
  }));
  const beamCProps = useAnimatedProps(() => ({
    strokeDashoffset: interpolate(sweep.value, [0, 1], [1200, -760]),
    opacity: interpolate(pulse.value, [0.55, 0.95], [0.25, 0.68]),
  }));

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={['#070A16', '#11123A', '#061B2A', '#071512']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Svg width={svgW} height={svgH} style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgLinearGradient id="beamSoft" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#38BDF8" stopOpacity="0" />
            <Stop offset="30%" stopColor="#6366F1" stopOpacity="0.28" />
            <Stop offset="62%" stopColor="#22C55E" stopOpacity="0.22" />
            <Stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
          </SvgLinearGradient>
          <SvgLinearGradient id="beamHot" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
            <Stop offset="38%" stopColor="#A5B4FC" stopOpacity="0.95" />
            <Stop offset="56%" stopColor="#67E8F9" stopOpacity="0.9" />
            <Stop offset="72%" stopColor="#86EFAC" stopOpacity="0.75" />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </SvgLinearGradient>
        </Defs>
        <Path d={pathA} stroke="url(#beamSoft)" strokeWidth={54} strokeLinecap="round" fill="none" />
        <Path d={pathB} stroke="url(#beamSoft)" strokeWidth={68} strokeLinecap="round" fill="none" opacity={0.7} />
        <Path d={pathC} stroke="url(#beamSoft)" strokeWidth={58} strokeLinecap="round" fill="none" opacity={0.5} />
        <AnimatedPath
          d={pathA}
          stroke="url(#beamHot)"
          strokeWidth={3}
          strokeLinecap="round"
          fill="none"
          strokeDasharray="180 760"
          animatedProps={beamAProps}
        />
        <AnimatedPath
          d={pathB}
          stroke="url(#beamHot)"
          strokeWidth={2.5}
          strokeLinecap="round"
          fill="none"
          strokeDasharray="150 820"
          animatedProps={beamBProps}
        />
        <AnimatedPath
          d={pathC}
          stroke="url(#beamHot)"
          strokeWidth={2.5}
          strokeLinecap="round"
          fill="none"
          strokeDasharray="130 780"
          animatedProps={beamCProps}
        />
      </Svg>
      <LinearGradient
        colors={['rgba(7,10,22,0.12)', 'rgba(7,10,22,0.42)', 'rgba(248,250,252,0.08)']}
        locations={[0, 0.58, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
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
        <Text style={styles.errorTitle}>Link unavailable</Text>
        <Text style={styles.errorText}>{error ?? 'This link is no longer valid.'}</Text>
        <Pressable style={styles.retry} onPress={load}>
          <Text style={styles.retryText}>Try again</Text>
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
              <Text style={styles.brandSub}>Secure payment request</Text>
            </View>
          </View>
          <View style={[styles.statusPill, { backgroundColor: tone.bg }]}>
            <Feather name={tone.icon} size={13} color={tone.fg} />
            <Text style={[styles.statusPillText, { color: tone.fg }]} numberOfLines={1}>
              {statusCopy(participant.paymentStatus)}
            </Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(80).duration(350)} style={styles.invoiceCard}>
          <View style={styles.invoiceHeader}>
            <View style={styles.invoiceHeaderText}>
              <Text style={styles.invoiceLabel}>PAYMENT INVOICE</Text>
              <Text style={styles.invoiceTitle} numberOfLines={2}>{bill.title}</Text>
              {bill.description && (
                <Text style={styles.invoiceDescription} numberOfLines={3}>{bill.description}</Text>
              )}
            </View>
            <View style={styles.invoiceNumberBlock}>
              <Text style={styles.invoiceNumberLabel}>Invoice</Text>
              <Text style={styles.invoiceNumber} numberOfLines={1}>
                {bill.invoiceNumber ?? 'Pending'}
              </Text>
            </View>
          </View>

          <LinearGradient
            colors={['#111827', '#312E81', '#0F766E']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.amountPanel}
          >
            <View style={styles.amountTopRow}>
              <Text style={styles.amountLabel}>Amount due</Text>
              <Text style={styles.amountDate}>{readableDate(bill.dueDate)}</Text>
            </View>
            <Text style={styles.amount}>{money(participant.amount, bill.currency)}</Text>
            {participant.confirmedAt ? (
              <Text style={styles.amountSub}>Confirmed on {readableDate(participant.confirmedAt, 'd MMM yyyy, HH:mm')}</Text>
            ) : participant.rejectedReason ? (
              <Text style={styles.amountSub}>{participant.rejectedReason}</Text>
            ) : (
              <Text style={styles.amountSub}>Your share for {organizer.displayName}'s bill</Text>
            )}
          </LinearGradient>

          <View style={styles.metaGrid}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>From</Text>
              <Text style={styles.metaValue} numberOfLines={1}>{organizer.displayName}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Invoice to</Text>
              <Text style={styles.metaValue} numberOfLines={1}>{participant.name}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Due date</Text>
              <Text style={styles.metaValue}>{readableDate(bill.dueDate)}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Group progress</Text>
              <Text style={styles.metaValue}>{paidCount}/{totalCount} paid</Text>
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
                  <Text style={styles.sectionLabel}>Payment method</Text>
                  {bill.paymentMethod && (
                    <Text style={styles.paymentMethod}>{paymentMethodLabel[bill.paymentMethod]}</Text>
                  )}
                </View>
              </View>
              {bill.paymentDetails && (
                <Text style={styles.paymentDetails}>{bill.paymentDetails}</Text>
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
            <Text style={styles.swipeHint}>
              By confirming, you're telling {organizer.displayName} you've paid your share.
            </Text>
          </Animated.View>
        )}

        <Text style={styles.footer}>Secure record by GoCheck</Text>
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
