import { ReactNode, useEffect } from 'react';
import {
  Platform,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useReduceMotion } from '../../hooks/useReduceMotion';

interface NoiseBackgroundProps {
  children?: ReactNode;
  /** Outer wrapper styles (margin, alignment). */
  containerStyle?: StyleProp<ViewStyle>;
  /** Border radius of the wrapper. Defaults to 9999 (pill). */
  radius?: number;
  /** Padding between the gradient ring and the child. Defaults to 2. */
  padding?: number;
  /** Ordered colors used to build the animated gradient ring. */
  gradientColors?: string[];
  /** Show the subtle noise texture overlay (web). Defaults to true. */
  showNoise?: boolean;
  /** Disable animation. */
  disabled?: boolean;
}

const DEFAULT_GRADIENT = ['#6366F1', '#A5B4FC', '#22D3EE', '#6366F1'];

/**
 * A gradient + noise frame designed to wrap interactive elements (buttons).
 *
 * Web: animated conic gradient as the ring background, optional SVG noise
 *      texture overlaid via mix-blend-mode for that "premium foil" feel.
 * Native: animated LinearGradient ring rotated by Reanimated to mimic the
 *      conic motion. Noise is skipped to keep the GPU cost negligible.
 */
export function NoiseBackground({
  children,
  containerStyle,
  radius = 9999,
  padding = 2,
  gradientColors = DEFAULT_GRADIENT,
  showNoise = true,
  disabled = false,
}: NoiseBackgroundProps) {
  if (Platform.OS === 'web') {
    return (
      <WebNoise
        containerStyle={containerStyle}
        radius={radius}
        padding={padding}
        gradientColors={gradientColors}
        showNoise={showNoise}
        disabled={disabled}
      >
        {children}
      </WebNoise>
    );
  }
  return (
    <NativeNoise
      containerStyle={containerStyle}
      radius={radius}
      padding={padding}
      gradientColors={gradientColors}
      disabled={disabled}
    >
      {children}
    </NativeNoise>
  );
}

// ─── Web ────────────────────────────────────────────────────────────────────

function WebNoise({
  children,
  containerStyle,
  radius,
  padding,
  gradientColors,
  showNoise,
  disabled,
}: Required<Omit<NoiseBackgroundProps, 'children' | 'containerStyle'>> & {
  children?: ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
}) {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const id = 'noise-bg-keyframes';
    if (document.getElementById(id)) return;
    const el = document.createElement('style');
    el.id = id;
    el.textContent = `
      @keyframes gocheck-noise-spin { to { transform: rotate(360deg); } }
    `;
    document.head.appendChild(el);
  }, []);

  const stops = gradientColors.join(', ');
  // Pre-built SVG noise (no dynamic generation), encoded as a data URI.
  const noiseDataUri =
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

  const wrapperStyle: any = {
    position: 'relative',
    borderRadius: radius,
    padding,
    overflow: 'hidden',
    isolation: 'isolate',
  };
  const ringStyle: any = {
    position: 'absolute',
    inset: '-50%',
    width: '200%',
    height: '200%',
    background: `conic-gradient(from 0deg, ${stops})`,
    animation: disabled ? undefined : 'gocheck-noise-spin 6s linear infinite',
    pointerEvents: 'none',
    zIndex: 0,
  };
  const noiseStyle: any = {
    position: 'absolute',
    inset: 0,
    borderRadius: radius,
    backgroundImage: noiseDataUri,
    backgroundSize: '160px 160px',
    backgroundRepeat: 'repeat',
    mixBlendMode: 'overlay',
    opacity: 0.35,
    pointerEvents: 'none',
    zIndex: 2,
  };
  const innerStyle: any = {
    position: 'relative',
    zIndex: 1,
    borderRadius: Math.max(0, radius - padding),
    overflow: 'hidden',
  };

  return (
    <View style={[wrapperStyle, containerStyle]}>
      <View style={ringStyle as ViewStyle} />
      <View style={innerStyle as ViewStyle}>{children}</View>
      {showNoise && <View style={noiseStyle as ViewStyle} />}
    </View>
  );
}

// ─── Native ─────────────────────────────────────────────────────────────────

function NativeNoise({
  children,
  containerStyle,
  radius,
  padding,
  gradientColors,
  disabled,
}: Required<Omit<NoiseBackgroundProps, 'children' | 'containerStyle' | 'showNoise'>> & {
  children?: ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
}) {
  const reduceMotion = useReduceMotion();
  const t = useSharedValue(0);
  const off = disabled || reduceMotion;

  useEffect(() => {
    if (off) return;
    t.value = withRepeat(
      withTiming(1, { duration: 6500, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(t);
  }, [off, t]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(t.value, [0, 1], [0, 360])}deg` }],
  }));

  return (
    <View
      style={[
        {
          padding,
          borderRadius: radius,
          overflow: 'hidden',
          position: 'relative',
        },
        containerStyle,
      ]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, spinStyle]} pointerEvents="none">
        <LinearGradient
          // Repeat the first color at the end so rotation loops smoothly.
          colors={[...gradientColors, gradientColors[0] ?? '#FFF'] as unknown as readonly [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <View
        style={{
          borderRadius: Math.max(0, radius - padding),
          overflow: 'hidden',
        }}
      >
        {children}
      </View>
    </View>
  );
}
