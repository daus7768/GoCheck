import { StyleSheet, View, Platform } from 'react-native';
import { AppText } from '../AppText';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { gc } from '../../theme/tokens';

interface GlowingSectionProps {
  title: string;
  icon?: React.ComponentProps<typeof Feather>['name'];
  delay?: number;
  children: React.ReactNode;
}

/**
 * Dark section card with a teal gradient border + soft outer glow.
 * Native React Native equivalent of Aceternity's GlowingEffect wrapper.
 */
export function GlowingSection({ title, icon, delay = 0, children }: GlowingSectionProps) {
  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(380).springify().damping(18)}
      style={styles.outer}
    >
      <LinearGradient
        colors={[
          'rgba(29,158,117,0.45)',
          'rgba(29,158,117,0.08)',
          'rgba(29,158,117,0.35)',
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.border}
      >
        <View style={styles.inner}>
          <View style={styles.titleRow}>
            {icon && <Feather name={icon} size={14} color={gc.primary} />}
            <AppText style={styles.title}>{title}</AppText>
          </View>
          {children}
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  outer: {
    marginBottom: 14,
    borderRadius: 20,
    // soft teal outer glow
    ...Platform.select({
      ios: {
        shadowColor: gc.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.20,
        shadowRadius: 18,
      },
      android: { elevation: 6 },
    }),
  },
  border: {
    borderRadius: 20,
    padding: 1, // 1px gradient border
  },
  inner: {
    borderRadius: 19,
    backgroundColor: gc.surface2,
    padding: 18,
    borderWidth: 1,
    borderColor: gc.border,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: gc.text,
    letterSpacing: 0.2,
  },
});
