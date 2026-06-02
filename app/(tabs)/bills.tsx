import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { format } from 'date-fns';
import {
  colors, typography, fontSize, spacing, radius, shadow,
} from '../../src/theme/tokens';
import { useTheme } from '../../src/theme/ThemeContext';
import { useBillStore } from '../../src/store/billStore';
import { useReminderStore } from '../../src/store/reminderStore';
import { buildQueueItems } from '../../src/lib/queueUtils';
import { getBillStats } from '../../src/lib/billStats';
import { useProfileStore } from '../../src/store/profileStore';
import { CURRENCY_SYMBOLS } from '../../src/types';
import type { Bill } from '../../src/types';
import { GlowingCard } from '../../src/components/effects/GlowingCard';
import { AnimatedBar } from '../../src/components/effects/AnimatedBar';
import { FadeInUp } from '../../src/components/effects/FadeInUp';
import { GradientBorderRing } from '../../src/components/effects/GradientBorderRing';
import { DottedGlowBackground } from '../../src/components/effects/DottedGlowBackground';
import { SheenButton } from '../../src/components/effects/SheenButton';
import { ColourfulText } from '../../src/components/effects/ColourfulText';
import { AnimatedTooltipStack } from '../../src/components/dashboard/AnimatedTooltipStack';
import { StatusPill } from '../../src/components/dashboard/StatusPill';
import { AppText } from '../../src/components/AppText';
import { haptic } from '../../src/lib/haptics';

type FilterId = 'active' | 'overdue' | 'recurring' | 'all';

