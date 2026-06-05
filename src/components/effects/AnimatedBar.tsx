import { useEffect, useState } from 'react';
import {
  LayoutChangeEvent,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withDelay,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { radius } from '../../theme/tokens';
import { useReduceMotion } from '../../hooks/useReduceMotion';

interface AnimatedBarProps {
  /** 0–100 */
  pct: number;
  height?: number;
  trackColor: string;
  fillColor: string;
  /** When set, the fill renders as a horizontal gradient of these colours. */
  gradientColors?: string[];
  /** Adds a glowing leading edge + a traveling sheen over the fill. */
  liquid?: boolean;
  duration?: number;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}

const SIGNATURE = Easing.bezier(0.22, 1, 0.36, 1);
const SHEEN_W = 44;

export function AnimatedBar({
  pct,
  height = 6,
  trackColor,
  fillColor,
  gradientColors,
  liquid = false,
  duration = 850,
  delay = 80,
  style,
}: AnimatedBarProps) {
  const reduceMotion = useReduceMotion();
  const clamped = Math.max(0, Math.min(100, pct));
  const progress = useSharedValue(reduceMotion ? clamped : 0);
  const sheen = useSharedValue(0);
  const [trackW, setTrackW] = useState(0);

  useEffect(() => {
    if (reduceMotion) {
      progress.value = clamped;
      return;
    }
    const id = setTimeout(() => {
      progress.value = withTiming(clamped, { duration, easing: SIGNATURE });
    }, delay);
    return () => clearTimeout(id);
  }, [clamped, duration, delay, reduceMotion, progress]);

  // Sheen sweeps across the fill once it has settled.
  useEffect(() => {
    if (reduceMotion || !liquid) return;
    sheen.value = withDelay(
      delay + duration,
      withRepeat(
        withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.cubic) }),
        -1,
        false
      )
    );
    return () => cancelAnimation(sheen);
  }, [reduceMotion, liquid, delay, duration, sheen]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value}%` }));

  const sheenStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -SHEEN_W + sheen.value * (trackW + SHEEN_W) }],
  }));

  // ── Plain bar: identical to the original implementation ──────────────────
  if (!liquid && !gradientColors) {
    return (
      <View
        style={[
          styles.track,
          { height, backgroundColor: trackColor, borderRadius: radius.full },
          style,
        ]}
      >
        <Animated.View
          style={[
            styles.fill,
            { backgroundColor: fillColor, borderRadius: radius.full },
            fillStyle,
          ]}
        />
      </View>
    );
  }

  // ── Liquid / gradient bar ────────────────────────────────────────────────
  const headWidth = Math.max(14, height * 2.4);

  return (
    <View
      style={[
        styles.track,
        { height, backgroundColor: trackColor, borderRadius: radius.full },
        style,
      ]}
      onLayout={(e: LayoutChangeEvent) => setTrackW(e.nativeEvent.layout.width)}
    >
      <Animated.View
        style={[styles.fill, styles.fillClip, { borderRadius: radius.full }, fillStyle]}
      >
        {/* Base colour or gradient */}
        {gradientColors && gradientColors.length > 1 ? (
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: fillColor }]} />
        )}

        {/* Traveling sheen */}
        {liquid && !reduceMotion ? (
          <Animated.View style={[styles.sheen, { width: SHEEN_W }, sheenStyle]}>
            <LinearGradient
              colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        ) : null}

        {/* Glowing leading edge */}
        {liquid ? (
          <LinearGradient
            colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.9)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.head, { width: headWidth }]}
          />
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', overflow: 'hidden' },
  fill: { height: '100%' },
  fillClip: { overflow: 'hidden' },
  sheen: { position: 'absolute', top: 0, bottom: 0, left: 0 },
  head: { position: 'absolute', top: 0, bottom: 0, right: 0 },
});
