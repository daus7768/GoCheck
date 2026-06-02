import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { AppText } from '../AppText';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { colors, typography, spacing, radius } from '../../theme/tokens';
import { GlowingCard } from '../effects/GlowingCard';
import type { ReliabilityResult } from '../../lib/reportsCompute';

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function ReliabilityRow({ item }: { item: ReliabilityResult }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(item.score / 100, {
      duration: 350,
      easing: Easing.out(Easing.cubic),
    });
  }, [item.score]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  const avgLabel =
    item.avgDays <= 0
      ? `avg ${Math.abs(item.avgDays)}d early`
      : `avg ${item.avgDays}d to pay`;

  return (
    <View style={styles.row}>
      <View
        style={[
          styles.avatar,
          { backgroundColor: hexToRgba(item.band.color, 0.12) },
        ]}
      >
        <AppText style={[styles.avatarText, { color: item.band.color }]}>
          {getInitials(item.name)}
        </AppText>
      </View>
      <View style={styles.nameGroup}>
        <AppText style={styles.name} numberOfLines={1}>{item.name}</AppText>
        <AppText style={styles.sub}>{avgLabel}</AppText>
      </View>
      <View style={styles.scoreGroup}>
        <View
          style={[
            styles.bandPill,
            { backgroundColor: hexToRgba(item.band.color, 0.12) },
          ]}
        >
          <AppText style={[styles.bandText, { color: item.band.color }]}>
            {item.band.label}
          </AppText>
        </View>
        <View style={styles.barTrack}>
          <Animated.View
            style={[styles.barFill, barStyle, { backgroundColor: item.band.color }]}
          />
        </View>
        <AppText style={[styles.score, { color: item.band.color }]}>{item.score}</AppText>
      </View>
    </View>
  );
}

interface Props {
  data: ReliabilityResult[];
}

export function ReliabilityCard({ data }: Props) {
  return (
    <GlowingCard radius={radius['2xl']} background={colors.surface}>
      <View style={styles.card}>
        <AppText style={styles.title}>Who pays on time</AppText>
        <AppText style={styles.cardSub}>Based on past 6 months</AppText>
        {data.length === 0 ? (
          <AppText style={styles.empty}>
            Not enough data yet — needs 1+ paid bills with a due date set.
          </AppText>
        ) : (
          <View style={styles.list}>
            {data.map((item) => (
              <ReliabilityRow key={item.name} item={item} />
            ))}
          </View>
        )}
      </View>
    </GlowingCard>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing[4],
  },
  title: {
    fontFamily: typography.sansBold,
    fontSize: 14,
    color: colors.gray900,
  },
  cardSub: {
    fontFamily: typography.sansRegular,
    fontSize: 11,
    color: colors.gray400,
    marginBottom: spacing[3],
    marginTop: 2,
  },
  list: { gap: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontFamily: typography.sansBold,
    fontSize: 11,
  },
  nameGroup: { flex: 1, minWidth: 0 },
  name: {
    fontFamily: typography.sansBold,
    fontSize: 12,
    color: colors.gray900,
  },
  sub: {
    fontFamily: typography.sansRegular,
    fontSize: 10,
    color: colors.gray400,
  },
  scoreGroup: {
    width: 118,
    alignItems: 'flex-end',
    gap: 4,
  },
  bandPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  bandText: {
    fontFamily: typography.sansBold,
    fontSize: 9,
  },
  barTrack: {
    width: '100%',
    height: 5,
    backgroundColor: colors.gray100,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  score: {
    fontFamily: typography.sansBold,
    fontSize: 11,
  },
  empty: {
    fontFamily: typography.sansRegular,
    fontSize: 12,
    color: colors.gray400,
    lineHeight: 18,
  },
});
