import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { colors, typography, fontSize, spacing, radius } from '../../src/theme/tokens';
import { supabase, getParticipantView, submitPayment } from '../../src/lib/supabase';
import { StatusCard } from '../../src/components/payment/StatusCard';
import { SlideToConfirm } from '../../src/components/payment/SlideToConfirm';
import { ProofUpload } from '../../src/components/payment/ProofUpload';
import type { ParticipantView } from '../../src/types';

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
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !view) {
    return (
      <View style={styles.centered}>
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

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing[6], paddingBottom: insets.bottom + spacing[8] }]}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View entering={FadeIn.duration(300)} style={styles.brand}>
        <Text style={styles.brandName}>GoCheck</Text>
        {bill.invoiceNumber && <Text style={styles.brandMeta}>{bill.invoiceNumber}</Text>}
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(80).duration(350)}>
        <StatusCard
          status={participant.paymentStatus}
          amount={participant.amount}
          currency={bill.currency}
          dueDate={bill.dueDate}
          organizerName={organizer.displayName}
          confirmedAt={participant.confirmedAt}
          rejectedReason={participant.rejectedReason}
        />
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(140).duration(350)} style={styles.greetBlock}>
        <Text style={styles.greet}>Hi {participant.name},</Text>
        <Text style={styles.greetSub}>
          {organizer.displayName} sent you "{bill.title}"
        </Text>
      </Animated.View>

      {bill.paymentMethod && bill.paymentDetails && (
        <Animated.View entering={FadeInUp.delay(200).duration(350)} style={styles.payCard}>
          <Text style={styles.payLabel}>HOW TO PAY</Text>
          <Text style={styles.payMethod}>
            {{
              duitnow: 'DuitNow',
              bank_transfer: 'Bank transfer',
              ewallet: 'eWallet / TNG',
              cash: 'Cash',
            }[bill.paymentMethod]}
          </Text>
          <Text style={styles.payDetails}>{bill.paymentDetails}</Text>
        </Animated.View>
      )}

      <Animated.View entering={FadeInUp.delay(230).duration(350)}>
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
        <Animated.View entering={FadeInUp.delay(280).duration(350)} style={styles.swipeBlock}>
          <SlideToConfirm onConfirm={handleConfirm} disabled={submitting} />
          <Text style={styles.swipeHint}>
            By confirming, you're telling {organizer.displayName} you've paid your share.
          </Text>
        </Animated.View>
      )}

      <Text style={styles.footer}>Secure record by GoCheck</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F9FB' },
  scroll: { paddingHorizontal: spacing[4], gap: spacing[4] },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[3], padding: spacing[6] },
  errorTitle: { fontFamily: typography.sansBold, fontSize: fontSize.lg, color: colors.textPrimary },
  errorText: { fontFamily: typography.sansRegular, fontSize: fontSize.base, color: colors.textSecondary, textAlign: 'center' },
  retry: { backgroundColor: colors.primary, borderRadius: radius.xl, paddingHorizontal: spacing[6], paddingVertical: spacing[3] },
  retryText: { fontFamily: typography.sansSemiBold, fontSize: fontSize.base, color: '#FFF' },
  brand: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  brandName: { fontFamily: typography.sansBold, fontSize: fontSize.lg, color: colors.primary },
  brandMeta: { fontFamily: typography.monoMedium, fontSize: fontSize.sm, color: colors.textSecondary },
  greetBlock: { gap: spacing[1] },
  greet: { fontFamily: typography.sansBold, fontSize: fontSize.lg, color: colors.textPrimary },
  greetSub: { fontFamily: typography.sansRegular, fontSize: fontSize.base, color: colors.textSecondary },
  payCard: { backgroundColor: '#FFF', borderRadius: radius['2xl'], padding: spacing[5], gap: spacing[1] },
  payLabel: { fontFamily: typography.sansBold, fontSize: 10, letterSpacing: 1, color: colors.textSecondary },
  payMethod: { fontFamily: typography.sansSemiBold, fontSize: fontSize.base, color: colors.textPrimary },
  payDetails: { fontFamily: typography.sansRegular, fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: fontSize.sm * 1.5 },
  swipeBlock: { gap: spacing[3], alignItems: 'center', marginTop: spacing[2] },
  swipeHint: { fontFamily: typography.sansRegular, fontSize: fontSize.xs, color: colors.textSecondary, textAlign: 'center' },
  footer: { fontFamily: typography.sansRegular, fontSize: fontSize.xs, color: colors.textSecondary, textAlign: 'center', marginTop: spacing[4] },
});
