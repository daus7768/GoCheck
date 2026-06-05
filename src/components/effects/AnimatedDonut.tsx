import { useEffect } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  withDelay,
  withRepeat,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  RadialGradient,
  Stop,
} from 'react-native-svg';
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
  /** Solid arc colour, used only when `liquid` is false. */
  fillColor?: string;
  /** Multi-stop colours for the liquid gradient arc (top-left → bottom-right). */
  arcColors?: string[];
  /** Iridescent gradient arc + glowing comet tip. Defaults to true. */
  liquid?: boolean;
  labelColor?: string;
  sublabelColor?: string;
  sublabel?: string;
  duration?: number;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}

const SIGNATURE = Easing.bezier(0.22, 1, 0.36, 1);

export const LIQUID_ARC_COLORS = ['#C7D2FE', '#22D3EE', '#A78BFA', '#F5D0FE'];

export function AnimatedDonut({
  pct,
  size = 78,
  stroke = 6,
  trackColor = 'rgba(255,255,255,0.22)',
  fillColor = '#FFFFFF',
  arcColors = LIQUID_ARC_COLORS,
  liquid = true,
  labelColor = colors.white,
  sublabelColor = 'rgba(255,255,255,0.85)',
  sublabel = 'COLLECTED',
  duration = 950,
  delay = 120,
  style,
}: AnimatedDonutProps) {
  const reduceMotion = useReduceMotion();
  const clamped = Math.max(0, Math.min(100, pct));

  // Reserve room around the ring so the comet's glow halo never clips the box.
  const glowPad = liquid ? stroke * 1.2 : 0;
  const r = (size - stroke) / 2 - glowPad;
  const circ = 2 * Math.PI * r;
  const cxy = size / 2;

  // Comet geometry
  const coreR = stroke * 0.5;
  const haloMaxR = stroke * 1.2; // matches glowPad so the halo stays in-bounds
  const showComet = liquid && clamped > 0;

  const progress = useSharedValue(reduceMotion ? clamped : 0);
  const pulse = useSharedValue(0); // halo breathing 0→1
  const sweep = useSharedValue(0); // shimmer travel 0→1

  useEffect(() => {
    if (reduceMotion) {
      progress.value = clamped;
      return;
    }
    progress.value = 0;
    const id = setTimeout(() => {
      progress.value = withTiming(clamped, { duration, easing: SIGNATURE });
    }, delay);

    pulse.value = withRepeat(
      withTiming(1, { duration: 1150, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
    // Shimmer begins once the arc has finished filling.
    sweep.value = withDelay(
      delay + duration,
      withRepeat(
        withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.cubic) }),
        -1,
        false
      )
    );

    return () => {
      clearTimeout(id);
      cancelAnimation(progress);
      cancelAnimation(pulse);
      cancelAnimation(sweep);
    };
  }, [clamped, duration, delay, reduceMotion, progress, pulse, sweep]);

  // Filled length of the arc — shared by the gradient arc and its glow.
  const arcProps = useAnimatedProps(() => {
    const filled = (progress.value / 100) * circ;
    return { strokeDasharray: `${filled} ${circ}` };
  });

  // A short highlight that slides along the filled arc — the "liquid" surface light.
  const seg = Math.max(8, circ * 0.06);
  const shimmerProps = useAnimatedProps(() => {
    const filled = (clamped / 100) * circ;
    const travel = Math.max(0, filled - seg);
    return {
      strokeDasharray: `${seg} ${circ}`,
      strokeDashoffset: -sweep.value * travel,
    };
  });

  // Comet core position (rides the leading edge of the fill).
  const coreProps = useAnimatedProps(() => {
    const theta = (progress.value / 100) * 2 * Math.PI;
    return {
      cx: cxy + r * Math.sin(theta),
      cy: cxy - r * Math.cos(theta),
    };
  });

  // Breathing glow halo around the comet tip.
  const haloProps = useAnimatedProps(() => {
    const theta = (progress.value / 100) * 2 * Math.PI;
    return {
      cx: cxy + r * Math.sin(theta),
      cy: cxy - r * Math.cos(theta),
      r: haloMaxR * (0.7 + 0.3 * pulse.value),
      opacity: 0.45 + 0.4 * pulse.value,
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
        <Defs>
          <SvgLinearGradient id="donutLiquid" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={arcColors[0]} />
            <Stop offset="0.4" stopColor={arcColors[1]} />
            <Stop offset="0.72" stopColor={arcColors[2]} />
            <Stop offset="1" stopColor={arcColors[3] ?? arcColors[0]} />
          </SvgLinearGradient>
          <RadialGradient id="donutTipGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.95} />
            <Stop offset="0.45" stopColor="#67E8F9" stopOpacity={0.55} />
            <Stop offset="1" stopColor="#67E8F9" stopOpacity={0} />
          </RadialGradient>
        </Defs>

        {/* Track */}
        <Circle cx={cxy} cy={cxy} r={r} stroke={trackColor} strokeWidth={stroke} fill="none" />

        {liquid ? (
          <>
            {/* Soft outer glow */}
            <AnimatedCircle
              cx={cxy}
              cy={cxy}
              r={r}
              stroke="url(#donutLiquid)"
              strokeWidth={stroke * 1.9}
              strokeOpacity={0.28}
              fill="none"
              strokeLinecap="round"
              animatedProps={arcProps}
              transform={`rotate(-90 ${cxy} ${cxy})`}
            />
            {/* Gradient arc */}
            <AnimatedCircle
              cx={cxy}
              cy={cxy}
              r={r}
              stroke="url(#donutLiquid)"
              strokeWidth={stroke}
              fill="none"
              strokeLinecap="round"
              animatedProps={arcProps}
              transform={`rotate(-90 ${cxy} ${cxy})`}
            />
            {/* Liquid shimmer */}
            {showComet && !reduceMotion ? (
              <AnimatedCircle
                cx={cxy}
                cy={cxy}
                r={r}
                stroke="#FFFFFF"
                strokeWidth={stroke * 0.7}
                strokeOpacity={0.45}
                fill="none"
                strokeLinecap="round"
                animatedProps={shimmerProps}
                transform={`rotate(-90 ${cxy} ${cxy})`}
              />
            ) : null}
            {/* Comet tip: glow halo + bright core */}
            {showComet ? (
              <>
                <AnimatedCircle
                  cx={cxy}
                  cy={stroke / 2 + glowPad}
                  r={haloMaxR}
                  fill="url(#donutTipGlow)"
                  animatedProps={haloProps}
                />
                <AnimatedCircle
                  cx={cxy}
                  cy={stroke / 2 + glowPad}
                  r={coreR}
                  fill="#FFFFFF"
                  animatedProps={coreProps}
                />
              </>
            ) : null}
          </>
        ) : (
          <AnimatedCircle
            cx={cxy}
            cy={cxy}
            r={r}
            stroke={fillColor}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            animatedProps={arcProps}
            transform={`rotate(-90 ${cxy} ${cxy})`}
          />
        )}
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
