import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Image,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography, fontSize, spacing, radius, shadow } from '../../src/theme/tokens';
import { useTheme } from '../../src/theme/ThemeContext';
import { useBillStore } from '../../src/store/billStore';
import { useReminderStore } from '../../src/store/reminderStore';
import { useProfileStore } from '../../src/store/profileStore';
import { getBillStats } from '../../src/lib/billStats';
import { computeReliability } from '../../src/lib/queueUtils';
import { haptic } from '../../src/lib/haptics';
import { StatusPill } from '../../src/components/dashboard/StatusPill';
import { AnimatedTooltipStack } from '../../src/components/dashboard/AnimatedTooltipStack';
import { BillDetailModal } from '../../src/components/dashboard/BillDetailModal';
import { GlowingCard } from '../../src/components/effects/GlowingCard';
import { FadeInUp } from '../../src/components/effects/FadeInUp';
import { CountUp } from '../../src/components/effects/CountUp';
import { AnimatedBar } from '../../src/components/effects/AnimatedBar';
import { AnimatedDonut } from '../../src/components/effects/AnimatedDonut';
import { ColourfulText } from '../../src/components/effects/ColourfulText';
import { DottedGlowBackground } from '../../src/components/effects/DottedGlowBackground';
import { SheenButton } from '../../src/components/effects/SheenButton';
import { TiltCard } from '../../src/components/effects/TiltCard';
import { GradientBorderRing } from '../../src/components/effects/GradientBorderRing';
import { AppText } from '../../src/components/AppText';
import { CURRENCY_SYMBOLS } from '../../src/types';
import type { Bill, QueueItem, ReliabilityLabel } from '../../src/types';

const WHATSAPP = '#25D366';
const WHATSAPP_SHADOW = 'rgba(37,211,102,0.4)';

// ── Text colours that always pop against the cosmic dark BackgroundBeams ─────
// Because the cosmic backdrop is permanent (independent of light/dark theme),
// page-level text outside opaque cards must use these fixed light tones so
// it stays readable in both theme modes.
const COSMIC_TEXT_PRIMARY = '#F0F0FF';
const COSMIC_TEXT_SECONDARY = 'rgba(240,240,255,0.62)';

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

type FilterId = 'active' | 'overdue' | 'recurring' | 'all';

interface NudgeRow {
  item: QueueItem;
  reliability: ReliabilityLabel | null;
  score: number;
  overdue: boolean;
  daysToDue: number;
  urgency: number;
  pendingReview: boolean;
}

function BillRowV2({ bill, onPress }: { bill: Bill; onPress: () => void }) {
  const { colors: c } = useTheme();
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
  const glowColor = stats.done
    ? colors.secondary
    : stats.overdue
      ? colors.error
      : colors.primary;

  const openLabel = `Open ${bill.title}`;

  return (
    <GlowingCard radius={radius.lg} color={glowColor} background={c.surface}>
      <View style={styles.billRow}>
        <Pressable
          style={({ pressed }) => [styles.billRowTop, pressed && { opacity: 0.92 }]}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={openLabel}
        >
          <View style={styles.billRowTitleWrap}>
            <View style={styles.billRowTitleLine}>
              <AppText style={[styles.billRowTitle, { color: c.textPrimary }]} numberOfLines={1}>
                {bill.title}
              </AppText>
              {bill.isRecurring ? (
                <View style={styles.recurringChip}>
                  <Feather name="repeat" size={9} color={colors.primary} />
                  <AppText style={styles.recurringChipText}>
                    {bill.isRecurring === 'yearly' ? 'YEARLY' : 'MONTHLY'}
                  </AppText>
                </View>
              ) : null}
            </View>
            <View style={styles.billRowMeta}>
              {stats.overdue ? (
                <>
                  <Feather name="alert-circle" size={11} color={colors.error} />
                  <AppText style={styles.billRowMetaOverdue}>
                    {Math.abs(stats.daysToDue)}d overdue · {stats.paidCount}/{stats.totalCount} paid
                  </AppText>
                </>
              ) : (
                <AppText style={[styles.billRowMetaText, { color: c.textSecondary }]}>
                  Due {new Date(bill.dueDate).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })} ·{' '}
                  {stats.paidCount}/{stats.totalCount} paid
                </AppText>
              )}
            </View>
          </View>
          <View style={styles.billRowAmountWrap}>
            <AppText style={[styles.billRowAmount, { color: c.textPrimary }]}>
              {sym}
              {fmt(bill.totalAmount)}
            </AppText>
            <AppText style={[styles.billRowCollected, { color: c.textSecondary }]}>
              {sym}
              {fmt(stats.collected)} in
            </AppText>
          </View>
        </Pressable>

        <View style={styles.billRowBottom}>
          <AnimatedTooltipStack people={bill.participants} currency={bill.currency} size={22} max={5} />
          <Pressable
            style={({ pressed }) => [styles.billRowBar, pressed && { opacity: 0.92 }]}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={openLabel}
          >
            <AnimatedBar
              pct={stats.pct}
              height={5}
              trackColor={c.gray100}
              fillColor={barColor}
              duration={780}
              delay={120}
            />
          </Pressable>
          <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={openLabel}
            style={({ pressed }) => [pressed && { opacity: 0.92 }]}
          >
            <StatusPill status={status} />
          </Pressable>
        </View>
      </View>
    </GlowingCard>
  );
}

