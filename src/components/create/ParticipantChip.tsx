import { Pressable, View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { Participant } from '../../types';
import { colors, typography, fontSize, spacing, radius } from '../../theme/tokens';

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

interface ChipProps {
  participant: Participant;
  onRemove: (id: string) => void;
}

export function ParticipantChip({ participant, onRemove }: ChipProps) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handleMount = () => {
    scale.value = 0.7;
    opacity.value = 0;
    scale.value = withSpring(1, { damping: 18, stiffness: 280 });
    opacity.value = withTiming(1, { duration: 200 });
  };

  const handleRemove = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scale.value = withTiming(0.8, { duration: 150 });
    opacity.value = withTiming(0, { duration: 150 }, (done) => {
      if (done) runOnJS(onRemove)(participant.id);
    });
  };

  return (
    <Animated.View
      style={animStyle}
      onLayout={() => handleMount()}
    >
      <View style={styles.chip}>
        <View style={[styles.avatar, { backgroundColor: participant.avatarColor }]}>
          <Text style={styles.avatarText}>{getInitials(participant.name)}</Text>
        </View>
        <Text style={styles.name} numberOfLines={1}>
          {participant.name}
        </Text>
        <Pressable
          onPress={handleRemove}
          style={styles.removeBtn}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
          accessibilityLabel={`Remove ${participant.name}`}
        >
          <Feather name="x" size={12} color={colors.gray400} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

interface AddChipProps {
  onPress: () => void;
  overflowCount?: number;
}

export function AddParticipantChip({ onPress, overflowCount }: AddChipProps) {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95, { damping: 20, stiffness: 400 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 20, stiffness: 400 });
  };

  if (overflowCount && overflowCount > 0) {
    return (
      <Animated.View style={animStyle}>
        <Pressable
          style={styles.overflowChip}
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
        >
          <Text style={styles.overflowText}>+{overflowCount} more</Text>
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={animStyle}>
      <Pressable
        style={styles.addChip}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel="Add participant"
      >
        <Feather name="plus" size={14} color={colors.primary} />
        <Text style={styles.addLabel}>Add Person</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingLeft: spacing[1],
    paddingRight: spacing[2],
    paddingVertical: spacing[1],
    gap: spacing[1],
    maxWidth: 130,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: typography.sansBold,
    fontSize: 10,
    color: colors.white,
  },
  name: {
    fontFamily: typography.sansMedium,
    fontSize: fontSize.xs,
    color: colors.textPrimary,
    flex: 1,
  },
  removeBtn: {
    width: 18,
    height: 18,
    borderRadius: radius.full,
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    backgroundColor: colors.primarySurface,
    borderWidth: 1.5,
    borderColor: colors.primaryBorder,
    borderStyle: 'dashed',
    borderRadius: radius.full,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    height: 38,
  },
  addLabel: {
    fontFamily: typography.sansSemiBold,
    fontSize: fontSize.xs,
    color: colors.primary,
  },
  overflowChip: {
    backgroundColor: colors.gray100,
    borderRadius: radius.full,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    height: 38,
    justifyContent: 'center',
  },
  overflowText: {
    fontFamily: typography.sansMedium,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
});
