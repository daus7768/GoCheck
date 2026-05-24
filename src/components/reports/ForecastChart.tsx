import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect, Text as SvgText, G } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { colors, typography, fontSize } from '../../theme/tokens';
import { formatCurrency } from '../../lib/reminderTemplates';
import type { ForecastMonth } from '../../lib/reportsCompute';
import type { Currency } from '../../types';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

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

function BarGroup({
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
    return {
      y: chartHeight - totalBarH * progress.value,
      height: h,
    };
  });

  const recurringProps = useAnimatedProps(() => {
    const h = recurringHeight * progress.value;
    return {
      y: chartHeight - totalBarH * progress.value + expectedHeight * progress.value,
      height: h,
    };
  });

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

export function ForecastChart({ data, currency, height = CHART_HEIGHT }: Props) {
  const progress = useSharedValue(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [svgWidth, setSvgWidth] = useState(280);

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) });
    setSelectedIndex(null);
  }, [data]);

  if (data.length === 0) return null;

  const maxValue = Math.max(...data.map((m) => m.recurring + m.expected), 1);
  const chartWidth = svgWidth - Y_AXIS_WIDTH;
  const barWidth = Math.max(4, (chartWidth - BAR_GAP * (data.length - 1)) / data.length);
  const xLabel = height + 16;

  const yLabels = [maxValue, Math.round(maxValue * 0.66), Math.round(maxValue * 0.33), 0];

  return (
    <View>
      <View
        onLayout={(e) => setSvgWidth(e.nativeEvent.layout.width)}
        style={{ width: '100%' }}
      >
        <Svg width={svgWidth} height={height + 24}>
          {yLabels.map((val, i) => (
            <SvgText
              key={i}
              x={Y_AXIS_WIDTH - 4}
              y={(height / 3) * i + 4}
              fontSize={8}
              fontFamily={typography.monoMedium}
              fill={colors.gray400}
              textAnchor="end"
            >
              {val >= 1000 ? `${Math.round(val / 1000)}k` : String(val)}
            </SvgText>
          ))}

          {data.map((month, i) => {
            const totalH = month.recurring + month.expected;
            const barH = (totalH / maxValue) * height;
            const expectedH = (month.expected / maxValue) * height;
            const recurringH = (month.recurring / maxValue) * height;
            const x = Y_AXIS_WIDTH + i * (barWidth + BAR_GAP);

            return (
              <G key={i}>
                <BarGroup
                  x={x}
                  barWidth={barWidth}
                  expectedHeight={expectedH}
                  recurringHeight={recurringH}
                  chartHeight={height}
                  isCurrent={false}
                  progress={progress}
                />
                <Rect
                  x={x}
                  y={0}
                  width={barWidth}
                  height={height}
                  fill="transparent"
                  onPress={() => setSelectedIndex(selectedIndex === i ? null : i)}
                />
                {selectedIndex === i && (
                  <G>
                    <Rect
                      x={Math.min(x - 10, svgWidth - 80)}
                      y={height - barH - 28}
                      width={72}
                      height={20}
                      rx={4}
                      fill="#1e1b4b"
                    />
                    <SvgText
                      x={Math.min(x - 10, svgWidth - 80) + 36}
                      y={height - barH - 14}
                      fontSize={9}
                      fontFamily={typography.monoMedium}
                      fill="#fff"
                      textAnchor="middle"
                    >
                      {formatCurrency(month.recurring + month.expected, currency)}
                    </SvgText>
                  </G>
                )}
                <SvgText
                  x={x + barWidth / 2}
                  y={xLabel}
                  fontSize={9}
                  fontFamily={typography.sansRegular}
                  fill={colors.gray400}
                  textAnchor="middle"
                >
                  {month.label}
                </SvgText>
              </G>
            );
          })}
        </Svg>
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: COLORS.projected }]} />
          <Text style={styles.legendLabel}>Projected</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: COLORS.recurring }]} />
          <Text style={styles.legendLabel}>Recurring</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: {
    flexDirection: 'row',
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
    color: colors.gray500,
  },
});
