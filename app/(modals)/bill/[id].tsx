import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, typography, fontSize, spacing, radius } from '../../../src/theme/tokens';

export default function BillDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="chevron-left" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Bill Detail</Text>
        <View style={{ width: 44 }} />
      </View>
      <View style={styles.body}>
        <Text style={styles.idText}>Bill ID: {id}</Text>
        <Text style={styles.hint}>Full bill detail view — coming next sprint.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  backBtn: { width: 44, height: 44, borderRadius: radius.xl, backgroundColor: colors.gray50, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: typography.sansBold, fontSize: fontSize.md, color: colors.textPrimary },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[2], padding: spacing[6] },
  idText: { fontFamily: typography.monoRegular, fontSize: fontSize.sm, color: colors.textSecondary },
  hint: { fontFamily: typography.sansRegular, fontSize: fontSize.base, color: colors.textSecondary, textAlign: 'center' },
});
