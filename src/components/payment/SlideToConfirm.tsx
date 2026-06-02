import { useCallback, useState } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { AppText } from '../AppText';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Feather } from '@expo/vector-icons';
import { colors, typography, fontSize, radius, spacing } from '../../theme/tokens';
import { haptic, NotificationFeedbackType } from '../../lib/haptics';

interface Props {
  label?: string;
  onConfirm: () => void | Promise<void>;
  disabled?: boolean;
}

const THUMB = 56;
const HORIZONTAL_PADDING = spacing[4];

export function SlideToConfirm({ label = 'Slide to confirm I paid', onConfirm, disabled = false }: Props) {
  const { width } = useWindowDimensions();
  const [containerWidth, setContainerWidth] = useState(0);
  const availableWidth = containerWidth || width - HORIZONTAL_PADDING * 2;
  const trackWidth = Math.min(availableWidth, 480);
  const maxTranslate = trackWidth - THUMB - 8;
  const offset = useSharedValue(0);

  const triggerConfirm = useCallback(() => {
    haptic.notification(NotificationFeedbackType.Success);
    onConfirm();
  }, [onConfirm]);

  const gesture = Gesture.Pan()
    .enabled(!disabled)
    .onStart(() => {
      offset.value = 0;
    })
    .onUpdate((e) => {
      offset.value = Math.max(0, Math.min(e.translationX, maxTranslate));
    })
    .onEnd(() => {
      if (offset.value > maxTranslate * 0.85) {
        offset.value = withSpring(maxTranslate);
        runOnJS(triggerConfirm)();
      } else {
        offset.value = withSpring(0);
      }
    });

  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));
  const fillStyle = useAnimatedStyle(() => ({
    width: offset.value + THUMB,
    opacity: interpolate(offset.value, [0, maxTranslate], [0.2, 1], Extrapolation.CLAMP),
  }));

  return (
    <View
      style={styles.shell}
      onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)}
    >
      <View style={[styles.track, { width: trackWidth, opacity: disabled ? 0.5 : 1 }]}>
        <Animated.View style={[styles.fill, fillStyle]} />
        <AppText style={styles.label} numberOfLines={1}>{label}</AppText>
        <GestureDetector gesture={gesture}>
          <Animated.View style={[styles.thumb, thumbStyle]}>
            <Feather name="chevrons-right" size={22} color="#FFF" />
          </Animated.View>
        </GestureDetector>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    width: '100%',
    alignItems: 'center',
  },
  track: {
    height: THUMB + 8,
    borderRadius: radius.full,
    backgroundColor: colors.gray100,
    justifyContent: 'center',
    overflow: 'hidden',
    alignSelf: 'center',
  },
  fill: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
  },
  label: {
    textAlign: 'center',
    fontFamily: typography.sansSemiBold,
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },
  thumb: {
    position: 'absolute',
    left: 4, top: 4,
    width: THUMB, height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
});
