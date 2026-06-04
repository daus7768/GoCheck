import { useEffect, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Share,
  Image,
} from 'react-native';
import { AppText } from '../../../../src/components/AppText';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { format } from 'date-fns';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { haptic, NotificationFeedbackType } from '../../../../src/lib/haptics';
import { colors, typography, fontSize, spacing, radius, shadow } from '../../../../src/theme/tokens';
import { useBillStore } from '../../../../src/store/billStore';
import { useProfileStore } from '../../../../src/store/profileStore';
import { CURRENCY_SYMBOLS } from '../../../../src/types';
import { supabase } from '../../../../src/lib/supabase';
import type { Bill } from '../../../../src/types';
import { participantUrl } from '../../../../src/lib/urls';
import { PaymentReviewSheet } from '../../../../src/components/payment/PaymentReviewSheet';
import type { Participant } from '../../../../src/types';

// ─── Invoice Screen ────────────────────────────────────────────────────────────

export default function InvoiceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { bills, fetchBills } = useBillStore();
  const sessionUserId = useProfileStore(s => s.session?.user.id) ?? '';
  const profile = useProfileStore(s => s.profile);

  const [bill, setBill] = useState<Bill | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [reviewing, setReviewing] = useState<Participant | null>(null);

  // ── Load bill ──
  useEffect(() => {
    const found = bills.find((b) => b.id === id);
    if (found) {
      setBill(found);
      setLoading(false);
    } else {
      fetchBills(sessionUserId).then(() => {
        const b = useBillStore.getState().bills.find((b) => b.id === id);
        if (b) setBill(b);
        setLoading(false);
      });
    }
  }, [id]);

  // ── Gemini invoice summary ──
  useEffect(() => {
    if (!bill) return;
    setSummaryLoading(true);

    const perPerson = bill.participants.length > 0
      ? (bill.totalAmount / bill.participants.length).toFixed(2)
      : '0.00';

    supabase.functions.invoke('gemini-invoice-summary', {
      body: {
        title: bill.title,
        description: bill.description ?? '',
        category: bill.category ?? 'other',
        totalAmount: bill.totalAmount,
        currency: bill.currency,
        participantCount: bill.participants.length,
        dueDate: bill.dueDate ? format(new Date(bill.dueDate), 'EEEE, d MMMM yyyy') : '',
        splitType: bill.splitType ?? 'equal',
        taxSst: bill.taxSst ?? false,
        taxService: bill.taxService ?? false,
        perPersonAmount: perPerson,
        organizerName: profile?.displayName ?? 'Organizer',
      },
    }).then(({ data }) => {
      if (data?.success) setAiSummary(data.summary as string);
    }).catch(() => {
      // summary is optional — silent fail
    }).finally(() => setSummaryLoading(false));
  }, [bill?.id]);

  // ── Realtime participant updates ──
  useEffect(() => {
    if (!bill?.id) return;
    const channel = supabase
      .channel(`bill:${bill.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'participants',
        filter: `bill_id=eq.${bill.id}`,
      }, () => { fetchBills(sessionUserId); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [bill?.id, sessionUserId, fetchBills]);

  // ── Derived ──
  const currencySymbol = bill ? CURRENCY_SYMBOLS[bill.currency] : 'RM';
  const lineSubtotal = (bill?.lineItems ?? []).reduce((s, li) => s + li.subtotal, 0);
  const sstAmount = bill?.taxSst ? lineSubtotal * 0.06 : 0;
  const serviceAmount = bill?.taxService ? lineSubtotal * ((bill.taxServiceRate ?? 10) / 100) : 0;
  const handleShareParticipant = useCallback(async (p: Participant) => {
    if (!bill || !p.accessToken) return;
    const link = participantUrl(p.accessToken);
    const msg =
      `Hi ${p.name}! 👋\n\n` +
      `Your share for *${bill.title}* is *${currencySymbol}${p.amount.toFixed(2)}*.\n\n` +
      `Tap here to confirm your payment:\n${link}`;
    await Share.share({ message: msg });
    haptic.notification(NotificationFeedbackType.Success);
  }, [bill, currencySymbol]);

  if (loading) {
    return (
      <View style={styles.loadingRoot}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!bill) {
    return (
      <View style={styles.loadingRoot}>
        <AppText style={styles.notFound}>Bill not found.</AppText>
      </View>
    );
  }

  const paidCount = bill.participants.filter(p => p.isPaid).length;
  const totalCount = bill.participants.length;
  const amountCollected = bill.participants.filter(p => p.isPaid).reduce((s, p) => s + p.amount, 0);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { justifyContent: 'flex-start' }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
          <Feather name="chevron-left" size={22} color={colors.textPrimary} />
        </Pressable>
        <AppText style={[styles.headerTitle, { marginLeft: spacing[3] }]}>Invoice</AppText>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Invoice card */}
        <Animated.View entering={FadeInDown.duration(400).springify()} style={styles.invoiceCard}>
          {/* Brand row */}
          <View style={styles.brandRow}>
            <View style={styles.brandLeft}>
              <Image source={require('../../../../assets/logo_v2.png')} style={styles.logo} />
              <View>
                <AppText style={styles.brandName}>GoCheck</AppText>
                <AppText style={styles.brandUrl}>gocheck.app</AppText>
              </View>
            </View>
            <View style={styles.invoiceNumBlock}>
              {bill.invoiceNumber && (
                <AppText style={styles.invoiceNum}>{bill.invoiceNumber}</AppText>
              )}
              <AppText style={styles.invoiceDate}>{format(new Date(), 'dd MMM yyyy')}</AppText>
            </View>
          </View>

          <View style={styles.divider} />

          {/* AI Summary */}
          {summaryLoading && (
            <View style={styles.summarySkeletonRow}>
              <View style={styles.skeletonLine} />
              <View style={[styles.skeletonLine, { width: '70%' }]} />
            </View>
          )}
          {!summaryLoading && aiSummary && (
            <Animated.View entering={FadeIn.duration(400)} style={styles.summaryBlock}>
              <View style={styles.summaryAccent} />
              <AppText style={styles.summaryText}>{aiSummary}</AppText>
            </Animated.View>
          )}

          {/* From / To */}
          <View style={styles.fromToRow}>
            <View style={styles.fromToBlock}>
              <AppText style={styles.fromToLabel}>FROM</AppText>
              <AppText style={styles.fromToName}>{profile?.displayName ?? 'Organizer'}</AppText>
              <AppText style={styles.fromToSub}>{bill.category ?? 'GoCheck Bill'}</AppText>
            </View>
            <View style={[styles.fromToBlock, { alignItems: 'flex-end' }]}>
              <AppText style={styles.fromToLabel}>BILL</AppText>
              <AppText style={styles.fromToName} numberOfLines={1}>{bill.title}</AppText>
              {bill.description && (
                <AppText style={styles.fromToSub} numberOfLines={2}>{bill.description}</AppText>
              )}
            </View>
          </View>

          <View style={styles.divider} />

          {/* Participants table */}
          <AppText style={styles.sectionLabel}>PARTICIPANTS & AMOUNTS</AppText>
          <View style={styles.participantTable}>
            {/* Header */}
            <View style={[styles.tableRow, styles.tableHeader]}>
              <AppText style={[styles.tableCell, styles.tableCellName, styles.tableHeaderText]}>Name</AppText>
              <AppText style={[styles.tableCell, styles.tableCellAmt, styles.tableHeaderText]}>Amount</AppText>
              <AppText style={[styles.tableCell, styles.tableCellStatus, styles.tableHeaderText]}>Status</AppText>
            </View>
            {bill.participants.map((p) => (
              <View key={p.id} style={styles.tableRow}>
                <View style={[styles.tableCell, styles.tableCellName, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                  <View style={[styles.avatar, { backgroundColor: p.avatarColor }]}>
                    <AppText style={styles.avatarText}>{p.name.slice(0, 1).toUpperCase()}</AppText>
                  </View>
                  <AppText style={styles.participantName} numberOfLines={1}>{p.name}</AppText>
                </View>
                <AppText style={[styles.tableCell, styles.tableCellAmt, styles.amountText]}>
                  {currencySymbol}{p.amount.toFixed(2)}
                </AppText>
                <View style={[styles.tableCell, styles.tableCellStatus]}>
                  {p.paymentStatus === 'unpaid' && (
                    <Pressable onPress={() => handleShareParticipant(p)} style={styles.rowAction}>
                      <Feather name="send" size={14} color={colors.primary} />
                      <AppText style={styles.rowActionText}>Send link</AppText>
                    </Pressable>
                  )}
                  {p.paymentStatus === 'pending' && (
                    <Pressable onPress={() => setReviewing(p)} style={[styles.rowAction, styles.rowActionPending]}>
                      <Feather name="eye" size={14} color="#B45309" />
                      <AppText style={[styles.rowActionText, { color: '#B45309' }]}>Review</AppText>
                    </Pressable>
                  )}
                  {p.paymentStatus === 'confirmed' && (
                    <View style={[styles.rowAction, styles.rowActionDone]}>
                      <Feather name="check" size={14} color="#059669" />
                      <AppText style={[styles.rowActionText, { color: '#059669' }]}>Paid</AppText>
                    </View>
                  )}
                  {p.paymentStatus === 'rejected' && (
                    <Pressable onPress={() => handleShareParticipant(p)} style={[styles.rowAction, styles.rowActionRejected]}>
                      <Feather name="rotate-cw" size={14} color="#DC2626" />
                      <AppText style={[styles.rowActionText, { color: '#DC2626' }]}>Re-send</AppText>
                    </Pressable>
                  )}
                </View>
              </View>
            ))}
          </View>

          {/* Progress summary */}
          <View style={styles.progressRow}>
            <AppText style={styles.progressText}>{paidCount}/{totalCount} paid</AppText>
            <AppText style={styles.progressAmount}>
              {currencySymbol}{amountCollected.toFixed(2)} of {currencySymbol}{bill.totalAmount.toFixed(2)} collected
            </AppText>
          </View>

          {/* Line items (if any) */}
          {(bill.lineItems ?? []).length > 0 && (
            <>
              <View style={styles.divider} />
              <AppText style={styles.sectionLabel}>LINE ITEMS</AppText>
              {(bill.lineItems ?? []).map((li) => (
                <View key={li.id} style={styles.lineItemRow}>
                  <AppText style={styles.lineItemName} numberOfLines={1}>{li.description}</AppText>
                  <AppText style={styles.lineItemQty}>×{li.quantity}</AppText>
                  <AppText style={styles.lineItemAmt}>{currencySymbol}{li.subtotal.toFixed(2)}</AppText>
                </View>
              ))}
              <View style={styles.divider} />
              <View style={styles.totalsBlock}>
                <View style={styles.totalsRow}>
                  <AppText style={styles.totalsLabel}>Subtotal</AppText>
                  <AppText style={styles.totalsValue}>{currencySymbol}{lineSubtotal.toFixed(2)}</AppText>
                </View>
                {bill.taxSst && (
                  <View style={styles.totalsRow}>
                    <AppText style={styles.totalsLabel}>SST (6%)</AppText>
                    <AppText style={styles.totalsValue}>{currencySymbol}{sstAmount.toFixed(2)}</AppText>
                  </View>
                )}
                {bill.taxService && (
                  <View style={styles.totalsRow}>
                    <AppText style={styles.totalsLabel}>Service ({bill.taxServiceRate ?? 10}%)</AppText>
                    <AppText style={styles.totalsValue}>{currencySymbol}{serviceAmount.toFixed(2)}</AppText>
                  </View>
                )}
                <View style={[styles.totalsRow, styles.totalsFinalRow]}>
                  <AppText style={styles.totalsFinalLabel}>TOTAL</AppText>
                  <AppText style={styles.totalsFinalValue}>{currencySymbol}{bill.totalAmount.toFixed(2)}</AppText>
                </View>
              </View>
            </>
          )}

          {/* Payment details */}
          {(bill.paymentMethod || bill.paymentDetails) && (
            <>
              <View style={styles.divider} />
              <AppText style={styles.sectionLabel}>PAYMENT DETAILS</AppText>
              {bill.paymentMethod && (
                <View style={styles.paymentRow}>
                  <Feather name="credit-card" size={14} color={colors.textSecondary} />
                  <AppText style={styles.paymentMethodText}>
                    {{
                      duitnow: 'DuitNow QR',
                      bank_transfer: 'Bank Transfer',
                      ewallet: 'eWallet / TNG',
                      cash: 'Cash',
                    }[bill.paymentMethod]}
                  </AppText>
                </View>
              )}
              {bill.paymentDetails && (
                <AppText style={styles.paymentDetailsText}>{bill.paymentDetails}</AppText>
              )}
            </>
          )}

          {/* Due date */}
          {bill.dueDate && (
            <>
              <View style={styles.divider} />
              <View style={styles.dueDateRow}>
                <Feather name="calendar" size={14} color={colors.primary} />
                <AppText style={styles.dueDateText}>
                  Due {format(new Date(bill.dueDate), 'EEEE, d MMMM yyyy')}
                </AppText>
              </View>
            </>
          )}
        </Animated.View>

      </ScrollView>
      <PaymentReviewSheet
        participant={reviewing}
        currency={bill.currency}
        onClose={() => setReviewing(null)}
        onChanged={() => fetchBills(sessionUserId)}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F9FB' },
  loadingRoot: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFound: { fontFamily: typography.sansRegular, fontSize: fontSize.base, color: colors.textSecondary },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    backgroundColor: '#fff', borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border, ...shadow.sm,
  },
  backBtn: { width: 40, height: 40, borderRadius: radius.xl, backgroundColor: colors.gray50, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: typography.sansBold, fontSize: fontSize.md, color: colors.textPrimary },
  shareBtn: { width: 40, height: 40, borderRadius: radius.xl, backgroundColor: colors.primarySurface, alignItems: 'center', justifyContent: 'center' },

  scroll: { paddingHorizontal: spacing[4], paddingTop: spacing[4] },

  invoiceCard: {
    backgroundColor: '#fff', borderRadius: radius['2xl'], padding: spacing[5],
    ...shadow.md, marginBottom: spacing[3],
  },

  // Brand
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[4] },
  brandLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  logo: { width: 36, height: 36, borderRadius: 18 },
  brandName: { fontFamily: typography.sansBold, fontSize: fontSize.base, color: colors.textPrimary },
  brandUrl: { fontFamily: typography.sansRegular, fontSize: fontSize.xs, color: colors.textSecondary },
  invoiceNumBlock: { alignItems: 'flex-end' },
  invoiceNum: { fontFamily: typography.monoMedium, fontSize: fontSize.sm, color: colors.primary },
  invoiceDate: { fontFamily: typography.sansRegular, fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },

  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: spacing[4] },

  // Summary
  summarySkeletonRow: { gap: spacing[2], marginBottom: spacing[4] },
  skeletonLine: { height: 12, width: '100%', backgroundColor: colors.gray100, borderRadius: radius.full },
  summaryBlock: { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[4] },
  summaryAccent: { width: 3, borderRadius: 2, backgroundColor: colors.primary },
  summaryText: { flex: 1, fontFamily: typography.sansRegular, fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: fontSize.sm * 1.6, fontStyle: 'italic' },

  // From/To
  fromToRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing[2] },
  fromToBlock: { flex: 1 },
  fromToLabel: { fontFamily: typography.sansBold, fontSize: 9, color: colors.textSecondary, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
  fromToName: { fontFamily: typography.sansBold, fontSize: fontSize.base, color: colors.textPrimary },
  fromToSub: { fontFamily: typography.sansRegular, fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },

  sectionLabel: { fontFamily: typography.sansBold, fontSize: 10, color: colors.textSecondary, letterSpacing: 1, textTransform: 'uppercase', marginBottom: spacing[3] },

  // Participant table
  participantTable: { borderRadius: radius.lg, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[3], paddingVertical: spacing[2.5], borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  tableHeader: { backgroundColor: colors.gray50 },
  tableHeaderText: { fontFamily: typography.sansBold, fontSize: 11, color: colors.textSecondary },
  tableCell: {},
  tableCellName: { flex: 1 },
  tableCellAmt: { width: 80, textAlign: 'right' },
  tableCellStatus: { width: 70, alignItems: 'flex-end' },
  avatar: { width: 24, height: 24, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: typography.sansBold, fontSize: 10, color: '#fff' },
  participantName: { fontFamily: typography.sansMedium, fontSize: fontSize.sm, color: colors.textPrimary, flex: 1 },
  amountText: { fontFamily: typography.monoMedium, fontSize: fontSize.sm, color: colors.textPrimary, textAlign: 'right' },

  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing[3] },
  progressText: { fontFamily: typography.sansMedium, fontSize: fontSize.xs, color: colors.textSecondary },
  progressAmount: { fontFamily: typography.monoMedium, fontSize: fontSize.xs, color: colors.primary },

  // Line items
  lineItemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing[2] },
  lineItemName: { flex: 1, fontFamily: typography.sansRegular, fontSize: fontSize.sm, color: colors.textPrimary },
  lineItemQty: { fontFamily: typography.monoRegular, fontSize: fontSize.xs, color: colors.textSecondary, marginRight: spacing[3] },
  lineItemAmt: { fontFamily: typography.monoMedium, fontSize: fontSize.sm, color: colors.textPrimary, width: 70, textAlign: 'right' },

  // Totals
  totalsBlock: { gap: spacing[1] },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing[1] },
  totalsLabel: { fontFamily: typography.sansRegular, fontSize: fontSize.sm, color: colors.textSecondary },
  totalsValue: { fontFamily: typography.monoMedium, fontSize: fontSize.sm, color: colors.textPrimary },
  totalsFinalRow: { marginTop: spacing[2], paddingTop: spacing[2], borderTopWidth: 2, borderTopColor: colors.gray100 },
  totalsFinalLabel: { fontFamily: typography.sansBold, fontSize: fontSize.md, color: colors.textPrimary },
  totalsFinalValue: { fontFamily: typography.monoMedium, fontSize: fontSize.lg, color: colors.primary },

  // Payment
  paymentRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[2] },
  paymentMethodText: { fontFamily: typography.sansMedium, fontSize: fontSize.sm, color: colors.textPrimary },
  paymentDetailsText: { fontFamily: typography.sansRegular, fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: fontSize.sm * 1.5 },

  // Due date
  dueDateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  dueDateText: { fontFamily: typography.sansMedium, fontSize: fontSize.sm, color: colors.primary },

  // Actions
  actions: { flexDirection: 'row', gap: spacing[3] },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing[2], backgroundColor: '#fff', borderRadius: radius.xl,
    paddingVertical: spacing[3.5], borderWidth: 1.5, borderColor: colors.primaryBorder,
    ...shadow.sm,
  },
  actionBtnActive: { backgroundColor: '#D1FAE5', borderColor: '#059669' },
  actionBtnText: { fontFamily: typography.sansSemiBold, fontSize: fontSize.sm, color: colors.primary },

  rowAction: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.primarySurface },
  rowActionText: { fontFamily: typography.sansMedium, fontSize: 11, color: colors.primary },
  rowActionPending: { backgroundColor: '#FEF3C7' },
  rowActionDone: { backgroundColor: '#D1FAE5' },
  rowActionRejected: { backgroundColor: '#FEE2E2' },
});
