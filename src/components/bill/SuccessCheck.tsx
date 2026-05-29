import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  withDelay,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { SUCCESS_TOKENS } from './billCreatedTokens';

const VIEW_SIZE = 52;
const CHECK_PATH = 'M16 27 L23 34 L37 19';
const PATH_LENGTH = 32;

const AnimatedPath =
  Platform.OS !== 'web' ? Animated.createAnimatedComponent(Path) : null;

interface Props {
  reduceMotion?: boolean;
  onPulseStart?: () => void;
}

export function SuccessCheck({ reduceMotion = false, onPulseStart }: Props) {
  const ringScale = useSharedValue(reduceMotion ? 1 : 0);
  const strokeProgress = useSharedValue(reduceMotion ? 1 : 0);
  const [webStroke, setWebStroke] = useState(reduceMotion ? 0 : PATH_LENGTH);
  const [pulseKey, setPulseKey] = useState(0);

  const strokeProps = useAnimatedProps(() => ({
    strokeDashoffset: PATH_LENGTH * (1 - strokeProgress.value),
  }));

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringScale.value,
  }));

  useEffect(() => {
    if (reduceMotion) {
      ringScale.value = 1;
      strokeProgress.value = 1;
      setWebStroke(0);
      return;
    }

    ringScale.value = withDelay(
      220,
      withSpring(1, { damping: 12, stiffness: 220 })
    );

    if (Platform.OS === 'web') {
      setWebStroke(PATH_LENGTH);
      const startAt = 220;
      const duration = 400;
      const timeout = setTimeout(() => {
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / duration);
          const eased = 1 - (1 - t) ** 3;
          setWebStroke(PATH_LENGTH * (1 - eased));
          if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }, startAt);
      const pulseId = setTimeout(() => {
        setPulseKey((k) => k + 1);
        onPulseStart?.();
      }, 360);
      return () => {
        clearTimeout(timeout);
        clearTimeout(pulseId);
      };
    }

    strokeProgress.value = withDelay(
      220,
      withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) })
    );
    const pulseId = setTimeout(() => {
      setPulseKey((k) => k + 1);
      onPulseStart?.();
    }, 360);
    return () => clearTimeout(pulseId);
  }, [reduceMotion, onPulseStart, ringScale, strokeProgress]);

  return (
    <View style={styles.wrap}>
      {!reduceMotion &&
        [0, 1].map((i) => (
          <PulseRing key={`${pulseKey}-${i}`} delay={i * 80} />
        ))}
      <Animated.View style={[styles.ringOuter, ringStyle]}>
        <Svg width={VIEW_SIZE} height={VIEW_SIZE} viewBox="0 0 52 52">
          <Circle
            cx={26}
            cy={26}
            r={24}
            fill={SUCCESS_TOKENS.ringSoft}
            stroke={SUCCESS_TOKENS.ring}
            strokeWidth={2}
          />
          {Platform.OS === 'web' || !AnimatedPath ? (
            <Path
              d={CHECK_PATH}
              stroke={SUCCESS_TOKENS.ring}
              strokeWidth={3.5}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={PATH_LENGTH}
              strokeDashoffset={webStroke}
            />
          ) : (
            <AnimatedPath
              d={CHECK_PATH}
              stroke={SUCCESS_TOKENS.ring}
              strokeWidth={3.5}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={PATH_LENGTH}
              animatedProps={strokeProps}
            />
          )}
        </Svg>
      </Animated.View>
    </View>
  );
}

function PulseRing({ delay }: { delay: number }) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    scale.value = 1;
    opacity.value = 0.4;
    scale.value = withDelay(
      delay,
      withTiming(1.8, { duration: 600, easing: Easing.out(Easing.cubic) })
    );
    opacity.value = withDelay(
      delay,
      withTiming(0, { duration: 600, easing: Easing.out(Easing.cubic) })
    );
  }, [delay, scale, opacity]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return <Animated.View style={[styles.pulse, style]} pointerEvents="none" />;
}

const styles = StyleSheet.create({
  wrap: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringOuter: {
    width: VIEW_SIZE,
    height: VIEW_SIZE,
  },
  pulse: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: SUCCESS_TOKENS.ringMid,
  },
});
