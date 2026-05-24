import { useEffect, useState } from 'react';
import {
  View,
  Text,
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
import { supabase, markParticipantPaid, updateBillStatus, deleteBill } from '../../../src/lib/supabase';
import { getOrganizerId } from '../../../src/lib/organizer';
import { CURRENCY_SYMBOLS } from '../../../src/types';
import type { Bill } from '../../../src/types';

export default function BillDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { bills, fetchBills } = useBillStore();
  const [bill, setBill] = useState<Bill | null>(null);
  const [paying, setPaying] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const found = bills.find((b) => b.id === id);
    if (found) setBill(found);
  }, [bills, id]);

  const reload = async () => {
    const orgId = await getOrganizerId();
    await fetchBills(orgId);
    const updated = useBillStore.getState().bills.find((b) => b.id === id);
    if (updated) setBill(updated);
  };

  if (!bill) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const sym = CURRENCY_SYMBOLS[bill.currency] ?? bill.currency;
  const paidCount = bill.participants.filter((p) => p.isPaid).length;
  const totalCount = bill.participants.length;
  const amountCollected = bill.participants
    .filter((p) => p.isPaid)
    .reduce((s, p) => s + p.amount, 0);
  const percent = totalCount > 0 ? Math.round((paidCount / totalCount) * 100) : 0;

  const handleMarkPaid = (participantId: string, name: string) => {
    Alert.alert('Confirm Payment', `Mark "${name}" as paid?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: "Mark as Paid",
        onPress: async () => {
          setPaying(participantId);
          try {
            await markParticipantPaid(participantId, bill.id);
            setBill((prev) =>
              prev
                ? {
                    ...prev,
                    participants: prev.participants.map((p) =>
                      p.id === participantId
                        ? { ...p, isPaid: true, paidAt: new Date().toISOString() }
                        : p
                    ),
                  }
                : prev
            );
          } catch {
            Alert.alert('Error', 'Could not mark as paid. Please try again.');
          } finally {
            setPaying(null);
          }
        },
      },
    ]);
  };

  const handleMarkUnpaid = (participantId: string, name: string) => {
    Alert.alert('Revert Payment', `Mark "${name}" as unpaid?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revert',
        style: 'destructive',
        onPress: async () => {
          setPaying(participantId);
          try {
            await supabase
              .from('participants')
              .update({ is_paid: false, paid_at: null })
              .eq('id', participantId)
              .eq('bill_id', bill.id);
            setBill((prev) =>
              prev
                ? {
                    ...prev,
                    participants: prev.participants.map((p) =>
                      p.id === participantId ? { ...p, isPaid: false, paidAt: null } : p
                    ),
                  }
                : prev
            );
          } catch {
            Alert.alert('Error', 'Could not revert payment.');
          } finally {
            setPaying(null);
          }
        },
      },
    ]);
  };

  const handleShare = async () => {
    const url = `https://gocheck.app/bill/${bill.shareLink}`;
    await Share.share({
      message: `Pay your share for "${bill.title}": ${url}`,
      url,
    });
  };

  const handleComplete = () => {
    Alert.alert('Complete Bill', 'Mark this bill as complete?', [
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
            const orgId = await getOrganizerId();
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
        <Text style={styles.headerTitle} numberOfLines={1}>{bill.title}</Text>
        <Pressable
          onPress={handleShare}
          style={[styles.headerBtn, styles.headerShareBtn]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="share-2" size={18} color={colors.primary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing[8] }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Progress card */}
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <View>
              <Text style={styles.progressTitle}>Payment Progress</Text>
              <Text style={styles.progressSub}>
                {sym}{amountCollected.toFixed(2)} of {sym}{bill.totalAmount.toFixed(2)}
              </Text>
            </View>
            <Text style={styles.progressPercent}>{percent}%</Text>
          </View>
          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: `${percent}%` }]} />
          </View>
          <View style={styles.progressStats}>
            <View style={styles.progressStat}>
              <Text style={styles.progressStatValue}>{paidCount}</Text>
              <Text style={styles.progressStatLabel}>Paid</Text>
            </View>
            <View style={styles.progressStat}>
              <Text style={styles.progressStatValue}>{totalCount - paidCount}</Text>
              <Text style={styles.progressStatLabel}>Pending</Text>
            </View>
            <View style={styles.progressStat}>
              <Text style={styles.progressStatValue}>{totalCount}</Text>
              <Text style={styles.progressStatLabel}>Total</Text>
            </View>
          </View>
        </View>

        {/* Info row */}
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Feather name="calendar" size={14} color={colors.textSecondary} />
            <Text style={styles.infoText}>Due {format(new Date(bill.dueDate), 'dd MMM yyyy')}</Text>
          </View>
          <View style={styles.infoItem}>
            <Feather name="globe" size={14} color={colors.textSecondary} />
            <Text style={styles.infoText}>{bill.currency}</Text>
          </View>
          <View style={[styles.infoBadge, bill.status === 'complete' && styles.infoBadgeDone]}>
            <Text style={[styles.infoBadgeText, bill.status === 'complete' && styles.infoBadgeTextDone]}>
              {bill.status === 'complete' ? 'Completed' : 'Active'}
            </Text>
          </View>
        </View>

        {/* Share link */}
        <View style={styles.shareLinkCard}>
          <View style={styles.shareLinkLeft}>
            <Feather name="link" size={16} color={colors.primary} />
            <View>
              <Text style={styles.shareLinkLabel}>Share Link</Text>
              <Text style={styles.shareLinkCode}>gocheck.app/bill/{bill.shareLink}</Text>
            </View>
          </View>
          <Pressable onPress={handleShare} style={styles.shareLinkBtn}>
            <Feather name="share-2" size={16} color={colors.white} />
          </Pressable>
        </View>

        {/* Participants */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Participants ({totalCount})</Text>
          {bill.participants.map((p) => (
            <View key={p.id} style={styles.participantRow}>
              <View style={[styles.avatar, { backgroundColor: p.isPaid ? colors.secondary : colors.gray300 }]}>
                <Text style={styles.avatarText}>{p.name.slice(0, 1).toUpperCase()}</Text>
              </View>
              <View style={styles.participantInfo}>
                <Text style={styles.participantName}>{p.name}</Text>
                {p.email ? <Text style={styles.participantEmail}>{p.email}</Text> : null}
                {p.isPaid && p.paidAt ? (
                  <Text style={styles.paidAt}>Paid {format(new Date(p.paidAt), 'dd MMM, HH:mm')}</Text>
                ) : null}
              </View>
              <View style={styles.participantRight}>
                <Text style={[styles.participantAmount, p.isPaid && styles.participantAmountPaid]}>
                  {sym}{p.amount.toFixed(2)}
                </Text>
                {p.isPaid ? (
                  <Pressable
                    style={styles.paidBadge}
                    onPress={() => handleMarkUnpaid(p.id, p.name)}
                    disabled={paying !== null}
                  >
                    {paying === p.id ? (
                      <ActivityIndicator size="small" color={colors.secondary} />
                    ) : (
                      <Feather name="check-circle" size={20} color={colors.secondary} />
                    )}
                  </Pressable>
                ) : (
                  <Pressable
                    style={[styles.markPaidBtn, paying === p.id && styles.markPaidBtnLoading]}
                    onPress={() => handleMarkPaid(p.id, p.name)}
                    disabled={paying !== null}
                  >
                    {paying === p.id ? (
                      <ActivityIndicator size="small" color={colors.white} />
                    ) : (
                      <Text style={styles.markPaidBtnText}>Mark Paid</Text>
                    )}
                  </Pressable>
                )}
              </View>
            </View>
          ))}
        </View>

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
                  <Text style={styles.completeBtnText}>Mark as Complete</Text>
                </>
              )}
            </Pressable>
            <Pressable
              style={[styles.deleteBtn, actionLoading && { opacity: 0.6 }]}
              onPress={handleDelete}
              disabled={actionLoading}
            >
              <Feather name="trash-2" size={16} color={colors.error} />
              <Text style={styles.deleteBtnText}>Delete Bill</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
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
    backgroundColor: colors.primary,
    borderRadius: radius['2xl'],
    padding: spacing[5],
    ...shadow.md,
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
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing[3],
    gap: spacing[3],
    ...shadow.sm,
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
    backgroundColor: colors.surface,
    borderRadius: radius['2xl'],
    padding: spacing[4],
    ...shadow.sm,
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
