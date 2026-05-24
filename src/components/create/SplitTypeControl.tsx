import { useRef, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, LayoutChangeEvent } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { SplitType } from '../../types';
import { colors, typography, fontSize, radius, animation } from '../../theme/tokens';

const SEGMENTS: { value: SplitType; label: string }[] = [
  { value: 'equal', label: 'Equal' },
  { value: 'custom', label: 'Custom' },
  { value: 'percent', label: 'Percent' },
  { value: 'shares', label: 'Shares' },
];

interface Props {
  value: SplitType;
  onChange: (value: SplitType) => void;
}

export function SplitTypeControl({ value, onChange }: Props) {
  const segmentWidth = useSharedValue(0);
  const pillX = useSharedValue(0);
  const containerRef = useRef<View>(null);
  const segmentIndex = SEGMENTS.findIndex((s) => s.value === value);

  const onContainerLayout = (e: LayoutChangeEvent) => {
    const w = (e.nativeEvent.layout.width - 8) / SEGMENTS.length;
    segmentWidth.value = w;
    pillX.value = segmentIndex * w + 4;
  };

  useEffect(() => {
    if (segmentWidth.value > 0) {
      pillX.value = withSpring(
        segmentIndex * segmentWidth.value + 4,
        animation.springSnappy
      );
    }
  }, [segmentIndex, segmentWidth.value]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value }],
    width: segmentWidth.value,
  }));

  const handlePress = (seg: SplitType) => {
    Haptics.selectionAsync();
    onChange(seg);
  };

  return (
    <View
      ref={containerRef}
      style={styles.container}
      onLayout={onContainerLayout}
    >
      <Animated.View style={[styles.pill, pillStyle]} />
      {SEGMENTS.map((seg) => {
        const isActive = seg.value === value;
        return (
          <Pressable
            key={seg.value}
            style={styles.segment}
            onPress={() => handlePress(seg.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
          >
            <Text style={[styles.label, isActive && styles.labelActive]}>
              {seg.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.gray100,
    borderRadius: radius.lg,
    padding: 4,
    position: 'relative',
    height: 44,
  },
  pill: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    minHeight: 44,
  },
  label: {
    fontFamily: typography.sansMedium,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  labelActive: {
    fontFamily: typography.sansSemiBold,
    color: colors.textPrimary,
  },
});
