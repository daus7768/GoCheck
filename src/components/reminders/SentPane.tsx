import { View, FlatList, StyleSheet } from 'react-native';
import { AppText } from '../AppText';
import { Feather } from '@expo/vector-icons';
import { useReminderStore } from '../../store/reminderStore';
import { SentRow } from './SentRow';
import { typography, fontSize, spacing, radius } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';

export function SentPane() {
  const { colors } = useTheme();
  const { sent } = useReminderStore();

  return (
    <View style={styles.container}>
      <FlatList
        data={sent}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={[styles.infoNote, { backgroundColor: colors.gray50, borderColor: colors.border }]}>
            <Feather name="info" size={14} color={colors.textSecondary} />
            <AppText style={[styles.infoText, { color: colors.textSecondary }]}>
              Reminders are logged when sent — confirm delivery in your WhatsApp or email outbox.
            </AppText>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="send" size={48} color={colors.gray300} />
            <AppText style={[styles.emptyTitle, { color: colors.textPrimary }]}>No reminders sent yet</AppText>
            <AppText style={[styles.emptyHint, { color: colors.textSecondary }]}>Send your first reminder from the Queue tab.</AppText>
          </View>
        }
        renderItem={({ item }) => <SentRow row={item} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: spacing[4] },
  infoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
    borderRadius: radius.md,
    padding: spacing[3],
    marginBottom: spacing[3],
    borderWidth: 1,
  },
  infoText: {
    flex: 1,
    fontFamily: typography.sansRegular,
    fontSize: fontSize.sm,
    lineHeight: 18,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing[12],
    gap: spacing[2],
  },
  emptyTitle: {
    fontFamily: typography.sansSemiBold,
    fontSize: fontSize.lg,
  },
  emptyHint: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.base,
    textAlign: 'center',
  },
});
