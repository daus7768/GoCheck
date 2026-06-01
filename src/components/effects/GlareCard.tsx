import { ReactNode, useEffect, useRef, useState } from 'react';
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

interface GlareCardProps {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Outer radius — should match the parent card. */
  radius?: number;
  /** Glare intensity (0..1). Defaults to 0.55 on web, 0.18 on native. */
  intensity?: number;
  /** Disable the effect entirely. */
  disabled?: boolean;
}

/**
 * Linear-style hover glare overlay.
 *
 * Web: a soft radial highlight follows the cursor while hovered, using
 *      mix-blend-mode: overlay so it tints whatever sits below.
 * Native: a slow, ambient diagonal sheen sweeps across to evoke the same
 *      "polished glass" feel without a pointer.
 *
 * Place this as a sibling overlay above your card surface, or wrap your
 * content with it — it positions itself absolutely and never blocks touches.
 */
export function GlareCard({
  children,
  style,
  radius = 24,
  intensity,
  disabled,
}: GlareCardProps) {
  const reduceMotion = useReduceMotion();
  const off = disabled || reduceMotion;

  if (Platform.OS === 'web') {
    return (
      <WebGlare radius={radius} intensity={intensity ?? 0.55} disabled={off} style={style}>
        {children}
      </WebGlare>
    );
  }
  return (
    <NativeGlare radius={radius} intensity={intensity ?? 0.18} disabled={off} style={style}>
      {children}
    </NativeGlare>
  );
}

// ─── Web implementation ─────────────────────────────────────────────────────

function WebGlare({
  children,
  style,
  radius,
  intensity,
  disabled,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  radius: number;
  intensity: number;
  disabled: boolean;
}) {
  const ref = useRef<View>(null);
  const [pos, setPos] = useState({ x: 50, y: 50, active: false });

  useEffect(() => {
    if (disabled || typeof window === 'undefined') return;
    function getNode(): HTMLElement | null {
      return (ref.current as unknown as HTMLElement | null) ?? null;
    }
    function onMove(e: MouseEvent) {
      const node = getNode();
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const inside =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
      if (!inside) {
        setPos((p) => (p.active ? { ...p, active: false } : p));
        return;
      }
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setPos({ x, y, active: true });
    }
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, [disabled]);

  const overlayStyle: any = {
    position: 'absolute',
    inset: 0,
    borderRadius: radius,
    pointerEvents: 'none',
    background: disabled
      ? 'transparent'
      : `radial-gradient(circle at ${pos.x}% ${pos.y}%, rgba(255,255,255,${intensity}) 0%, rgba(255,255,255,0) 45%)`,
    mixBlendMode: 'overlay',
    opacity: pos.active && !disabled ? 1 : 0,
    transition: 'opacity 200ms ease-out',
  };

  // Static foiled sheen — a faint diagonal highlight that subtly hints at gloss
  // even before the cursor enters.
  const sheenStyle: any = {
    position: 'absolute',
    inset: 0,
    borderRadius: radius,
    pointerEvents: 'none',
    background:
      'linear-gradient(110deg, transparent 35%, rgba(255,255,255,0.08) 50%, transparent 65%)',
    mixBlendMode: 'overlay',
  };

  return (
    <View ref={ref} style={[StyleSheet.absoluteFill, style]} pointerEvents="box-none">
      {children}
      <View style={sheenStyle as ViewStyle} />
      <View style={overlayStyle as ViewStyle} />
    </View>
  );
}

// ─── Native implementation ──────────────────────────────────────────────────

function NativeGlare({
  children,
  style,
  radius,
  intensity,
  disabled,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  radius: number;
  intensity: number;
  disabled: boolean;
}) {
  const t = useSharedValue(0);

  useEffect(() => {
    if (disabled) return;
    t.value = withRepeat(
      withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.quad) }),
      -1,
      false,
    );
    return () => cancelAnimation(t);
  }, [disabled, t]);

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [
      // Slide the sheen across the card from left to right and back.
      { translateX: interpolate(t.value, [0, 1], [-200, 200]) },
      { rotate: '15deg' },
    ],
    opacity: 0.5 + 0.5 * Math.sin(t.value * Math.PI * 2),
  }));

  const tint = `rgba(255,255,255,${intensity})`;

  return (
    <View
      style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }, style]}
      pointerEvents="none"
    >
      {children}
      {!disabled && (
        <Animated.View style={[styles.nativeSheen, sweepStyle]} pointerEvents="none">
          <LinearGradient
            colors={['transparent', tint, 'transparent']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  nativeSheen: {
    position: 'absolute',
    top: -40,
    bottom: -40,
    left: -120,
    width: 140,
  },
});
