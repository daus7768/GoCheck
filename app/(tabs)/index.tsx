import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import { colors, typography, fontSize, spacing, radius, shadow } from '../../src/theme/tokens';
import { useBillStore } from '../../src/store/billStore';
import { useReminderStore } from '../../src/store/reminderStore';
import { useProfileStore } from '../../src/store/profileStore';
import { getBillStats } from '../../src/lib/billStats';
import { computeReliability } from '../../src/lib/queueUtils';
import { haptic } from '../../src/lib/haptics';
import { AvatarStack } from '../../src/components/dashboard/AvatarStack';
import { StatusPill } from '../../src/components/dashboard/StatusPill';
import { CURRENCY_SYMBOLS } from '../../src/types';
import type { Bill, QueueItem, ReliabilityLabel } from '../../src/types';

const WHATSAPP = '#25D366';
const WHATSAPP_SHADOW = 'rgba(37,211,102,0.4)';

function fmt(amount: number): string {
  return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function reliabilityScore(label: ReliabilityLabel | null): number {
  switch (label) {
    case 'reliable':
      return 95;
    case 'on-time':
      return 80;
    case 'slow':
      return 60;
    case 'at-risk':
      return 30;
    default:
      return 75;
  }
}

const RELIABILITY_CHIP: Record<
  'reliable' | 'on-time' | 'slow' | 'at-risk' | 'new',
  { label: string; bg: string; text: string }
> = {
  reliable: { label: 'Reliable', bg: colors.secondarySurface, text: colors.secondaryDark },
  'on-time': { label: 'On-time', bg: colors.primarySurface, text: colors.primary },
  slow: { label: 'Slow', bg: colors.warningSurface, text: colors.warning },
  'at-risk': { label: 'At risk', bg: colors.errorSurface, text: colors.error },
  new: { label: 'New', bg: colors.gray100, text: colors.textSecondary },
};

function Donut({ pct }: { pct: number }) {
  const size = 78;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const filled = (Math.min(Math.max(pct, 0), 100) / 100) * circ;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="rgba(255,255,255,0.22)"
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="#fff"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circ}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text style={styles.donutPct}>{pct}%</Text>
      <Text style={styles.donutSub}>COLLECTED</Text>
    </View>
  );
}

type FilterId = 'active' | 'overdue' | 'recurring' | 'all';

interface NudgeRow {
  item: QueueItem;
  reliability: ReliabilityLabel | null;
  score: number;
  overdue: boolean;
  daysToDue: number;
  urgency: number;
}

