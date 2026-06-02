import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Platform,
  Pressable,
  type LayoutChangeEvent,
} from 'react-native';
import { AppText } from '../AppText';
import Svg, { Rect, Text as SvgText, G } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { colors, typography } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import { formatCurrency } from '../../lib/reminderTemplates';
import type { ForecastMonth } from '../../lib/reportsCompute';
import type { Currency } from '../../types';

const AnimatedRect =
  Platform.OS !== 'web' ? Animated.createAnimatedComponent(Rect) : null;

interface Props {
  data: ForecastMonth[];
  currency: Currency;
  height?: number;
}

const CHART_HEIGHT = 100;
const Y_AXIS_WIDTH = 36;
const BAR_GAP = 5;
const COLORS = {
  projected: '#4F46E5',
  recurring: '#c7d2fe',
  projectedCurrent: '#10B981',
  recurringCurrent: '#6ee7b7',
};

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

// ── Native animated bars (Reanimated + SVG — native only) ─────────────────────

function NativeBarGroup({
  x,
  barWidth,
  expectedHeight,
  recurringHeight,
  chartHeight,
  isCurrent,
  progress,
}: {
  x: number;
  barWidth: number;
  expectedHeight: number;
  recurringHeight: number;
  chartHeight: number;
  isCurrent: boolean;
  progress: Animated.SharedValue<number>;
}) {
  const totalBarH = expectedHeight + recurringHeight;

  const projectedProps = useAnimatedProps(() => {
    const h = expectedHeight * progress.value;
    return { y: chartHeight - totalBarH * progress.value, height: h };
  });

  const recurringProps = useAnimatedProps(() => {
    const h = recurringHeight * progress.value;
    return {
      y: chartHeight - totalBarH * progress.value + expectedHeight * progress.value,
      height: h,
    };
  });

  if (!AnimatedRect) return null;

  return (
    <G>
      <AnimatedRect
        x={x}
        width={barWidth}
        rx={3}
        fill={isCurrent ? COLORS.projectedCurrent : COLORS.projected}
        animatedProps={projectedProps}
      />
      <AnimatedRect
        x={x}
        width={barWidth}
        rx={0}
        fill={isCurrent ? COLORS.recurringCurrent : COLORS.recurring}
        animatedProps={recurringProps}
      />
    </G>
  );
}

// ── Static bars (web + shared drawing) ────────────────────────────────────────

function StaticBars({
  data,
  height,
  maxValue,
  svgWidth,
  progress,
}: {
  data: ForecastMonth[];
  height: number;
  maxValue: number;
  svgWidth: number;
  progress: number;
}) {
  const chartWidth = svgWidth - Y_AXIS_WIDTH;
  const barWidth = Math.max(4, (chartWidth - BAR_GAP * (data.length - 1)) / data.length);

  return (
    <>
      {data.map((month, i) => {
        const expectedH = (month.expected / maxValue) * height * progress;
        const recurringH = (month.recurring / maxValue) * height * progress;
        const x = Y_AXIS_WIDTH + i * (barWidth + BAR_GAP);
        const isCurrent = i === 0;

        return (
          <G key={i}>
            <Rect
              x={x}
              width={barWidth}
              rx={3}
              fill={isCurrent ? COLORS.projectedCurrent : COLORS.projected}
              y={height - expectedH - recurringH}
              height={expectedH}
            />
            <Rect
              x={x}
              width={barWidth}
              rx={0}
              fill={isCurrent ? COLORS.recurringCurrent : COLORS.recurring}
              y={height - recurringH}
              height={recurringH}
            />
          </G>
        );
      })}
    </>
  );
}

function ChartTooltip({
  label,
  top,
  left,
}: {
  label: string;
  top: number;
  left: number;
}) {
  return (
    <View
      style={[
        styles.tooltip,
        { top: Math.max(4, top), left: Math.max(Y_AXIS_WIDTH, left) },
      ]}
      pointerEvents="none"
    >
      <AppText style={styles.tooltipText}>{label}</AppText>
    </View>
  );
}

