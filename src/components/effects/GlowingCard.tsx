import { ReactNode, useEffect, useRef, useState } from 'react';
import { Platform, View, StyleSheet, ViewStyle, StyleProp, LayoutChangeEvent } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
  interpolate,
} from 'react-native-reanimated';
import { useTheme } from '../../theme/ThemeContext';
import { useReduceMotion } from '../../hooks/useReduceMotion';

interface GlowingCardProps {
  children: ReactNode;
  /** Outer container style (margin, width, etc.). */
  style?: StyleProp<ViewStyle>;
  /** Border radius of the card. Defaults to 18. */
  radius?: number;
  /** How wide (in deg) the bright arc of the glow is. Defaults to 60. */
  spread?: number;
  /** Distance from the cursor at which the glow becomes inactive on web. */
  proximity?: number;
  /** Disable the glow entirely. */
  disabled?: boolean;
  /** Override accent color. Defaults to theme primary. */
  color?: string;
  /** Override the inner background color of the card. Defaults to theme surface. */
  background?: string;
  /** Inner padding for the content (after the glowing border). Defaults to 0 — content controls its own padding. */
  innerPadding?: number;
  /** Border thickness for the glow ring. Defaults to 1.5. */
  borderWidth?: number;
}

/**
 * A reusable card that draws an animated conic-style border-glow inspired by
 * Aceternity's GlowingEffect.
 *
 * Web: glow follows the cursor (real conic gradient on a CSS pseudo-element).
 * Native: glow auto-rotates as a gentle ambient effect (LinearGradient + spin).
 *
 * Wraps `children` inside a rounded surface that adapts to any container size.
 */
export function GlowingCard({
  children,
  style,
  radius = 18,
  spread = 60,
  proximity = 80,
  disabled,
  color,
  background,
  innerPadding = 0,
  borderWidth = 1.5,
}: GlowingCardProps) {
  const { colors: c } = useTheme();
  const reduceMotion = useReduceMotion();
  const accent = color ?? c.primary;
  const surface = background ?? c.surface;
  const inactive = disabled || reduceMotion;

  if (Platform.OS === 'web') {
    return (
      <WebGlowingCard
        radius={radius}
        spread={spread}
        proximity={proximity}
        accent={accent}
        surface={surface}
        innerPadding={innerPadding}
        borderWidth={borderWidth}
        disabled={inactive}
        style={style}
      >
        {children}
      </WebGlowingCard>
    );
  }

  return (
    <NativeGlowingCard
      radius={radius}
      accent={accent}
      surface={surface}
      innerPadding={innerPadding}
      borderWidth={borderWidth}
      disabled={inactive}
      style={style}
    >
      {children}
    </NativeGlowingCard>
  );
}

// ─── Native implementation ──────────────────────────────────────────────────
// Uses a rotating conic-like gradient built from a spinning Animated.View
// (twice the diagonal of the card) with a LinearGradient. Masked by a
// rounded inner surface so the visible result is a soft rotating glow on
// the rim.

interface NativeProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  radius: number;
  accent: string;
  surface: string;
  innerPadding: number;
  borderWidth: number;
  disabled: boolean;
}

