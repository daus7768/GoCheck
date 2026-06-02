import { useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  Share,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { format } from 'date-fns';
import { getBillByShareLink, markParticipantPaid } from '../../../src/lib/supabase';
import { colors, typography, fontSize, spacing, radius } from '../../../src/theme/tokens';
import type { Currency } from '../../../src/types';
import { CURRENCY_SYMBOLS } from '../../../src/types';
import { GlowingCard } from '../../../src/components/effects/GlowingCard';
import { AppText } from '../../../src/components/AppText';

interface BillData {
  id: string;
  title: string;
  description?: string;
  total_amount: number;
  currency: Currency;
  due_date: string;
  status: string;
  participants: Array<{
    id: string;
    name: string;
    amount: number;
    is_paid: boolean;
    paid_at: string | null;
  }>;
}

export default function ShareBillScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const insets = useSafeAreaInsets();
  const [bill, setBill] = useState<BillData | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (code) loadBill();
  }, [code]);

  const loadBill = async () => {
    try {
      const data = await getBillByShareLink(code ?? '');
      setBill(data as BillData);
    } catch {
      setError('Bill not found or link is invalid.');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkPaid = async (participantId: string, name: string) => {
    Alert.alert(
      'Confirm Payment',
      `Mark "${name}" as paid?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: "Yes, I've Paid",
          style: 'default',
          onPress: async () => {
            if (!bill) return;
            setPaying(participantId);
            try {
              await markParticipantPaid(participantId, bill.id);
              setBill((prev) =>
                prev
                  ? {
                      ...prev,
                      participants: prev.participants.map((p) =>
                        p.id === participantId
                          ? { ...p, is_paid: true, paid_at: new Date().toISOString() }
                          : p
                      ),
                    }
                  : prev
              );
            } catch {
              Alert.alert('Error', 'Could not confirm payment. Please try again.');
            } finally {
              setPaying(null);
            }
          },
        },
      ]
    );
  };

  const handleShare = async () => {
    await Share.share({
      message: `Pay your share for "${bill?.title ?? 'GoCheck bill'}" here: gocheck.app/bill/${code}`,
      url: `https://gocheck.app/bill/${code}`,
    });
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !bill) {
    return (
      <View style={styles.centered}>
        <Feather name="alert-circle" size={48} color={colors.error} />
        <AppText style={styles.errorTitle}>Bill not found</AppText>
        <AppText style={styles.errorText}>{error}</AppText>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <AppText style={styles.backBtnText}>Go Back</AppText>
        </Pressable>
      </View>
    );
  }

  const symbol = CURRENCY_SYMBOLS[bill.currency] ?? bill.currency;
  const paidCount = bill.participants.filter((p) => p.is_paid).length;
  const totalCount = bill.participants.length;
  const amountCollected = bill.participants
    .filter((p) => p.is_paid)
    .reduce((sum, p) => sum + p.amount, 0);
  const percent = totalCount > 0 ? Math.round((paidCount / totalCount) * 100) : 0;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="chevron-left" size={22} color={colors.textPrimary} />
        </Pressable>
        <AppText style={styles.headerTitle} numberOfLines={1}>{bill.title}</AppText>
        <Pressable onPress={handleShare} style={styles.shareBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="share-2" size={18} color={colors.primary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing[8] }]} showsVerticalScrollIndicator={false}>
        {/* Progress card */}
        <View style={styles.cardWrap}>
          <GlowingCard radius={radius['2xl']} background={colors.surface}>
            <View style={styles.progressCard}>
              <View style={styles.progressHeader}>
                <AppText style={styles.progressTitle}>Payment Progress</AppText>
                <AppText style={styles.progressCount}>{paidCount}/{totalCount} paid</AppText>
              </View>
              <View style={styles.progressBarTrack}>
                <View style={[styles.progressBarFill, { width: `${percent}%` }]} />
              </View>
              <View style={styles.progressAmounts}>
                <AppText style={styles.progressCollected}>
                  {symbol}{amountCollected.toFixed(2)} collected
                </AppText>
                <AppText style={styles.progressRemaining}>
                  {symbol}{(bill.total_amount - amountCollected).toFixed(2)} remaining
                </AppText>
              </View>
            </View>
          </GlowingCard>
        </View>

        {/* Participants */}
        <View style={styles.cardWrap}>
          <GlowingCard radius={radius['2xl']} background={colors.surface}>
        <View style={styles.section}>
          <AppText style={styles.sectionTitle}>Participants</AppText>
          {bill.participants.map((p) => (
            <View key={p.id} style={styles.participantRow}>
              <View style={[styles.avatar, { backgroundColor: p.is_paid ? colors.secondary : colors.gray200 }]}>
                <AppText style={styles.avatarText}>{p.name.slice(0, 1).toUpperCase()}</AppText>
              </View>
              <View style={styles.participantInfo}>
                <AppText style={styles.participantName}>{p.name}</AppText>
                {p.is_paid && p.paid_at && (
                  <AppText style={styles.paidAt}>Paid {format(new Date(p.paid_at), 'dd MMM, HH:mm')}</AppText>
                )}
              </View>
              <AppText style={[styles.participantAmount, p.is_paid && styles.participantAmountPaid]}>
                {symbol}{p.amount.toFixed(2)}
              </AppText>
              {p.is_paid ? (
                <View style={styles.paidBadge}>
                  <Feather name="check" size={14} color={colors.secondary} />
                </View>
              ) : (
                <Pressable
                  style={[styles.payBtn, paying === p.id && styles.payBtnLoading]}
                  onPress={() => handleMarkPaid(p.id, p.name)}
                  disabled={paying !== null}
                >
                  {paying === p.id ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <AppText style={styles.payBtnText}>Pay</AppText>
                  )}
                </Pressable>
              )}
            </View>
          ))}
        </View>
          </GlowingCard>
        </View>

        {/* Due date */}
        <View style={styles.dueRow}>
          <Feather name="calendar" size={14} color={colors.textSecondary} />
          <AppText style={styles.dueText}>
            Due {format(new Date(bill.due_date), 'EEEE, dd MMMM yyyy')}
          </AppText>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Transparent so the global cosmic BackgroundBeams from RootLayout shows
  // through; the opaque header below + per-card surfaces handle legibility.
  root: { flex: 1, backgroundColor: 'transparent' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[3], padding: spacing[6] },
  errorTitle: { fontFamily: typography.sansBold, fontSize: fontSize.lg, color: colors.textPrimary },
  errorText: { fontFamily: typography.sansRegular, fontSize: fontSize.base, color: colors.textSecondary, textAlign: 'center' },
  backBtn: { backgroundColor: colors.primary, borderRadius: radius.xl, paddingHorizontal: spacing[6], paddingVertical: spacing[3] },
  backBtnText: { fontFamily: typography.sansSemiBold, fontSize: fontSize.base, color: colors.white },
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
  headerBack: { width: 40, height: 40, borderRadius: radius.xl, backgroundColor: colors.gray50, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontFamily: typography.sansBold, fontSize: fontSize.md, color: colors.textPrimary },
  shareBtn: { width: 40, height: 40, borderRadius: radius.xl, backgroundColor: colors.primarySurface, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing[4] },
  cardWrap: { marginBottom: spacing[4] },
  progressCard: {
    padding: spacing[5],
  },
  progressHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[3] },
  progressTitle: { fontFamily: typography.sansBold, fontSize: fontSize.base, color: colors.textPrimary },
  progressCount: { fontFamily: typography.monoMedium, fontSize: fontSize.base, color: colors.primary },
  progressBarTrack: { height: 10, backgroundColor: colors.gray100, borderRadius: radius.full, overflow: 'hidden', marginBottom: spacing[3] },
  progressBarFill: { height: '100%', backgroundColor: colors.secondary, borderRadius: radius.full },
  progressAmounts: { flexDirection: 'row', justifyContent: 'space-between' },
  progressCollected: { fontFamily: typography.sansMedium, fontSize: fontSize.sm, color: colors.secondary },
  progressRemaining: { fontFamily: typography.sansMedium, fontSize: fontSize.sm, color: colors.textSecondary },
  section: { padding: spacing[5] },
  sectionTitle: { fontFamily: typography.sansBold, fontSize: fontSize.base, color: colors.textPrimary, marginBottom: spacing[4] },
  participantRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[2.5], borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  avatar: { width: 36, height: 36, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: typography.sansBold, fontSize: 15, color: colors.white },
  participantInfo: { flex: 1 },
  participantName: { fontFamily: typography.sansMedium, fontSize: fontSize.base, color: colors.textPrimary },
  paidAt: { fontFamily: typography.sansRegular, fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 1 },
  participantAmount: { fontFamily: typography.monoMedium, fontSize: fontSize.base, color: colors.textPrimary },
  participantAmountPaid: { color: colors.secondary },
  paidBadge: { width: 32, height: 32, borderRadius: radius.full, backgroundColor: colors.secondarySurface, alignItems: 'center', justifyContent: 'center' },
  payBtn: { backgroundColor: colors.primary, borderRadius: radius.lg, paddingHorizontal: spacing[3], paddingVertical: spacing[1.5], minWidth: 52, alignItems: 'center' },
  payBtnLoading: { opacity: 0.7 },
  payBtnText: { fontFamily: typography.sansSemiBold, fontSize: fontSize.sm, color: colors.white },
  dueRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], justifyContent: 'center' },
  dueText: { fontFamily: typography.sansMedium, fontSize: fontSize.sm, color: colors.textSecondary },
});