export function ForecastChart({ data, currency, height = CHART_HEIGHT }: Props) {
  const { colors: c } = useTheme();
  const isWeb = Platform.OS === 'web';
  const nativeProgress = useSharedValue(0);
  const [webProgress, setWebProgress] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [svgWidth, setSvgWidth] = useState(280);

  const runWebAnimation = useCallback(() => {
    const duration = 400;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setWebProgress(easeOutCubic(t));
      if (t < 1) requestAnimationFrame(tick);
    };
    setWebProgress(0);
    requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    setSelectedIndex(null);
    if (isWeb) {
      runWebAnimation();
    } else {
      nativeProgress.value = 0;
      nativeProgress.value = withTiming(1, {
        duration: 400,
        easing: Easing.out(Easing.cubic),
      });
    }
  }, [data, isWeb, runWebAnimation, nativeProgress]);

  const onLayout = (e: LayoutChangeEvent) => {
    setSvgWidth(e.nativeEvent.layout.width);
  };

  if (data.length === 0) return null;

  const maxValue = Math.max(...data.map((m) => m.recurring + m.expected), 1);
  const chartWidth = svgWidth - Y_AXIS_WIDTH;
  const barWidth = Math.max(4, (chartWidth - BAR_GAP * (data.length - 1)) / data.length);
  const xLabel = height + 16;
  const progress = isWeb ? webProgress : 1;
  const yLabels = [maxValue, Math.round(maxValue * 0.66), Math.round(maxValue * 0.33), 0];

  const handleBarPress = (index: number) => {
    setSelectedIndex((prev) => (prev === index ? null : index));
  };

  const selectedMonth = selectedIndex !== null ? data[selectedIndex] : null;
  const tooltipTop =
    selectedIndex !== null && selectedMonth
      ? height -
        ((selectedMonth.recurring + selectedMonth.expected) / maxValue) * height -
        36
      : 0;
  const tooltipLeft =
    selectedIndex !== null
      ? Y_AXIS_WIDTH + selectedIndex * (barWidth + BAR_GAP) + barWidth / 2 - 40
      : 0;

  return (
    <View>
      <View onLayout={onLayout} style={styles.chartWrap}>
        <Svg width={svgWidth} height={height + 24}>
          {yLabels.map((val, i) => (
            <SvgText
              key={i}
              x={Y_AXIS_WIDTH - 4}
              y={(height / 3) * i + 4}
              fontSize={8}
              fontFamily={typography.monoMedium}
              fill={c.textSecondary}
              textAnchor="end"
            >
              {val >= 1000 ? `${Math.round(val / 1000)}k` : String(val)}
            </SvgText>
          ))}

          {isWeb ? (
            <StaticBars
              data={data}
              height={height}
              maxValue={maxValue}
              svgWidth={svgWidth}
              progress={progress}
            />
          ) : (
            data.map((month, i) => {
              const expectedH = (month.expected / maxValue) * height;
              const recurringH = (month.recurring / maxValue) * height;
              const x = Y_AXIS_WIDTH + i * (barWidth + BAR_GAP);
              return (
                <G key={i}>
                  <NativeBarGroup
                    x={x}
                    barWidth={barWidth}
                    expectedHeight={expectedH}
                    recurringHeight={recurringH}
                    chartHeight={height}
                    isCurrent={i === 0}
                    progress={nativeProgress}
                  />
                  <SvgText
                    x={x + barWidth / 2}
                    y={xLabel}
                    fontSize={9}
                    fontFamily={typography.sansRegular}
                    fill={c.textSecondary}
                    textAnchor="middle"
                  >
                    {month.label}
                  </SvgText>
                </G>
              );
            })
          )}

          {isWeb &&
            data.map((month, i) => {
              const x = Y_AXIS_WIDTH + i * (barWidth + BAR_GAP);
              return (
                <SvgText
                  key={`label-${i}`}
                  x={x + barWidth / 2}
                  y={xLabel}
                  fontSize={9}
                  fontFamily={typography.sansRegular}
                  fill={selectedIndex === i ? colors.primary : c.textSecondary}
                  textAnchor="middle"
                >
                  {month.label}
                </SvgText>
              );
            })}
        </Svg>

        {/* RN Pressables — avoids SVG onPress / Reanimated on DOM */}
        <View
          style={[styles.touchLayer, { height, left: Y_AXIS_WIDTH, width: chartWidth }]}
        >
          {data.map((_, i) => (
            <Pressable
              key={i}
              style={({ pressed }) => [
                styles.touchCol,
                { width: barWidth + (i < data.length - 1 ? BAR_GAP : 0) },
                pressed && styles.touchColPressed,
                selectedIndex === i && styles.touchColSelected,
              ]}
              onPress={() => handleBarPress(i)}
              accessibilityRole="button"
              accessibilityLabel={`${data[i]!.label} forecast`}
            />
          ))}
        </View>

        {selectedMonth && selectedIndex !== null && (
          <ChartTooltip
            label={formatCurrency(
              selectedMonth.recurring + selectedMonth.expected,
              currency
            )}
            top={tooltipTop}
            left={tooltipLeft}
          />
        )}
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: COLORS.projected }]} />
          <AppText style={[styles.legendLabel, { color: c.textSecondary }]}>Projected</AppText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: COLORS.recurring }]} />
          <AppText style={[styles.legendLabel, { color: c.textSecondary }]}>Recurring</AppText>
        </View>
        <AppText style={[styles.legendHint, { color: c.textSecondary }]}>Tap a bar for details</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chartWrap: {
    width: '100%',
    position: 'relative',
  },
  touchLayer: {
    position: 'absolute',
    top: 0,
    flexDirection: 'row',
  },
  touchCol: {
    height: '100%',
    borderRadius: 4,
  },
  touchColPressed: {
    backgroundColor: 'rgba(79, 70, 229, 0.06)',
  },
  touchColSelected: {
    backgroundColor: 'rgba(79, 70, 229, 0.1)',
  },
  tooltip: {
    position: 'absolute',
    backgroundColor: '#1e1b4b',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    minWidth: 72,
    alignItems: 'center',
    zIndex: 10,
    ...Platform.select({
      web: { boxShadow: '0 4px 12px rgba(0,0,0,0.15)' } as object,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 4,
      },
    }),
  },
  tooltipText: {
    fontFamily: typography.monoMedium,
    fontSize: 10,
    color: '#fff',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
    marginBottom: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
  legendLabel: {
    fontFamily: typography.sansRegular,
    fontSize: 10,
  },
  legendHint: {
    fontFamily: typography.sansRegular,
    fontSize: 10,
    marginLeft: 'auto',
  },
});
