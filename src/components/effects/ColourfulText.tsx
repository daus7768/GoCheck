import { useEffect, useMemo } from 'react';
import { StyleProp, StyleSheet, TextStyle, View, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
  interpolateColor,
  cancelAnimation,
} from 'react-native-reanimated';
import { colors } from '../../theme/tokens';
import { useReduceMotion } from '../../hooks/useReduceMotion';

interface ColourfulTextProps {
  text: string;
  /** On-brand palette; defaults to indigo / emerald flow. No purple. */
  palette?: string[];
  /** Full cycle duration through the palette in ms. */
  duration?: number;
  /** Stagger between adjacent letters in ms. */
  letterStaggerMs?: number;
  /** Style applied to each character text node. */
  style?: StyleProp<TextStyle>;
  /** Wrapper style for the inline row. */
  containerStyle?: StyleProp<ViewStyle>;
}

const DEFAULT_PALETTE = [
  colors.primary,
  colors.primaryLight,
  colors.secondary,
  colors.secondaryLight,
  colors.primary,
];

export function ColourfulText({
  text,
  palette = DEFAULT_PALETTE,
  duration = 4200,
  letterStaggerMs = 90,
  style,
  containerStyle,
}: ColourfulTextProps) {
  const reduceMotion = useReduceMotion();
  const chars = useMemo(() => Array.from(text), [text]);

  return (
    <View style={[styles.row, containerStyle]}>
      {chars.map((ch, i) => (
        <Glyph
          key={`${ch}-${i}`}
          char={ch}
          index={i}
          palette={palette}
          duration={duration}
          letterStaggerMs={letterStaggerMs}
          reduceMotion={reduceMotion}
          style={style}
        />
      ))}
    </View>
  );
}

interface GlyphProps {
  char: string;
  index: number;
  palette: string[];
  duration: number;
  letterStaggerMs: number;
  reduceMotion: boolean;
  style?: StyleProp<TextStyle>;
}

function Glyph({ char, index, palette, duration, letterStaggerMs, reduceMotion, style }: GlyphProps) {
  const t = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      t.value = 0;
      return;
    }
    t.value = withDelay(
      index * letterStaggerMs,
      withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false)
    );
    return () => cancelAnimation(t);
  }, [index, duration, letterStaggerMs, reduceMotion, t]);

  const inputRange = useMemo(
    () => palette.map((_, i) => i / (palette.length - 1)),
    [palette]
  );

  const animatedStyle = useAnimatedStyle(() => {
    if (reduceMotion) return { color: palette[0] };
    return {
      color: interpolateColor(t.value, inputRange, palette),
    };
  });

  // Render whitespace as-is so layout/wrapping stays natural.
  if (char === ' ') {
    return <Animated.Text style={[style, { color: palette[0] }]}>{' '}</Animated.Text>;
  }

  return <Animated.Text style={[style, animatedStyle]}>{char}</Animated.Text>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
