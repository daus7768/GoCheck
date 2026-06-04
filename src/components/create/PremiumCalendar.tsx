import { useEffect, useState } from 'react';
import { View, Pressable, StyleSheet, Text, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn } from 'react-native-reanimated';
import {
  startOfMonth,
  startOfDay,
  getDaysInMonth,
  getDay,
  setDate,
  isSameDay,
  isBefore,
  isAfter,
  addMonths,
  subMonths,
  format,
} from 'date-fns';
import { haptic, ImpactFeedbackStyle } from '../../lib/haptics';
import { gc, typography } from '../../theme/tokens';

interface Props {
  value: Date;
  minimumDate?: Date;
  onChange: (date: Date) => void;
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/**
 * A premium, fully-custom month calendar built from RN primitives so it looks
 * identical on web + native (no raw browser <input type="date">). Dark teal
 * theme to match the Create Bill surfaces.
 */
export function PremiumCalendar({ value, minimumDate, onChange }: Props) {
  const [viewMonth, setViewMonth] = useState<Date>(startOfMonth(value));

  // Jump the view to the month of the selected value when it changes externally
  // (e.g. the 3d / 7d / 14d / 30d preset chips).
  useEffect(() => {
    setViewMonth(startOfMonth(value));
  }, [value]);

  const today = new Date();
  const minDay = minimumDate ? startOfDay(minimumDate) : undefined;

  const leadingBlanks = getDay(startOfMonth(viewMonth)); // 0 (Sun) .. 6 (Sat)
  const daysInMonth = getDaysInMonth(viewMonth);

  const canGoPrev = !minDay || isAfter(startOfMonth(viewMonth), startOfMonth(minDay));

  const goPrev = () => {
    if (!canGoPrev) return;
    haptic.impact(ImpactFeedbackStyle.Light);
    setViewMonth((m) => subMonths(m, 1));
  };
  const goNext = () => {
    haptic.impact(ImpactFeedbackStyle.Light);
    setViewMonth((m) => addMonths(m, 1));
  };

  const cells: (Date | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => setDate(viewMonth, i + 1)),
  ];

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={goPrev}
          disabled={!canGoPrev}
          style={[styles.navBtn, !canGoPrev && styles.navBtnDisabled]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
        >
          <Feather name="chevron-left" size={18} color={canGoPrev ? gc.text : gc.hint} />
        </Pressable>

        <Text style={styles.monthLabel}>{format(viewMonth, 'MMMM yyyy')}</Text>

        <Pressable
          onPress={goNext}
          style={styles.navBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Next month"
        >
          <Feather name="chevron-right" size={18} color={gc.text} />
        </Pressable>
      </View>

      {/* Weekday row */}
      <View style={styles.weekRow}>
        {WEEKDAYS.map((d, i) => (
          <View key={i} style={styles.weekCell}>
            <Text style={[styles.weekText, (i === 0 || i === 6) && styles.weekTextEnd]}>{d}</Text>
          </View>
        ))}
      </View>

      {/* Day grid */}
      <Animated.View key={format(viewMonth, 'yyyy-MM')} entering={FadeIn.duration(220)} style={styles.grid}>
        {cells.map((date, i) => {
          if (!date) return <View key={`b${i}`} style={styles.dayCell} />;

          const selected = isSameDay(date, value);
          const isToday = isSameDay(date, today);
          const disabled = minDay ? isBefore(startOfDay(date), minDay) : false;
          const dayNum = date.getDate();

          return (
            <View key={date.toISOString()} style={styles.dayCell}>
              <Pressable
                disabled={disabled}
                onPress={() => { haptic.selection(); onChange(date); }}
                style={styles.dayPressable}
                accessibilityRole="button"
                accessibilityState={{ selected, disabled }}
                accessibilityLabel={format(date, 'EEEE, d MMMM yyyy')}
              >
                {selected ? (
                  <LinearGradient
                    colors={[gc.primary, gc.primaryMid]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.dayCircleSelected}
                  >
                    <Text style={styles.dayTextSelected}>{dayNum}</Text>
                  </LinearGradient>
                ) : (
                  <View style={[styles.dayCircle, isToday && styles.dayCircleToday]}>
                    <Text
                      style={[
                        styles.dayText,
                        disabled && styles.dayTextDisabled,
                        isToday && styles.dayTextToday,
                      ]}
                    >
                      {dayNum}
                    </Text>
                    {isToday && <View style={styles.todayDot} />}
                  </View>
                )}
              </Pressable>
            </View>
          );
        })}
      </Animated.View>
    </View>
  );
}

const CIRCLE = 38;

const styles = StyleSheet.create({
  card: {
    backgroundColor: gc.surface3,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: gc.border,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
    marginTop: 12,
    ...Platform.select({
      ios: {
        shadowColor: gc.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.18,
        shadowRadius: 16,
      },
      android: { elevation: 6 },
      default: {},
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  navBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: gc.surface2,
    borderWidth: 1,
    borderColor: gc.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnDisabled: { opacity: 0.35 },
  monthLabel: {
    fontFamily: typography.sansBold,
    fontSize: 16,
    color: gc.text,
    letterSpacing: 0.2,
  },
  weekRow: {
    flexDirection: 'row',
    marginTop: 4,
    marginBottom: 2,
  },
  weekCell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    paddingVertical: 6,
  },
  weekText: {
    fontFamily: typography.sansMedium,
    fontSize: 11,
    color: gc.muted,
    letterSpacing: 0.5,
  },
  weekTextEnd: { color: gc.hint },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayPressable: {
    width: CIRCLE,
    height: CIRCLE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleToday: {
    borderWidth: 1,
    borderColor: gc.borderEm,
    backgroundColor: gc.primaryLight,
  },
  dayCircleSelected: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: gc.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.55,
    shadowRadius: 8,
    elevation: 6,
  },
  dayText: {
    fontFamily: typography.sansMedium,
    fontSize: 15,
    color: gc.text,
  },
  dayTextDisabled: { color: gc.hint },
  dayTextToday: { color: gc.primary, fontFamily: typography.sansBold },
  dayTextSelected: {
    fontFamily: typography.sansBold,
    fontSize: 15,
    color: gc.white,
  },
  todayDot: {
    position: 'absolute',
    bottom: 5,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: gc.primary,
  },
});
