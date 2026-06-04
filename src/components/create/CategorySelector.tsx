import { useEffect } from 'react';
import { View, Pressable, StyleSheet, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  interpolateColor,
  interpolate,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import { haptic, ImpactFeedbackStyle } from '../../lib/haptics';
import type { BillCategory } from '../../types';
import { gc, typography } from '../../theme/tokens';

const AnimatedIcon = Animated.createAnimatedComponent(MaterialCommunityIcons);

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

interface CategoryDef {
  key: BillCategory;
  label: string;
  icon: IconName;
  color: string;
  tint: string;
}

const CATEGORIES: CategoryDef[] = [
  { key: 'travel',  label: 'Travel',  icon: 'airplane',              color: '#6366F1', tint: 'rgba(99,102,241,0.14)' },
  { key: 'food',    label: 'Food',    icon: 'silverware-fork-knife', color: '#F59E0B', tint: 'rgba(245,158,11,0.14)' },
  { key: 'housing', label: 'Housing', icon: 'home-variant',          color: '#10B981', tint: 'rgba(16,185,129,0.14)' },
  { key: 'sports',  label: 'Sports',  icon: 'basketball',            color: '#3B82F6', tint: 'rgba(59,130,246,0.14)' },
  { key: 'events',  label: 'Events',  icon: 'party-popper',          color: '#EC4899', tint: 'rgba(236,72,153,0.14)' },
  { key: 'other',   label: 'Other',   icon: 'shape-outline',         color: '#94A3B8', tint: 'rgba(148,163,184,0.14)' },
];

interface CardProps {
  def: CategoryDef;
  active: boolean;
  onPress: () => void;
}

function CategoryCard({ def, active, onPress }: CardProps) {
  // 0 = inactive, 1 = active. Drives colour + shadow morphs.
  const progress = useSharedValue(active ? 1 : 0);
  const pressScale = useSharedValue(1);
  const float = useSharedValue(0);
  const pop = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(active ? 1 : 0, {
      duration: 260,
      easing: Easing.out(Easing.cubic),
    });
    if (active) {
      // gentle continuous bob on the selected icon
      float.value = withRepeat(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      );
      // little celebratory pop on the moment of selection
      pop.value = withSequence(
        withTiming(1, { duration: 160, easing: Easing.out(Easing.back(2.4)) }),
        withTiming(0, { duration: 220 }),
      );
    } else {
      cancelAnimation(float);
      float.value = withTiming(0, { duration: 200 });
    }
    return () => cancelAnimation(float);
  }, [active]);

  const cardStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [gc.surface3, def.tint]),
    borderColor: interpolateColor(progress.value, [0, 1], [gc.border, def.color]),
    transform: [{ scale: pressScale.value }],
    shadowOpacity: progress.value * 0.5,
    shadowRadius: 4 + progress.value * 10,
    elevation: progress.value * 8,
  }));

  const badgeStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], ['rgba(255,255,255,0.04)', def.color]),
    borderColor: interpolateColor(progress.value, [0, 1], [gc.border, def.color]),
    transform: [
      { translateY: interpolate(float.value, [0, 1], [0, -3]) },
      { scale: 1 + pop.value * 0.16 },
      { rotate: `${interpolate(pop.value, [0, 1], [0, def.key === 'travel' ? 12 : 0])}deg` },
    ],
  }));

  const iconProps = useAnimatedProps(() => ({
    color: interpolateColor(progress.value, [0, 1], [def.color, '#FFFFFF']),
  }));

  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], [gc.muted, gc.text]),
  }));

  const checkStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: progress.value }],
  }));

  return (
    <Pressable
      style={styles.cardPressable}
      onPress={() => { haptic.impact(ImpactFeedbackStyle.Light); onPress(); }}
      onPressIn={() => { pressScale.value = withSpring(0.94, { damping: 18, stiffness: 380 }); }}
      onPressOut={() => { pressScale.value = withSpring(1, { damping: 14, stiffness: 320 }); }}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={def.label}
    >
      <Animated.View style={[styles.card, { shadowColor: def.color }, cardStyle]}>
        <Animated.View style={[styles.badge, badgeStyle]}>
          <AnimatedIcon name={def.icon} size={20} color={def.color} animatedProps={iconProps} />
          <Animated.View style={[styles.check, checkStyle]}>
            <MaterialCommunityIcons name="check" size={9} color={def.color} />
          </Animated.View>
        </Animated.View>
        <Animated.Text style={[styles.label, labelStyle]} numberOfLines={1}>
          {def.label}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

interface Props {
  value: BillCategory;
  onChange: (category: BillCategory) => void;
}

export function CategorySelector({ value, onChange }: Props) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>Category</Text>
      <View style={styles.grid}>
        {CATEGORIES.map((def) => (
          <CategoryCard
            key={def.key}
            def={def}
            active={value === def.key}
            onPress={() => onChange(def.key)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fieldGroup: { marginBottom: 16 },
  fieldLabel: {
    fontFamily: typography.sansMedium,
    fontSize: 11,
    color: gc.muted,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cardPressable: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 96,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: gc.border,
    backgroundColor: gc.surface3,
    paddingVertical: 10,
    paddingHorizontal: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  badge: {
    width: 34,
    height: 34,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: gc.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: typography.sansSemiBold,
    fontSize: 13,
    color: gc.muted,
  },
});