export default function HomeScreen() {
  const { colors: c } = useTheme();
  const insets = useSafeAreaInsets();
  const { bills, fetchBills, isLoading } = useBillStore();
  const { sendReminder } = useReminderStore();
  const sessionUserId = useProfileStore(s => s.session?.user.id) ?? '';
  const [filter, setFilter] = useState<FilterId>('active');
  const [activeBill, setActiveBill] = useState<Bill | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // ── Logo ring spin ──────────────────────────────────────────────────────────
  const logoRotation = useSharedValue(0);
  useEffect(() => {
    logoRotation.value = withRepeat(
      withTiming(360, { duration: 7000, easing: Easing.linear }),
      -1,
      false
    );
    return () => cancelAnimation(logoRotation);
  }, [logoRotation]);

  const logoRingStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${logoRotation.value}deg` }],
  }));
  const logoInnerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-logoRotation.value}deg` }],
  }));

  // ── Bell shake when nudges pending ─────────────────────────────────────────
  const bellShake = useSharedValue(0);

  useEffect(() => {
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
        if (p.paymentStatus === 'confirmed' || p.id === sessionUserId) continue;
        const reliability = computeReliability(p.name, bills);
        const score = reliabilityScore(reliability);
        const pendingReview = p.paymentStatus === 'pending';
        // Pending review jumps to the top — organizer should act before reminding
        const urgency =
          (pendingReview ? 1000 : 0) +
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
          pendingReview,
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

  // Bell shake fires every ~4 s while nudges are pending
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    cancelAnimation(bellShake);
    if (needsNudge.length > 0) {
      bellShake.value = withRepeat(
        withSequence(
          withTiming(0,    { duration: 3600 }),
          withTiming(-14,  { duration: 55, easing: Easing.out(Easing.quad) }),
          withTiming( 12,  { duration: 55 }),
          withTiming(-9,   { duration: 55 }),
          withTiming( 6,   { duration: 55 }),
          withTiming(-3,   { duration: 55 }),
          withTiming(0,    { duration: 55 }),
        ),
        -1,
        false
      );
    } else {
      bellShake.value = withTiming(0, { duration: 200 });
    }
    return () => cancelAnimation(bellShake);
  }, [needsNudge.length, bellShake]);

  const bellStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${bellShake.value}deg` }],
  }));

  function handleNudge(row: NudgeRow) {
    haptic.impact();
    sendReminder(row.item, 'whatsapp');
  }

  function openBill(bill: Bill) {
    haptic.impact();
    setActiveBill(bill);
    setModalVisible(true);
  }

  function closeBill() {
    setModalVisible(false);
    setTimeout(() => setActiveBill(null), 220);
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing[2] }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar */}
        <FadeInUp index={0}>
          <View style={styles.topBar}>
            {/* ── Spinning gradient logo ring ── */}
            <Pressable
              onPress={() => router.push('/(tabs)/profile')}
              accessibilityRole="button"
              accessibilityLabel="Open profile"
            >
              <Animated.View style={[styles.topAvatarRing, logoRingStyle]}>
                <LinearGradient
                  colors={[colors.primaryLight, '#A78BFA', colors.primaryDark, '#22D3EE', colors.primaryLight]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <Animated.View style={[styles.topAvatarDisc, logoInnerStyle]}>
                  <Image
                    source={require('../../assets/logo_v5.jpg')}
                    style={styles.topAvatarLogo}
                    resizeMode="contain"
                  />
                </Animated.View>
              </Animated.View>
            </Pressable>

            {/* ── Colourful animated title ── */}
            <ColourfulText
              text="GoCheck"
              style={styles.topTitleColourful}
              palette={['#818CF8', '#A78BFA', '#22D3EE', '#10B981', '#6366F1', '#818CF8']}
              duration={5000}
              letterStaggerMs={80}
            />

            {/* ── Bell with shake animation ── */}
            <Pressable
              onPress={() => router.push('/(modals)/reminders')}
              accessibilityRole="button"
              accessibilityLabel="Open reminders"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.bellBtn}
            >
              <Animated.View style={bellStyle}>
                <Feather name="bell" size={22} color={c.textPrimary} />
              </Animated.View>
              {needsNudge.length > 0 && (
                <View style={styles.bellBadge}>
                  <AppText style={styles.bellBadgeText}>{needsNudge.length}</AppText>
                </View>
              )}
            </Pressable>
          </View>
        </FadeInUp>

        {/* Hero */}
        <FadeInUp index={1}>
          <TiltCard style={styles.heroWrap}>
            <GlowingCard radius={radius['2xl']} color={colors.primaryLight} background="transparent" borderWidth={1.5}>
              <LinearGradient
                colors={[colors.primaryLight, colors.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.hero}
              >
                {/* Ambient dotted glow */}
                <DottedGlowBackground
                  gap={18}
                  radius={1.4}
                  opacity={0.45}
                  color="#FFFFFF"
                  glowColor="#FFFFFF"
                  focusX={0.85}
                  focusY={0.2}
                  speedMin={2.6}
                  speedMax={5.4}
                  maxDots={220}
                />
                <View style={styles.heroBlobTop} />
                <View style={styles.heroBlobBottom} />
                <View style={styles.heroContent}>
                  {/* Eyebrow row with date */}
                  <View style={styles.heroEyebrowRow}>
                    <AppText style={styles.heroEyebrow}>Still to collect</AppText>
                    <AppText style={styles.heroDateLabel}>
                      {new Date().toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
                    </AppText>
                  </View>

                  {/* Amount + donut */}
                  <View style={styles.heroMainRow}>
                    <View style={styles.heroAmountWrap}>
                      {isLoading && bills.length === 0 ? (
                        <ActivityIndicator color={colors.white} style={{ alignSelf: 'flex-start', marginVertical: spacing[2] }} />
                      ) : (
                        <CountUp
                          value={totals.remaining}
                          decimals={2}
                          prefix={`${sym} `}
                          duration={900}
                          delay={150}
                          style={styles.heroAmount}
                        />
                      )}
                      <AppText style={styles.heroSub}>
                        from{' '}
                        <AppText style={styles.heroSubBold}>
                          {needsNudge.length} {needsNudge.length === 1 ? 'person' : 'people'}
                        </AppText>{' '}
                        across {activeBills.length} active {activeBills.length === 1 ? 'bill' : 'bills'}
                      </AppText>
                    </View>
                    <AnimatedDonut pct={overallPct} size={82} stroke={6} />
                  </View>

                  {/* Separator */}
                  <View style={styles.heroSeparator} />

                  {/* Progress bar */}
                  <AnimatedBar
                    pct={overallPct}
                    height={6}
                    trackColor="rgba(255,255,255,0.22)"
                    fillColor={colors.white}
                    delay={220}
                    duration={950}
                  />
                  <View style={styles.splitLabels}>
                    <AppText style={styles.splitLabel}>
                      Collected {sym} {fmt(totals.collected)}
                    </AppText>
                    <AppText style={styles.splitLabel}>
                      Total {sym} {fmt(totals.amount)}
                    </AppText>
                  </View>

                  {/* Quick action row */}
                  {needsNudge.length > 0 && (
                    <Pressable
                      onPress={() => router.push('/(modals)/reminders')}
                      style={({ pressed }) => [styles.heroActionRow, pressed && { opacity: 0.78 }]}
                      accessibilityRole="button"
                      accessibilityLabel="View pending reminders"
                    >
                      <View style={styles.heroActionLeft}>
                        <Feather name="zap" size={12} color="rgba(255,255,255,0.9)" />
                        <AppText style={styles.heroActionText}>
                          {needsNudge.length} pending {needsNudge.length === 1 ? 'nudge' : 'nudges'}
                        </AppText>
                      </View>
                      <Feather name="chevron-right" size={14} color="rgba(255,255,255,0.5)" />
                    </Pressable>
                  )}
                </View>
              </LinearGradient>
            </GlowingCard>
          </TiltCard>
        </FadeInUp>

        {/* Needs a nudge */}
        {needsNudge.length > 0 && (
          <View style={styles.section}>
            <FadeInUp index={2}>
              <View style={styles.sectionHead}>
                <View style={styles.sectionHeadLeft}>
                  <AppText style={[styles.sectionTitle, { color: COSMIC_TEXT_PRIMARY }]}>Needs a nudge</AppText>
                  <View style={styles.nudgeCount}>
                    <AppText style={styles.nudgeCountText}>{needsNudge.length}</AppText>
                  </View>
                </View>
                <Pressable
                  onPress={() => router.push('/(modals)/reminders')}
                  accessibilityRole="button"
                  accessibilityLabel="See all reminders"
                >
                  <AppText style={styles.seeAll}>See all →</AppText>
                </Pressable>
              </View>
            </FadeInUp>
            <View style={{ gap: spacing[2] }}>
              {needsNudge.map((row, i) => {
                const chip = RELIABILITY_CHIP[row.reliability ?? 'new'];
                const initial = row.item.participantName.charAt(0).toUpperCase();
                const s = CURRENCY_SYMBOLS[row.item.currency] ?? row.item.currency;
                return (
                  <FadeInUp index={3 + i} key={`${row.item.billId}:${row.item.participantId}`}>
                    <GlowingCard
                      radius={radius.lg}
                      background={c.surface}
                      color={row.overdue ? colors.error : colors.primary}
                    >
                      <View style={styles.nudgeRow}>
                        <View style={[styles.nudgeAvatar, { backgroundColor: row.item.participantAvatarColor }]}>
                          <AppText style={styles.nudgeAvatarText}>{initial}</AppText>
                        </View>
                        <View style={styles.nudgeInfo}>
                          <View style={styles.nudgeNameLine}>
                            <AppText style={[styles.nudgeName, { color: c.textPrimary }]} numberOfLines={1}>
                              {row.item.participantName}
                            </AppText>
                            {row.pendingReview ? (
                              <View style={styles.reviewChip}>
                                <Feather name="eye" size={10} color="#B45309" />
                                <AppText style={styles.reviewChipText}>Review</AppText>
                              </View>
                            ) : (
                              <View style={[styles.relChip, { backgroundColor: chip.bg }]}>
                                <AppText style={[styles.relChipText, { color: chip.text }]}>{chip.label}</AppText>
                              </View>
                            )}
                          </View>
                          <AppText style={[styles.nudgeMeta, { color: c.textSecondary }]} numberOfLines={1}>
                            {row.item.billTitle} ·{' '}
                            {row.pendingReview ? (
                              <AppText style={styles.nudgeMetaPending}>submitted payment</AppText>
                            ) : row.overdue ? (
                              <AppText style={styles.nudgeMetaOverdue}>{Math.abs(row.daysToDue)}d late</AppText>
                            ) : row.daysToDue === 0 ? (
                              'due today'
                            ) : (
                              `in ${row.daysToDue}d`
                            )}
                          </AppText>
                        </View>
                        <View style={styles.nudgeRight}>
                          <AppText style={[styles.nudgeAmount, { color: c.textPrimary }]}>
                            {s}
                            {fmt(row.item.amount)}
                          </AppText>
                          {row.pendingReview ? (
                            <Pressable
                              onPress={() => router.push(`/(modals)/bill/${row.item.billId}`)}
                              accessibilityRole="button"
                              accessibilityLabel={`Review ${row.item.participantName}'s payment`}
                              style={({ pressed }) => [styles.waBtn, styles.reviewBtn, pressed && { opacity: 0.85 }]}
                            >
                              <Feather name="eye" size={15} color={colors.white} />
                            </Pressable>
                          ) : (
                            <Pressable
                              onPress={() => handleNudge(row)}
                              accessibilityRole="button"
                              accessibilityLabel={`Send WhatsApp reminder to ${row.item.participantName}`}
                              style={({ pressed }) => [styles.waBtn, pressed && { opacity: 0.85 }]}
                            >
                              <Feather name="message-circle" size={15} color={colors.white} />
                            </Pressable>
                          )}
                        </View>
                      </View>
                    </GlowingCard>
                  </FadeInUp>
                );
              })}
            </View>
          </View>
        )}

        {/* Bills */}
        <View style={styles.section}>
          <FadeInUp index={needsNudge.length > 0 ? 4 : 2}>
            <View style={styles.billsHead}>
              <AppText style={[styles.sectionTitle, { color: COSMIC_TEXT_PRIMARY }]}>Your bills</AppText>
              <SheenButton
                onPress={() => router.push('/(modals)/create')}
                accessibilityLabel="Create new bill"
                size="sm"
                glowBorder
              >
                <Feather name="plus" size={13} color={colors.white} />
                <AppText style={styles.newBillText}>New bill</AppText>
              </SheenButton>
            </View>
          </FadeInUp>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {filterTabs.map((t) => {
              const active = t.id === filter;
              return (
                <GradientBorderRing key={t.id} thickness={1.5}>
                  <Pressable
                    onPress={() => {
                      haptic.selection();
                      setFilter(t.id);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`${t.label} bills`}
                    accessibilityState={{ selected: active }}
                    style={[styles.filterPill, active ? styles.filterPillActive : [styles.filterPillIdle, { backgroundColor: c.surface }]]}
                  >
                    <AppText style={[styles.filterPillText, { color: c.textSecondary }, active && styles.filterPillTextActive]}>
                      {t.label}
                    </AppText>
                    <View style={[styles.filterBadge, { backgroundColor: c.gray100 }, active && styles.filterBadgeActive]}>
                      <AppText style={[styles.filterBadgeText, { color: c.textSecondary }, active && styles.filterBadgeTextActive]}>
                        {t.count}
                      </AppText>
                    </View>
                  </Pressable>
                </GradientBorderRing>
              );
            })}
          </ScrollView>

          {isLoading && bills.length === 0 ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : displayBills.length === 0 ? (
            <FadeInUp index={0}>
              <View style={styles.empty}>
                <View style={styles.emptyHaloWrap}>
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
                  <View style={styles.emptyIconCircle}>
                    <Feather name="check-circle" size={36} color={colors.secondary} />
                  </View>
                </View>
                <View style={styles.emptyTitleRow}>
                  <AppText style={[styles.emptyTitle, { color: COSMIC_TEXT_PRIMARY }]}>All </AppText>
                  <ColourfulText text="settled" style={[styles.emptyTitle, { color: COSMIC_TEXT_PRIMARY }]} />
                </View>
                <AppText style={[styles.emptySub, { color: COSMIC_TEXT_SECONDARY }]}>You're all caught up. Time to relax.</AppText>
              </View>
            </FadeInUp>
          ) : (
            <View style={{ gap: spacing[2.5] }}>
              {displayBills.map((bill, i) => (
                <FadeInUp key={bill.id} index={i + (needsNudge.length > 0 ? 5 : 3)}>
                  <BillRowV2
                    bill={bill}
                    onPress={() => openBill(bill)}
                  />
                </FadeInUp>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <BillDetailModal
        bill={activeBill}
        allBills={bills}
        visible={modalVisible}
        onClose={closeBill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingBottom: spacing[12] },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[3],
  },
  topAvatarRing: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...shadow.md,
  },
  topAvatarDisc: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  topAvatarLogo: {
    width: 28,
    height: 28,
  },
  topTitleColourful: {
    fontFamily: typography.sansBold,
    fontSize: fontSize.lg,
    letterSpacing: 0.3,
  },
  bellBtn: { padding: spacing[1.5], position: 'relative' },
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

  heroWrap: {
    marginTop: spacing[1],
    marginBottom: spacing[1],
    marginHorizontal: spacing[4],
    borderRadius: radius['2xl'],
    ...shadow.indigoPulse,
  },
  hero: {
    padding: spacing[5],
    overflow: 'hidden',
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
  heroEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroEyebrow: {
    fontFamily: typography.sansBold,
    fontSize: fontSize.xs,
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heroDateLabel: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize['2xs'],
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 0.4,
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
  splitLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing[1.5] },
  splitLabel: { fontFamily: typography.sansRegular, fontSize: fontSize['2xs'], color: 'rgba(255,255,255,0.85)' },
  heroSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.22)',
    marginTop: spacing[3.5],
    marginBottom: spacing[1],
  },
  heroActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing[3],
    paddingTop: spacing[2.5],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
  heroActionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
  },
  heroActionText: {
    fontFamily: typography.sansMedium,
    fontSize: fontSize.xs,
    color: 'rgba(255,255,255,0.9)',
  },

  section: { marginHorizontal: spacing[4], marginTop: spacing[5] },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing[2],
  },
  sectionHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  sectionTitle: { fontFamily: typography.sansBold, fontSize: fontSize.base },
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
    padding: spacing[3],
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
  nudgeName: { fontFamily: typography.sansSemiBold, fontSize: fontSize.sm, flexShrink: 1 },
  relChip: { borderRadius: radius.full, paddingHorizontal: spacing[1.5], paddingVertical: 1 },
  relChipText: { fontFamily: typography.sansBold, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.3 },
  nudgeMeta: { fontFamily: typography.sansRegular, fontSize: fontSize.xs, marginTop: 1 },
  nudgeMetaOverdue: { fontFamily: typography.sansSemiBold, color: colors.error },
  nudgeMetaPending: { fontFamily: typography.sansSemiBold, color: '#B45309' },
  reviewChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FEF3C7', borderRadius: radius.full, paddingHorizontal: 6, paddingVertical: 2 },
  reviewChipText: { fontFamily: typography.sansBold, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.3, color: '#B45309' },
  reviewBtn: { backgroundColor: '#B45309', shadowColor: '#B45309' },
  nudgeRight: { alignItems: 'flex-end', gap: spacing[1.5] },
  nudgeAmount: { fontFamily: typography.monoMedium, fontSize: fontSize.sm },
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
  filterPillIdle: {},
  filterPillText: { fontFamily: typography.sansSemiBold, fontSize: fontSize.xs },
  filterPillTextActive: { color: colors.white },
  filterBadge: {
    borderRadius: radius.full,
    paddingHorizontal: spacing[1.5],
    paddingVertical: 1,
    minWidth: 18,
    alignItems: 'center',
  },
  filterBadgeActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
  filterBadgeText: { fontFamily: typography.sansMedium, fontSize: fontSize['2xs'] },
  filterBadgeTextActive: { color: colors.white },

  billRow: {
    padding: spacing[3.5],
    gap: spacing[2.5],
  },
  billRowTop: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing[2.5] },
  billRowTitleWrap: { flex: 1, minWidth: 0 },
  billRowTitleLine: { flexDirection: 'row', alignItems: 'center', gap: spacing[1.5] },
  billRowTitle: { fontFamily: typography.sansSemiBold, fontSize: fontSize.base, flexShrink: 1 },
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
  billRowMetaText: { fontFamily: typography.sansRegular, fontSize: fontSize.xs },
  billRowMetaOverdue: { fontFamily: typography.sansMedium, fontSize: fontSize.xs, color: colors.error },
  billRowAmountWrap: { alignItems: 'flex-end' },
  billRowAmount: { fontFamily: typography.sansBold, fontSize: fontSize.base },
  billRowCollected: { fontFamily: typography.monoRegular, fontSize: fontSize['2xs'], marginTop: 2 },
  billRowBottom: { flexDirection: 'row', alignItems: 'center', gap: spacing[2.5] },
  billRowBar: { flex: 1 },

  loadingWrap: { paddingVertical: spacing[12], alignItems: 'center' },
  empty: { alignItems: 'center', paddingVertical: spacing[8], gap: spacing[2] },
  emptyHaloWrap: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[1],
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    backgroundColor: colors.secondarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitleRow: { flexDirection: 'row', alignItems: 'baseline' },
  emptyTitle: { fontFamily: typography.sansSemiBold, fontSize: fontSize.md },
  emptySub: { fontFamily: typography.sansRegular, fontSize: fontSize.sm },
});