function fmt(amount: number): string {
  return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function BillCard({ bill, index, onPress }: { bill: Bill; index: number; onPress: () => void }) {
  const { colors: c, isDark } = useTheme();
  const stats = getBillStats(bill);
  const sym = CURRENCY_SYMBOLS[bill.currency] ?? bill.currency;

  const status = stats.done
    ? 'paid'
    : stats.overdue
    ? 'overdue'
    : stats.pct >= 50
    ? 'partial'
    : 'unpaid';

  const barColor = stats.done
    ? colors.secondary
    : stats.overdue
    ? colors.error
    : stats.pct >= 50
    ? colors.warning
    : colors.primary;

  const glowColor = stats.done
    ? colors.secondary
    : stats.overdue
    ? colors.error
    : colors.primary;

  return (
    <FadeInUp index={index}>
      <GlowingCard radius={radius.xl} color={glowColor} background={c.surface}>
        <Pressable
          style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={`Open ${bill.title}`}
        >
          {/* Top-edge highlight in dark mode */}
          {isDark && (
            <View style={styles.cardTopEdge} />
          )}

          {/* Title row */}
          <View style={styles.cardTop}>
            <View style={styles.cardTitleWrap}>
              <View style={styles.cardTitleLine}>
                <AppText style={[styles.cardTitle, { color: c.textPrimary }]} numberOfLines={1}>
                  {bill.title}
                </AppText>
                {bill.isRecurring ? (
                  <View style={[styles.recurringChip, { backgroundColor: c.primarySurface }]}>
                    <Feather name="repeat" size={9} color={colors.primary} />
                    <AppText style={styles.recurringChipText}>
                      {bill.isRecurring === 'yearly' ? 'YEARLY' : 'MONTHLY'}
                    </AppText>
                  </View>
                ) : null}
              </View>
              <View style={styles.cardMeta}>
                {stats.overdue ? (
                  <>
                    <Feather name="alert-circle" size={11} color={colors.error} />
                    <AppText style={styles.cardMetaOverdue}>
                      {Math.abs(stats.daysToDue)}d overdue · {stats.paidCount}/{stats.totalCount} paid
                    </AppText>
                  </>
                ) : (
                  <AppText style={[styles.cardMetaText, { color: c.textSecondary }]}>
                    Due {format(new Date(bill.dueDate), 'dd MMM')} · {stats.paidCount}/{stats.totalCount} paid
                  </AppText>
                )}
              </View>
            </View>
            <View style={styles.cardAmountWrap}>
              <AppText style={[styles.cardAmount, { color: c.textPrimary }]}>
                {sym}{fmt(bill.totalAmount)}
              </AppText>
              <AppText style={[styles.cardCollected, { color: c.textSecondary }]}>
                {sym}{fmt(stats.collected)} in
              </AppText>
            </View>
          </View>

          {/* Progress bar */}
          <AnimatedBar
            pct={stats.pct}
            height={4}
            trackColor={isDark ? 'rgba(255,255,255,0.06)' : colors.gray100}
            fillColor={barColor}
            duration={780}
            delay={120 + index * 60}
            style={styles.cardBar}
          />

          {/* Bottom row */}
          <View style={styles.cardBottom}>
            <AnimatedTooltipStack
              people={bill.participants}
              currency={bill.currency}
              size={22}
              max={5}
            />
            <StatusPill status={status} />
          </View>
        </Pressable>
      </GlowingCard>
    </FadeInUp>
  );
}

function EmptyState({ filter }: { filter: FilterId }) {
  const { colors: c } = useTheme();
  const messages: Record<FilterId, { title: string; colorWord: string; sub: string }> = {
    active:    { title: 'All ', colorWord: 'settled',  sub: "You're all caught up. Time to relax." },
    overdue:   { title: 'No ', colorWord: 'overdue',   sub: 'Nothing overdue — great work!' },
    recurring: { title: 'No ', colorWord: 'recurring', sub: 'Set up a recurring bill to see it here.' },
    all:       { title: 'No ', colorWord: 'bills yet', sub: 'Create your first bill to get started.' },
  };
  const { title, colorWord, sub } = messages[filter];

  return (
    <FadeInUp index={0}>
      <View style={styles.empty}>
        <View style={styles.emptyHalo}>
          <DottedGlowBackground
            gap={14}
            radius={1.4}
            opacity={0.55}
            color={colors.primary}
            glowColor={colors.primaryLight}
            focusX={0.5}
            focusY={0.5}
            speedMin={2.4}
            speedMax={5}
            maxDots={260}
          />
          <View style={[styles.emptyIconCircle, { backgroundColor: c.secondarySurface }]}>
            <Feather name="check-circle" size={36} color={colors.secondary} />
          </View>
        </View>
        <View style={styles.emptyTitleRow}>
          <AppText style={[styles.emptyTitle, { color: c.textPrimary }]}>{title}</AppText>
          <ColourfulText text={colorWord} style={[styles.emptyTitle, { color: c.textPrimary }]} />
        </View>
        <AppText style={[styles.emptySub, { color: c.textSecondary }]}>{sub}</AppText>
        <SheenButton
          onPress={() => router.push('/(modals)/create')}
          accessibilityLabel="Create new bill"
          size="sm"
          glowBorder
        >
          <Feather name="plus" size={13} color={colors.white} />
          <AppText style={styles.emptyBtnText}>Create bill</AppText>
        </SheenButton>
      </View>
    </FadeInUp>
  );
}

export default function BillsScreen() {
  const insets = useSafeAreaInsets();
  const { colors: c } = useTheme();
  const { bills, fetchBills, isLoading } = useBillStore();
  const { sent, settings } = useReminderStore();
  const sessionUserId = useProfileStore((s) => s.session?.user.id) ?? '';
  const [filter, setFilter] = useState<FilterId>('active');

  const { items: queueItems } = useMemo(
    () => buildQueueItems(bills, sent, settings, sessionUserId),
    [bills, sent, settings, sessionUserId]
  );
  const bellBadge = queueItems.length;

  useEffect(() => {
    if (!sessionUserId) return;
    fetchBills(sessionUserId);
  }, [fetchBills, sessionUserId]);

  const activeBills    = useMemo(() => bills.filter((b) => b.status === 'active' && !getBillStats(b).done), [bills]);
  const overdueBills   = useMemo(() => bills.filter((b) => getBillStats(b).overdue), [bills]);
  const recurringBills = useMemo(() => bills.filter((b) => b.isRecurring), [bills]);

  const displayBills = useMemo(() => {
    if (filter === 'overdue')   return overdueBills;
    if (filter === 'recurring') return recurringBills;
    if (filter === 'all')       return bills;
    return activeBills;
  }, [filter, bills, activeBills, overdueBills, recurringBills]);

  const filterTabs: { id: FilterId; label: string; count: number }[] = [
    { id: 'active',    label: 'Active',    count: activeBills.length },
    { id: 'overdue',   label: 'Overdue',   count: overdueBills.length },
    { id: 'recurring', label: 'Recurring', count: recurringBills.length },
    { id: 'all',       label: 'All',       count: bills.length },
  ];

  const ListHeader = useCallback(() => (
    <>
      {/* Filter strip */}
      <View style={styles.filterWrap}>
        {filterTabs.map((t) => {
          const active = t.id === filter;
          return (
            <GradientBorderRing key={t.id} thickness={1.5}>
              <Pressable
                onPress={() => { haptic.selection(); setFilter(t.id); }}
                accessibilityRole="button"
                accessibilityLabel={`${t.label} bills`}
                accessibilityState={{ selected: active }}
                style={[styles.filterPill, active ? styles.filterPillActive : { backgroundColor: c.surface }]}
              >
                <AppText style={[styles.filterPillText, active && styles.filterPillTextActive]}>
                  {t.label}
                </AppText>
                <View style={[styles.filterBadge, active && styles.filterBadgeActive]}>
                  <AppText style={[styles.filterBadgeText, active && styles.filterBadgeTextActive]}>
                    {t.count}
                  </AppText>
                </View>
              </Pressable>
            </GradientBorderRing>
          );
        })}
      </View>
    </>
  ), [filter, c.surface, filterTabs]);

  if (isLoading && bills.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: c.background, paddingTop: insets.top }]}>
        <View style={[styles.header, { backgroundColor: c.surface }]}>
          <AppText style={[styles.title, { color: c.textPrimary }]}>My Bills</AppText>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: c.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: c.surface }]}>
        <AppText style={[styles.title, { color: c.textPrimary }]}>My Bills</AppText>
        <View style={styles.headerActions}>
          <Pressable
            style={[styles.headerBtn, { backgroundColor: c.primarySurface, borderColor: c.primaryBorder }]}
            onPress={() => router.push('/(modals)/reminders')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Reminders"
          >
            <Feather name="bell" size={18} color={colors.primary} />
            {bellBadge > 0 && (
              <View style={styles.bellBadge}>
                <AppText style={styles.bellBadgeCount}>{bellBadge > 99 ? '99+' : bellBadge}</AppText>
              </View>
            )}
          </Pressable>
          <Pressable
            style={[styles.headerBtn, styles.headerBtnCreate]}
            onPress={() => router.push('/(modals)/create')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Create bill"
          >
            <Feather name="plus" size={18} color={colors.white} />
          </Pressable>
        </View>
      </View>

      <FlatList
        data={displayBills}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + spacing[6] },
          displayBills.length === 0 && styles.listEmpty,
        ]}
        ListHeaderComponent={ListHeader}
        renderItem={({ item, index }) => (
          <BillCard
            bill={item}
            index={index}
            onPress={() => router.push(`/(modals)/bill/${item.id}`)}
          />
        )}
        ListEmptyComponent={<EmptyState filter={filter} />}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
  },
  title: {
    fontFamily: typography.sansBold,
    fontSize: fontSize.xl,
    letterSpacing: -0.5,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  headerBtn: {
    width: 36, height: 36, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  headerBtnCreate: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  bellBadge: {
    position: 'absolute', top: -2, right: -2,
    backgroundColor: colors.error, borderRadius: radius.full,
    minWidth: 16, height: 16,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3, borderWidth: 1.5, borderColor: colors.white,
  },
  bellBadgeCount: { fontFamily: typography.sansBold, fontSize: 9, color: colors.white, lineHeight: 12 },

  filterWrap: {
    flexDirection: 'row',
    gap: spacing[1.5],
    paddingVertical: spacing[3],
  },
  filterPill: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1.5],
    paddingHorizontal: spacing[3], paddingVertical: spacing[1.5],
    borderRadius: radius.full,
  },
  filterPillActive: { backgroundColor: colors.gray900 },
  filterPillText: { fontFamily: typography.sansSemiBold, fontSize: fontSize.xs, color: colors.textSecondary },
  filterPillTextActive: { color: colors.white },
  filterBadge: {
    backgroundColor: colors.gray100, borderRadius: radius.full,
    paddingHorizontal: spacing[1.5], paddingVertical: 1, minWidth: 18, alignItems: 'center',
  },
  filterBadgeActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
  filterBadgeText: { fontFamily: typography.sansMedium, fontSize: fontSize['2xs'], color: colors.textSecondary },
  filterBadgeTextActive: { color: colors.white },

  list: { paddingHorizontal: spacing[4], paddingTop: 0, gap: spacing[2.5] },
  listEmpty: { flex: 1 },

  card: { padding: spacing[3.5], gap: spacing[2.5] },
  cardTopEdge: {
    position: 'absolute', top: 0, left: 16, right: 16, height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing[2.5] },
  cardTitleWrap: { flex: 1, minWidth: 0 },
  cardTitleLine: { flexDirection: 'row', alignItems: 'center', gap: spacing[1.5] },
  cardTitle: { fontFamily: typography.sansSemiBold, fontSize: fontSize.base, flexShrink: 1 },
  recurringChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    borderRadius: radius.full, paddingHorizontal: spacing[1.5], paddingVertical: 1,
  },
  recurringChipText: { fontFamily: typography.sansBold, fontSize: 9, color: colors.primary, letterSpacing: 0.3 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], marginTop: 3 },
  cardMetaText: { fontFamily: typography.sansRegular, fontSize: fontSize.xs },
  cardMetaOverdue: { fontFamily: typography.sansMedium, fontSize: fontSize.xs, color: colors.error },
  cardAmountWrap: { alignItems: 'flex-end' },
  cardAmount: { fontFamily: typography.sansBold, fontSize: fontSize.base },
  cardCollected: { fontFamily: typography.monoRegular, fontSize: fontSize['2xs'], marginTop: 2 },
  cardBar: { marginVertical: spacing[1] },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  empty: { alignItems: 'center', paddingVertical: spacing[10], gap: spacing[2], flex: 1 },
  emptyHalo: { width: 140, height: 140, alignItems: 'center', justifyContent: 'center', marginBottom: spacing[1] },
  emptyIconCircle: { width: 72, height: 72, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  emptyTitleRow: { flexDirection: 'row', alignItems: 'baseline' },
  emptyTitle: { fontFamily: typography.sansSemiBold, fontSize: fontSize.md },
  emptySub: { fontFamily: typography.sansRegular, fontSize: fontSize.sm, textAlign: 'center', maxWidth: 260 },
  emptyBtnText: { fontFamily: typography.sansSemiBold, fontSize: fontSize.xs, color: colors.white },
});
