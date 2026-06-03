import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography, fontSize, radius, spacing, shadow } from '../../theme/tokens';
import { haptic, ImpactFeedbackStyle } from '../../lib/haptics';
import { AppText } from '../AppText';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { ConfettiBurst } from './ConfettiBurst';
import { SuccessCheck } from '../bill/SuccessCheck';

export type HoldToConfirmVariant = 'success' | 'destructive';
export type HoldToConfirmAnimation = 'confetti' | 'shake-dissolve';

export interface HoldToConfirmProps {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  variant: HoldToConfirmVariant;
  /** Milliseconds the user must hold before onConfirm fires. Default 1200. */
  holdDuration?: number;
  /** Async callback invoked when the hold completes naturally. */
  onConfirm: () => void | Promise<void>;
  /**
   * Which finale animation to play:
   * - `confetti`: HoldToConfirm renders ConfettiBurst + SuccessCheck overlay above the button.
   *   The overlay is absolutely positioned inside the nearest positioned ancestor.
   * - `shake-dissolve`: HoldToConfirm only fires onConfirm; the *parent* is responsible
   *   for any animation (e.g., shaking and dissolving the screen). Use this when the
   *   destructive effect needs to encompass content the button doesn't own.
   */
  onConfirmAnimation: HoldToConfirmAnimation;
  disabled?: boolean;
  /** Optional accessibility hint override. */
  accessibilityHint?: string;
}

const FALLBACK_TITLES: Record<HoldToConfirmVariant, string> = {
  success: 'Confirm',
  destructive: 'Are you sure?',
};

const FALLBACK_MESSAGES: Record<HoldToConfirmVariant, string> = {
  success: 'Proceed?',
  destructive: 'This action cannot be undone.',
};

/**
 * Press-and-hold confirmation button. Only natural completion of the
 * `withTiming` animation fires `onConfirm` — releasing early calls
 * `cancelAnimation` so the callback can't misfire.
 *
 * Accessibility: respects `prefers-reduced-motion` and falls back to a
 * single-tap `Alert.alert` flow for those users.
 */
export function HoldToConfirm({
  label,
  icon,
  variant,
  holdDuration = 1200,
  onConfirm,
  onConfirmAnimation,
  disabled = false,
  accessibilityHint,
}: HoldToConfirmProps) {
  const reduceMotion = useReduceMotion();
  const progress = useSharedValue(0);
  const scale = useSharedValue(1);
  const [confettiActive, setConfettiActive] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const fillColors: [string, string] =
    variant === 'success'
      ? [colors.secondary, colors.secondaryDark]
      : [colors.error, colors.errorDark];

  const baseBg = variant === 'success' ? colors.secondary : colors.error;

  useEffect(() => {
    return () => {
      cancelAnimation(progress);
      cancelAnimation(scale);
    };
  }, [progress, scale]);

  const handleConfirmed = useCallback(async () => {
    haptic.impact(ImpactFeedbackStyle.Medium);
    if (onConfirmAnimation === 'confetti') {
      setShowSuccess(true);
      setTimeout(() => setConfettiActive(true), 220);
    }
    try {
      await onConfirm();
    } finally {
      if (onConfirmAnimation === 'confetti') {
        setTimeout(() => {
          setShowSuccess(false);
          setConfettiActive(false);
        }, 1500);
      }
    }
  }, [onConfirm, onConfirmAnimation]);

  const handleReducedMotionTap = useCallback(() => {
    Alert.alert(
      FALLBACK_TITLES[variant],
      FALLBACK_MESSAGES[variant],
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: variant === 'destructive' ? 'Delete' : 'Confirm',
          style: variant === 'destructive' ? 'destructive' : 'default',
          onPress: () => {
            void handleConfirmed();
          },
        },
      ],
    );
  }, [variant, handleConfirmed]);

  const handlePressIn = useCallback(() => {
    if (disabled) return;
    haptic.selection();
    scale.value = withSpring(0.98, { damping: 18, stiffness: 320 });
    progress.value = 0;
    progress.value = withTiming(
      1,
      { duration: holdDuration, easing: Easing.linear },
      (finished) => {
        if (finished) {
          runOnJS(handleConfirmed)();
        }
      },
    );
  }, [disabled, holdDuration, progress, scale, handleConfirmed]);

  const handlePressOut = useCallback(() => {
    if (disabled) return;
    scale.value = withSpring(1, { damping: 18, stiffness: 220 });
    if (progress.value < 1) {
      cancelAnimation(progress);
      haptic.selection();
      progress.value = withSpring(0, { damping: 18, stiffness: 220 });
    }
  }, [disabled, progress, scale]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  if (reduceMotion) {
    return (
      <Pressable
        onPress={handleReducedMotionTap}
        disabled={disabled}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: baseBg },
          pressed && { opacity: 0.85 },
          disabled && { opacity: 0.5 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Feather name={icon} size={16} color={colors.white} />
        <AppText style={styles.label}>{label}</AppText>
      </Pressable>
    );
  }

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.button, { backgroundColor: 'transparent', borderWidth: 0 }, containerStyle]}>
        <Pressable
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint={accessibilityHint ?? `Press and hold for ${(holdDuration / 1000).toFixed(1)} seconds`}
          style={[styles.pressableInner, { backgroundColor: baseBg }, disabled && { opacity: 0.5 }]}
        >
          <Animated.View style={[StyleSheet.absoluteFillObject, styles.fillClip, fillStyle]}>
            <LinearGradient
              colors={fillColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFillObject}
            />
          </Animated.View>

          <View style={styles.labelRow} pointerEvents="none">
            <Feather name={icon} size={16} color={colors.white} />
            <AppText style={styles.label}>{label}</AppText>
          </View>
        </Pressable>
      </Animated.View>

      {onConfirmAnimation === 'confetti' && (showSuccess || confettiActive) ? (
        <View style={styles.celebrationOverlay} pointerEvents="none">
          {showSuccess ? <SuccessCheck reduceMotion={false} /> : null}
          <ConfettiBurst active={confettiActive} originX={0} originY={0} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
  },
  button: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    ...shadow.sm,
  },
  pressableInner: {
    paddingVertical: spacing[4],
    borderRadius: radius.xl,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fillClip: {
    overflow: 'hidden',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
  },
  label: {
    fontFamily: typography.sansSemiBold,
    fontSize: fontSize.base,
    color: colors.white,
  },
  celebrationOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
});
