import React, { useEffect, useState, useCallback } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  Pressable,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { format, isValid, parseISO } from 'date-fns';
import Animated, {
  FadeIn,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { AppText } from '../AppText';
import { SuccessCheck } from './SuccessCheck';
import { SUCCESS_TOKENS } from './billCreatedTokens';
import { ConfettiBurst } from '../common/ConfettiBurst';
import { formatBillAmount, shareBillLink } from '../../lib/share';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { haptic, NotificationFeedbackType } from '../../lib/haptics';
import { typography } from '../../theme/tokens';
import type { Bill } from '../../types';

export interface BillCreatedSheetProps {
  visible: boolean;
  bill: Bill | null;
  /** When false, share CTA is disabled (e.g. pending sync). */
  canShare?: boolean;
  onViewBill: () => void;
  onCreateAnother: () => void;
}

function formatDueLabel(dueDate: string | undefined): string | null {
  if (!dueDate) return null;
  const d = parseISO(dueDate);
  if (!isValid(d)) return null;
  return `Due ${format(d, 'MMM d')}`;
}

export function BillCreatedSheet({
  visible,
  bill,
  canShare = true,
  onViewBill,
  onCreateAnother,
}: BillCreatedSheetProps) {
  const reduceMotion = useReduceMotion();
  const [confettiActive, setConfettiActive] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  const backdropOpacity = useSharedValue(0);
  const cardTranslateY = useSharedValue(reduceMotion ? 0 : 40);
  const cardScale = useSharedValue(reduceMotion ? 1 : 0.92);
  const cardOpacity = useSharedValue(0);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [
      { translateY: cardTranslateY.value },
      { scale: cardScale.value },
    ],
  }));

  const runEntrance = useCallback(() => {
    if (!bill) return;

    haptic.notification(NotificationFeedbackType.Success);
    setConfettiActive(false);

    if (reduceMotion) {
      backdropOpacity.value = withTiming(1, { duration: 150 });
      cardOpacity.value = withTiming(1, { duration: 150 });
      cardTranslateY.value = 0;
      cardScale.value = 1;
      return;
    }

    backdropOpacity.value = withTiming(1, { duration: 200 });
    cardOpacity.value = withDelay(
      80,
      withTiming(1, { duration: 360, easing: Easing.out(Easing.cubic) })
    );
    cardTranslateY.value = withDelay(
      80,
      withSpring(0, { damping: 18, stiffness: 220 })
    );
    cardScale.value = withDelay(
      80,
      withSpring(1, { damping: 18, stiffness: 220 })
    );

  }, [bill, reduceMotion, backdropOpacity, cardOpacity, cardTranslateY, cardScale]);

  useEffect(() => {
    if (visible && bill) {
      const cleanup = runEntrance();
      return cleanup;
    }
    backdropOpacity.value = 0;
    cardOpacity.value = 0;
    setConfettiActive(false);
    setDismissing(false);
    setSharing(false);
  }, [visible, bill, runEntrance, backdropOpacity, cardOpacity]);

  const dismissWithAnimation = (action: () => void) => {
    if (dismissing) return;
    setDismissing(true);
    setConfettiActive(false);

    const finish = () => {
      setDismissing(false);
      action();
    };

    if (reduceMotion) {
      finish();
      return;
    }

    backdropOpacity.value = withTiming(0, { duration: 220, easing: Easing.in(Easing.cubic) });
    cardOpacity.value = withTiming(0, { duration: 220, easing: Easing.in(Easing.cubic) });
    cardTranslateY.value = withTiming(20, { duration: 220, easing: Easing.in(Easing.cubic) });
    cardScale.value = withTiming(
      0.95,
      { duration: 220, easing: Easing.in(Easing.cubic) },
      (done) => {
        if (done) runOnJS(finish)();
      }
    );
  };

  const handleShare = async () => {
    if (!bill || !canShare || sharing) return;
    setSharing(true);
    try {
      await shareBillLink(bill);
      haptic.notification(NotificationFeedbackType.Success);
    } catch {
      // User cancelled share sheet — no alert needed
    } finally {
      setSharing(false);
    }
  };

  const peopleLabel =
    bill && bill.participants.length === 1
      ? '1 person'
      : `${bill?.participants.length ?? 0} people`;

  const dueLabel = bill ? formatDueLabel(bill.dueDate) : null;
  const recurringLabel =
    bill?.isRecurring === 'monthly'
      ? 'Monthly'
      : bill?.isRecurring === 'yearly'
        ? 'Yearly'
        : null;

  const enteringTitle = reduceMotion
    ? FadeIn.duration(150)
    : FadeInUp.delay(420).duration(280);
  const enteringSub = reduceMotion
    ? FadeIn.duration(150)
    : FadeInUp.delay(480).duration(280);
  const enteringChip = reduceMotion
    ? FadeIn.duration(150)
    : FadeInUp.delay(540).duration(300);
  const enteringBtnPrimary = reduceMotion
    ? FadeIn.duration(150)
    : FadeInUp.delay(640).duration(280);
  const enteringBtnSecondary = reduceMotion
    ? FadeIn.duration(150)
    : FadeInUp.delay(690).duration(280);
  const enteringBtnTertiary = reduceMotion
    ? FadeIn.duration(150)
    : FadeInUp.delay(740).duration(280);

  if (!bill) return null;

  const content = (
    <View style={styles.root} accessibilityViewIsModal>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => dismissWithAnimation(onViewBill)}
        accessibilityLabel="Close and view bill"
      >
        <Animated.View style={[styles.backdrop, backdropStyle]} />
      </Pressable>

      <Animated.View
        style={[styles.card, cardStyle]}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        accessibilityLabel="Bill created successfully"
      >
        <ConfettiBurst
          active={confettiActive}
          reduceMotion={reduceMotion}
          originX={170}
          originY={36}
        />

        <SuccessCheck
          reduceMotion={reduceMotion}
          onPulseStart={() => {
            if (!reduceMotion) setConfettiActive(true);
          }}
        />

        <Animated.View entering={enteringTitle} style={styles.textBlock}>
          <AppText style={styles.title}>Bill created! 🎉</AppText>
        </Animated.View>

        <Animated.View entering={enteringSub}>
          <AppText style={styles.subtitle}>
            &ldquo;{bill.title}&rdquo; is ready to share
          </AppText>
        </Animated.View>

        <Animated.View entering={enteringChip} style={styles.chip}>
          <AppText style={styles.chipLine1}>
            {formatBillAmount(bill.totalAmount, bill.currency)} · {peopleLabel}
          </AppText>
          {dueLabel ? <AppText style={styles.chipLine2}>{dueLabel}</AppText> : null}
          {recurringLabel ? (
            <View style={styles.recurringPill}>
              <AppText style={styles.recurringText}>🔁 {recurringLabel}</AppText>
            </View>
          ) : null}
        </Animated.View>

        <View style={styles.actions}>
          <Animated.View entering={enteringBtnPrimary} style={styles.actionItem}>
            <Pressable
              onPress={handleShare}
              disabled={!canShare || sharing || dismissing}
              style={({ pressed }) => [
                styles.primaryWrap,
                pressed && canShare && styles.primaryPressed,
                (!canShare || sharing) && styles.primaryDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Share payment link"
              accessibilityState={{ disabled: !canShare || sharing }}
            >
              <LinearGradient
                colors={[SUCCESS_TOKENS.indigo, SUCCESS_TOKENS.indigoDeep]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.primaryBtn}
              >
                {sharing ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Feather name="link-2" size={18} color="#fff" />
                    <AppText style={styles.primaryLabel}>Share payment link</AppText>
                  </>
                )}
              </LinearGradient>
            </Pressable>

            {!canShare && (
              <AppText style={styles.syncHint}>
                Link available once synced.
              </AppText>
            )}
          </Animated.View>

          <Animated.View entering={enteringBtnSecondary} style={styles.actionItem}>
            <Pressable
              onPress={() => dismissWithAnimation(onViewBill)}
              disabled={dismissing}
              style={({ pressed }) => [
                styles.secondaryBtn,
                pressed && styles.secondaryPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="View bill"
            >
              <AppText style={styles.secondaryLabel}>View bill</AppText>
            </Pressable>
          </Animated.View>

          <Animated.View entering={enteringBtnTertiary}>
            <Pressable
              onPress={() => dismissWithAnimation(onCreateAnother)}
              disabled={dismissing}
              style={styles.tertiaryBtn}
              accessibilityRole="button"
              accessibilityLabel="Create another bill"
            >
              <AppText style={styles.tertiaryLabel}>Create another</AppText>
            </Pressable>
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  );

  if (Platform.OS === 'web') {
    if (!visible) return null;
    return (
      <View style={StyleSheet.absoluteFillObject} pointerEvents="auto">
        {content}
      </View>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => dismissWithAnimation(onViewBill)}
    >
      {content}
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: SUCCESS_TOKENS.backdrop,
    ...Platform.select({
      web: { backdropFilter: 'blur(4px)' } as object,
      default: {},
    }),
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: SUCCESS_TOKENS.cardRadius,
    padding: 28,
    alignItems: 'center',
    zIndex: 2,
    ...Platform.select({
      web: {
        boxShadow: '0 20px 40px -16px rgba(67,56,202,0.30)',
      } as object,
      ios: {
        shadowColor: '#4338CA',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.3,
        shadowRadius: 40,
      },
      android: { elevation: 16 },
    }),
  },
  textBlock: {
    marginTop: 8,
  },
  title: {
    fontFamily: typography.sansBold,
    fontSize: 22,
    color: SUCCESS_TOKENS.slate900,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: typography.sansRegular,
    fontSize: 14,
    color: SUCCESS_TOKENS.slate500,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },
  chip: {
    width: '100%',
    backgroundColor: SUCCESS_TOKENS.slate100,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 16,
    alignItems: 'center',
    gap: 4,
  },
  chipLine1: {
    fontFamily: typography.monoMedium,
    fontSize: 14,
    color: SUCCESS_TOKENS.slate900,
  },
  chipLine2: {
    fontFamily: typography.sansRegular,
    fontSize: 12,
    color: SUCCESS_TOKENS.slate500,
  },
  recurringPill: {
    marginTop: 6,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 9999,
  },
  recurringText: {
    fontFamily: typography.sansMedium,
    fontSize: 11,
    color: SUCCESS_TOKENS.indigo,
  },
  actions: {
    width: '100%',
    marginTop: 20,
    gap: 10,
  },
  actionItem: {
    width: '100%',
  },
  primaryWrap: {
    width: '100%',
    borderRadius: 9999,
    overflow: 'hidden',
  },
  primaryPressed: {
    opacity: 0.92,
  },
  primaryDisabled: {
    opacity: 0.55,
  },
  primaryBtn: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
  },
  primaryLabel: {
    fontFamily: typography.sansBold,
    fontSize: 15,
    color: '#FFFFFF',
  },
  syncHint: {
    fontFamily: typography.sansRegular,
    fontSize: 11,
    color: SUCCESS_TOKENS.slate500,
    textAlign: 'center',
    marginTop: -4,
  },
  secondaryBtn: {
    height: 48,
    borderRadius: 9999,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  secondaryPressed: {
    backgroundColor: '#F8FAFC',
  },
  secondaryLabel: {
    fontFamily: typography.sansBold,
    fontSize: 15,
    color: SUCCESS_TOKENS.indigo,
  },
  tertiaryBtn: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  tertiaryLabel: {
    fontFamily: typography.sansMedium,
    fontSize: 14,
    color: SUCCESS_TOKENS.slate500,
  },
});