function NativeGlowingCard({
  children,
  style,
  radius,
  accent,
  surface,
  innerPadding,
  borderWidth,
  disabled,
}: NativeProps) {
  const rotate = useSharedValue(0);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    if (disabled) return;
    rotate.value = withRepeat(
      withTiming(1, { duration: 6500, easing: Easing.linear }),
      -1,
      false
    );
    return () => cancelAnimation(rotate);
  }, [disabled, rotate]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(rotate.value, [0, 1], [0, 360])}deg` }],
  }));

  function onLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.w || height !== size.h) setSize({ w: width, h: height });
  }

  const diag = Math.sqrt(size.w * size.w + size.h * size.h) || 0;

  return (
    <View style={[{ borderRadius: radius }, style]} onLayout={onLayout}>
      <View
        style={[
          styles.clip,
          { borderRadius: radius, backgroundColor: hexWithAlpha(accent, 0.18) },
        ]}
        pointerEvents="box-none"
      >
        {!disabled && diag > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                width: diag,
                height: diag,
                top: (size.h - diag) / 2,
                left: (size.w - diag) / 2,
              },
              animatedStyle,
            ]}
          >
            <ConicSweep accent={accent} />
          </Animated.View>
        )}

        <View
          style={{
            margin: borderWidth,
            borderRadius: Math.max(0, radius - borderWidth),
            backgroundColor: surface,
            padding: innerPadding,
            overflow: 'hidden',
          }}
        >
          {children}
        </View>
      </View>
    </View>
  );
}

/** Four-quadrant pseudo-conic sweep using two crossed gradients. */
function ConicSweep({ accent }: { accent: string }) {
  // We render two diagonal LinearGradients rotated to create a bright arc
  // that sweeps around. Imported lazily to keep web bundles slim.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { LinearGradient } = require('expo-linear-gradient') as typeof import('expo-linear-gradient');
  const transparent = hexWithAlpha(accent, 0);
  const bright = hexWithAlpha(accent, 0.9);
  const mid = hexWithAlpha(accent, 0.25);
  return (
    <>
      <LinearGradient
        colors={[bright, mid, transparent, transparent]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <LinearGradient
        colors={[transparent, transparent, mid, bright]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
    </>
  );
}

// ─── Web implementation ─────────────────────────────────────────────────────
// Uses a real conic-gradient driven by the pointer position. Falls back to a
// static subtle gradient when the pointer is far away or disabled.

interface WebProps extends NativeProps {
  spread: number;
  proximity: number;
}

function WebGlowingCard({
  children,
  style,
  radius,
  spread,
  proximity,
  accent,
  surface,
  innerPadding,
  borderWidth,
  disabled,
}: WebProps) {
  const ref = useRef<View>(null);
  const [angle, setAngle] = useState(0);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (disabled || typeof window === 'undefined') return;
    function onMove(e: MouseEvent) {
      // @ts-ignore — react-native-web View exposes the underlying DOM node
      const node = (ref.current as unknown as HTMLElement | null) ?? null;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      // distance to nearest edge (negative = inside)
      const insideX = Math.max(rect.left - e.clientX, e.clientX - rect.right, 0);
      const insideY = Math.max(rect.top - e.clientY, e.clientY - rect.bottom, 0);
      const dist = Math.sqrt(insideX * insideX + insideY * insideY);
      const next = dist <= proximity;
      setActive(next);
      if (next) {
        const a = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
        setAngle(a);
      }
    }
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, [disabled, proximity]);

  const arc = Math.max(20, Math.min(180, spread));
  const transparent = hexWithAlpha(accent, 0);
  const bright = hexWithAlpha(accent, 0.95);

  const ringBackground = disabled
    ? hexWithAlpha(accent, 0.12)
    : active
    ? `conic-gradient(from ${angle}deg, ${transparent} 0deg, ${bright} ${arc / 2}deg, ${transparent} ${arc}deg, ${transparent} 360deg)`
    : `conic-gradient(from 0deg, ${hexWithAlpha(accent, 0.18)} 0deg, ${hexWithAlpha(accent, 0.05)} 180deg, ${hexWithAlpha(accent, 0.18)} 360deg)`;

  // Web-only escape-hatch styles for the conic gradient + smooth transitions.
  const ringStyle: ViewStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius,
    // @ts-expect-error — web-only CSS properties
    background: ringBackground,
    transition: 'background 200ms ease-out',
    pointerEvents: 'none',
  };

  return (
    <View ref={ref} style={[{ borderRadius: radius, position: 'relative' }, style]}>
      <View style={ringStyle} />
      <View
        style={{
          margin: borderWidth,
          borderRadius: Math.max(0, radius - borderWidth),
          backgroundColor: surface,
          padding: innerPadding,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {children}
      </View>
    </View>
  );
}

// ─── Utilities ──────────────────────────────────────────────────────────────

/** Returns the input color with the given alpha. Supports #RRGGBB, #RGB, and rgb()/rgba() input. */
function hexWithAlpha(input: string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha));
  if (input.startsWith('rgba(') || input.startsWith('rgb(')) {
    const nums = input.replace(/rgba?\(|\)|\s/g, '').split(',');
    const [r, g, b] = nums;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  if (input.startsWith('#')) {
    let hex = input.slice(1);
    if (hex.length === 3) hex = hex.split('').map((ch) => ch + ch).join('');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  return input;
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
  },
});
