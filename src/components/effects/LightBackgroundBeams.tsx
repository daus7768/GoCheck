/**
 * LightBackgroundBeams — light-mode equivalent of BackgroundBeams.
 * Same 5 animated SVG bezier beams, same path geometry and timing.
 * Pearl-white base, soft emerald/teal/indigo pastel palette.
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

interface BeamDef {
  id: string;
  softOpacity: number;
  softWidth: number;
  dashArray: string;
  offsetFrom: number;
  offsetTo: number;
  delay: number;
  duration: number;
}

// Same timing/geometry as dark mode — only colors differ
const BEAMS: BeamDef[] = [
  { id: 'a', softOpacity: 0.27, softWidth: 54, dashArray: '180 760', offsetFrom:  900, offsetTo: -900,  delay:    0, duration: 9000 },
  { id: 'b', softOpacity: 0.25, softWidth: 68, dashArray: '150 820', offsetFrom:  520, offsetTo: -1320, delay: 1000, duration: 8200 },
  { id: 'c', softOpacity: 0.20, softWidth: 58, dashArray: '130 780', offsetFrom: 1200, offsetTo: -760,  delay:  500, duration: 10000 },
  { id: 'd', softOpacity: 0.17, softWidth: 44, dashArray: '120 680', offsetFrom:  820, offsetTo: -1080, delay: 1800, duration: 11000 },
  { id: 'e', softOpacity: 0.14, softWidth: 50, dashArray: '160 720', offsetFrom: 1400, offsetTo: -580,  delay: 2400, duration: 8500 },
];

// Pastel emerald/teal dominant palette for light backgrounds
const GRADIENT_STOPS: Record<string, { soft: string[]; hot: string[] }> = {
  a: { soft: ['#A5B4FC', '#818CF8', '#C4B5FD', '#FFFFFF'], hot: ['#FFFFFF', '#C7D2FE', '#A5B4FC', '#C7D2FE', '#FFFFFF'] },
  b: { soft: ['#6EE7B7', '#34D399', '#A7F3D0', '#FFFFFF'], hot: ['#FFFFFF', '#D1FAE5', '#6EE7B7', '#D1FAE5', '#FFFFFF'] },
  c: { soft: ['#86EFAC', '#4ADE80', '#BBF7D0', '#FFFFFF'], hot: ['#FFFFFF', '#DCFCE7', '#86EFAC', '#DCFCE7', '#FFFFFF'] },
  d: { soft: ['#34D399', '#2DD4BF', '#99F6E4', '#FFFFFF'], hot: ['#FFFFFF', '#CCFBF1', '#5EEAD4', '#CCFBF1', '#FFFFFF'] },
  e: { soft: ['#67E8F9', '#22D3EE', '#A5F3FC', '#FFFFFF'], hot: ['#FFFFFF', '#CFFAFE', '#67E8F9', '#CFFAFE', '#FFFFFF'] },
};

function buildPaths(w: number, h: number): Record<string, string> {
  return {
    a: `M -80 ${h * 0.18} C ${w * 0.18} ${h * 0.02}, ${w * 0.36} ${h * 0.44}, ${w + 80} ${h * 0.14}`,
    b: `M -70 ${h * 0.54} C ${w * 0.22} ${h * 0.30}, ${w * 0.54} ${h * 0.76}, ${w + 80} ${h * 0.46}`,
    c: `M ${w + 70} ${h * 0.80} C ${w * 0.72} ${h * 0.58}, ${w * 0.24} ${h * 0.96}, -80 ${h * 0.66}`,
    d: `M ${w + 50} ${h * 0.08} C ${w * 0.76} ${h * 0.24}, ${w * 0.38} ${h * 0.10}, -60 ${h * 0.34}`,
    e: `M -50 ${h * 0.88} C ${w * 0.28} ${h * 0.64}, ${w * 0.72} ${h * 0.42}, ${w + 50} ${h * 0.06}`,
  };
}

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
      stroke={`url(#lhot${id})`}
      strokeWidth={2.8}
      strokeLinecap="round"
      fill="none"
      strokeDasharray={dashArray}
      animatedProps={animProps}
    />
  );
}

export interface LightBackgroundBeamsProps {
  style?: StyleProp<ViewStyle>;
  opacityScale?: number;
  showBase?: boolean;
}

export function LightBackgroundBeams({
  style,
  opacityScale = 1,
  showBase = true,
}: LightBackgroundBeamsProps) {
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
      {/* ── Base pearl-white gradient ── */}
      {showBase && (
        <LinearGradient
          colors={['#FAFBFF', '#F0F4FF', '#F5FFFE', '#F8FFFC']}
          locations={[0, 0.35, 0.68, 1]}
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
              const stops = GRADIENT_STOPS[id]!;
              return (
                <Fragment key={id}>
                  <SvgGrad id={`lsoft${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
                    <Stop offset="0%"   stopColor={stops.soft[0]!} stopOpacity="0" />
                    <Stop offset="30%"  stopColor={stops.soft[1]!} stopOpacity={String(0.3  * opacityScale)} />
                    <Stop offset="62%"  stopColor={stops.soft[2]!} stopOpacity={String(0.22 * opacityScale)} />
                    <Stop offset="100%" stopColor={stops.soft[3]!} stopOpacity="0" />
                  </SvgGrad>
                  <SvgGrad id={`lhot${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
                    <Stop offset="0%"   stopColor={stops.hot[0]!} stopOpacity="0" />
                    <Stop offset="28%"  stopColor={stops.hot[1]!} stopOpacity={String(0.75 * opacityScale)} />
                    <Stop offset="54%"  stopColor={stops.hot[2]!} stopOpacity={String(0.70 * opacityScale)} />
                    <Stop offset="76%"  stopColor={stops.hot[3]!} stopOpacity={String(0.55 * opacityScale)} />
                    <Stop offset="100%" stopColor={stops.hot[4]!} stopOpacity="0" />
                  </SvgGrad>
                </Fragment>
              );
            })}
          </Defs>

          {/* Static soft glow strokes */}
          {BEAMS.map(({ id, softOpacity, softWidth }) => (
            <Path
              key={`lglow${id}`}
              d={paths[id] ?? ''}
              stroke={`url(#lsoft${id})`}
              strokeWidth={softWidth}
              strokeLinecap="round"
              fill="none"
              opacity={softOpacity * opacityScale}
            />
          ))}

          {/* Animated bright strokes */}
          {BEAMS.map((beam) => (
            <AnimBeam
              key={`lanim${beam.id}`}
              {...beam}
              d={paths[beam.id] ?? ''}
              maxOpacity={0.55 * opacityScale}
            />
          ))}
        </Svg>
      )}

      {/* ── Light frost readability overlay ── */}
      <LinearGradient
        colors={[
          'rgba(240,244,255,0.20)',
          'rgba(240,244,255,0.10)',
          'rgba(245,255,254,0.15)',
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
