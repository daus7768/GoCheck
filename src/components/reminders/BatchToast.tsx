import { useEffect } from 'react';
import { View, Pressable, StyleSheet, Linking } from 'react-native';
import { AppText } from '../AppText';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { haptic } from '../../lib/haptics';
import { useReminderStore } from '../../store/reminderStore';
import { renderTemplate, formatCurrency, buildWhen } from '../../lib/reminderTemplates';
import { typography, fontSize, spacing, radius, animation } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';

export function BatchToast() {
  const { colors } = useTheme();
  const { batchQueue, batchPointer, settings, sendReminder, advanceBatch, clearBatch } =
    useReminderStore();

  const translateY = useSharedValue(80);
  const opacity = useSharedValue(0);

  const isActive = batchQueue.length > 0;
  const isDone = batchPointer >= batchQueue.length;

  useEffect(() => {
    if (isActive) {
      translateY.value = withSpring(0, animation.springSnappy);
      opacity.value = withTiming(1, { duration: 200 });
    } else {
      translateY.value = withTiming(80, { duration: 200 });
      opacity.value = withTiming(0, { duration: 150 });
    }
  }, [isActive]);

  useEffect(() => {
    if (isDone && isActive) {
      const timer = setTimeout(() => clearBatch(), 2500);
      return () => clearTimeout(timer);
    }
  }, [isDone, isActive]);

  const toastStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!isActive) return null;

  const handleSendNext = async () => {
    if (batchPointer >= batchQueue.length) return;
    haptic.impact();
    const item = batchQueue[batchPointer];
    if (!item) return;
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
    await sendReminder(item, 'whatsapp');
    advanceBatch();
  };

  return (
    <Animated.View style={[styles.toast, { backgroundColor: '#1C1C2E' }, toastStyle]}>
      <View style={styles.toastContent}>
        <Feather name="send" size={16} color={colors.white} />
        <AppText style={[styles.toastText, { color: colors.white }]}>
          {isDone
            ? `All ${batchQueue.length} reminders sent 🎉`
            : `${batchPointer} of ${batchQueue.length} sent — tap to continue`}
        </AppText>
      </View>
      {!isDone && (
        <Pressable style={[styles.nextBtn, { backgroundColor: colors.white }]} onPress={handleSendNext}>
          <AppText style={[styles.nextBtnText, { color: colors.primary }]}>Send next</AppText>
          <Feather name="chevron-right" size={14} color={colors.primary} />
        </Pressable>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    bottom: spacing[6],
    left: spacing[4],
    right: spacing[4],
    borderRadius: radius.xl,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 100,
  },
  toastContent: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  toastText: {
    fontFamily: typography.sansMedium,
    fontSize: fontSize.sm,
    flex: 1,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
  },
  nextBtnText: {
    fontFamily: typography.sansSemiBold,
    fontSize: fontSize.sm,
  },
});
