import React, { useMemo } from 'react';
import { Platform, StyleSheet, Text, TextProps } from 'react-native';
import Animated, { useAnimatedStyle, interpolateColor } from 'react-native-reanimated';
import { colors } from '../theme/tokens';
import { useColourClock } from '../theme/ColourfulClockContext';
import { useReduceMotion } from '../hooks/useReduceMotion';

const DEFAULT_PALETTE = [
  colors.primary,
  colors.primaryLight,
  colors.secondary,
  colors.secondaryLight,
  colors.primary,
];

const CYCLE_MS = 4200;
const STAGGER_MS = 90;
const STAGGER_FRACTION = STAGGER_MS / CYCLE_MS;
const IS_WEB = Platform.OS === 'web';

interface GlyphProps {
  char: string;
  index: number;
  palette: string[];
  reduceMotion: boolean;
}

// ─── Native glyph (reanimated, UI-thread colour interpolation) ───────────────
// Nesting Animated.Text inside Text is fine on native; on web it double-renders,
// so the web path below uses plain Text + CSS keyframes instead.
function NativeGlyph({ char, index, palette }: GlyphProps) {
  const clock = useColourClock();
  const inputRange = useMemo(
    () => palette.map((_, i) => i / (palette.length - 1)),
    [palette]
  );
  const staggeredOffset = index * STAGGER_FRACTION;

  const animatedStyle = useAnimatedStyle(() => ({
    color: interpolateColor((clock.value + staggeredOffset) % 1, inputRange, palette),
  }));

  return <Animated.Text style={animatedStyle}>{char}</Animated.Text>;
}

// ─── Web glyph (plain Text + CSS @keyframes) ─────────────────────────────────
// react-native-web only compiles `animationKeyframes` via StyleSheet.create, so
// we memoise one stylesheet per palette and stagger each glyph with an inline
// negative animation-delay (matching the native STAGGER_FRACTION).
const webAnimCache = new Map<string, { color: string }>();

function getWebAnimStyle(palette: string[]) {
  const key = palette.join('|');
  let style = webAnimCache.get(key);
  if (!style) {
    const n = palette.length;
    const frames: Record<string, { color: string }> = {};
    palette.forEach((c, i) => {
      const pct = n <= 1 ? 100 : +((i / (n - 1)) * 100).toFixed(2);
      frames[`${pct}%`] = { color: c };
    });
    style = StyleSheet.create({
      anim: {
        animationKeyframes: [frames],
        animationDuration: `${CYCLE_MS}ms`,
        animationTimingFunction: 'linear',
        animationIterationCount: 'infinite',
      } as object,
    }).anim as { color: string };
    webAnimCache.set(key, style);
  }
  return style;
}

function WebGlyph({ char, index, palette, reduceMotion }: GlyphProps) {
  if (reduceMotion) {
    return <Text style={{ color: palette[0] }}>{char}</Text>;
  }
  return (
    <Text
      style={[
        { color: palette[0] },
        getWebAnimStyle(palette),
        { animationDelay: `${-index * STAGGER_MS}ms` } as object,
      ]}
    >
      {char}
    </Text>
  );
}

interface AppTextProps extends TextProps {
  palette?: string[];
}

export function AppText({ children, palette = DEFAULT_PALETTE, ...rest }: AppTextProps) {
  const reduceMotion = useReduceMotion();
  const content = typeof children === 'number' ? String(children) : children;

  if (typeof content !== 'string') {
    return <Text {...rest}>{content}</Text>;
  }

  const chars = Array.from(content);
  const Glyph = IS_WEB ? WebGlyph : NativeGlyph;

  return (
    <Text {...rest}>
      {chars.map((ch, i) => (
        <Glyph key={i} char={ch} index={i} palette={palette} reduceMotion={reduceMotion} />
      ))}
    </Text>
  );
}
