import { type ReactNode } from 'react';
import { StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withSpring,
  runOnUI,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import { useReduceMotion } from '../../hooks/useReduceMotion';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const SPRING = { damping: 20, stiffness: 200, mass: 0.8 };

interface TiltCardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Maximum tilt angle in degrees. Default: 12 */
  maxTilt?: number;
  /** Perspective depth — lower = more dramatic. Default: 900 */
  perspective?: number;
  /** Show a radial glare spotlight that follows touch. Default: true */
  glare?: boolean;
  /** Glare opacity at its brightest (0–1). Default: 0.28 */
  glareIntensity?: number;
}

/**
 * 3D perspective tilt card inspired by Perplexity Comet.
 *
 * Touch anywhere on the card to tilt it in 3D. A radial glare spotlight follows
 * the touch position. On release, the card springs back to flat.
 *
 * Uses the Responder system so it degrades gracefully inside a ScrollView —
 * the scroll view can still reclaim the responder for vertical scrolling.
 */
export function TiltCard({
  children,
  style,
  maxTilt = 12,
  perspective = 900,
  glare = true,
  glareIntensity = 0.28,
}: TiltCardProps) {
  const reduceMotion = useReduceMotion();

  const rotateX = useSharedValue(0);
  const rotateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const glareOpacity = useSharedValue(0);
  const glareX = useSharedValue(50);
  const glareY = useSharedValue(50);
  const cardW = useSharedValue(300);
  const cardH = useSharedValue(180);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective },
      { rotateX: `${rotateX.value}deg` },
      { rotateY: `${rotateY.value}deg` },
      { scale: scale.value },
    ],
  }));

  const glareOpacityStyle = useAnimatedStyle(() => ({
    opacity: glareOpacity.value,
  }));

  const glareCircleProps = useAnimatedProps(() => ({
    cx: glareX.value,
    cy: glareY.value,
  }));

  function applyTilt(x: number, y: number) {
    const _tilt = maxTilt;
    runOnUI(() => {
      'worklet';
      const w = cardW.value || 300;
      const h = cardH.value || 180;
      const relX = Math.max(0, Math.min(x / w, 1));
      const relY = Math.max(0, Math.min(y / h, 1));
      rotateY.value = (relX - 0.5) * 2 * _tilt;
      rotateX.value = -(relY - 0.5) * 2 * _tilt;
      glareX.value = relX * 100;
      glareY.value = relY * 100;
    })();
  }

  function snapBack() {
    rotateX.value = withSpring(0, SPRING);
    rotateY.value = withSpring(0, SPRING);
    scale.value = withSpring(1, SPRING);
    glareOpacity.value = withSpring(0, SPRING);
  }

  if (reduceMotion) {
    return <Animated.View style={style}>{children}</Animated.View>;
  }

  return (
    <Animated.View
      style={[style, cardStyle]}
      onLayout={(e) => {
        cardW.value = e.nativeEvent.layout.width;
        cardH.value = e.nativeEvent.layout.height;
      }}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => false}
      onResponderGrant={(e) => {
        scale.value = withSpring(1.025, SPRING);
        glareOpacity.value = withSpring(1, SPRING);
        applyTilt(e.nativeEvent.locationX, e.nativeEvent.locationY);
      }}
      onResponderMove={(e) => {
        applyTilt(e.nativeEvent.locationX, e.nativeEvent.locationY);
      }}
      onResponderRelease={snapBack}
      onResponderTerminate={snapBack}
    >
      {children}
      {glare && (
        <Animated.View
          style={[StyleSheet.absoluteFill, glareOpacityStyle]}
          pointerEvents="none"
        >
          <Svg
            style={StyleSheet.absoluteFill}
            viewBox="0 0 100 100"
            preserveAspectRatio="xMidYMid meet"
          >
            <Defs>
              <RadialGradient id="tiltGlare" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor="white" stopOpacity={glareIntensity} />
                <Stop offset="55%" stopColor="white" stopOpacity={glareIntensity * 0.15} />
                <Stop offset="100%" stopColor="white" stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <AnimatedCircle
              animatedProps={glareCircleProps}
              r="55"
              fill="url(#tiltGlare)"
            />
          </Svg>
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({});
