import { ReactNode, useEffect } from 'react';
import {
  AccessibilityRole,
  GestureResponderEvent,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSpring,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, shadow } from '../../theme/tokens';
import { useReduceMotion } from '../../hooks/useReduceMotion';

interface SheenButtonProps {
  children: ReactNode;
  onPress?: (e: GestureResponderEvent) => void;
  /** Pill height & padding feel. */
  size?: 'sm' | 'md' | 'lg';
  /** Override gradient colors. Defaults to brand indigo. */
  gradient?: [string, string];
  /** Loop duration for sheen sweep in ms. */
  sheenDuration?: number;
  /** Outer container style (margin etc.). */
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityRole?: AccessibilityRole;
  disabled?: boolean;
}

const SIZE_MAP: Record<'sm' | 'md' | 'lg', { padH: number; padV: number }> = {
  sm: { padH: 12, padV: 6 },
  md: { padH: 16, padV: 10 },
  lg: { padH: 22, padV: 14 },
};

/**
 * Gradient-filled pill with a looping diagonal sheen sweep and spring press-scale.
 * Native adaptation of Aceternity's HoverBorderGradient — "hover" replaced with
 * a continuous ambient sheen because mobile has no hover.
 */
export function SheenButton({
  children,
  onPress,
  size = 'md',
  gradient = [colors.primary, colors.primaryDark],
  sheenDuration = 2400,
  style,
  accessibilityLabel,
  accessibilityRole = 'button',
  disabled,
}: SheenButtonProps) {
  const reduceMotion = useReduceMotion();
  const sheen = useSharedValue(-1);
  const press = useSharedValue(1);
  const { padH, padV } = SIZE_MAP[size];

  useEffect(() => {
    if (reduceMotion || disabled) return;
    sheen.value = -1;
    sheen.value = withRepeat(
      withTiming(1, { duration: sheenDuration, easing: Easing.inOut(Easing.cubic) }),
      -1,
      false
    );
    return () => cancelAnimation(sheen);
  }, [reduceMotion, disabled, sheenDuration, sheen]);

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: press.value }],
  }));

  const sheenStyle = useAnimatedStyle(() => ({
    // Sweep a diagonal highlight from off-left (-100%) across to off-right (+200%).
    transform: [
      { translateX: (sheen.value + 1) * 180 - 80 },
      { rotate: '20deg' },
    ],
    opacity: reduceMotion ? 0 : 0.55,
  }));

  return (
    <Animated.View style={[pressStyle, style]}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        onPressIn={() => {
          press.value = withSpring(0.94, { damping: 18, stiffness: 320 });
        }}
        onPressOut={() => {
          press.value = withSpring(1, { damping: 14, stiffness: 260 });
        }}
        accessibilityRole={accessibilityRole}
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled: !!disabled }}
      >
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.pill,
            {
              paddingHorizontal: padH,
              paddingVertical: padV,
              borderRadius: radius.full,
            },
            disabled && { opacity: 0.5 },
          ]}
        >
          <View style={[styles.content]}>{children}</View>
          {/* Sheen overlay — clipped to pill */}
          <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { borderRadius: radius.full, overflow: 'hidden' }]}>
            <Animated.View style={[styles.sheen, sheenStyle]}>
              <LinearGradient
                colors={[
                  'rgba(255,255,255,0)',
                  'rgba(255,255,255,0.85)',
                  'rgba(255,255,255,0)',
                ]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFillObject}
              />
            </Animated.View>
          </View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...shadow.sm,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    zIndex: 2,
  },
  sheen: {
    position: 'absolute',
    top: -20,
    bottom: -20,
    width: 40,
  },
});
