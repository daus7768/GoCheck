/**
 * BackgroundBeams — curved SVG bezier beams with soft atmospheric glow +
 * animated bright traveling stroke. Inspired by the aceternity pattern used
 * in app/p/[token].tsx.
 *
 * Layout: dark gradient base → 5 thick static glow strokes → 5 thin animated
 * bright strokes → subtle content-readability overlay.
 */
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, LinearGradient as SvgGrad, Stop, Path } from 'react-native-svg';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useReduceMotion } from '../../hooks/useReduceMotion';

const AnimatedPath = Animated.createAnimatedComponent(Path);

// ── Beam definitions — 5 beams, each with visual + animation params ──────────

interface BeamDef {
  id: string;
  // Gradient IDs are auto-derived from id
  softOpacity: number;    // thick glow opacity
  softWidth: number;      // thick glow stroke width
  dashArray: string;      // bright stroke dash pattern (segment gap)
  offsetFrom: number;     // dashOffset start
  offsetTo: number;       // dashOffset end
  delay: number;
  duration: number;
}

const BEAMS: BeamDef[] = [
  // A — sweeps upper screen left→right, indigo/violet
  { id: 'a', softOpacity: 0.42, softWidth: 54, dashArray: '180 760', offsetFrom:  900, offsetTo: -900,  delay:    0, duration: 9000 },
  // B — sweeps mid screen left→right, cyan/emerald
  { id: 'b', softOpacity: 0.38, softWidth: 68, dashArray: '150 820', offsetFrom:  520, offsetTo: -1320, delay: 1000, duration: 8200 },
  // C — sweeps lower screen right→left, pink/violet
  { id: 'c', softOpacity: 0.30, softWidth: 58, dashArray: '130 780', offsetFrom: 1200, offsetTo: -760,  delay:  500, duration: 10000 },
  // D — gentle top-right arc, amber/orange
  { id: 'd', softOpacity: 0.26, softWidth: 44, dashArray: '120 680', offsetFrom:  820, offsetTo: -1080, delay: 1800, duration: 11000 },
  // E — diagonal cross, blue/sky
  { id: 'e', softOpacity: 0.22, softWidth: 50, dashArray: '160 720', offsetFrom: 1400, offsetTo: -580,  delay: 2400, duration: 8500 },
];

// Per-beam gradient stop colours
const GRADIENT_STOPS: Record<string, { soft: string[]; hot: string[] }> = {
  a: { soft: ['#38BDF8', '#6366F1', '#8B5CF6', '#FFFFFF'], hot: ['#FFFFFF', '#A5B4FC', '#67E8F9', '#A5B4FC', '#FFFFFF'] },
  b: { soft: ['#22D3EE', '#10B981', '#34D399', '#FFFFFF'], hot: ['#FFFFFF', '#67E8F9', '#6EE7B7', '#67E8F9', '#FFFFFF'] },
  c: { soft: ['#EC4899', '#8B5CF6', '#A78BFA', '#FFFFFF'], hot: ['#FFFFFF', '#F9A8D4', '#C4B5FD', '#F9A8D4', '#FFFFFF'] },
  d: { soft: ['#F59E0B', '#EF4444', '#FB923C', '#FFFFFF'], hot: ['#FFFFFF', '#FDE68A', '#FCA5A5', '#FDE68A', '#FFFFFF'] },
  e: { soft: ['#3B82F6', '#6366F1', '#60A5FA', '#FFFFFF'], hot: ['#FFFFFF', '#93C5FD', '#A5B4FC', '#93C5FD', '#FFFFFF'] },
};

// ── Path geometry — computed from container dimensions ────────────────────────

function buildPaths(w: number, h: number): Record<string, string> {
  return {
    // A: upper screen, left→right gentle arc
    a: `M -80 ${h * 0.18} C ${w * 0.18} ${h * 0.02}, ${w * 0.36} ${h * 0.44}, ${w + 80} ${h * 0.14}`,
    // B: mid-screen, left→right deep curve
    b: `M -70 ${h * 0.54} C ${w * 0.22} ${h * 0.30}, ${w * 0.54} ${h * 0.76}, ${w + 80} ${h * 0.46}`,
    // C: lower screen, right→left arc
    c: `M ${w + 70} ${h * 0.80} C ${w * 0.72} ${h * 0.58}, ${w * 0.24} ${h * 0.96}, -80 ${h * 0.66}`,
    // D: top-right sweep
    d: `M ${w + 50} ${h * 0.08} C ${w * 0.76} ${h * 0.24}, ${w * 0.38} ${h * 0.10}, -60 ${h * 0.34}`,
    // E: long diagonal cross (bottom-left to top-right)
    e: `M -50 ${h * 0.88} C ${w * 0.28} ${h * 0.64}, ${w * 0.72} ${h * 0.42}, ${w + 50} ${h * 0.06}`,
  };
}

