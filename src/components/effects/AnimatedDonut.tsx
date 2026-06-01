import { useEffect } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { CountUp } from './CountUp';
import { typography, fontSize, colors } from '../../theme/tokens';
import { useReduceMotion } from '../../hooks/useReduceMotion';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface AnimatedDonutProps {
  /** 0–100 */
  pct: number;
  size?: number;
  stroke?: number;
  trackColor?: string;
  fillColor?: string;
  labelColor?: string;
  sublabelColor?: string;
  sublabel?: string;
  duration?: number;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}

const SIGNATURE = Easing.bezier(0.22, 1, 0.36, 1);

export function AnimatedDonut({
  pct,
  size = 78,
  stroke = 6,
  trackColor = 'rgba(255,255,255,0.22)',
  fillColor = '#FFFFFF',
  labelColor = colors.white,
  sublabelColor = 'rgba(255,255,255,0.85)',
  sublabel = 'COLLECTED',
  duration = 950,
  delay = 120,
  style,
}: AnimatedDonutProps) {
  const reduceMotion = useReduceMotion();
  const clamped = Math.max(0, Math.min(100, pct));
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;

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

  const animatedProps = useAnimatedProps(() => {
    const filled = (progress.value / 100) * circ;
    return {
      strokeDasharray: `${filled} ${circ}`,
    };
  });

  return (
    <View
      style={[
        { width: size, height: size, alignItems: 'center', justifyContent: 'center' },
        style,
      ]}
    >
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={trackColor}
          strokeWidth={stroke}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={fillColor}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          animatedProps={animatedProps}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <CountUp
        value={clamped}
        duration={duration}
        delay={delay}
        suffix="%"
        decimals={0}
        style={[styles.pct, { color: labelColor }]}
      />
      <Animated.Text style={[styles.sub, { color: sublabelColor }]}>
        {sublabel}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pct: {
    fontFamily: typography.sansBold,
    fontSize: fontSize.lg,
  },
  sub: {
    fontFamily: typography.sansRegular,
    fontSize: 9,
  },
});
