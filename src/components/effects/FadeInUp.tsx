import { ReactNode, useEffect } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useReduceMotion } from '../../hooks/useReduceMotion';

interface FadeInUpProps {
  children: ReactNode;
  index?: number;
  delay?: number;
  duration?: number;
  distance?: number;
  style?: StyleProp<ViewStyle>;
  staggerMs?: number;
  cap?: number;
}

const SIGNATURE = Easing.bezier(0.22, 1, 0.36, 1);

export function FadeInUp({
  children,
  index = 0,
  delay = 0,
  duration = 420,
  distance = 14,
  style,
  staggerMs = 55,
  cap = 6,
}: FadeInUpProps) {
  const reduceMotion = useReduceMotion();
  const opacity = useSharedValue(reduceMotion ? 1 : 0);
  const translate = useSharedValue(reduceMotion ? 0 : distance);

  useEffect(() => {
    if (reduceMotion) {
      opacity.value = 1;
      translate.value = 0;
      return;
    }
    const total = delay + Math.min(index, cap) * staggerMs;
    opacity.value = withDelay(total, withTiming(1, { duration, easing: SIGNATURE }));
    translate.value = withDelay(total, withTiming(0, { duration, easing: SIGNATURE }));
  }, [reduceMotion, delay, index, staggerMs, cap, duration, opacity, translate]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translate.value }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
