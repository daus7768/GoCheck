import { useEffect } from 'react';
import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import {
  colors,
  typography,
  fontSize,
  spacing,
  radius,
  shadow,
} from '../../theme/tokens';
import { CURRENCY_SYMBOLS } from '../../types';
import type { Bill, ReliabilityLabel } from '../../types';
import { getBillStats } from '../../lib/billStats';
import { computeReliability } from '../../lib/queueUtils';
import { useReminderStore } from '../../store/reminderStore';
import { haptic } from '../../lib/haptics';
import { participantUrl } from '../../lib/urls';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { AnimatedBar } from '../effects/AnimatedBar';

const WHATSAPP = '#25D366';

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

function fmt(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface BillDetailModalProps {
  bill: Bill | null;
  allBills: Bill[];
  visible: boolean;
  onClose: () => void;
}

const SIGNATURE = Easing.bezier(0.22, 1, 0.36, 1);

export function BillDetailModal({ bill, allBills, visible, onClose }: BillDetailModalProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const sendReminder = useReminderStore((s) => s.sendReminder);

  const backdrop = useSharedValue(0);
  const sheet = useSharedValue(0);
  const scale = useSharedValue(0.92);

  useEffect(() => {
    if (visible) {
      backdrop.value = withTiming(1, { duration: 220, easing: SIGNATURE });
      if (reduceMotion) {
        sheet.value = 1;
        scale.value = 1;
      } else {
        sheet.value = withTiming(1, { duration: 320, easing: SIGNATURE });
        scale.value = withSpring(1, { damping: 18, stiffness: 220 });
      }
    } else {
      backdrop.value = withTiming(0, { duration: 180 });
      sheet.value = withTiming(0, { duration: 180 });
      scale.value = withTiming(0.96, { duration: 180 });
    }
  }, [visible, reduceMotion, backdrop, sheet, scale]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdrop.value,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    opacity: sheet.value,
    transform: [{ scale: scale.value }, { translateY: (1 - sheet.value) * 20 }],
  }));

  function handleClose() {
    haptic.selection();
    onClose();
  }

  function handleOpenFull() {
    if (!bill) return;
    haptic.impact();
    // Defer the close-then-navigate by a tick so the modal animates out cleanly.
    const id = bill.id;
    onClose();
    setTimeout(() => router.push(`/(modals)/bill/${id}`), 80);
  }

  function handleShare() {
    if (!bill) return;
    Share.share({
      message: `${bill.title} — split the bill: ${bill.shareLink}`,
      url: bill.shareLink,
      title: bill.title,
    }).catch(() => {});
  }

  function handleWhatsApp(participantIndex: number) {
    if (!bill) return;
    const p = bill.participants[participantIndex];
    if (!p) return;
    const stats = getBillStats(bill);
    haptic.impact();
    sendReminder(
      {
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
      'whatsapp'
    );
    // Also open WhatsApp directly if we have a phone number.
    if (p.phone) {
      const sym = CURRENCY_SYMBOLS[bill.currency] ?? bill.currency;
      const text = encodeURIComponent(
        `Hi ${p.name}! 👋\n\nYour share for *${bill.title}* is *${sym}${fmt(p.amount)}*.\n\nTap here to confirm your payment:\n${p.accessToken ? participantUrl(p.accessToken) : ''}`
      );
      const phone = p.phone.replace(/[^\d+]/g, '');
      Linking.openURL(`whatsapp://send?phone=${phone}&text=${text}`).catch(() => {});
    }
  }

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel="Close bill details"
        />
        <Animated.View
          style={[
            styles.sheetWrap,
            {
              paddingTop: insets.top + spacing[6],
              paddingBottom: insets.bottom + spacing[5],
            },
            sheetStyle,
          ]}
          pointerEvents="box-none"
        >
          {bill && (
            <View style={styles.sheet}>
              <ExpandedHeader bill={bill} onClose={handleClose} onShare={handleShare} />
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.body}
              >
                <ExpandedStats bill={bill} />
                <ExpandedParticipants
                  bill={bill}
                  allBills={allBills}
                  onWhatsApp={handleWhatsApp}
                />
                <View style={{ height: spacing[5] }} />
                <Pressable
                  onPress={handleOpenFull}
                  accessibilityRole="button"
                  accessibilityLabel="Open full bill"
                  style={({ pressed }) => [styles.openFullBtn, pressed && { opacity: 0.9 }]}
                >
                  <Text style={styles.openFullText}>Open full bill</Text>
                  <Feather name="arrow-right" size={16} color={colors.white} />
                </Pressable>
              </ScrollView>
            </View>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

function ExpandedHeader({
  bill,
  onClose,
  onShare,
}: {
  bill: Bill;
  onClose: () => void;
  onShare: () => void;
}) {
  const sym = CURRENCY_SYMBOLS[bill.currency] ?? bill.currency;
  return (
    <LinearGradient
      colors={[colors.primaryLight, colors.primaryDark]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.header}
    >
      <View style={styles.headerTopRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          {bill.isRecurring ? (
            <View style={styles.recurringChip}>
              <Feather name="repeat" size={10} color={colors.white} />
              <Text style={styles.recurringChipText}>
                {bill.isRecurring === 'yearly' ? 'YEARLY' : 'MONTHLY'}
              </Text>
            </View>
          ) : null}
          <Text style={styles.headerTitle} numberOfLines={2}>{bill.title}</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            onPress={onShare}
            accessibilityRole="button"
            accessibilityLabel="Share bill link"
            hitSlop={8}
            style={styles.iconBtn}
          >
            <Feather name="share-2" size={16} color={colors.white} />
          </Pressable>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={8}
            style={styles.iconBtn}
          >
            <Feather name="x" size={18} color={colors.white} />
          </Pressable>
        </View>
      </View>
      <Text style={styles.headerAmount}>
        {sym} {fmt(bill.totalAmount)}
      </Text>
      <Text style={styles.headerSub}>
        Due {new Date(bill.dueDate).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
      </Text>
    </LinearGradient>
  );
}

function ExpandedStats({ bill }: { bill: Bill }) {
  const stats = getBillStats(bill);
  const sym = CURRENCY_SYMBOLS[bill.currency] ?? bill.currency;
  return (
    <View style={styles.statsCard}>
      <View style={styles.statsRow}>
        <View style={styles.statsCol}>
          <Text style={styles.statsLabel}>Collected</Text>
          <Text style={styles.statsValue}>
            {sym} {fmt(stats.collected)}
          </Text>
        </View>
        <View style={styles.statsCol}>
          <Text style={styles.statsLabel}>Remaining</Text>
          <Text style={[styles.statsValue, { color: stats.overdue ? colors.error : colors.textPrimary }]}>
            {sym} {fmt(stats.remaining)}
          </Text>
        </View>
        <View style={styles.statsCol}>
          <Text style={styles.statsLabel}>Paid</Text>
          <Text style={styles.statsValue}>
            {stats.paidCount}/{stats.totalCount}
          </Text>
        </View>
      </View>
      <AnimatedBar
        pct={stats.pct}
        height={6}
        trackColor={colors.gray100}
        fillColor={stats.done ? colors.secondary : stats.overdue ? colors.error : colors.primary}
        delay={150}
        style={{ marginTop: spacing[3] }}
      />
    </View>
  );
}

function ExpandedParticipants({
  bill,
  allBills,
  onWhatsApp,
}: {
  bill: Bill;
  allBills: Bill[];
  onWhatsApp: (i: number) => void;
}) {
  const sym = CURRENCY_SYMBOLS[bill.currency] ?? bill.currency;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Participants</Text>
      <View style={{ gap: spacing[2] }}>
        {bill.participants.map((p, i) => {
          const reliability: ReliabilityLabel | null = computeReliability(p.name, allBills);
          const chip = RELIABILITY_CHIP[reliability ?? 'new'];
          const initial = p.name.charAt(0).toUpperCase();
          return (
            <View key={p.id} style={styles.partRow}>
              <View style={[styles.partAvatar, { backgroundColor: p.avatarColor }]}>
                <Text style={styles.partAvatarText}>{initial}</Text>
                {p.isPaid && (
                  <View style={styles.partPaidBadge}>
                    <Feather name="check" size={9} color={colors.white} />
                  </View>
                )}
              </View>
              <View style={styles.partInfo}>
                <View style={styles.partNameLine}>
                  <Text style={styles.partName} numberOfLines={1}>{p.name}</Text>
                  <View style={[styles.relChip, { backgroundColor: chip.bg }]}>
                    <Text style={[styles.relChipText, { color: chip.text }]}>{chip.label}</Text>
                  </View>
                </View>
                <Text style={styles.partAmount}>
                  {sym}
                  {fmt(p.amount)}
                  <Text style={styles.partAmountMeta}>
                    {p.isPaid ? '  ·  Paid' : '  ·  Unpaid'}
                  </Text>
                </Text>
              </View>
              {!p.isPaid && (
                <Pressable
                  onPress={() => onWhatsApp(i)}
                  accessibilityRole="button"
                  accessibilityLabel={`Send WhatsApp reminder to ${p.name}`}
                  style={({ pressed }) => [styles.partWaBtn, pressed && { opacity: 0.85 }]}
                >
                  <Feather name="message-circle" size={14} color={colors.white} />
                </Pressable>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(7, 10, 22, 0.55)',
    justifyContent: 'flex-start',
  },
  sheetWrap: {
    paddingHorizontal: spacing[4],
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius['2xl'],
    overflow: 'hidden',
    maxHeight: '92%',
    ...shadow.lg,
  },
  header: {
    padding: spacing[5],
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing[1.5],
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recurringChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: radius.full,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    marginBottom: spacing[1.5],
  },
  recurringChipText: {
    fontFamily: typography.sansBold,
    fontSize: 10,
    color: colors.white,
    letterSpacing: 0.4,
  },
  headerTitle: {
    fontFamily: typography.sansBold,
    fontSize: fontSize.xl,
    color: colors.white,
    letterSpacing: -0.4,
  },
  headerAmount: {
    fontFamily: typography.sansBold,
    fontSize: fontSize['3xl'],
    color: colors.white,
    letterSpacing: -0.5,
    marginTop: spacing[2],
  },
  headerSub: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },

  body: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    paddingBottom: spacing[4],
  },

  statsCard: {
    backgroundColor: colors.gray50,
    borderRadius: radius.lg,
    padding: spacing[3.5],
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  statsCol: { flex: 1 },
  statsLabel: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  statsValue: {
    fontFamily: typography.sansBold,
    fontSize: fontSize.base,
    color: colors.textPrimary,
    marginTop: 2,
  },

  section: { marginTop: spacing[4] },
  sectionTitle: {
    fontFamily: typography.sansBold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    marginBottom: spacing[2],
  },
  partRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[3],
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  partAvatar: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  partAvatarText: {
    fontFamily: typography.sansBold,
    fontSize: fontSize.base,
    color: colors.white,
  },
  partPaidBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: radius.full,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  partInfo: { flex: 1, minWidth: 0 },
  partNameLine: { flexDirection: 'row', alignItems: 'center', gap: spacing[1.5] },
  partName: {
    fontFamily: typography.sansSemiBold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  partAmount: {
    fontFamily: typography.monoMedium,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    marginTop: 2,
  },
  partAmountMeta: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  relChip: { borderRadius: radius.full, paddingHorizontal: spacing[1.5], paddingVertical: 1 },
  relChipText: {
    fontFamily: typography.sansBold,
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  partWaBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: WHATSAPP,
    alignItems: 'center',
    justifyContent: 'center',
  },

  openFullBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1.5],
    backgroundColor: colors.gray900,
    borderRadius: radius.full,
    paddingVertical: spacing[3],
    marginTop: spacing[2],
  },
  openFullText: {
    fontFamily: typography.sansBold,
    fontSize: fontSize.sm,
    color: colors.white,
  },
});
