import { ReactNode, useEffect } from 'react';
import { Platform, StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '../../theme/tokens';
import { useReduceMotion } from '../../hooks/useReduceMotion';

interface AuroraBackgroundProps {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Show subtle radial/dark vignette over the aurora. Defaults to true. */
  showRadialGradient?: boolean;
  /** Override the base color stack used for the aurora bands. */
  bandColors?: [string, string, string, string, string];
  /** Base surface color (sits behind the aurora). Defaults to a deep indigo navy. */
  background?: string;
}

const DEFAULT_BANDS: [string, string, string, string, string] = [
  '#3B82F6', // sky-blue
  '#6366F1', // indigo
  '#8B5CF6', // violet
  '#22D3EE', // cyan
  '#10B981', // emerald
];

/**
 * Cross-platform Aurora Background (inspired by Aceternity).
 *
 * Web: real CSS aurora — two stacked gradient layers with mask-image cutting them
 *      into wavy bands, then animated via background-position over 60s.
 * Native: layered, slowly drifting LinearGradient blobs producing a similar
 *      shifting-light feel.
 */
export function AuroraBackground({
  children,
  style,
  showRadialGradient = true,
  bandColors = DEFAULT_BANDS,
  background = '#0B1020',
}: AuroraBackgroundProps) {
  if (Platform.OS === 'web') {
    return (
      <WebAurora
        style={style}
        showRadialGradient={showRadialGradient}
        bandColors={bandColors}
        background={background}
      >
        {children}
      </WebAurora>
    );
  }
  return (
    <NativeAurora
      style={style}
      showRadialGradient={showRadialGradient}
      bandColors={bandColors}
      background={background}
    >
      {children}
    </NativeAurora>
  );
}

// ─── Web implementation ─────────────────────────────────────────────────────

function WebAurora({
  children,
  style,
  showRadialGradient,
  bandColors,
  background,
}: Required<Pick<AuroraBackgroundProps, 'showRadialGradient' | 'bandColors' | 'background'>> & {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const [c0, c1, c2, c3, c4] = bandColors;
  const whiteGradient =
    'repeating-linear-gradient(100deg,#fff 0%,#fff 7%,transparent 10%,transparent 12%,#fff 16%)';
  const auroraGradient = `repeating-linear-gradient(100deg,${c0} 10%,${c1} 15%,${c2} 20%,${c3} 25%,${c4} 30%)`;

  // Inline keyframes — injected once on mount.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const id = 'aurora-keyframes';
    if (document.getElementById(id)) return;
    const el = document.createElement('style');
    el.id = id;
    el.textContent = `
      @keyframes gocheck-aurora {
        0%   { background-position: 50% 50%, 50% 50%; }
        100% { background-position: 350% 50%, 350% 50%; }
      }
    `;
    document.head.appendChild(el);
  }, []);

  // Cast to any so we can pass web-only CSS props through react-native-web.
  const auroraLayer: any = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    backgroundImage: `${whiteGradient}, ${auroraGradient}`,
    backgroundSize: '300% 200%, 200% 200%',
    backgroundPosition: '50% 50%, 50% 50%',
    filter: 'blur(10px) saturate(1.1)',
    opacity: 0.5,
    mixBlendMode: 'difference',
    WebkitMaskImage:
      'radial-gradient(ellipse at 100% 0%, black 10%, transparent 70%)',
    maskImage:
      'radial-gradient(ellipse at 100% 0%, black 10%, transparent 70%)',
    animation: 'gocheck-aurora 60s linear infinite',
    willChange: 'transform, background-position',
  };

  const radialOverlay: any = showRadialGradient
    ? {
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        background:
          'radial-gradient(ellipse 80% 60% at 50% 0%, transparent 0%, rgba(11,16,32,0.0) 30%, rgba(11,16,32,0.6) 75%, rgba(11,16,32,0.9) 100%)',
      }
    : null;

  return (
    <View style={[styles.fill, { backgroundColor: background }, style]}>
      <View style={auroraLayer as ViewStyle} />
      {radialOverlay && <View style={radialOverlay as ViewStyle} />}
      {children}
    </View>
  );
}

