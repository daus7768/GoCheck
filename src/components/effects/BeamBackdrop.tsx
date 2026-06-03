import { useEffect } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Path } from 'react-native-svg';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * Cosmic animated backdrop used by participant + group share landing pages.
 * Renders a multi-stop indigo→cyan→emerald gradient base with three
 * curved bezier "beam" paths that sweep across the screen on a 9s loop.
 *
 * Extracted from the inline implementation in app/p/[token].tsx so the
 * group share landing page can reuse the same visual.
 */
export function BeamBackdrop() {
  const { width, height } = useWindowDimensions();
  const sweep = useSharedValue(0);
  const pulse = useSharedValue(0.55);

  useEffect(() => {
    sweep.value = withRepeat(
      withTiming(1, { duration: 9000, easing: Easing.linear }),
      -1,
      false
    );
    pulse.value = withRepeat(
      withTiming(0.95, { duration: 4200, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
    return () => {
      cancelAnimation(sweep);
      cancelAnimation(pulse);
    };
  }, [pulse, sweep]);

  const svgW = Math.max(width, 390);
  const svgH = Math.max(height, 780);
  const pathA = `M -80 ${svgH * 0.18} C ${svgW * 0.18} ${svgH * 0.02}, ${svgW * 0.34} ${svgH * 0.44}, ${svgW + 90} ${svgH * 0.14}`;
  const pathB = `M -70 ${svgH * 0.54} C ${svgW * 0.2} ${svgH * 0.32}, ${svgW * 0.52} ${svgH * 0.76}, ${svgW + 80} ${svgH * 0.46}`;
  const pathC = `M ${svgW + 70} ${svgH * 0.82} C ${svgW * 0.72} ${svgH * 0.58}, ${svgW * 0.22} ${svgH * 0.96}, -80 ${svgH * 0.68}`;

  const beamAProps = useAnimatedProps(() => ({
    strokeDashoffset: interpolate(sweep.value, [0, 1], [980, -980]),
    opacity: pulse.value,
  }));
  const beamBProps = useAnimatedProps(() => ({
    strokeDashoffset: interpolate(sweep.value, [0, 1], [520, -1320]),
    opacity: interpolate(pulse.value, [0.55, 0.95], [0.35, 0.8]),
  }));
  const beamCProps = useAnimatedProps(() => ({
    strokeDashoffset: interpolate(sweep.value, [0, 1], [1200, -760]),
    opacity: interpolate(pulse.value, [0.55, 0.95], [0.25, 0.68]),
  }));

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={['#070A16', '#11123A', '#061B2A', '#071512']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Svg width={svgW} height={svgH} style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgLinearGradient id="beamSoft" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#38BDF8" stopOpacity="0" />
            <Stop offset="30%" stopColor="#6366F1" stopOpacity="0.28" />
            <Stop offset="62%" stopColor="#22C55E" stopOpacity="0.22" />
            <Stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
          </SvgLinearGradient>
          <SvgLinearGradient id="beamHot" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
            <Stop offset="38%" stopColor="#A5B4FC" stopOpacity="0.95" />
            <Stop offset="56%" stopColor="#67E8F9" stopOpacity="0.9" />
            <Stop offset="72%" stopColor="#86EFAC" stopOpacity="0.75" />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </SvgLinearGradient>
        </Defs>
        <Path d={pathA} stroke="url(#beamSoft)" strokeWidth={54} strokeLinecap="round" fill="none" />
        <Path d={pathB} stroke="url(#beamSoft)" strokeWidth={68} strokeLinecap="round" fill="none" opacity={0.7} />
        <Path d={pathC} stroke="url(#beamSoft)" strokeWidth={58} strokeLinecap="round" fill="none" opacity={0.5} />
        <AnimatedPath
          d={pathA}
          stroke="url(#beamHot)"
          strokeWidth={3}
          strokeLinecap="round"
          fill="none"
          strokeDasharray="180 760"
          animatedProps={beamAProps}
        />
        <AnimatedPath
          d={pathB}
          stroke="url(#beamHot)"
          strokeWidth={2.5}
          strokeLinecap="round"
          fill="none"
          strokeDasharray="150 820"
          animatedProps={beamBProps}
        />
        <AnimatedPath
          d={pathC}
          stroke="url(#beamHot)"
          strokeWidth={2.5}
          strokeLinecap="round"
          fill="none"
          strokeDasharray="130 780"
          animatedProps={beamCProps}
        />
      </Svg>
      <LinearGradient
        colors={['rgba(7,10,22,0.12)', 'rgba(7,10,22,0.42)', 'rgba(248,250,252,0.08)']}
        locations={[0, 0.58, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}
