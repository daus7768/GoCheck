import { useEffect, useMemo, useState } from 'react';
import { StyleProp, TextStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedReaction,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { useReduceMotion } from '../../hooks/useReduceMotion';

interface CountUpProps {
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  thousandsSeparator?: boolean;
  style?: StyleProp<TextStyle>;
  delay?: number;
}

const SIGNATURE = Easing.bezier(0.22, 1, 0.36, 1);

export function CountUp({
  value,
  duration = 850,
  decimals = 0,
  prefix = '',
  suffix = '',
  thousandsSeparator = true,
  style,
  delay = 0,
}: CountUpProps) {
  const reduceMotion = useReduceMotion();
  const sv = useSharedValue(reduceMotion ? value : 0);
  const [display, setDisplay] = useState<number>(reduceMotion ? value : 0);

  useEffect(() => {
    if (reduceMotion) {
      sv.value = value;
      setDisplay(value);
      return;
    }
    const id = setTimeout(() => {
      sv.value = withTiming(value, { duration, easing: SIGNATURE });
    }, delay);
    return () => clearTimeout(id);
  }, [value, duration, delay, reduceMotion, sv]);

  useAnimatedReaction(
    () => sv.value,
    (current, prev) => {
      if (prev === null || Math.abs(current - (prev ?? 0)) > 0.01 || current === value) {
        runOnJS(setDisplay)(current);
      }
    },
    [value]
  );

  const formatted = useMemo(() => {
    const fixed = display.toFixed(decimals);
    if (!thousandsSeparator) return `${prefix}${fixed}${suffix}`;
    const dotIdx = fixed.indexOf('.');
    const intPart = dotIdx === -1 ? fixed : fixed.slice(0, dotIdx);
    const fracPart = dotIdx === -1 ? '' : fixed.slice(dotIdx + 1);
    const withSep = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `${prefix}${fracPart ? `${withSep}.${fracPart}` : withSep}${suffix}`;
  }, [display, decimals, prefix, suffix, thousandsSeparator]);

  return <Animated.Text style={style}>{formatted}</Animated.Text>;
}
