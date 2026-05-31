import { useEffect } from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { gc } from '../../theme/tokens';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

/**
 * Cinematic dark beam background — native equivalent of Aceternity's
 * BackgroundBeamsWithCollision. Uses two diagonal teal gradient beams that
 * slowly pulse in opacity. Animation auto-cancels on unmount so it never
 * keeps a rAF loop alive in the background.
 */
export function BeamBackground({ children }: { children: React.ReactNode }) {
  const pulseA = useSharedValue(0.25);
  const pulseB = useSharedValue(0.18);

  useEffect(() => {
    pulseA.value = withRepeat(
      withTiming(0.5, { duration: 4200, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
    pulseB.value = withRepeat(
      withTiming(0.42, { duration: 5400, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
    return () => {
      cancelAnimation(pulseA);
      cancelAnimation(pulseB);
    };
  }, [pulseA, pulseB]);

  const beamAStyle = useAnimatedStyle(() => ({ opacity: pulseA.value }));
  const beamBStyle = useAnimatedStyle(() => ({ opacity: pulseB.value }));

  return (
    <View style={styles.root}>
      {/* base layer */}
      <View style={styles.base} pointerEvents="none" />

      {/* Beam A — top-right teal sweep */}
      <Animated.View
        style={[styles.beamWrap, styles.beamA, beamAStyle]}
        pointerEvents="none"
      >
        <LinearGradient
          colors={[gc.primary, 'rgba(29,158,117,0.0)']}
          start={{ x: 0.0, y: 0.0 }}
          end={{ x: 1.0, y: 1.0 }}
          style={styles.beamGradient}
        />
      </Animated.View>

      {/* Beam B — bottom-left white-ish glow */}
      <Animated.View
        style={[styles.beamWrap, styles.beamB, beamBStyle]}
        pointerEvents="none"
      >
        <LinearGradient
          colors={['rgba(240,246,252,0.10)', 'rgba(29,158,117,0.0)']}
          start={{ x: 0.0, y: 1.0 }}
          end={{ x: 1.0, y: 0.0 }}
          style={styles.beamGradient}
        />
      </Animated.View>

      {/* Vignette — fades edges into pure surface for a cinematic frame */}
      <LinearGradient
        colors={['rgba(13,17,23,0.0)', gc.surface]}
        start={{ x: 0.5, y: 0.0 }}
        end={{ x: 0.5, y: 1.0 }}
        style={styles.vignette}
        pointerEvents="none"
      />

      {children}
    </View>
  );
}

const BEAM_W = SCREEN_W * 1.4;
const BEAM_H = SCREEN_H * 0.7;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: gc.surface },
  base: { ...StyleSheet.absoluteFillObject, backgroundColor: gc.surface },
  beamWrap: {
    position: 'absolute',
    width: BEAM_W,
    height: BEAM_H,
    transform: [{ rotate: '-18deg' }],
  },
  beamA: { top: -BEAM_H * 0.25, right: -BEAM_W * 0.35 },
  beamB: { bottom: -BEAM_H * 0.25, left: -BEAM_W * 0.35 },
  beamGradient: { flex: 1, opacity: 0.6 },
  vignette: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    height: SCREEN_H * 0.45,
  },
});
