import { View, Text, Pressable, FlatList, StyleSheet, Linking } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { haptic } from '../../lib/haptics';
import { useReminderStore } from '../../store/reminderStore';
import { useBillStore } from '../../store/billStore';
import { buildQueueItems } from '../../lib/queueUtils';
import { renderTemplate, formatCurrency, buildWhen } from '../../lib/reminderTemplates';
import { QueueRow } from './QueueRow';
import { BatchToast } from './BatchToast';
import { colors, typography, fontSize, spacing, radius } from '../../theme/tokens';
import type { QueueItem, ReminderRow } from '../../types';

export function QueuePane({ organizerId }: { organizerId: string }) {
  const { sent, settings, sendReminder, startBatch, advanceBatch } = useReminderStore();
  const { bills } = useBillStore();

  const { items, limitReached } = buildQueueItems(bills, sent, settings, organizerId);

  const remindersForItem = (item: QueueItem): ReminderRow[] =>
    sent.filter((r) => r.billId === item.billId && r.participantId === item.participantId);

  const openWALink = async (item: QueueItem): Promise<void> => {
    const isOverdue = item.daysToDue < 0;
    const message = renderTemplate(settings.tone, {
      name: item.participantName,
      bill: item.billTitle,
      amount: formatCurrency(item.amount, item.currency),
      when: buildWhen(item.daysToDue),
      days: isOverdue ? Math.abs(item.daysToDue) : 0,
      link: `https://gocheck.app/bill/${item.shareLink}`,
    });
    const encoded = encodeURIComponent(message);
    const url = item.participantPhone
      ? `https://wa.me/${item.participantPhone}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;
    await Linking.openURL(url);
  };

  const handleSendAll = async () => {
    if (items.length === 0) return;
    const first = items[0];
    if (!first) return;
    haptic.impact();
    startBatch(items);
    await openWALink(first);
    await sendReminder(first, 'whatsapp');
    advanceBatch();
  };

  const allData = [...items, ...limitReached];

  if (items.length === 0 && limitReached.length === 0) {
    return (
      <View style={styles.empty}>
        <Feather name="check-circle" size={48} color={colors.gray300} />
        <Text style={styles.emptyTitle}>All caught up</Text>
        <Text style={styles.emptyHint}>Nobody to nudge right now.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={allData}
        keyExtractor={(item) => `${item.billId}_${item.participantId}`}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          items.length > 0 ? (
            <View style={styles.batchCard}>
              <View style={styles.batchInfo}>
                <Text style={styles.batchTitle}>Send all {items.length} reminders</Text>
                <Text style={styles.batchSub}>{settings.tone} tone · via WhatsApp</Text>
              </View>
              <Pressable style={styles.batchBtn} onPress={handleSendAll}>
                <Feather name="send" size={14} color={colors.white} />
                <Text style={styles.batchBtnText}>Send all</Text>
              </Pressable>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const isLimitItem = limitReached.includes(item);
          if (isLimitItem) {
            return (
              <View style={styles.limitRow}>
                <View style={[styles.limitAvatar, { backgroundColor: item.participantAvatarColor }]}>
                  <Text style={styles.limitAvatarText}>
                    {item.participantName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.limitName}>{item.participantName}</Text>
                <View style={styles.limitBadge}>
                  <Text style={styles.limitBadgeText}>Limit reached</Text>
                </View>
              </View>
            );
          }
          return (
            <QueueRow
              item={item}
              remindersForItem={remindersForItem(item)}
            />
          );
        }}
      />
      <BatchToast />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, position: 'relative' },
  list: { padding: spacing[4] },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    padding: spacing[8],
  },
  emptyTitle: {
    fontFamily: typography.sansSemiBold,
    fontSize: fontSize.lg,
    color: colors.textPrimary,
  },
  emptyHint: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.base,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  batchCard: {
    borderRadius: radius.xl,
    padding: spacing[4],
    marginBottom: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primary,
  },
  batchInfo: { gap: 4, flex: 1 },
  batchTitle: {
    fontFamily: typography.sansBold,
    fontSize: fontSize.base,
    color: colors.white,
  },
  batchSub: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.75)',
  },
  batchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  batchBtnText: {
    fontFamily: typography.sansSemiBold,
    fontSize: fontSize.sm,
    color: colors.white,
  },
  limitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    marginBottom: spacing[1],
    opacity: 0.6,
  },
  limitAvatar: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  limitAvatarText: {
    fontFamily: typography.sansBold,
    fontSize: 10,
    color: colors.white,
  },
  limitName: {
    flex: 1,
    fontFamily: typography.sansMedium,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  limitBadge: {
    backgroundColor: colors.gray100,
    borderRadius: radius.full,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
  },
  limitBadgeText: {
    fontFamily: typography.sansMedium,
    fontSize: fontSize['2xs'],
    color: colors.textSecondary,
  },
});
