import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { colors, typography, fontSize, spacing, radius } from '../../theme/tokens';
import type { ReminderRow } from '../../types';

interface Props {
  row: ReminderRow;
}

export function SentRow({ row }: Props) {
  const isWhatsApp = row.channel === 'whatsapp';
  const iconColor = isWhatsApp ? '#25D366' : colors.primary;
  const iconBg = isWhatsApp ? '#F0FDF4' : colors.primarySurface;
  const channelLabel = isWhatsApp ? 'WhatsApp' : 'Email';
  const iconName: 'message-circle' | 'mail' = isWhatsApp ? 'message-circle' : 'mail';

  const timeAgo = (() => {
    try {
      return formatDistanceToNow(new Date(row.sentAt), { addSuffix: true });
    } catch {
      return '';
    }
  })();

  return (
    <View style={styles.row}>
      <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
        <Feather name={iconName} size={18} color={iconColor} />
      </View>
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{row.recipientName}</Text>
          {row.syncFailed && (
            <Feather name="alert-triangle" size={14} color={colors.warning} />
          )}
        </View>
        <Text style={styles.meta}>via {channelLabel} · {timeAgo}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  info: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  name: {
    fontFamily: typography.sansMedium,
    fontSize: fontSize.base,
    color: colors.textPrimary,
    flex: 1,
  },
  meta: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
});
