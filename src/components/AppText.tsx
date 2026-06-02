import React, { useMemo } from 'react';
import { Text, TextProps } from 'react-native';
import Animated, { useAnimatedStyle, interpolateColor } from 'react-native-reanimated';
import { colors } from '../theme/tokens';
import { useColourClock } from '../theme/ColourfulClockContext';

const DEFAULT_PALETTE = [
  colors.primary,
  colors.primaryLight,
  colors.secondary,
  colors.secondaryLight,
  colors.primary,
];

const STAGGER_FRACTION = 90 / 4200;

interface GlyphProps {
  char: string;
  index: number;
  palette: string[];
}

function Glyph({ char, index, palette }: GlyphProps) {
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

interface AppTextProps extends TextProps {
  palette?: string[];
}

export function AppText({ children, palette = DEFAULT_PALETTE, ...rest }: AppTextProps) {
  const content = typeof children === 'number' ? String(children) : children;

  if (typeof content !== 'string') {
    return <Text {...rest}>{content}</Text>;
  }

  const chars = Array.from(content);

  return (
    <Text {...rest}>
      {chars.map((ch, i) => (
        <Glyph key={i} char={ch} index={i} palette={palette} />
      ))}
    </Text>
  );
}