// ─── Native implementation ──────────────────────────────────────────────────
// Three large, soft gradient blobs drifting on slow loops. Each blob is
// oversized relative to its container so the edges never become visible.

function NativeAurora({
  children,
  style,
  showRadialGradient,
  bandColors,
  background,
}: Required<Pick<AuroraBackgroundProps, 'showRadialGradient' | 'bandColors' | 'background'>> & {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const reduceMotion = useReduceMotion();
  const t1 = useSharedValue(0);
  const t2 = useSharedValue(0);
  const t3 = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    t1.value = withRepeat(withTiming(1, { duration: 22000, easing: Easing.inOut(Easing.quad) }), -1, true);
    t2.value = withRepeat(withTiming(1, { duration: 31000, easing: Easing.inOut(Easing.quad) }), -1, true);
    t3.value = withRepeat(withTiming(1, { duration: 26000, easing: Easing.inOut(Easing.quad) }), -1, true);
    return () => {
      cancelAnimation(t1);
      cancelAnimation(t2);
      cancelAnimation(t3);
    };
  }, [reduceMotion, t1, t2, t3]);

  const blob1Style = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(t1.value, [0, 1], [-80, 80]) },
      { translateY: interpolate(t1.value, [0, 1], [-40, 60]) },
      { rotate: `${interpolate(t1.value, [0, 1], [-15, 25])}deg` },
    ],
  }));
  const blob2Style = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(t2.value, [0, 1], [60, -100]) },
      { translateY: interpolate(t2.value, [0, 1], [80, -40]) },
      { rotate: `${interpolate(t2.value, [0, 1], [20, -10])}deg` },
    ],
  }));
  const blob3Style = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(t3.value, [0, 1], [-50, 70]) },
      { translateY: interpolate(t3.value, [0, 1], [40, -60]) },
      { rotate: `${interpolate(t3.value, [0, 1], [-5, 20])}deg` },
    ],
  }));

  return (
    <View style={[styles.fill, { backgroundColor: background, overflow: 'hidden' }, style]}>
      {/* Base soft glow */}
      <LinearGradient
        colors={[background, '#13193A', background]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Drifting aurora blobs */}
      <Animated.View style={[styles.blob, styles.blobA, blob1Style]} pointerEvents="none">
        <LinearGradient
          colors={[hexA(bandColors[1], 0.55), hexA(bandColors[2], 0.35), 'transparent']}
          start={{ x: 0.1, y: 0.1 }}
          end={{ x: 0.9, y: 0.9 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <Animated.View style={[styles.blob, styles.blobB, blob2Style]} pointerEvents="none">
        <LinearGradient
          colors={[hexA(bandColors[0], 0.5), hexA(bandColors[3], 0.3), 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <Animated.View style={[styles.blob, styles.blobC, blob3Style]} pointerEvents="none">
        <LinearGradient
          colors={[hexA(bandColors[4], 0.45), hexA(bandColors[1], 0.25), 'transparent']}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Radial vignette to anchor content */}
      {showRadialGradient && (
        <LinearGradient
          colors={['transparent', 'rgba(11,16,32,0.55)', 'rgba(11,16,32,0.9)']}
          locations={[0.2, 0.7, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      )}

      {children}
    </View>
  );
}

function hexA(input: string, alpha: number): string {
  if (input.startsWith('rgba(') || input.startsWith('rgb(')) return input;
  let hex = input.startsWith('#') ? input.slice(1) : input;
  if (hex.length === 3) hex = hex.split('').map((ch) => ch + ch).join('');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  blob: {
    position: 'absolute',
    width: '120%',
    height: '70%',
    borderRadius: 9999,
  },
  blobA: { top: '-15%', left: '-10%' },
  blobB: { top: '20%', right: '-25%' },
  blobC: { bottom: '-15%', left: '-15%' },
});

// Reference the unused tokens import to avoid lint complaining if future
// versions want theme defaults. Kept intentionally minimal.
void colors;
