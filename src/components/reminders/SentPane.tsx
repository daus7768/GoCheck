import { View, Text, FlatList, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useReminderStore } from '../../store/reminderStore';
import { SentRow } from './SentRow';
import { colors, typography, fontSize, spacing, radius } from '../../theme/tokens';

export function SentPane() {
  const { sent } = useReminderStore();

  return (
    <View style={styles.container}>
      <FlatList
        data={sent}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.infoNote}>
            <Feather name="info" size={14} color={colors.textSecondary} />
            <Text style={styles.infoText}>
              Reminders are logged when sent — confirm delivery in your WhatsApp or email outbox.
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="send" size={48} color={colors.gray300} />
            <Text style={styles.emptyTitle}>No reminders sent yet</Text>
            <Text style={styles.emptyHint}>Send your first reminder from the Queue tab.</Text>
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
    backgroundColor: colors.gray50,
    borderRadius: radius.md,
    padding: spacing[3],
    marginBottom: spacing[3],
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoText: {
    flex: 1,
    fontFamily: typography.sansRegular,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
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
    color: colors.textPrimary,
  },
  emptyHint: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.base,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
