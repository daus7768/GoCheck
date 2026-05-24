import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, typography, fontSize, spacing, radius, shadow } from '../../src/theme/tokens';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good morning</Text>
            <Text style={styles.name}>GoCheck</Text>
          </View>
          <Pressable style={styles.avatarBtn}>
            <Text style={styles.avatarInitial}>G</Text>
          </Pressable>
        </View>

        {/* Summary Card */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Outstanding</Text>
          <Text style={styles.summaryAmount}>RM 0.00</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryItemValue}>0</Text>
              <Text style={styles.summaryItemLabel}>Active Bills</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryItemValue}>0</Text>
              <Text style={styles.summaryItemLabel}>Pending</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryItemValue}>0</Text>
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

        {/* Empty state */}
        <View style={styles.emptyState}>
          <Feather name="file-text" size={48} color={colors.gray300} />
          <Text style={styles.emptyTitle}>No bills yet</Text>
          <Text style={styles.emptySubtitle}>
            Create your first bill to start tracking group payments.
          </Text>
        </View>
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
