import { useEffect } from 'react';
import { View, Text, StyleSheet, Modal, Image, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSpring,
  withSequence,
  Easing,
  interpolate,
  cancelAnimation,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { colors, typography, fontSize } from '../../theme/tokens';

interface Props {
  visible: boolean;
}

const OUTER = 120;
const MID   = 90;
const INNER = 62;
const CENTER = 44;
const BORDER = 2.5;

export function SignOutOverlay({ visible }: Props) {
  const backdropOpacity = useSharedValue(0);
  const contentScale    = useSharedValue(0.82);
  const contentOpacity  = useSharedValue(0);
  const ring1           = useSharedValue(0);
  const ring2           = useSharedValue(0);
  const ring3           = useSharedValue(0);
  const logoPulse       = useSharedValue(1);
  const dot1            = useSharedValue(0.2);
  const dot2            = useSharedValue(0.2);
  const dot3            = useSharedValue(0.2);

  useEffect(() => {
    if (visible) {
      backdropOpacity.value = withTiming(1, { duration: 320 });
      contentOpacity.value  = withTiming(1, { duration: 380, easing: Easing.out(Easing.ease) });
      contentScale.value    = withSpring(1, { damping: 16, stiffness: 140 });

      ring1.value = withRepeat(withTiming(1,  { duration: 1100, easing: Easing.linear }), -1, false);
      ring2.value = withRepeat(withTiming(-1, { duration: 1750, easing: Easing.linear }), -1, false);
      ring3.value = withRepeat(withTiming(1,  { duration: 2800, easing: Easing.linear }), -1, false);

      logoPulse.value = withRepeat(
        withSequence(
          withTiming(1.07, { duration: 850, easing: Easing.inOut(Easing.sine) }),
          withTiming(1.00, { duration: 850, easing: Easing.inOut(Easing.sine) }),
        ),
        -1,
        false
      );

      // Sequential dot pulse
      dot1.value = withRepeat(
        withSequence(
          withTiming(1,   { duration: 360 }),
          withTiming(0.2, { duration: 360 }),
          withTiming(0.2, { duration: 720 }),
        ),
        -1,
        false
      );
      dot2.value = withRepeat(
        withSequence(
          withTiming(0.2, { duration: 360 }),
          withTiming(1,   { duration: 360 }),
          withTiming(0.2, { duration: 360 }),
          withTiming(0.2, { duration: 360 }),
        ),
        -1,
        false
      );
      dot3.value = withRepeat(
        withSequence(
          withTiming(0.2, { duration: 720 }),
          withTiming(1,   { duration: 360 }),
          withTiming(0.2, { duration: 360 }),
        ),
        -1,
        false
      );
    } else {
      cancelAnimation(ring1);
      cancelAnimation(ring2);
      cancelAnimation(ring3);
      cancelAnimation(logoPulse);
      cancelAnimation(dot1);
      cancelAnimation(dot2);
      cancelAnimation(dot3);
      backdropOpacity.value = withTiming(0, { duration: 220 });
      contentOpacity.value  = withTiming(0, { duration: 160 });
      contentScale.value    = withTiming(0.9, { duration: 160 });
    }
  }, [visible]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const contentStyle  = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ scale: contentScale.value }],
  }));
  const r1Style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(ring1.value, [0, 1],  [0, 360])}deg` }],
  }));
  const r2Style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(ring2.value, [0, -1], [0, -360])}deg` }],
  }));
  const r3Style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(ring3.value, [0, 1],  [0, 360])}deg` }],
  }));
  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoPulse.value }],
  }));
  const d1 = useAnimatedStyle(() => ({ opacity: dot1.value }));
  const d2 = useAnimatedStyle(() => ({ opacity: dot2.value }));
  const d3 = useAnimatedStyle(() => ({ opacity: dot3.value }));

  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]} pointerEvents="none">
        <BlurView
          intensity={Platform.OS === 'web' ? 20 : 30}
          tint="dark"
          style={[StyleSheet.absoluteFill, styles.blurOverlay]}
        />
      </Animated.View>

      <View style={styles.center} pointerEvents="none">
        <Animated.View style={contentStyle}>
          {/* ── Spinner rings ── */}
          <View style={styles.spinnerWrap}>
            {/* Outer ring – slow, primaryLight */}
            <Animated.View style={[styles.ring, styles.ringOuter, r3Style]} />

            {/* Middle ring – medium, primary with glow */}
            <Animated.View style={[styles.ring, styles.ringMid, r2Style]} />

            {/* Inner ring – fast, white */}
            <Animated.View style={[styles.ring, styles.ringInner, r1Style]} />

            {/* Centre logo */}
            <Animated.View style={[styles.centerCircle, logoStyle]}>
              <Image source={require('../../../assets/logo.png')} style={styles.logo} />
            </Animated.View>
          </View>

          {/* ── Label + dots ── */}
          <View style={styles.textRow}>
            <Text style={styles.label}>Signing out</Text>
            <Animated.Text style={[styles.dot, d1]}>.</Animated.Text>
            <Animated.Text style={[styles.dot, d2]}>.</Animated.Text>
            <Animated.Text style={[styles.dot, d3]}>.</Animated.Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  blurOverlay: {
    backgroundColor: 'rgba(6,6,14,0.72)',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinnerWrap: {
    width: OUTER,
    height: OUTER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderRadius: 999,
  },
  ringOuter: {
    width: OUTER,
    height: OUTER,
    borderWidth: BORDER,
    borderTopColor:    'rgba(99,102,241,0.55)',
    borderRightColor:  'rgba(99,102,241,0.18)',
    borderBottomColor: 'transparent',
    borderLeftColor:   'transparent',
  },
  ringMid: {
    width: MID,
    height: MID,
    borderWidth: BORDER + 0.5,
    borderTopColor:    colors.primary,
    borderRightColor:  'rgba(79,70,229,0.35)',
    borderBottomColor: 'transparent',
    borderLeftColor:   'transparent',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 12,
    elevation: 10,
  },
  ringInner: {
    width: INNER,
    height: INNER,
    borderWidth: BORDER + 1,
    borderTopColor:    '#FFFFFF',
    borderRightColor:  'rgba(255,255,255,0.25)',
    borderBottomColor: 'transparent',
    borderLeftColor:   'transparent',
  },
  centerCircle: {
    width: CENTER,
    height: CENTER,
    borderRadius: CENTER / 2,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 18,
    elevation: 14,
  },
  logo: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  textRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginTop: 32,
    gap: 1,
  },
  label: {
    fontFamily: typography.sansMedium,
    fontSize: fontSize.base,
    color: 'rgba(255,255,255,0.78)',
    letterSpacing: 0.4,
  },
  dot: {
    fontFamily: typography.sansBold,
    fontSize: fontSize.base,
    color: 'rgba(255,255,255,0.78)',
    lineHeight: fontSize.base * 1.25,
  },
});
