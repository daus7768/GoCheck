import { useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  RadialGradient,
  Rect,
  Stop,
  Mask,
} from 'react-native-svg';
import { colors } from '../../theme/tokens';
import { useReduceMotion } from '../../hooks/useReduceMotion';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface DottedGlowBackgroundProps {
  /** Pixel distance between dot centers. */
  gap?: number;
  /** Dot radius. */
  radius?: number;
  /** Base opacity ceiling. */
  opacity?: number;
  /** Background flood opacity (0 = transparent). */
  backgroundOpacity?: number;
  /** Dot tint. */
  color?: string;
  /** Hotspot/glow tint at the focus point. */
  glowColor?: string;
  /** Min/max twinkle period in seconds. */
  speedMin?: number;
  speedMax?: number;
  /** Hard cap on dot count (perf safeguard). */
  maxDots?: number;
  /** Where the radial focus sits (0..1, normalized). */
  focusX?: number;
  focusY?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Native re-creation of Aceternity's DottedGlowBackground.
 * - Grid of dots with a per-dot phase-offset twinkle on one shared driver.
 * - SVG radial mask creates the glow/fade so contrast stays high outside the focus.
 * - Reduce-motion → static field.
 */
export function DottedGlowBackground({
  gap = 16,
  radius = 1.6,
  opacity = 0.55,
  backgroundOpacity = 0,
  color = colors.primary,
  glowColor = colors.primaryLight,
  speedMin = 2.2,
  speedMax = 5.2,
  maxDots = 600,
  focusX = 0.5,
  focusY = 0.5,
  style,
}: DottedGlowBackgroundProps) {
  const reduceMotion = useReduceMotion();
  const [size, setSize] = useState({ w: 0, h: 0 });

  const t = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    t.value = withRepeat(
      withTiming(1, { duration: 4000, easing: Easing.linear }),
      -1,
      false
    );
    return () => cancelAnimation(t);
  }, [reduceMotion, t]);

  const dots = useMemo(() => {
    if (size.w === 0 || size.h === 0) return [] as { x: number; y: number; phase: number; speed: number }[];
    const cols = Math.floor(size.w / gap);
    const rows = Math.floor(size.h / gap);
    const total = cols * rows;
    const stride = total > maxDots ? Math.ceil(total / maxDots) : 1;
    const list: { x: number; y: number; phase: number; speed: number }[] = [];
    let n = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        n++;
        if (n % stride !== 0) continue;
        // Deterministic pseudo-random so re-layouts don't flash.
        const seed = ((r * 92821) ^ (c * 50777)) >>> 0;
        const rand = (seed % 1000) / 1000;
        const phase = rand;
        const speed = speedMin + rand * (speedMax - speedMin);
        list.push({
          x: c * gap + gap / 2,
          y: r * gap + gap / 2,
          phase,
          speed,
        });
      }
    }
    return list;
  }, [size, gap, maxDots, speedMin, speedMax]);

  function onLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.w || height !== size.h) setSize({ w: width, h: height });
  }

  const maskId = 'dgb-radial-mask';

  return (
    <View
      style={[StyleSheet.absoluteFill, style]}
      pointerEvents="none"
      onLayout={onLayout}
    >
      {size.w > 0 && size.h > 0 && (
        <Svg width={size.w} height={size.h}>
          <Defs>
            <RadialGradient
              id="dgb-glow"
              cx={`${focusX * 100}%`}
              cy={`${focusY * 100}%`}
              rx="60%"
              ry="60%"
              fx={`${focusX * 100}%`}
              fy={`${focusY * 100}%`}
            >
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
              <Stop offset="55%" stopColor="#FFFFFF" stopOpacity="0.55" />
              <Stop offset="100%" stopColor="#000000" stopOpacity="0" />
            </RadialGradient>
            <Mask id={maskId}>
              <Rect width="100%" height="100%" fill={`url(#dgb-glow)`} />
            </Mask>
            <RadialGradient
              id="dgb-tint"
              cx={`${focusX * 100}%`}
              cy={`${focusY * 100}%`}
              rx="55%"
              ry="55%"
            >
              <Stop offset="0%" stopColor={glowColor} stopOpacity="0.35" />
              <Stop offset="100%" stopColor={color} stopOpacity="0" />
            </RadialGradient>
          </Defs>

          {backgroundOpacity > 0 && (
            <Rect
              width="100%"
              height="100%"
              fill={color}
              opacity={backgroundOpacity}
            />
          )}

          <Rect width="100%" height="100%" fill="url(#dgb-tint)" mask={`url(#${maskId})`} />

          <Rect width="100%" height="100%" fill="transparent" mask={`url(#${maskId})`} />
          {dots.map((d, i) => (
            <Dot
              key={i}
              cx={d.x}
              cy={d.y}
              r={radius}
              color={color}
              opacity={opacity}
              phase={d.phase}
              speed={d.speed}
              t={t}
              reduceMotion={reduceMotion}
              maskId={maskId}
            />
          ))}
        </Svg>
      )}
    </View>
  );
}

interface DotProps {
  cx: number;
  cy: number;
  r: number;
  color: string;
  opacity: number;
  phase: number;
  speed: number;
  t: ReturnType<typeof useSharedValue<number>>;
  reduceMotion: boolean;
  maskId: string;
}

function Dot({ cx, cy, r, color, opacity, phase, speed, t, reduceMotion, maskId }: DotProps) {
  const animatedProps = useAnimatedProps(() => {
    if (reduceMotion) {
      return { opacity: opacity * 0.7 };
    }
    // Sine wave keyed off shared `t` plus per-dot phase. `speed` scales the wavelength.
    const wave = Math.sin((t.value * 2 + phase) * Math.PI * 2 * (1 / speed));
    const o = opacity * (0.35 + 0.65 * (0.5 + 0.5 * wave));
    return { opacity: o };
  });

  return (
    <AnimatedCircle
      cx={cx}
      cy={cy}
      r={r}
      fill={color}
      mask={`url(#${maskId})`}
      animatedProps={animatedProps}
    />
  );
}
