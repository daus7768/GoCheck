import { Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { colors, hitSlop } from '../../theme/tokens';
import { haptic } from '../../lib/haptics';
import { useReduceMotion } from '../../hooks/useReduceMotion';

const TRACK_WIDTH = 42;
const TRACK_HEIGHT = 24;
const THUMB = 20;
const TRAVEL = TRACK_WIDTH - THUMB - 4; // 18

interface ToggleV2Props {
  on: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  accessibilityLabel: string;
}

export function ToggleV2({ on, onChange, disabled, accessibilityLabel }: ToggleV2Props) {
  const reduceMotion = useReduceMotion();
  const progress = useDerivedValue(() =>
    reduceMotion ? (on ? 1 : 0) : withTiming(on ? 1 : 0, { duration: 200, easing: Easing.bezier(0.4, 0, 0.2, 1) })
  );

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: progress.value > 0.5 ? colors.primaryLight : colors.gray300,
    opacity: disabled ? 0.5 : 1,
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: reduceMotion
          ? on
            ? TRAVEL
            : 0
          : withSpring(on ? TRAVEL : 0, { damping: 18, stiffness: 260, mass: 0.7 }),
      },
    ],
  }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: on, disabled: !!disabled }}
      accessibilityLabel={accessibilityLabel}
      hitSlop={hitSlop.medium}
      disabled={disabled}
      onPress={() => {
        haptic.selection();
        onChange(!on);
      }}
    >
      <Animated.View
        style={[
          {
            width: TRACK_WIDTH,
            height: TRACK_HEIGHT,
            borderRadius: TRACK_HEIGHT / 2,
            padding: 2,
            justifyContent: 'center',
          },
          trackStyle,
        ]}
      >
        <Animated.View
          style={[
            {
              width: THUMB,
              height: THUMB,
              borderRadius: THUMB / 2,
              backgroundColor: colors.white,
              shadowColor: colors.black,
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.2,
              shadowRadius: 2,
              elevation: 2,
            },
            thumbStyle,
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}
