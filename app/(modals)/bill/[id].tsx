import { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Share,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { format } from 'date-fns';
import { colors, typography, fontSize, spacing, radius, shadow } from '../../../src/theme/tokens';
import { useBillStore } from '../../../src/store/billStore';
import { supabase, updateBillStatus, deleteBill } from '../../../src/lib/supabase';
import { useProfileStore } from '../../../src/store/profileStore';
import { CURRENCY_SYMBOLS } from '../../../src/types';
import type { Bill, Participant } from '../../../src/types';
import { shareBillLink } from '../../../src/lib/share';
import { participantUrl } from '../../../src/lib/urls';
import { GlowingCard } from '../../../src/components/effects/GlowingCard';
import { PaymentReviewSheet } from '../../../src/components/payment/PaymentReviewSheet';
import { AppText } from '../../../src/components/AppText';

export default function BillDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { bills, fetchBills } = useBillStore();
  const sessionUserId = useProfileStore(s => s.session?.user.id) ?? '';
  const [bill, setBill] = useState<Bill | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [reviewing, setReviewing] = useState<Participant | null>(null);

  useEffect(() => {
    const found = bills.find((b) => b.id === id);
    if (found) setBill(found);
  }, [bills, id]);

  const reload = async () => {
    const orgId = sessionUserId;
    await fetchBills(orgId);
    const updated = useBillStore.getState().bills.find((b) => b.id === id);
    if (updated) setBill(updated);
  };

  // Always refetch on mount so we see the latest payment_status
  useEffect(() => {
    if (!sessionUserId || !id) return;
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionUserId, id]);

  // Realtime: refresh when any participant of this bill changes (e.g., participant swipes)
  useEffect(() => {
    if (!bill?.id) return;
    const channel = supabase
      .channel(`bill-detail:${bill.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'participants',
        filter: `bill_id=eq.${bill.id}`,
      }, () => { reload(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bill?.id, sessionUserId]);

  if (!bill) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const sym = CURRENCY_SYMBOLS[bill.currency] ?? bill.currency;
  const totalCount = bill.participants.length;
  const confirmedCount = bill.participants.filter((p) => p.paymentStatus === 'confirmed').length;
  const pendingCount   = bill.participants.filter((p) => p.paymentStatus === 'pending').length;
  const unpaidCount    = bill.participants.filter((p) => p.paymentStatus === 'unpaid' || p.paymentStatus === 'rejected').length;
  const amountCollected = bill.participants
    .filter((p) => p.paymentStatus === 'confirmed')
    .reduce((s, p) => s + p.amount, 0);
  const percent = totalCount > 0 ? Math.round((confirmedCount / totalCount) * 100) : 0;

  const handleShareParticipant = async (p: Participant) => {
    if (!p.accessToken) {
      Alert.alert('No link yet', 'This participant has no shareable link. Try refreshing.');
      return;
    }
    const link = participantUrl(p.accessToken);
    const msg =
      `Hi ${p.name}! 👋\n\n` +
      `Your share for *${bill.title}* is *${sym}${p.amount.toFixed(2)}*.\n\n` +
      `Tap here to confirm your payment:\n${link}`;
    try {
      await Share.share({ message: msg });
    } catch {
      // user cancelled
    }
  };

  const handleShare = async () => {
    await shareBillLink(bill);
  };

  const handleComplete = () => {
    const stillOutstanding = bill.participants.filter((p) => p.paymentStatus !== 'confirmed').length;
    const title = stillOutstanding > 0
      ? `${stillOutstanding} participant${stillOutstanding > 1 ? 's' : ''} still unpaid`
      : 'Mark bill as complete?';
    const message = stillOutstanding > 0
      ? 'Some participants haven\'t paid yet. Mark as complete anyway?'
      : 'This will close the bill. You can still view it afterwards.';

    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Complete',
        onPress: async () => {
          setActionLoading(true);
          try {
            await updateBillStatus(bill.id, 'complete');
            setBill((prev) => prev ? { ...prev, status: 'complete' } : prev);
          } catch {
            Alert.alert('Error', 'Could not update bill status.');
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const handleDelete = () => {
    Alert.alert('Delete Bill', 'This will permanently delete the bill. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setActionLoading(true);
          try {
            const orgId = sessionUserId;
            await deleteBill(bill.id, orgId);
            await reload();
            router.back();
          } catch {
            Alert.alert('Error', 'Could not delete bill.');
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.headerBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="chevron-left" size={22} color={colors.textPrimary} />
        </Pressable>
        <AppText style={styles.headerTitle} numberOfLines={1}>{bill.title}</AppText>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            onPress={() => router.push(`/(modals)/bill/${id}/invoice`)}
            style={[styles.headerBtn, styles.headerShareBtn]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="View invoice"
          >
            <Feather name="file-text" size={18} color={colors.primary} />
          </Pressable>
          <Pressable
            onPress={handleShare}
            style={[styles.headerBtn, styles.headerShareBtn]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="share-2" size={18} color={colors.primary} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing[8] }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Progress card */}
        <GlowingCard radius={radius['2xl']} color={colors.white} background={colors.primary}>
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <View>
              <AppText style={styles.progressTitle}>Payment Progress</AppText>
              <AppText style={styles.progressSub}>
                {sym}{amountCollected.toFixed(2)} of {sym}{bill.totalAmount.toFixed(2)}
              </AppText>
            </View>
            <AppText style={styles.progressPercent}>{percent}%</AppText>
          </View>
          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: `${percent}%` }]} />
          </View>
          <View style={styles.progressStats}>
            <View style={styles.progressStat}>
              <AppText style={styles.progressStatValue}>{confirmedCount}</AppText>
              <AppText style={styles.progressStatLabel}>Paid</AppText>
            </View>
            <View style={styles.progressStat}>
              <AppText style={styles.progressStatValue}>{pendingCount}</AppText>
              <AppText style={styles.progressStatLabel}>Review</AppText>
            </View>
            <View style={styles.progressStat}>
              <AppText style={styles.progressStatValue}>{unpaidCount}</AppText>
              <AppText style={styles.progressStatLabel}>Unpaid</AppText>
            </View>
          </View>
        </View>
        </GlowingCard>

        {/* Info row */}
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Feather name="calendar" size={14} color={colors.textSecondary} />
            <AppText style={styles.infoText}>Due {format(new Date(bill.dueDate), 'dd MMM yyyy')}</AppText>
          </View>
          <View style={styles.infoItem}>
            <Feather name="globe" size={14} color={colors.textSecondary} />
            <AppText style={styles.infoText}>{bill.currency}</AppText>
          </View>
          <View style={[styles.infoBadge, bill.status === 'complete' && styles.infoBadgeDone]}>
            <AppText style={[styles.infoBadgeText, bill.status === 'complete' && styles.infoBadgeTextDone]}>
              {bill.status === 'complete' ? 'Completed' : 'Active'}
            </AppText>
          </View>
        </View>

        {/* Participants */}
        <GlowingCard radius={radius['2xl']} background={colors.surface}>
        <View style={styles.section}>
          <AppText style={styles.sectionTitle}>Participants ({totalCount})</AppText>
          {bill.participants.map((p) => {
            const isConfirmed = p.paymentStatus === 'confirmed';
            const isPending   = p.paymentStatus === 'pending';
            const isRejected  = p.paymentStatus === 'rejected';
            return (
              <Pressable
                key={p.id}
                style={styles.participantRow}
                onPress={() => setReviewing(p)}
                accessibilityRole="button"
                accessibilityLabel={`Review ${p.name}'s payment`}
              >
                <View style={[styles.avatar, { backgroundColor: p.avatarColor ?? (isConfirmed ? colors.secondary : colors.gray300) }]}>
                  <AppText style={styles.avatarText}>{p.name.slice(0, 1).toUpperCase()}</AppText>
                </View>
                <View style={styles.participantInfo}>
                  <AppText style={styles.participantName}>{p.name}</AppText>
                  {p.email ? <AppText style={styles.participantEmail}>{p.email}</AppText> : null}
                  {!p.email && p.phone ? <AppText style={styles.participantEmail}>{p.phone}</AppText> : null}
                  {isConfirmed && p.confirmedAt ? (
                    <AppText style={styles.paidAt}>Paid {format(new Date(p.confirmedAt), 'dd MMM, HH:mm')}</AppText>
                  ) : isPending && p.submittedAt ? (
                    <AppText style={styles.pendingAt}>Submitted {format(new Date(p.submittedAt), 'dd MMM, HH:mm')}</AppText>
                  ) : isRejected && p.rejectedReason ? (
                    <AppText style={styles.rejectedHint} numberOfLines={1}>{p.rejectedReason}</AppText>
                  ) : null}
                </View>
                <View style={styles.participantRight}>
                  <AppText style={[styles.participantAmount, isConfirmed && styles.participantAmountPaid]}>
                    {sym}{p.amount.toFixed(2)}
                  </AppText>
                  {isConfirmed ? (
                    <View style={[styles.statusPill, styles.statusPillPaid]}>
                      <Feather name="check" size={11} color="#059669" />
                      <AppText style={[styles.statusPillText, { color: '#059669' }]}>Paid</AppText>
                    </View>
                  ) : isPending ? (
                    <View style={[styles.statusPill, styles.statusPillPending]}>
                      <Feather name="eye" size={11} color="#B45309" />
                      <AppText style={[styles.statusPillText, { color: '#B45309' }]}>Review</AppText>
                    </View>
                  ) : isRejected ? (
                    <Pressable
                      onPress={(e) => { e.stopPropagation?.(); handleShareParticipant(p); }}
                      style={[styles.statusPill, styles.statusPillRejected]}
                    >
                      <Feather name="rotate-cw" size={11} color="#DC2626" />
                      <AppText style={[styles.statusPillText, { color: '#DC2626' }]}>Re-send</AppText>
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={(e) => { e.stopPropagation?.(); handleShareParticipant(p); }}
                      style={[styles.statusPill, styles.statusPillSend]}
                    >
                      <Feather name="send" size={11} color={colors.primary} />
                      <AppText style={[styles.statusPillText, { color: colors.primary }]}>Send link</AppText>
                    </Pressable>
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
        </GlowingCard>

        {/* Actions */}
        {bill.status === 'active' && (
          <View style={styles.actions}>
            <Pressable
              style={[styles.completeBtn, actionLoading && { opacity: 0.6 }]}
              onPress={handleComplete}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <>
                  <Feather name="check-circle" size={16} color={colors.white} />
                  <AppText style={styles.completeBtnText}>Mark as Complete</AppText>
                </>
              )}
            </Pressable>
            <Pressable
              style={[styles.deleteBtn, actionLoading && { opacity: 0.6 }]}
              onPress={handleDelete}
              disabled={actionLoading}
            >
              <Feather name="trash-2" size={16} color={colors.error} />
              <AppText style={styles.deleteBtnText}>Delete Bill</AppText>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <PaymentReviewSheet
        participant={reviewing}
        currency={bill.currency}
        onClose={() => setReviewing(null)}
        onChanged={reload}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Transparent so the global cosmic BackgroundBeams from RootLayout shows
  // through; the opaque header below + per-card surfaces handle legibility.
  root: { flex: 1, backgroundColor: 'transparent' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: spacing[3],
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.xl,
    backgroundColor: colors.gray50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerShareBtn: { backgroundColor: colors.primarySurface },
  headerTitle: {
    flex: 1,
    fontFamily: typography.sansBold,
    fontSize: fontSize.md,
    color: colors.textPrimary,
  },
  scroll: { padding: spacing[4], gap: spacing[3] },
  progressCard: {
    padding: spacing[5],
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing[4],
  },
  progressTitle: {
    fontFamily: typography.sansBold,
    fontSize: fontSize.base,
    color: colors.white,
  },
  progressSub: {
    fontFamily: typography.monoRegular,
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  progressPercent: {
    fontFamily: typography.monoMedium,
    fontSize: fontSize['2xl'],
    color: colors.white,
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: radius.full,
    overflow: 'hidden',
    marginBottom: spacing[4],
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.white,
    borderRadius: radius.full,
  },
  progressStats: {
    flexDirection: 'row',
  },
  progressStat: {
    flex: 1,
    alignItems: 'center',
  },
  progressStatValue: {
    fontFamily: typography.sansBold,
    fontSize: fontSize.lg,
    color: colors.white,
  },
  progressStatLabel: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.xs,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 1,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[2],
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  infoText: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  infoBadge: {
    marginLeft: 'auto',
    backgroundColor: colors.primarySurface,
    borderRadius: radius.full,
    paddingHorizontal: spacing[2.5],
    paddingVertical: 3,
  },
  infoBadgeDone: { backgroundColor: colors.secondarySurface },
  infoBadgeText: {
    fontFamily: typography.sansMedium,
    fontSize: fontSize.xs,
    color: colors.primary,
  },
  infoBadgeTextDone: { color: colors.secondary },
  shareLinkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[3],
    gap: spacing[3],
  },
  shareLinkLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  shareLinkLabel: {
    fontFamily: typography.sansMedium,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  shareLinkCode: {
    fontFamily: typography.monoRegular,
    fontSize: fontSize.xs,
    color: colors.primary,
  },
  shareLinkBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    padding: spacing[4],
  },
  sectionTitle: {
    fontFamily: typography.sansBold,
    fontSize: fontSize.base,
    color: colors.textPrimary,
    marginBottom: spacing[3],
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: typography.sansBold,
    fontSize: 16,
    color: colors.white,
  },
  participantInfo: { flex: 1 },
  participantName: {
    fontFamily: typography.sansMedium,
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },
  participantEmail: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 1,
  },
  paidAt: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.xs,
    color: colors.secondary,
    marginTop: 1,
  },
  pendingAt: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.xs,
    color: '#B45309',
    marginTop: 1,
  },
  rejectedHint: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.xs,
    color: '#DC2626',
    marginTop: 1,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusPillSend:     { backgroundColor: colors.primarySurface },
  statusPillPending:  { backgroundColor: '#FEF3C7' },
  statusPillPaid:     { backgroundColor: '#D1FAE5' },
  statusPillRejected: { backgroundColor: '#FEE2E2' },
  statusPillText: {
    fontFamily: typography.sansMedium,
    fontSize: 11,
  },
  participantRight: {
    alignItems: 'flex-end',
    gap: spacing[1.5],
  },
  participantAmount: {
    fontFamily: typography.monoMedium,
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },
  participantAmountPaid: { color: colors.secondary },
  paidBadge: {
    padding: 4,
  },
  markPaidBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1],
    minWidth: 72,
    alignItems: 'center',
  },
  markPaidBtnLoading: { opacity: 0.7 },
  markPaidBtnText: {
    fontFamily: typography.sansSemiBold,
    fontSize: fontSize.xs,
    color: colors.white,
  },
  actions: {
    gap: spacing[2],
  },
  completeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    backgroundColor: colors.secondary,
    borderRadius: radius.xl,
    paddingVertical: spacing[4],
    ...shadow.sm,
  },
  completeBtnText: {
    fontFamily: typography.sansSemiBold,
    fontSize: fontSize.base,
    color: colors.white,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    paddingVertical: spacing[4],
    borderWidth: 1,
    borderColor: colors.error,
  },
  deleteBtnText: {
    fontFamily: typography.sansSemiBold,
    fontSize: fontSize.base,
    color: colors.error,
  },
});
