import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, fontSize, spacing } from '../../src/theme/tokens';

export default function BillsScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>My Bills</Text>
      </View>
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No bills yet.</Text>
        <Text style={styles.emptyHint}>Create one from the Home tab.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
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
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: {
    fontFamily: typography.sansSemiBold,
    fontSize: fontSize.lg,
    color: colors.textPrimary,
  },
  emptyHint: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.base,
    color: colors.textSecondary,
    marginTop: spacing[1],
  },
});
