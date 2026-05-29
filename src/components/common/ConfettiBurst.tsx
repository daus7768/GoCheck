import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';

const COLORS = ['#6366F1', '#10B981', '#F59E0B', '#4338CA', '#EC4899', '#06B6D4'];
const PARTICLE_COUNT = 28;

interface Particle {
  id: number;
  color: string;
  angle: number;
  distance: number;
  size: number;
  rotate: number;
}

function makeParticles(): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, id) => ({
    id,
    color: COLORS[id % COLORS.length]!,
    angle: (Math.PI * 2 * id) / PARTICLE_COUNT + Math.random() * 0.4,
    distance: 40 + Math.random() * 55,
    size: 5 + Math.random() * 5,
    rotate: Math.random() * 360,
  }));
}

interface Props {
  active: boolean;
  reduceMotion?: boolean;
  originX?: number;
  originY?: number;
}

function ParticleView({
  particle,
  progress,
}: {
  particle: Particle;
  progress: Animated.SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    const dx = Math.cos(particle.angle) * particle.distance * p;
    const dy = Math.sin(particle.angle) * particle.distance * p + 30 * p * p;
    return {
      opacity: 1 - p,
      transform: [
        { translateX: dx },
        { translateY: dy },
        { rotate: `${particle.rotate + p * 180}deg` },
        { scale: 1 - p * 0.3 },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          width: particle.size,
          height: particle.size * 0.55,
          backgroundColor: particle.color,
          borderRadius: 2,
        },
        style,
      ]}
    />
  );
}

export function ConfettiBurst({
  active,
  reduceMotion = false,
  originX = 0,
  originY = 0,
}: Props) {
  const particles = useMemo(() => makeParticles(), []);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!active || reduceMotion) return;
    progress.value = 0;
    progress.value = withTiming(1, {
      duration: 1200,
      easing: Easing.out(Easing.quad),
    });
  }, [active, reduceMotion, progress]);

  if (!active || reduceMotion) return null;

  return (
    <View
      style={[
        styles.container,
        { left: originX, top: originY },
        Platform.OS === 'web' ? styles.containerWeb : null,
      ]}
      pointerEvents="none"
    >
      {particles.map((p) => (
        <ParticleView key={p.id} particle={p} progress={progress} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: 0,
    height: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
    overflow: 'visible',
  },
  containerWeb: {
    overflow: 'visible',
  },
  particle: {
    position: 'absolute',
  },
});