// ── Animated bright beam path ─────────────────────────────────────────────────

interface AnimBeamProps extends BeamDef {
  d: string;
  maxOpacity: number;
}

function AnimBeam({ id, d, dashArray, offsetFrom, offsetTo, delay, duration, maxOpacity }: AnimBeamProps) {
  const progress = useSharedValue(0);
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    if (reduceMotion) return;
    progress.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false)
    );
    return () => cancelAnimation(progress);
  }, [reduceMotion, delay, duration, progress]);

  const animProps = useAnimatedProps(() => ({
    strokeDashoffset: interpolate(progress.value, [0, 1], [offsetFrom, offsetTo]),
    opacity: interpolate(
      progress.value,
      [0, 0.06, 0.84, 1],
      [0, maxOpacity, maxOpacity * 0.7, 0]
    ),
  }));

  return (
    <AnimatedPath
      d={d}
      stroke={`url(#hot${id})`}
      strokeWidth={2.8}
      strokeLinecap="round"
      fill="none"
      strokeDasharray={dashArray}
      animatedProps={animProps}
    />
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export interface BackgroundBeamsProps {
  style?: StyleProp<ViewStyle>;
  /** 0–1 multiplier on all beam opacities (use 0.5 dark / 0.15 light). */
  opacityScale?: number;
  /** When true renders the dark gradient base layer. Disable for transparent screens. */
  showBase?: boolean;
}

export function BackgroundBeams({
  style,
  opacityScale = 1,
  showBase = true,
}: BackgroundBeamsProps) {
  const [size, setSize] = useState({ w: 0, h: 0 });

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: width, h: height });
  }, []);

  const paths = useMemo(() => (size.w > 0 ? buildPaths(size.w, size.h) : null), [size]);

  return (
    <View
      style={[StyleSheet.absoluteFill, styles.root, style]}
      pointerEvents="none"
      onLayout={onLayout}
    >
      {/* ── Base dark gradient ── */}
      {showBase && (
        <LinearGradient
          colors={['#070A16', '#0F1035', '#061B2A', '#071215']}
          locations={[0, 0.38, 0.68, 1]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}

      {/* ── SVG beams ── */}
      {paths && (
        <Svg
          width={size.w}
          height={size.h}
          style={StyleSheet.absoluteFill}
          // @ts-ignore web-only
          pointerEvents="none"
        >
          <Defs>
            {BEAMS.map(({ id }) => {
              // Guaranteed to exist — GRADIENT_STOPS is keyed by BEAMS[*].id
              const stops = GRADIENT_STOPS[id]!;
              return (
                <Fragment key={id}>
                  <SvgGrad id={`soft${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
                    <Stop offset="0%"   stopColor={stops.soft[0]!} stopOpacity="0" />
                    <Stop offset="30%"  stopColor={stops.soft[1]!} stopOpacity={String(0.3  * opacityScale)} />
                    <Stop offset="62%"  stopColor={stops.soft[2]!} stopOpacity={String(0.22 * opacityScale)} />
                    <Stop offset="100%" stopColor={stops.soft[3]!} stopOpacity="0" />
                  </SvgGrad>
                  <SvgGrad id={`hot${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
                    <Stop offset="0%"   stopColor={stops.hot[0]!} stopOpacity="0" />
                    <Stop offset="28%"  stopColor={stops.hot[1]!} stopOpacity={String(0.95 * opacityScale)} />
                    <Stop offset="54%"  stopColor={stops.hot[2]!} stopOpacity={String(0.90 * opacityScale)} />
                    <Stop offset="76%"  stopColor={stops.hot[3]!} stopOpacity={String(0.75 * opacityScale)} />
                    <Stop offset="100%" stopColor={stops.hot[4]!} stopOpacity="0" />
                  </SvgGrad>
                </Fragment>
              );
            })}
          </Defs>

          {/* Static soft glow strokes */}
          {BEAMS.map(({ id, softOpacity, softWidth }) => (
            <Path
              key={`glow${id}`}
              d={paths[id] ?? ''}
              stroke={`url(#soft${id})`}
              strokeWidth={softWidth}
              strokeLinecap="round"
              fill="none"
              opacity={softOpacity * opacityScale}
            />
          ))}

          {/* Animated bright strokes */}
          {BEAMS.map((beam) => (
            <AnimBeam
              key={`anim${beam.id}`}
              {...beam}
              d={paths[beam.id] ?? ''}
              maxOpacity={0.9 * opacityScale}
            />
          ))}
        </Svg>
      )}

      {/* ── Content-readability overlay — softens hot spots ── */}
      <LinearGradient
        colors={[
          'rgba(7,10,22,0.08)',
          'rgba(7,10,22,0.38)',
          'rgba(7,10,22,0.18)',
        ]}
        locations={[0, 0.52, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    overflow: 'hidden',
  },
});
