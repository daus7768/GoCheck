import { Tabs } from 'expo-router';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  withSpring,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { colors, spacing, radius, typography, fontSize } from '../../src/theme/tokens';
import { useTheme } from '../../src/theme/ThemeContext';
import { AppText } from '../../src/components/AppText';
import { haptic } from '../../src/lib/haptics';

const ROUTE_CONFIG: Record<string, {
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
}> = {
  index:   { label: 'Home',    icon: 'home' },
  bills:   { label: 'Bills',   icon: 'file-text' },
  reports: { label: 'Reports', icon: 'bar-chart-2' },
  profile: { label: 'Profile', icon: 'user' },
};

interface TabItemProps {
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  focused: boolean;
  isDark: boolean;
  onPress: () => void;
}

function TabItem({ label, icon, focused, isDark, onPress }: TabItemProps) {
  const pillOpacity = useSharedValue(focused ? 1 : 0);
  const pillScale  = useSharedValue(focused ? 1 : 0.82);
  const iconScale  = useSharedValue(1);
  const dotOpacity = useSharedValue(focused ? 1 : 0);
  const iconOpacity = useSharedValue(focused ? 1 : 0.28);

  // React to focus changes
  useAnimatedReaction(
    () => focused,
    (isFocused: boolean) => {
      'worklet';
      pillOpacity.value = withTiming(isFocused ? 1 : 0, { duration: 200 });
      pillScale.value   = withSpring(isFocused ? 1 : 0.82, { damping: 16, stiffness: 220 });
      dotOpacity.value  = withSpring(isFocused ? 1 : 0, { damping: 16, stiffness: 200 });
      iconOpacity.value = withTiming(isFocused ? 1 : 0.28, { duration: 180 });
    }
  );

  const pillStyle = useAnimatedStyle(() => ({
    opacity: pillOpacity.value,
    transform: [{ scale: pillScale.value }],
  }));

  const iconAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
    opacity: iconOpacity.value,
  }));

  const dotStyle = useAnimatedStyle(() => ({
    opacity: dotOpacity.value,
    transform: [{ scaleX: dotOpacity.value }],
  }));

  function handlePress() {
    haptic.selection();
    iconScale.value = withSequence(
      withSpring(1.22, { damping: 8, stiffness: 300 }),
      withSpring(1.0,  { damping: 12, stiffness: 220 })
    );
    onPress();
  }

  const activeColor  = isDark ? '#818CF8' : colors.primary;
  const pillBgColor  = isDark ? 'rgba(99,102,241,0.18)' : 'rgba(99,102,241,0.10)';
  const pillShadow   = isDark
    ? { shadowColor: '#6366F1', shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 0 }, elevation: 6 }
    : { shadowColor: '#4F46E5', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 0 }, elevation: 3 };

  return (
    <Pressable
      onPress={handlePress}
      style={styles.tabItem}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
    >
      {/* Animated pill background */}
      <Animated.View style={[
        styles.pillBg,
        { backgroundColor: pillBgColor, ...(focused ? pillShadow : {}) },
        pillStyle,
      ]} />

      {/* Icon */}
      <Animated.View style={iconAnimStyle}>
        <Feather
          name={icon}
          size={20}
          color={focused ? activeColor : (isDark ? 'rgba(255,255,255,0.28)' : colors.gray400)}
          // @ts-ignore — web-only drop-shadow, not in RN TextStyle
          style={focused ? {
            filter: `drop-shadow(0 0 6px ${activeColor}88)`,
          } as any : undefined}
        />
      </Animated.View>

      {/* Label */}
      <AppText style={[
        styles.tabLabel,
        { color: focused ? activeColor : (isDark ? 'rgba(255,255,255,0.28)' : colors.gray400) },
      ]}>
        {label}
      </AppText>

      {/* Glow dot underline */}
      <Animated.View style={[
        styles.glowDot,
        {
          backgroundColor: activeColor,
          shadowColor: activeColor,
          shadowOpacity: 0.9,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 0 },
          elevation: 4,
        },
        dotStyle,
      ]} />
    </Pressable>
  );
}

function FloatingTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const { isDark } = useTheme();

  return (
    <View style={[styles.tabBarOuter, { paddingBottom: insets.bottom + 8 }]}>
      <View style={[
        styles.tabBarPill,
        {
          borderColor: isDark ? 'rgba(99,102,241,0.18)' : 'rgba(99,102,241,0.12)',
          shadowColor: '#4F46E5',
          shadowOpacity: isDark ? 0.22 : 0.12,
          shadowRadius: 28,
          shadowOffset: { width: 0, height: -4 },
          elevation: 16,
        },
      ]}>
        {/* Glassmorphic blur fill */}
        <BlurView
          intensity={isDark ? 24 : 20}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
        {/* Android fallback opaque bg (BlurView on old Android = transparent) */}
        {Platform.OS === 'android' && (
          <View style={[
            StyleSheet.absoluteFill,
            { backgroundColor: isDark ? 'rgba(10,10,20,0.95)' : 'rgba(255,255,255,0.97)', borderRadius: 28 },
          ]} />
        )}
        {/* Top-edge shimmer line */}
        <LinearGradient
          colors={['transparent', 'rgba(99,102,241,0.55)', 'rgba(99,102,241,0.3)', 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.shimmerLine}
        />
        {/* Tab items */}
        <View style={styles.tabRow}>
          {state.routes.map((route, index) => {
            const config = ROUTE_CONFIG[route.name] ?? { label: route.name, icon: 'circle' as const };
            const focused = state.index === index;
            return (
              <TabItem
                key={route.key}
                label={config.label}
                icon={config.icon}
                focused={focused}
                isDark={isDark}
                onPress={() => {
                  const event = navigation.emit({
                    type: 'tabPress',
                    target: route.key,
                    canPreventDefault: true,
                  });
                  if (!focused && !event.defaultPrevented) {
                    navigation.navigate(route.name);
                  }
                }}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index"   options={{ title: 'Home' }} />
      <Tabs.Screen name="bills"   options={{ title: 'Bills' }} />
      <Tabs.Screen name="reports" options={{ title: 'Reports' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarOuter: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  tabBarPill: {
    borderRadius: 28,
    borderWidth: 1,
    overflow: Platform.OS === 'ios' ? 'hidden' : 'visible',
    position: 'relative',
  },
  shimmerLine: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    height: 1,
    zIndex: 1,
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 6,
    paddingVertical: 8,
    position: 'relative',
    zIndex: 2,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 6,
    paddingHorizontal: 4,
    position: 'relative',
  },
  pillBg: {
    position: 'absolute',
    top: 0,
    left: 4,
    right: 4,
    bottom: 0,
    borderRadius: 16,
  },
  tabLabel: {
    fontFamily: typography.sansMedium,
    fontSize: fontSize['2xs'],
    letterSpacing: 0.2,
  },
  glowDot: {
    width: 16,
    height: 2,
    borderRadius: 1,
    marginTop: 1,
  },
});
