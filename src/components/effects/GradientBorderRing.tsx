import { ReactNode, useEffect } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { radius as themeRadius } from '../../theme/tokens';
import { useReduceMotion } from '../../hooks/useReduceMotion';

interface Props {
  children: ReactNode;
  /** Border ring thickness in px. */
  thickness?: number;
  /** Spin duration in ms. */
  duration?: number;
  /** Outer container border radius. Defaults to fully rounded. */
  borderRadius?: number;
  /** Outer container style — margins, alignment, etc. */
  style?: StyleProp<ViewStyle>;
  /** Color stops for the rotating gradient. Override for theme variants. */
  colors?: string[];
  /** Pause animation. */
  disabled?: boolean;
}

const DEFAULT_COLORS = [
  'rgba(255,255,255,0)',
  'rgba(255,255,255,0.95)',
  'rgba(167,139,250,0.85)',
  'rgba(255,255,255,0)',
  'rgba(99,102,241,0.9)',
  'rgba(255,255,255,0)',
];

/**
 * Wraps any child with an Aceternity-style rotating gradient border ring.
 * The child renders inset by `thickness`, so the spinning gradient peeks out
 * as a thin animated border. Respects reduce-motion.
 */
export function GradientBorderRing({
  children,
  thickness = 1.5,
  duration = 3200,
  borderRadius = themeRadius.full,
  style,
  colors = DEFAULT_COLORS,
  disabled = false,
}: Props) {
  const reduceMotion = useReduceMotion();
  const spin = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion || disabled) return;
    spin.value = 0;
    spin.value = withRepeat(
      withTiming(1, { duration, easing: Easing.linear }),
      -1,
      false
    );
    return () => cancelAnimation(spin);
  }, [reduceMotion, disabled, duration, spin]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 360}deg` }],
  }));

  return (
    <View
      style={[
        styles.wrap,
        { padding: thickness, borderRadius },
        style,
      ]}
    >
      <Animated.View pointerEvents="none" style={[styles.spinner, spinStyle]}>
        <LinearGradient
          colors={colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    position: 'relative',
    alignSelf: 'flex-start',
  },
  spinner: {
    position: 'absolute',
    top: '-150%',
    left: '-150%',
    width: '400%',
    height: '400%',
  },
});
