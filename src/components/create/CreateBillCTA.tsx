import { useEffect } from 'react';
import { Pressable, StyleSheet, ActivityIndicator, View } from 'react-native';
import { AppText } from '../AppText';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  interpolateColor,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { haptic, ImpactFeedbackStyle, NotificationFeedbackType } from '../../lib/haptics';
import { colors, typography, fontSize, radius, shadow } from '../../theme/tokens';

type ButtonState = 'idle' | 'loading' | 'success';

interface Props {
  onPress: () => void;
  state: ButtonState;
  disabled: boolean;
  label?: string;
}

export function CreateBillCTA({ onPress, state, disabled, label = 'Create Bill' }: Props) {
  const scale = useSharedValue(1);
  const progress = useSharedValue(0);
  const successScale = useSharedValue(0);

  useEffect(() => {
    if (state === 'loading') {
      progress.value = withTiming(1, { duration: 300 });
      successScale.value = 0;
    } else if (state === 'success') {
      haptic.notification(NotificationFeedbackType.Success);
      successScale.value = withSequence(
        withSpring(1.3, { damping: 10, stiffness: 300 }),
        withDelay(100, withSpring(1, { damping: 15, stiffness: 300 }))
      );
    } else {
      progress.value = withTiming(0, { duration: 200 });
      successScale.value = withTiming(0, { duration: 150 });
    }
  }, [state]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [disabled ? colors.gray200 : colors.primary, colors.primary]
    ),
  }));

  const successIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: successScale.value }],
    opacity: successScale.value,
  }));

  const handlePressIn = () => {
    if (state !== 'idle' || disabled) return;
    scale.value = withSpring(0.97, { damping: 20, stiffness: 400 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 20, stiffness: 400 });
  };

  const handlePress = () => {
    if (state !== 'idle' || disabled) return;
    haptic.impact(ImpactFeedbackStyle.Medium);
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || state !== 'idle'}
      accessibilityRole="button"
      accessibilityLabel={state === 'loading' ? 'Creating bill…' : state === 'success' ? 'Bill created' : label}
      accessibilityState={{ disabled: disabled || state !== 'idle', busy: state === 'loading' }}
    >
      <Animated.View style={[styles.button, containerStyle]}>
        {state === 'loading' ? (
          <View style={styles.content}>
            <ActivityIndicator size="small" color={colors.white} />
            <AppText style={styles.label}>Creating…</AppText>
          </View>
        ) : state === 'success' ? (
          <View style={styles.content}>
            <Animated.View style={successIconStyle}>
              <Feather name="check-circle" size={22} color={colors.white} />
            </Animated.View>
            <AppText style={styles.label}>Bill Created!</AppText>
          </View>
        ) : (
          <View style={styles.content}>
            <Feather
              name="send"
              size={18}
              color={disabled ? colors.gray400 : colors.white}
            />
            <AppText style={[styles.label, disabled && styles.labelDisabled]}>
              {label}
            </AppText>
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 58,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.indigoPulse,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  label: {
    fontFamily: typography.sansSemiBold,
    fontSize: fontSize.md,
    color: colors.white,
    letterSpacing: 0.2,
  },
  labelDisabled: {
    color: colors.gray400,
  },
});
