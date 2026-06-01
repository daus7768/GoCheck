import { useEffect } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { radius } from '../../theme/tokens';
import { useReduceMotion } from '../../hooks/useReduceMotion';

interface AnimatedBarProps {
  /** 0–100 */
  pct: number;
  height?: number;
  trackColor: string;
  fillColor: string;
  duration?: number;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}

const SIGNATURE = Easing.bezier(0.22, 1, 0.36, 1);

export function AnimatedBar({
  pct,
  height = 6,
  trackColor,
  fillColor,
  duration = 850,
  delay = 80,
  style,
}: AnimatedBarProps) {
  const reduceMotion = useReduceMotion();
  const clamped = Math.max(0, Math.min(100, pct));
  const progress = useSharedValue(reduceMotion ? clamped : 0);

  useEffect(() => {
    if (reduceMotion) {
      progress.value = clamped;
      return;
    }
    const id = setTimeout(() => {
      progress.value = withTiming(clamped, { duration, easing: SIGNATURE });
    }, delay);
    return () => clearTimeout(id);
  }, [clamped, duration, delay, reduceMotion, progress]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value}%`,
  }));

  return (
    <View
      style={[
        styles.track,
        { height, backgroundColor: trackColor, borderRadius: radius.full },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.fill,
          { backgroundColor: fillColor, borderRadius: radius.full },
          fillStyle,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', overflow: 'hidden' },
  fill: { height: '100%' },
});
