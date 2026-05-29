import { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme, type ThemeColors } from '../../src/theme/ThemeContext';
import { useProfileStore } from '../../src/store/profileStore';
import { AUTO_LOCK_OPTIONS } from '../../src/types';
import { typography, fontSize, spacing, radius } from '../../src/theme/tokens';

export default function AutoLockSettingsModal() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const security = useProfileStore(s => s.security);
  const updateSecuritySetting = useProfileStore(s => s.updateSecuritySetting);
  const styles = useMemo(() => makeStyles(colors), [colors]);

  async function handleSelect(value: number) {
    await updateSecuritySetting('autoLockDuration', value);
    router.back();
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing[3], paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Feather name="x" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Auto-lock</Text>
        <View style={{ width: 22 }} />
      </View>

      <Text style={styles.description}>
        GoCheck will lock automatically after this period of inactivity.
      </Text>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {AUTO_LOCK_OPTIONS.map(option => {
          const isSelected = security.autoLockDuration === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              style={[styles.row, isSelected && styles.rowSelected]}
              onPress={() => handleSelect(option.value)}
              activeOpacity={0.7}
            >
              <Text style={[styles.rowLabel, isSelected && styles.rowLabelSelected]}>
                {option.label}
              </Text>
              {isSelected && <Feather name="check" size={18} color={colors.primary} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: spacing[5], paddingBottom: spacing[4],
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
    },
    headerTitle: { fontFamily: typography.sansBold, fontSize: fontSize.base, color: colors.textPrimary },
    description: {
      fontFamily: typography.sansRegular, fontSize: fontSize.sm,
      color: colors.textSecondary, paddingHorizontal: spacing[5],
      paddingTop: spacing[4], paddingBottom: spacing[2], lineHeight: fontSize.sm * 1.6,
    },
    list: { flex: 1 },
    listContent: { paddingHorizontal: spacing[4], paddingTop: spacing[2] },
    row: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingVertical: spacing[4], paddingHorizontal: spacing[4],
      marginBottom: spacing[1], borderRadius: radius.lg,
      backgroundColor: colors.surface,
      borderWidth: 1, borderColor: colors.border,
    },
    rowSelected: {
      backgroundColor: colors.primarySurface,
      borderColor: colors.primaryBorder,
    },
    rowLabel: {
      fontFamily: typography.sansMedium, fontSize: fontSize.base,
      color: colors.textPrimary,
    },
    rowLabelSelected: { color: colors.primary },
  });
}