function BillRowV2({ bill, onPress }: { bill: Bill; onPress: () => void }) {
  const stats = getBillStats(bill);
  const sym = CURRENCY_SYMBOLS[bill.currency] ?? bill.currency;
  const status = stats.done ? 'paid' : stats.overdue ? 'overdue' : stats.pct >= 50 ? 'partial' : 'unpaid';
  const barColor = stats.done
    ? colors.secondary
    : stats.overdue
      ? colors.error
      : stats.pct >= 50
        ? colors.warning
        : colors.primary;

  return (
    <Pressable
      style={({ pressed }) => [styles.billRow, pressed && { opacity: 0.9 }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${bill.title}`}
    >
      <View style={styles.billRowTop}>
        <View style={styles.billRowTitleWrap}>
          <View style={styles.billRowTitleLine}>
            <Text style={styles.billRowTitle} numberOfLines={1}>
              {bill.title}
            </Text>
            {bill.isRecurring ? (
              <View style={styles.recurringChip}>
                <Feather name="repeat" size={9} color={colors.primary} />
                <Text style={styles.recurringChipText}>
                  {bill.isRecurring === 'yearly' ? 'YEARLY' : 'MONTHLY'}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={styles.billRowMeta}>
            {stats.overdue ? (
              <>
                <Feather name="alert-circle" size={11} color={colors.error} />
                <Text style={styles.billRowMetaOverdue}>
                  {Math.abs(stats.daysToDue)}d overdue · {stats.paidCount}/{stats.totalCount} paid
                </Text>
              </>
            ) : (
              <Text style={styles.billRowMetaText}>
                Due {new Date(bill.dueDate).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })} ·{' '}
                {stats.paidCount}/{stats.totalCount} paid
              </Text>
            )}
          </View>
        </View>
        <View style={styles.billRowAmountWrap}>
          <Text style={styles.billRowAmount}>
            {sym}
            {fmt(bill.totalAmount)}
          </Text>
          <Text style={styles.billRowCollected}>
            {sym}
            {fmt(stats.collected)} in
          </Text>
        </View>
      </View>

      <View style={styles.billRowBottom}>
        <AvatarStack people={bill.participants} size={22} max={5} />
        <View style={styles.billRowBar}>
          <View style={styles.billRowBarTrack}>
            <View style={[styles.billRowBarFill, { width: `${stats.pct}%`, backgroundColor: barColor }]} />
          </View>
        </View>
        <StatusPill status={status} />
      </View>
    </Pressable>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { bills, fetchBills, isLoading } = useBillStore();
  const { sendReminder } = useReminderStore();
  const sessionUserId = useProfileStore(s => s.session?.user.id) ?? '';
  const [filter, setFilter] = useState<FilterId>('active');

  useEffect(() => {
    if (!sessionUserId) return;
    fetchBills(sessionUserId);
  }, [sessionUserId]);

  const activeBills = useMemo(
    () =>
      bills
        .filter((b) => b.status === 'active' && !getBillStats(b).done)
        .sort((a, b) => {
          const sa = getBillStats(a);
          const sb = getBillStats(b);
          return Number(sb.overdue) - Number(sa.overdue) || sa.daysToDue - sb.daysToDue;
        }),
    [bills]
  );

  const overdueBills = useMemo(() => bills.filter((b) => getBillStats(b).overdue), [bills]);
  const recurringBills = useMemo(() => bills.filter((b) => b.isRecurring), [bills]);

  const totals = useMemo(() => {
    return activeBills.reduce(
      (acc, b) => {
        const s = getBillStats(b);
        acc.amount += b.totalAmount;
        acc.collected += s.collected;
        acc.remaining += s.remaining;
        return acc;
      },
      { amount: 0, collected: 0, remaining: 0 }
    );
  }, [activeBills]);

  const overallPct = totals.amount > 0 ? Math.round((totals.collected / totals.amount) * 100) : 0;

  const needsNudge = useMemo<NudgeRow[]>(() => {
    const rows: NudgeRow[] = [];
    for (const bill of activeBills) {
      const stats = getBillStats(bill);
      for (const p of bill.participants) {
        if (p.isPaid || p.id === sessionUserId) continue;
        const reliability = computeReliability(p.name, bills);
        const score = reliabilityScore(reliability);
        const urgency =
          (stats.overdue ? 100 + Math.abs(stats.daysToDue) : stats.daysToDue <= 3 ? 50 : 10) +
          (100 - score);
        rows.push({
          item: {
            billId: bill.id,
            billTitle: bill.title,
            participantId: p.id,
            participantName: p.name,
            participantPhone: p.phone,
            participantEmail: p.email,
            participantAvatarColor: p.avatarColor,
            amount: p.amount,
            currency: bill.currency,
            dueDate: bill.dueDate,
            shareLink: bill.shareLink,
            daysToDue: stats.daysToDue,
          },
          reliability,
          score,
          overdue: stats.overdue,
          daysToDue: stats.daysToDue,
          urgency,
        });
      }
    }
    return rows.sort((a, b) => b.urgency - a.urgency).slice(0, 4);
  }, [activeBills, bills]);

  const displayBills =
    filter === 'overdue'
      ? overdueBills
      : filter === 'recurring'
        ? recurringBills
        : filter === 'all'
          ? bills
          : activeBills;

  const sym = CURRENCY_SYMBOLS[activeBills[0]?.currency ?? 'MYR'] ?? 'RM';

  const filterTabs: { id: FilterId; label: string; count: number }[] = [
    { id: 'active', label: 'Active', count: activeBills.length },
    { id: 'overdue', label: 'Overdue', count: overdueBills.length },
    { id: 'recurring', label: 'Recurring', count: recurringBills.length },
    { id: 'all', label: 'All', count: bills.length },
  ];

  function handleNudge(row: NudgeRow) {
    haptic.impact();
    sendReminder(row.item, 'whatsapp');
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing[2] }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar */}
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.push('/(tabs)/profile')}
            accessibilityRole="button"
            accessibilityLabel="Open profile"
          >
            <LinearGradient
              colors={[colors.primaryLight, colors.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.topAvatar}
            >
              <Text style={styles.topAvatarText}>G</Text>
            </LinearGradient>
          </Pressable>
          <Text style={styles.topTitle}>GoCheck</Text>
          <Pressable
            onPress={() => router.push('/(modals)/reminders')}
            accessibilityRole="button"
            accessibilityLabel="Open reminders"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.bellBtn}
          >
            <Feather name="bell" size={22} color={colors.textPrimary} />
            {needsNudge.length > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{needsNudge.length}</Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* Hero */}
        <LinearGradient
          colors={[colors.primaryLight, colors.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroBlobTop} />
          <View style={styles.heroBlobBottom} />
          <View style={styles.heroContent}>
            <Text style={styles.heroEyebrow}>Still to collect</Text>
            <View style={styles.heroMainRow}>
              <View style={styles.heroAmountWrap}>
                {isLoading && bills.length === 0 ? (
                  <ActivityIndicator color={colors.white} style={{ alignSelf: 'flex-start', marginVertical: spacing[2] }} />
                ) : (
                  <Text style={styles.heroAmount}>
                    {sym} {fmt(totals.remaining)}
                  </Text>
                )}
                <Text style={styles.heroSub}>
                  from{' '}
                  <Text style={styles.heroSubBold}>
                    {needsNudge.length} {needsNudge.length === 1 ? 'person' : 'people'}
                  </Text>{' '}
                  across {activeBills.length} active {activeBills.length === 1 ? 'bill' : 'bills'}
                </Text>
              </View>
              <Donut pct={overallPct} />
            </View>
            <View style={styles.splitTrack}>
              <View style={[styles.splitFill, { width: `${overallPct}%` }]} />
            </View>
            <View style={styles.splitLabels}>
              <Text style={styles.splitLabel}>
                Collected {sym} {fmt(totals.collected)}
              </Text>
              <Text style={styles.splitLabel}>
                Total {sym} {fmt(totals.amount)}
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* Needs a nudge */}
        {needsNudge.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <View style={styles.sectionHeadLeft}>
                <Text style={styles.sectionTitle}>Needs a nudge</Text>
                <View style={styles.nudgeCount}>
                  <Text style={styles.nudgeCountText}>{needsNudge.length}</Text>
                </View>
              </View>
              <Pressable
                onPress={() => router.push('/(modals)/reminders')}
                accessibilityRole="button"
                accessibilityLabel="See all reminders"
              >
                <Text style={styles.seeAll}>See all →</Text>
              </Pressable>
            </View>
            <View style={{ gap: spacing[2] }}>
              {needsNudge.map((row) => {
                const chip = RELIABILITY_CHIP[row.reliability ?? 'new'];
                const initial = row.item.participantName.charAt(0).toUpperCase();
                const s = CURRENCY_SYMBOLS[row.item.currency] ?? row.item.currency;
                return (
                  <View key={`${row.item.billId}:${row.item.participantId}`} style={styles.nudgeRow}>
                    <View style={[styles.nudgeAvatar, { backgroundColor: row.item.participantAvatarColor }]}>
                      <Text style={styles.nudgeAvatarText}>{initial}</Text>
                    </View>
                    <View style={styles.nudgeInfo}>
                      <View style={styles.nudgeNameLine}>
                        <Text style={styles.nudgeName} numberOfLines={1}>
                          {row.item.participantName}
                        </Text>
                        <View style={[styles.relChip, { backgroundColor: chip.bg }]}>
                          <Text style={[styles.relChipText, { color: chip.text }]}>{chip.label}</Text>
                        </View>
                      </View>
                      <Text style={styles.nudgeMeta} numberOfLines={1}>
                        {row.item.billTitle} ·{' '}
                        {row.overdue ? (
                          <Text style={styles.nudgeMetaOverdue}>{Math.abs(row.daysToDue)}d late</Text>
                        ) : row.daysToDue === 0 ? (
                          'due today'
                        ) : (
                          `in ${row.daysToDue}d`
                        )}
                      </Text>
                    </View>
                    <View style={styles.nudgeRight}>
                      <Text style={styles.nudgeAmount}>
                        {s}
                        {fmt(row.item.amount)}
                      </Text>
                      <Pressable
                        onPress={() => handleNudge(row)}
                        accessibilityRole="button"
                        accessibilityLabel={`Send WhatsApp reminder to ${row.item.participantName}`}
                        style={({ pressed }) => [styles.waBtn, pressed && { opacity: 0.85 }]}
                      >
                        <Feather name="message-circle" size={15} color={colors.white} />
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Bills */}
        <View style={styles.section}>
          <View style={styles.billsHead}>
            <Text style={styles.sectionTitle}>Your bills</Text>
            <Pressable
              onPress={() => router.push('/(modals)/create')}
              accessibilityRole="button"
              accessibilityLabel="Create new bill"
              style={({ pressed }) => [styles.newBillBtn, pressed && { opacity: 0.9 }]}
            >
              <Feather name="plus" size={13} color={colors.white} />
              <Text style={styles.newBillText}>New bill</Text>
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {filterTabs.map((t) => {
              const active = t.id === filter;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => {
                    haptic.selection();
                    setFilter(t.id);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${t.label} bills`}
                  accessibilityState={{ selected: active }}
                  style={[styles.filterPill, active ? styles.filterPillActive : styles.filterPillIdle]}
                >
                  <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>
                    {t.label}
                  </Text>
                  <View style={[styles.filterBadge, active && styles.filterBadgeActive]}>
                    <Text style={[styles.filterBadgeText, active && styles.filterBadgeTextActive]}>
                      {t.count}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          {isLoading && bills.length === 0 ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : displayBills.length === 0 ? (
            <View style={styles.empty}>
              <Feather name="check-circle" size={44} color={colors.gray300} />
              <Text style={styles.emptyTitle}>All settled</Text>
              <Text style={styles.emptySub}>You're all caught up. Time to relax.</Text>
            </View>
          ) : (
            <View style={{ gap: spacing[2.5] }}>
              {displayBills.map((bill) => (
                <BillRowV2
                  key={bill.id}
                  bill={bill}
                  onPress={() => router.push(`/(modals)/bill/${bill.id}`)}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingBottom: spacing[12] },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[3],
  },
  topAvatar: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
    ...shadow.sm,
  },
  topAvatarText: { fontFamily: typography.sansBold, fontSize: fontSize.sm, color: colors.white },
  topTitle: { fontFamily: typography.sansSemiBold, fontSize: fontSize.base, color: colors.textPrimary },
  bellBtn: { padding: spacing[1.5] },
  bellBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: radius.full,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadgeText: { fontFamily: typography.sansBold, fontSize: 9, color: colors.white },

  hero: {
    marginHorizontal: spacing[4],
    borderRadius: radius.xl,
    padding: spacing[5],
    overflow: 'hidden',
    ...shadow.lg,
  },
  heroBlobTop: {
    position: 'absolute',
    top: -50,
    right: -40,
    width: 180,
    height: 180,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  heroBlobBottom: {
    position: 'absolute',
    bottom: -70,
    left: -30,
    width: 140,
    height: 140,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  heroContent: { position: 'relative' },
  heroEyebrow: {
    fontFamily: typography.sansBold,
    fontSize: fontSize.xs,
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heroMainRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing[4],
    marginTop: spacing[1.5],
  },
  heroAmountWrap: { flex: 1, minWidth: 0 },
  heroAmount: {
    fontFamily: typography.sansBold,
    fontSize: fontSize['3xl'],
    color: colors.white,
    letterSpacing: -0.5,
  },
  heroSub: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.85)',
    marginTop: spacing[2],
  },
  heroSubBold: { fontFamily: typography.sansBold, color: colors.white },
  donutPct: { fontFamily: typography.sansBold, fontSize: fontSize.lg, color: colors.white },
  donutSub: { fontFamily: typography.sansRegular, fontSize: 9, color: 'rgba(255,255,255,0.85)' },
  splitTrack: {
    marginTop: spacing[3.5],
    height: 6,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.22)',
    overflow: 'hidden',
  },
  splitFill: { height: '100%', backgroundColor: colors.white, borderRadius: radius.full },
  splitLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing[1.5] },
  splitLabel: { fontFamily: typography.sansRegular, fontSize: fontSize['2xs'], color: 'rgba(255,255,255,0.85)' },

  section: { marginHorizontal: spacing[4], marginTop: spacing[4] },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing[2],
  },
  sectionHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  sectionTitle: { fontFamily: typography.sansBold, fontSize: fontSize.sm, color: colors.textPrimary },
  nudgeCount: {
    backgroundColor: colors.warningSurface,
    borderRadius: radius.full,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
  },
  nudgeCountText: { fontFamily: typography.sansBold, fontSize: fontSize['2xs'], color: colors.warning },
  seeAll: { fontFamily: typography.sansMedium, fontSize: fontSize.xs, color: colors.primary },

  nudgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing[3],
    ...shadow.sm,
  },
  nudgeAvatar: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nudgeAvatarText: { fontFamily: typography.sansBold, fontSize: fontSize.base, color: colors.white },
  nudgeInfo: { flex: 1, minWidth: 0 },
  nudgeNameLine: { flexDirection: 'row', alignItems: 'center', gap: spacing[1.5] },
  nudgeName: { fontFamily: typography.sansSemiBold, fontSize: fontSize.sm, color: colors.textPrimary, flexShrink: 1 },
  relChip: { borderRadius: radius.full, paddingHorizontal: spacing[1.5], paddingVertical: 1 },
  relChipText: { fontFamily: typography.sansBold, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.3 },
  nudgeMeta: { fontFamily: typography.sansRegular, fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 1 },
  nudgeMetaOverdue: { fontFamily: typography.sansSemiBold, color: colors.error },
  nudgeRight: { alignItems: 'flex-end', gap: spacing[1.5] },
  nudgeAmount: { fontFamily: typography.monoMedium, fontSize: fontSize.sm, color: colors.textPrimary },
  waBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: WHATSAPP,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: WHATSAPP_SHADOW,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 3,
  },

  billsHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing[2],
  },
  newBillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    ...shadow.sm,
  },
  newBillText: { fontFamily: typography.sansSemiBold, fontSize: fontSize.xs, color: colors.white },

  filterRow: { gap: spacing[1.5], paddingVertical: spacing[1], paddingBottom: spacing[3] },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: radius.full,
  },
  filterPillActive: { backgroundColor: colors.gray900 },
  filterPillIdle: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.gray200 },
  filterPillText: { fontFamily: typography.sansSemiBold, fontSize: fontSize.xs, color: colors.textSecondary },
  filterPillTextActive: { color: colors.white },
  filterBadge: {
    backgroundColor: colors.gray100,
    borderRadius: radius.full,
    paddingHorizontal: spacing[1.5],
    paddingVertical: 1,
    minWidth: 18,
    alignItems: 'center',
  },
  filterBadgeActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
  filterBadgeText: { fontFamily: typography.sansMedium, fontSize: fontSize['2xs'], color: colors.textSecondary },
  filterBadgeTextActive: { color: colors.white },

  billRow: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing[3.5],
    gap: spacing[2.5],
    ...shadow.md,
  },
  billRowTop: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing[2.5] },
  billRowTitleWrap: { flex: 1, minWidth: 0 },
  billRowTitleLine: { flexDirection: 'row', alignItems: 'center', gap: spacing[1.5] },
  billRowTitle: { fontFamily: typography.sansSemiBold, fontSize: fontSize.base, color: colors.textPrimary, flexShrink: 1 },
  recurringChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.primarySurface,
    borderRadius: radius.full,
    paddingHorizontal: spacing[1.5],
    paddingVertical: 1,
  },
  recurringChipText: { fontFamily: typography.sansBold, fontSize: 9, color: colors.primary, letterSpacing: 0.3 },
  billRowMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], marginTop: 3 },
  billRowMetaText: { fontFamily: typography.sansRegular, fontSize: fontSize.xs, color: colors.textSecondary },
  billRowMetaOverdue: { fontFamily: typography.sansMedium, fontSize: fontSize.xs, color: colors.error },
  billRowAmountWrap: { alignItems: 'flex-end' },
  billRowAmount: { fontFamily: typography.sansBold, fontSize: fontSize.base, color: colors.textPrimary },
  billRowCollected: { fontFamily: typography.monoRegular, fontSize: fontSize['2xs'], color: colors.textSecondary, marginTop: 2 },
  billRowBottom: { flexDirection: 'row', alignItems: 'center', gap: spacing[2.5] },
  billRowBar: { flex: 1 },
  billRowBarTrack: { height: 5, borderRadius: radius.full, backgroundColor: colors.gray100, overflow: 'hidden' },
  billRowBarFill: { height: '100%', borderRadius: radius.full },

  loadingWrap: { paddingVertical: spacing[12], alignItems: 'center' },
  empty: { alignItems: 'center', paddingVertical: spacing[10], gap: spacing[2] },
  emptyTitle: { fontFamily: typography.sansSemiBold, fontSize: fontSize.md, color: colors.textPrimary },
  emptySub: { fontFamily: typography.sansRegular, fontSize: fontSize.sm, color: colors.textSecondary },
});
