import { useEffect } from 'react';
import { Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
  withSpring,
  withRepeat,
  withSequence,
  useSharedValue,
  Easing,
} from 'react-native-reanimated';
import { colors, hitSlop } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import { haptic } from '../../lib/haptics';
import { useReduceMotion } from '../../hooks/useReduceMotion';

const TRACK_WIDTH = 44;
const TRACK_HEIGHT = 24;
const THUMB = 18;
const TRAVEL = TRACK_WIDTH - THUMB - 6; // 20

interface ToggleV2Props {
  on: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  accessibilityLabel: string;
}

export function ToggleV2({ on, onChange, disabled, accessibilityLabel }: ToggleV2Props) {
  const reduceMotion = useReduceMotion();
  const { isDark } = useTheme();

  const progress = useDerivedValue(() =>
    reduceMotion
      ? on ? 1 : 0
      : withTiming(on ? 1 : 0, { duration: 200, easing: Easing.bezier(0.4, 0, 0.2, 1) })
  );

  // Glow pulse — only runs in dark mode when toggle is ON
  const glowPulse = useSharedValue(0);

  useEffect(() => {
    if (!isDark || !on || reduceMotion) {
      glowPulse.value = withTiming(0, { duration: 200 });
      return;
    }
    glowPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.35, { duration: 900, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, [isDark, on, reduceMotion]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: progress.value > 0.5
      ? colors.primary
      : isDark ? 'rgba(255,255,255,0.1)' : colors.gray200,
    opacity: disabled ? 0.5 : 1,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: glowPulse.value * 0.7,
    shadowRadius: 12,
    elevation: Math.round(glowPulse.value * 6),
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: reduceMotion
          ? on ? TRAVEL : 0
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
            padding: 3,
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
              shadowOpacity: 0.25,
              shadowRadius: 3,
              elevation: 2,
            },
            thumbStyle,
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}
