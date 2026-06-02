import { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Path } from 'react-native-svg';
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
  // Offsets relative to source point (fraction of container dimensions)
  dx: number;
  dy: number;
  color: string;
  duration: number;
  delay: number;
  maxOpacity: number;
  strokeWidth: number;
}

// 12 beams radiating from a central-top source, covering all directions
const BEAM_DEFS: BeamDef[] = [
  { id: 'a', dx: -0.55, dy: -0.42, color: '#6366F1', duration: 3800, delay: 0,    maxOpacity: 0.85, strokeWidth: 1.5 },
  { id: 'b', dx: -0.32, dy: -0.46, color: '#8B5CF6', duration: 3200, delay: 500,  maxOpacity: 0.75, strokeWidth: 1   },
  { id: 'c', dx: -0.08, dy: -0.46, color: '#22D3EE', duration: 4200, delay: 200,  maxOpacity: 0.8,  strokeWidth: 2   },
  { id: 'd', dx:  0.08, dy: -0.46, color: '#A78BFA', duration: 3600, delay: 800,  maxOpacity: 0.78, strokeWidth: 1   },
  { id: 'e', dx:  0.32, dy: -0.46, color: '#10B981', duration: 2800, delay: 300,  maxOpacity: 0.7,  strokeWidth: 1   },
  { id: 'f', dx:  0.55, dy: -0.42, color: '#38BDF8', duration: 4000, delay: 1100, maxOpacity: 0.82, strokeWidth: 1.5 },
  { id: 'g', dx: -0.58, dy: -0.08, color: '#34D399', duration: 4600, delay: 700,  maxOpacity: 0.6,  strokeWidth: 1   },
  { id: 'h', dx:  0.58, dy: -0.08, color: '#F472B6', duration: 3400, delay: 1400, maxOpacity: 0.58, strokeWidth: 1   },
  { id: 'i', dx: -0.56, dy:  0.34, color: '#818CF8', duration: 5000, delay: 400,  maxOpacity: 0.52, strokeWidth: 1   },
  { id: 'j', dx:  0.56, dy:  0.34, color: '#67E8F9', duration: 3800, delay: 1000, maxOpacity: 0.58, strokeWidth: 1.5 },
  { id: 'k', dx: -0.28, dy:  0.52, color: '#C084FC', duration: 4400, delay: 900,  maxOpacity: 0.48, strokeWidth: 1   },
  { id: 'l', dx:  0.28, dy:  0.52, color: '#5EEAD4', duration: 3200, delay: 1600, maxOpacity: 0.52, strokeWidth: 1   },
];

interface ComputedBeam extends BeamDef {
  srcX: number;
  srcY: number;
  dstX: number;
  dstY: number;
}

interface BeamPathProps {
  beam: ComputedBeam;
  opacityScale: number;
}

function BeamPath({ beam, opacityScale }: BeamPathProps) {
  const { id, srcX, srcY, dstX, dstY, duration, delay, maxOpacity, strokeWidth } = beam;
  const reduceMotion = useReduceMotion();
  const progress = useSharedValue(0);

  const dx = dstX - srcX;
  const dy = dstY - srcY;
  const length = Math.sqrt(dx * dx + dy * dy);
  const segLen = length * 0.13;
  const scaledOpacity = maxOpacity * opacityScale;

  useEffect(() => {
    if (reduceMotion || length < 10) return;
    progress.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false)
    );
    return () => cancelAnimation(progress);
  }, [reduceMotion, length, duration, delay, progress]);

  const animProps = useAnimatedProps(() => ({
    strokeDashoffset: interpolate(
      progress.value,
      [0, 1],
      [length + segLen, -(segLen + 4)]
    ),
    opacity: interpolate(
      progress.value,
      [0, 0.06, 0.84, 1],
      [0, scaledOpacity, scaledOpacity * 0.6, 0]
    ),
  }));

  if (length < 10) return null;

  const dashArr = `${segLen} ${length + segLen}`;

  return (
    <AnimatedPath
      d={`M ${srcX} ${srcY} L ${dstX} ${dstY}`}
      stroke={`url(#bg${id})`}
      strokeWidth={strokeWidth}
      strokeDasharray={dashArr}
      fill="none"
      animatedProps={animProps}
    />
  );
}

interface BackgroundBeamsProps {
  style?: StyleProp<ViewStyle>;
  /** 0–1 multiplier applied to all beam opacities. Default 1. */
  opacityScale?: number;
}

export function BackgroundBeams({ style, opacityScale = 1 }: BackgroundBeamsProps) {
  const [size, setSize] = useState({ w: 0, h: 0 });

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: width, h: height });
  }, []);

  const beams = useMemo<ComputedBeam[]>(() => {
    if (size.w < 1 || size.h < 1) return [];
    const srcX = size.w * 0.5;
    const srcY = size.h * 0.36;
    return BEAM_DEFS.map((def) => ({
      ...def,
      srcX,
      srcY,
      dstX: srcX + def.dx * size.w,
      dstY: srcY + def.dy * size.h,
    }));
  }, [size]);

  return (
    <View
      style={[StyleSheet.absoluteFill, styles.root, style]}
      pointerEvents="none"
      onLayout={onLayout}
    >
      {beams.length > 0 && (
        <Svg
          width={size.w}
          height={size.h}
          // @ts-ignore — web-only
          style={{ pointerEvents: 'none' }}
        >
          <Defs>
            {beams.map(({ id, srcX, srcY, dstX, dstY, color }) => (
              <LinearGradient
                key={id}
                id={`bg${id}`}
                x1={srcX}
                y1={srcY}
                x2={dstX}
                y2={dstY}
                gradientUnits="userSpaceOnUse"
              >
                <Stop offset="0%" stopColor={color} stopOpacity={0.95} />
                <Stop offset="50%" stopColor={color} stopOpacity={0.5}  />
                <Stop offset="100%" stopColor={color} stopOpacity={0}   />
              </LinearGradient>
            ))}
          </Defs>

          {beams.map((beam) => (
            <BeamPath key={beam.id} beam={beam} opacityScale={opacityScale} />
          ))}
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    overflow: 'hidden',
  },
});
