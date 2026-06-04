import { View, Pressable, StyleSheet, Linking } from 'react-native';
import { AppText } from '../AppText';
import { Feather } from '@expo/vector-icons';
import { haptic } from '../../lib/haptics';
import { useReminderStore } from '../../store/reminderStore';
import { useBillStore } from '../../store/billStore';
import { buildWhen, renderTemplate, formatCurrency } from '../../lib/reminderTemplates';
import { participantUrl } from '../../lib/urls';
import { computeReliability } from '../../lib/queueUtils';
import { typography, fontSize, spacing, radius } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import { GlowingCard } from '../effects/GlowingCard';
import type { QueueItem, ReminderRow, ReliabilityLabel } from '../../types';

function getInitials(name: string): string {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

// WhatsApp brand colors (fixed across all themes)
const WA_BTN_BG = '#F0FDF4';
const WA_BTN_BORDER = '#BBF7D0';
const WA_BTN_TEXT = '#15803D';

interface Props {
  item: QueueItem;
  remindersForItem: ReminderRow[];
}

export function QueueRow({ item, remindersForItem }: Props) {
  const { colors } = useTheme();
  const c = colors;

  const RELIABILITY_CONFIG: Record<ReliabilityLabel, { label: string; color: string; bg: string }> = {
    reliable: { label: 'Reliable', color: c.secondaryDark, bg: c.secondarySurface },
    'on-time': { label: 'On-time', color: c.primary,       bg: c.primarySurface },
    slow:      { label: 'Slow',    color: c.warning,       bg: c.warningSurface },
    'at-risk': { label: 'At-risk', color: c.errorDark,     bg: c.errorSurface },
  };

  const { settings, sendReminder } = useReminderStore();
  const { bills } = useBillStore();

  const reliability = computeReliability(item.participantName, bills);
  const reliabilityConfig = reliability ? RELIABILITY_CONFIG[reliability] : null;
  const askedCount = remindersForItem.filter(
    (r) => r.billId === item.billId && r.participantId === item.participantId
  ).length;

  const isOverdue = item.daysToDue < 0;

  const buildMessage = () => {
    const link = item.participantAccessToken
      ? participantUrl(item.participantAccessToken)
      : participantUrl(item.shareLink);
    return renderTemplate(settings.tone, {
      name: item.participantName,
      bill: item.billTitle,
      amount: formatCurrency(item.amount, item.currency),
      when: buildWhen(item.daysToDue),
      days: isOverdue ? Math.abs(item.daysToDue) : 0,
      link,
    });
  };

  const handleWhatsApp = async () => {
    haptic.impact();
    const message = buildMessage();
    const encoded = encodeURIComponent(message);
    const url = item.participantPhone
      ? `https://wa.me/${item.participantPhone}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;
    await Linking.openURL(url);
    sendReminder(item, 'whatsapp');
  };

  const handleEmail = async () => {
    if (!item.participantEmail) return;
    haptic.impact();
    const message = buildMessage();
    const subject = encodeURIComponent(`Reminder: ${item.billTitle}`);
    const body = encodeURIComponent(message);
    await Linking.openURL(`mailto:${item.participantEmail}?subject=${subject}&body=${body}`);
    sendReminder(item, 'email');
  };

  const dueLabelColor = isOverdue
    ? colors.error
    : item.daysToDue <= 3
    ? colors.warning
    : colors.textSecondary;
  const dueLabel = isOverdue
    ? `${Math.abs(item.daysToDue)}d overdue`
    : item.daysToDue === 0
    ? 'Due today'
    : `Due in ${item.daysToDue}d`;

  return (
    <View style={styles.rowWrap}>
      <GlowingCard
        radius={radius.lg}
        color={isOverdue ? colors.error : item.daysToDue <= 3 ? colors.warning : colors.primary}
        background={colors.surface}
      >
        <View style={styles.row}>
          <View style={styles.left}>
        {/* Avatar */}
        <View style={[styles.avatar, { backgroundColor: item.participantAvatarColor }]}>
          <AppText style={[styles.avatarText, { color: colors.white }]}>{getInitials(item.participantName)}</AppText>
        </View>

        {/* Info */}
        <View style={styles.info}>
          {/* Name row */}
          <View style={styles.nameRow}>
            <AppText style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>{item.participantName}</AppText>
            {/* Fixed-width reliability slot */}
            <View style={styles.reliabilitySlot}>
              {reliabilityConfig ? (
                <View style={[styles.chip, { backgroundColor: reliabilityConfig.bg }]}>
                  <AppText style={[styles.chipText, { color: reliabilityConfig.color }]}>
                    {reliabilityConfig.label}
                  </AppText>
                </View>
              ) : null}
            </View>
            {askedCount > 0 && (
              <View style={[styles.askedChip, { backgroundColor: colors.gray100 }]}>
                <AppText style={[styles.askedText, { color: colors.textSecondary }]}>asked {askedCount}×</AppText>
              </View>
            )}
          </View>

          {/* Bill + amount */}
          <AppText style={[styles.billMeta, { color: colors.textSecondary }]} numberOfLines={1}>
            {item.billTitle} · {formatCurrency(item.amount, item.currency)}
          </AppText>

          {/* Due label */}
          <AppText style={[styles.dueLabel, { color: dueLabelColor }]}>{dueLabel}</AppText>
        </View>
      </View>

      {/* Channel buttons */}
      <View style={styles.actions}>
        <Pressable style={styles.waBtn} onPress={handleWhatsApp}>
          <Feather name="message-circle" size={14} color="#25D366" />
          <AppText style={styles.waBtnText}>WhatsApp</AppText>
        </Pressable>
        {item.participantEmail ? (
          <Pressable style={[styles.emailBtn, { backgroundColor: colors.primarySurface, borderColor: colors.primaryBorder }]} onPress={handleEmail}>
            <Feather name="mail" size={14} color={colors.primary} />
          </Pressable>
        ) : null}
      </View>
        </View>
      </GlowingCard>
    </View>
  );
}

const styles = StyleSheet.create({
  rowWrap: {
    marginBottom: spacing[2],
  },
  row: {
    padding: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  left: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2] },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontFamily: typography.sansBold,
    fontSize: fontSize.sm,
  },
  info: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], flexWrap: 'wrap' },
  name: {
    fontFamily: typography.sansSemiBold,
    fontSize: fontSize.base,
    flexShrink: 1,
  },
  reliabilitySlot: { width: 60, height: 20 },
  chip: {
    borderRadius: radius.full,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  chipText: { fontFamily: typography.sansMedium, fontSize: fontSize['2xs'] },
  askedChip: {
    borderRadius: radius.full,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
  },
  askedText: {
    fontFamily: typography.sansMedium,
    fontSize: fontSize['2xs'],
  },
  billMeta: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.sm,
  },
  dueLabel: {
    fontFamily: typography.sansMedium,
    fontSize: fontSize.xs,
  },
  actions: { flexDirection: 'row', gap: spacing[2], alignItems: 'center' },
  waBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    backgroundColor: WA_BTN_BG,
    borderWidth: 1,
    borderColor: WA_BTN_BORDER,
    borderRadius: radius.md,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1.5],
  },
  waBtnText: {
    fontFamily: typography.sansMedium,
    fontSize: fontSize.xs,
    color: WA_BTN_TEXT,
  },
  emailBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
