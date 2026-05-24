import { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
  Share,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { format } from 'date-fns';
import { colors, typography, fontSize, spacing, radius, shadow } from '../../src/theme/tokens';
import { useBillStore } from '../../src/store/billStore';
import { useReminderStore } from '../../src/store/reminderStore';
import { buildQueueItems } from '../../src/lib/queueUtils';
import { getOrganizerId } from '../../src/lib/organizer';
import { CURRENCY_SYMBOLS } from '../../src/types';
import type { Bill } from '../../src/types';

function BillCard({ bill, onPress, onShare }: { bill: Bill; onPress: () => void; onShare: () => void }) {
  const paidCount = bill.participants.filter((p) => p.isPaid).length;
  const total = bill.participants.length;
  const percent = total > 0 ? Math.round((paidCount / total) * 100) : 0;
  const sym = CURRENCY_SYMBOLS[bill.currency] ?? bill.currency;
  const amountCollected = bill.participants.filter((p) => p.isPaid).reduce((s, p) => s + p.amount, 0);

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
      onPress={onPress}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle} numberOfLines={1}>{bill.title}</Text>
          <View style={[styles.badge, bill.status === 'complete' && styles.badgeDone]}>
            <Text style={[styles.badgeText, bill.status === 'complete' && styles.badgeTextDone]}>
              {bill.status === 'complete' ? 'Completed' : 'Active'}
            </Text>
          </View>
        </View>
        {bill.description ? (
          <Text style={styles.cardDesc} numberOfLines={1}>{bill.description}</Text>
        ) : null}
      </View>

      <View style={styles.progressRow}>
        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: `${percent}%` }]} />
        </View>
        <Text style={styles.progressLabel}>{percent}%</Text>
      </View>

      <View style={styles.cardMeta}>
        <View style={styles.metaItem}>
          <Feather name="users" size={13} color={colors.textSecondary} />
          <Text style={styles.metaText}>{paidCount}/{total} paid</Text>
        </View>
        <View style={styles.metaItem}>
          <Feather name="calendar" size={13} color={colors.textSecondary} />
          <Text style={styles.metaText}>Due {format(new Date(bill.dueDate), 'dd MMM')}</Text>
        </View>
        <Text style={styles.cardAmount}>
          {sym}{amountCollected.toFixed(2)} / {sym}{bill.totalAmount.toFixed(2)}
        </Text>
      </View>

      <View style={styles.cardActions}>
        <Pressable
          style={styles.actionBtn}
          onPress={onShare}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="share-2" size={14} color={colors.primary} />
          <Text style={styles.actionBtnText}>Share Link</Text>
        </Pressable>
        <Pressable
          style={[styles.actionBtn, styles.actionBtnFilled]}
          onPress={onPress}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.actionBtnFilledText}>View Details</Text>
          <Feather name="chevron-right" size={14} color={colors.white} />
        </Pressable>
      </View>
    </Pressable>
  );
}

export default function BillsScreen() {
  const insets = useSafeAreaInsets();
  const { bills, fetchBills, isLoading } = useBillStore();
  const { sent, settings } = useReminderStore();
  const { items: queueItems } = buildQueueItems(bills, sent, settings, '');
  const bellBadge = queueItems.length;

  const load = useCallback(async () => {
    const id = await getOrganizerId();
    fetchBills(id);
  }, []);

  useEffect(() => {
    load();
  }, []);

  const handleShare = async (bill: Bill) => {
    const url = `https://gocheck.app/bill/${bill.shareLink}`;
    await Share.share({
      message: `Pay your share for "${bill.title}": ${url}`,
      url,
    });
  };

  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }
    return (
      <View style={styles.centered}>
        <Feather name="file-text" size={52} color={colors.gray300} />
        <Text style={styles.emptyTitle}>No bills yet</Text>
        <Text style={styles.emptyHint}>Bills you create will appear here.</Text>
        <Pressable style={styles.createBtn} onPress={() => router.push('/(modals)/create')}>
          <Feather name="plus" size={16} color={colors.white} />
          <Text style={styles.createBtnText}>Create Bill</Text>
        </Pressable>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>My Bills</Text>
        <View style={styles.headerActions}>
          <Pressable
            style={styles.headerBtn}
            onPress={() => router.push('/(modals)/reminders')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Reminders"
          >
            <Feather name="bell" size={20} color={colors.primary} />
            {bellBadge > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeCount}>{bellBadge > 99 ? '99+' : bellBadge}</Text>
              </View>
            )}
          </Pressable>
          <Pressable
            style={styles.headerBtn}
            onPress={() => router.push('/(modals)/create')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Create bill"
          >
            <Feather name="plus" size={20} color={colors.primary} />
          </Pressable>
        </View>
      </View>

      {isLoading && bills.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={bills}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + spacing[6] },
          ]}
          renderItem={({ item }) => (
            <BillCard
              bill={item}
              onPress={() => router.push(`/(modals)/bill/${item.id}`)}
              onShare={() => handleShare(item)}
            />
          )}
          ListEmptyComponent={renderEmpty}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[5],
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  title: {
    fontFamily: typography.sansBold,
    fontSize: fontSize.xl,
    color: colors.textPrimary,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: colors.error,
    borderRadius: radius.full,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  bellBadgeCount: {
    fontFamily: typography.sansBold,
    fontSize: 9,
    color: colors.white,
    lineHeight: 12,
  },
  list: {
    padding: spacing[4],
    gap: spacing[3],
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius['2xl'],
    padding: spacing[4],
    ...shadow.sm,
  },
  cardHeader: {
    marginBottom: spacing[3],
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[1],
  },
  cardTitle: {
    flex: 1,
    fontFamily: typography.sansBold,
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },
  cardDesc: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  badge: {
    backgroundColor: colors.primarySurface,
    borderRadius: radius.full,
    paddingHorizontal: spacing[2.5],
    paddingVertical: 3,
  },
  badgeDone: { backgroundColor: colors.secondarySurface },
  badgeText: {
    fontFamily: typography.sansMedium,
    fontSize: fontSize.xs,
    color: colors.primary,
  },
  badgeTextDone: { color: colors.secondary },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  progressBarTrack: {
    flex: 1,
    height: 6,
    backgroundColor: colors.gray100,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.secondary,
    borderRadius: radius.full,
  },
  progressLabel: {
    fontFamily: typography.monoMedium,
    fontSize: fontSize.xs,
    color: colors.secondary,
    width: 32,
    textAlign: 'right',
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginBottom: spacing[3],
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  metaText: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  cardAmount: {
    flex: 1,
    fontFamily: typography.monoMedium,
    fontSize: fontSize.xs,
    color: colors.textPrimary,
    textAlign: 'right',
  },
  cardActions: {
    flexDirection: 'row',
    gap: spacing[2],
    paddingTop: spacing[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1.5],
    paddingVertical: spacing[2.5],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primarySurface,
    backgroundColor: colors.primarySurface,
  },
  actionBtnText: {
    fontFamily: typography.sansMedium,
    fontSize: fontSize.sm,
    color: colors.primary,
  },
  actionBtnFilled: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  actionBtnFilledText: {
    fontFamily: typography.sansMedium,
    fontSize: fontSize.sm,
    color: colors.white,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[3],
    padding: spacing[6],
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
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
    marginTop: spacing[2],
  },
  createBtnText: {
    fontFamily: typography.sansSemiBold,
    fontSize: fontSize.base,
    color: colors.white,
  },
});
