import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, typography, fontSize, spacing, radius, shadow } from '../../src/theme/tokens';
import { useBillStore } from '../../src/store/billStore';
import { getOrganizerId } from '../../src/lib/organizer';
import { CURRENCY_SYMBOLS } from '../../src/types';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { bills, fetchBills, isLoading } = useBillStore();
  const [organizerId, setOrganizerId] = useState<string | null>(null);

  useEffect(() => {
    getOrganizerId().then((id) => {
      setOrganizerId(id);
      fetchBills(id);
    });
  }, []);

  const activeBills = bills.filter((b) => b.status === 'active');
  const completedBills = bills.filter((b) => b.status === 'complete');
  const pendingCount = bills.reduce(
    (sum, b) => sum + b.participants.filter((p) => !p.isPaid).length,
    0
  );
  const totalOutstanding = bills
    .filter((b) => b.status === 'active')
    .reduce(
      (sum, b) => sum + b.participants.filter((p) => !p.isPaid).reduce((s, p) => s + p.amount, 0),
      0
    );

  const primaryCurrency = bills[0]?.currency ?? 'MYR';
  const symbol = CURRENCY_SYMBOLS[primaryCurrency] ?? 'RM';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Welcome back</Text>
            <Text style={styles.name}>GoCheck</Text>
          </View>
          <Pressable style={styles.avatarBtn} onPress={() => router.push('/(tabs)/profile')}>
            <Text style={styles.avatarInitial}>G</Text>
          </Pressable>
        </View>

        {/* Summary Card */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Outstanding</Text>
          {isLoading ? (
            <ActivityIndicator size="small" color={colors.white} style={{ marginBottom: spacing[5] }} />
          ) : (
            <Text style={styles.summaryAmount}>{symbol} {totalOutstanding.toFixed(2)}</Text>
          )}
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryItemValue}>{activeBills.length}</Text>
              <Text style={styles.summaryItemLabel}>Active Bills</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryItemValue}>{pendingCount}</Text>
              <Text style={styles.summaryItemLabel}>Pending</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryItemValue}>{completedBills.length}</Text>
              <Text style={styles.summaryItemLabel}>Completed</Text>
            </View>
          </View>
        </View>

        {/* Create Bill CTA */}
        <Pressable
          style={({ pressed }) => [styles.createBtn, pressed && { opacity: 0.9 }]}
          onPress={() => router.push('/(modals)/create')}
        >
          <Feather name="plus-circle" size={20} color={colors.white} />
          <Text style={styles.createBtnText}>Create New Bill</Text>
        </Pressable>

        {/* Recent Bills */}
        {bills.length > 0 ? (
          <View>
            <Text style={styles.sectionTitle}>Recent Bills</Text>
            {bills.slice(0, 3).map((bill) => {
              const paidCount = bill.participants.filter((p) => p.isPaid).length;
              const total = bill.participants.length;
              const percent = total > 0 ? Math.round((paidCount / total) * 100) : 0;
              const sym = CURRENCY_SYMBOLS[bill.currency] ?? bill.currency;
              return (
                <Pressable
                  key={bill.id}
                  style={({ pressed }) => [styles.billCard, pressed && { opacity: 0.85 }]}
                  onPress={() => router.push(`/(modals)/bill/${bill.id}`)}
                >
                  <View style={styles.billCardTop}>
                    <Text style={styles.billCardTitle} numberOfLines={1}>{bill.title}</Text>
                    <View style={[styles.statusBadge, bill.status === 'complete' && styles.statusBadgeDone]}>
                      <Text style={[styles.statusText, bill.status === 'complete' && styles.statusTextDone]}>
                        {bill.status === 'complete' ? 'Done' : 'Active'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.progressBarTrack}>
                    <View style={[styles.progressBarFill, { width: `${percent}%` }]} />
                  </View>
                  <View style={styles.billCardBottom}>
                    <Text style={styles.billCardMeta}>{paidCount}/{total} paid</Text>
                    <Text style={styles.billCardAmount}>{sym}{bill.totalAmount.toFixed(2)}</Text>
                  </View>
                </Pressable>
              );
            })}
            {bills.length > 3 && (
              <Pressable style={styles.viewAllBtn} onPress={() => router.push('/(tabs)/bills')}>
                <Text style={styles.viewAllText}>View all {bills.length} bills</Text>
                <Feather name="chevron-right" size={16} color={colors.primary} />
              </Pressable>
            )}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Feather name="file-text" size={48} color={colors.gray300} />
            <Text style={styles.emptyTitle}>No bills yet</Text>
            <Text style={styles.emptySubtitle}>
              Create your first bill to start tracking group payments.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[10],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[5],
  },
  greeting: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  name: {
    fontFamily: typography.sansBold,
    fontSize: fontSize['2xl'],
    color: colors.textPrimary,
    marginTop: 2,
  },
  avatarBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: typography.sansBold,
    fontSize: fontSize.md,
    color: colors.primary,
  },
  summaryCard: {
    backgroundColor: colors.primary,
    borderRadius: radius['2xl'],
    padding: spacing[6],
    marginBottom: spacing[4],
    ...shadow.lg,
  },
  summaryLabel: {
    fontFamily: typography.sansMedium,
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: spacing[1],
  },
  summaryAmount: {
    fontFamily: typography.monoMedium,
    fontSize: fontSize['3xl'],
    color: colors.white,
    marginBottom: spacing[5],
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryItemValue: {
    fontFamily: typography.sansBold,
    fontSize: fontSize.lg,
    color: colors.white,
  },
  summaryItemLabel: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.xs,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    paddingVertical: spacing[4],
    marginBottom: spacing[8],
    ...shadow.lg,
  },
  createBtnText: {
    fontFamily: typography.sansSemiBold,
    fontSize: fontSize.base,
    color: colors.white,
  },
  sectionTitle: {
    fontFamily: typography.sansBold,
    fontSize: fontSize.base,
    color: colors.textPrimary,
    marginBottom: spacing[3],
  },
  billCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing[4],
    marginBottom: spacing[3],
    ...shadow.sm,
  },
  billCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[3],
  },
  billCardTitle: {
    flex: 1,
    fontFamily: typography.sansSemiBold,
    fontSize: fontSize.base,
    color: colors.textPrimary,
    marginRight: spacing[2],
  },
  statusBadge: {
    backgroundColor: colors.primarySurface,
    borderRadius: radius.full,
    paddingHorizontal: spacing[2.5],
    paddingVertical: 3,
  },
  statusBadgeDone: {
    backgroundColor: colors.secondarySurface,
  },
  statusText: {
    fontFamily: typography.sansMedium,
    fontSize: fontSize.xs,
    color: colors.primary,
  },
  statusTextDone: {
    color: colors.secondary,
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: colors.gray100,
    borderRadius: radius.full,
    overflow: 'hidden',
    marginBottom: spacing[2],
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.secondary,
    borderRadius: radius.full,
  },
  billCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  billCardMeta: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  billCardAmount: {
    fontFamily: typography.monoMedium,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1],
    paddingVertical: spacing[3],
  },
  viewAllText: {
    fontFamily: typography.sansMedium,
    fontSize: fontSize.sm,
    color: colors.primary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing[12],
    gap: spacing[3],
  },
  emptyTitle: {
    fontFamily: typography.sansSemiBold,
    fontSize: fontSize.lg,
    color: colors.textPrimary,
  },
  emptySubtitle: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.base,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: fontSize.base * 1.5,
  },
});
