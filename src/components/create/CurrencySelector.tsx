import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  FlatList,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { haptic, ImpactFeedbackStyle } from '../../lib/haptics';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import type { Currency } from '../../types';
import { SUPPORTED_CURRENCIES, CURRENCY_SYMBOLS, CURRENCY_LABELS } from '../../types';
import { colors, typography, fontSize, spacing, radius, shadow } from '../../theme/tokens';

interface Props {
  value: Currency;
  onChange: (currency: Currency) => void;
}

export function CurrencySelector({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handleSelect = (currency: Currency) => {
    haptic.selection();
    onChange(currency);
    setOpen(false);
  };

  return (
    <>
      <Animated.View style={animStyle}>
        <Pressable
          style={styles.chip}
          onPress={() => {
            haptic.impact(ImpactFeedbackStyle.Light);
            setOpen(true);
          }}
          onPressIn={() => { scale.value = withSpring(0.95, { damping: 20, stiffness: 400 }); }}
          onPressOut={() => { scale.value = withSpring(1, { damping: 20, stiffness: 400 }); }}
          accessibilityRole="button"
          accessibilityLabel={`Currency: ${value}`}
        >
          <Text style={styles.symbol}>{CURRENCY_SYMBOLS[value]}</Text>
          <Text style={styles.code}>{value}</Text>
          <Feather name="chevron-down" size={14} color={colors.textSecondary} />
        </Pressable>
      </Animated.View>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <View
            style={[styles.sheet, { paddingBottom: insets.bottom + spacing[4] }]}
            onStartShouldSetResponder={() => true}
          >
            {/* Handle */}
            <View style={styles.handle} />

            <Text style={styles.sheetTitle}>Select Currency</Text>

            <FlatList
              data={SUPPORTED_CURRENCIES}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.option, item === value && styles.optionSelected]}
                  onPress={() => handleSelect(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.optionLeft}>
                    <Text style={styles.optionSymbol}>{CURRENCY_SYMBOLS[item]}</Text>
                    <View>
                      <Text style={styles.optionCode}>{item}</Text>
                      <Text style={styles.optionLabel}>{CURRENCY_LABELS[item]}</Text>
                    </View>
                  </View>
                  {item === value && (
                    <Feather name="check" size={18} color={colors.primary} />
                  )}
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.xl,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    ...shadow.sm,
  },
  symbol: {
    fontFamily: typography.monoMedium,
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },
  code: {
    fontFamily: typography.sansSemiBold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius['3xl'],
    borderTopRightRadius: radius['3xl'],
    paddingTop: spacing[2],
    paddingHorizontal: spacing[4],
    maxHeight: '70%',
    ...shadow.lg,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.gray200,
    borderRadius: radius.full,
    alignSelf: 'center',
    marginBottom: spacing[5],
  },
  sheetTitle: {
    fontFamily: typography.sansBold,
    fontSize: fontSize.lg,
    color: colors.textPrimary,
    marginBottom: spacing[4],
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
    borderRadius: radius.lg,
  },
  optionSelected: {
    backgroundColor: colors.primarySurface,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  optionSymbol: {
    fontFamily: typography.monoMedium,
    fontSize: fontSize.xl,
    color: colors.textPrimary,
    width: 32,
    textAlign: 'center',
  },
  optionCode: {
    fontFamily: typography.sansSemiBold,
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },
  optionLabel: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 1,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginHorizontal: spacing[3],
  },
});
