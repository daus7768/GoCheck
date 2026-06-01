import { useEffect, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { colors, typography, fontSize, radius, shadow, spacing } from '../../theme/tokens';
import { haptic } from '../../lib/haptics';
import { CURRENCY_SYMBOLS } from '../../types';
import type { Bill, Currency } from '../../types';
import { useReduceMotion } from '../../hooks/useReduceMotion';

type Participant = Bill['participants'][number];

interface AnimatedTooltipStackProps {
  people: Participant[];
  currency: Currency;
  size?: number;
  max?: number;
}

function fmt(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function AnimatedTooltipStack({
  people,
  currency,
  size = 28,
  max = 5,
}: AnimatedTooltipStackProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  const sym = CURRENCY_SYMBOLS[currency] ?? currency;

  return (
    <View style={styles.row}>
      {shown.map((person, index) => (
        <AvatarBubble
          key={person.id}
          person={person}
          index={index}
          size={size}
          isActive={activeId === person.id}
          onToggle={() => {
            haptic.selection();
            setActiveId((prev) => (prev === person.id ? null : person.id));
          }}
          sym={sym}
        />
      ))}
      {extra > 0 && (
        <View
          style={[
            styles.avatar,
            styles.extraChip,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              marginLeft: -8,
            },
          ]}
        >
          <Text style={[styles.initial, styles.extraText, { fontSize: Math.round(size * 0.38) }]}>
            +{extra}
          </Text>
        </View>
      )}
    </View>
  );
}

interface AvatarBubbleProps {
  person: Participant;
  index: number;
  size: number;
  isActive: boolean;
  onToggle: () => void;
  sym: string;
}

function AvatarBubble({ person, index, size, isActive, onToggle, sym }: AvatarBubbleProps) {
  const reduceMotion = useReduceMotion();
  const scale = useSharedValue(1);
  const lift = useSharedValue(0);
  const tipOpacity = useSharedValue(0);
  const tipScale = useSharedValue(0.7);
  const tipTranslate = useSharedValue(6);

  useEffect(() => {
    if (isActive) {
      if (!reduceMotion) {
        lift.value = withSpring(-2, { damping: 14, stiffness: 220 });
        scale.value = withSpring(1.08, { damping: 14, stiffness: 220 });
      }
      tipOpacity.value = withTiming(1, { duration: 160, easing: Easing.bezier(0.22, 1, 0.36, 1) });
      tipScale.value = withSpring(1, { damping: 14, stiffness: 220 });
      tipTranslate.value = withSpring(0, { damping: 14, stiffness: 220 });
    } else {
      lift.value = withSpring(0, { damping: 14, stiffness: 220 });
      scale.value = withSpring(1, { damping: 14, stiffness: 220 });
      tipOpacity.value = withTiming(0, { duration: 120 });
      tipScale.value = withTiming(0.7, { duration: 120 });
      tipTranslate.value = withTiming(6, { duration: 120 });
    }
  }, [isActive, reduceMotion, lift, scale, tipOpacity, tipScale, tipTranslate]);

  const bubbleStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: lift.value }, { scale: scale.value }],
    zIndex: isActive ? 30 : 1,
  }));

  const tipStyle = useAnimatedStyle(() => ({
    opacity: tipOpacity.value,
    transform: [{ translateY: tipTranslate.value }, { scale: tipScale.value }],
  }));

  const bg = person.avatarColor || colors.avatar[index % colors.avatar.length];
  const initial = person.name.charAt(0).toUpperCase();
  const status = person.isPaid ? 'Settled up' : `Owes ${sym}${fmt(person.amount)}`;

  return (
    <View style={[styles.bubbleWrap, { marginLeft: index === 0 ? 0 : -8 }]}>
      {/* Tooltip — absolute positioned ABOVE the avatar */}
      <Animated.View
        pointerEvents="none"
        style={[styles.tip, tipStyle, { bottom: size + 6 }]}
      >
        <View style={styles.tipBubble}>
          <Text style={styles.tipName} numberOfLines={1}>{person.name}</Text>
          <Text style={[styles.tipStatus, person.isPaid && { color: colors.secondary }]} numberOfLines={1}>
            {status}
          </Text>
        </View>
        <View style={styles.tipArrow} />
      </Animated.View>

      <Pressable
        onPress={onToggle}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        accessibilityRole="button"
        accessibilityLabel={`${person.name}, ${status}`}
        accessibilityState={{ selected: isActive }}
      >
        <Animated.View
          style={[
            styles.avatar,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: bg,
            },
            bubbleStyle,
          ]}
        >
          <Text style={[styles.initial, { fontSize: Math.round(size * 0.4) }]}>{initial}</Text>
          {person.isPaid && (
            <View style={[styles.paidDot, { width: size * 0.38, height: size * 0.38, borderRadius: (size * 0.38) / 2 }]}>
              <Feather name="check" size={size * 0.22} color={colors.white} />
            </View>
          )}
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bubbleWrap: {
    position: 'relative',
  },
  avatar: {
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
  },
  initial: {
    fontFamily: typography.sansBold,
    color: colors.white,
  },
  extraChip: {
    backgroundColor: colors.gray300,
  },
  extraText: {
    color: colors.gray700,
  },
  paidDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  tip: {
    position: 'absolute',
    left: '50%',
    alignItems: 'center',
    transform: [{ translateX: -80 }],
    width: 160,
    zIndex: 40,
  },
  tipBubble: {
    backgroundColor: colors.gray900,
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1.5],
    borderRadius: radius.md,
    alignItems: 'center',
    ...shadow.md,
  },
  tipName: {
    fontFamily: typography.sansBold,
    fontSize: fontSize.xs,
    color: colors.white,
  },
  tipStatus: {
    fontFamily: typography.sansRegular,
    fontSize: 10,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 1,
  },
  tipArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 5,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: colors.gray900,
    marginTop: -1,
  },
});
