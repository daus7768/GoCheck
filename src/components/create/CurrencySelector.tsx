import { useState } from 'react';
import {
  View,
  Pressable,
  Modal,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import { AppText } from '../AppText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { haptic, ImpactFeedbackStyle } from '../../lib/haptics';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useWebEscape } from '../../hooks/useWebEscape';
import type { Currency } from '../../types';
import { SUPPORTED_CURRENCIES, CURRENCY_SYMBOLS, CURRENCY_LABELS } from '../../types';
import { gc, typography, fontSize, spacing, radius } from '../../theme/tokens';

const SCREEN_HEIGHT = Dimensions.get('window').height;

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

  useWebEscape(open, () => setOpen(false));

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
          <AppText style={styles.symbol}>{CURRENCY_SYMBOLS[value]}</AppText>
          <AppText style={styles.code}>{value}</AppText>
          <Feather name="chevron-down" size={14} color={gc.muted} />
        </Pressable>
      </Animated.View>

      {(() => {
        const sheetContent = (
          <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
            <View
              style={[styles.sheet, { paddingBottom: insets.bottom + spacing[4], maxHeight: SCREEN_HEIGHT * 0.82 }]}
              onStartShouldSetResponder={() => true}
            >
              <View style={styles.handle} />

              <AppText style={styles.sheetTitle}>Select Currency</AppText>

              <FlatList
                data={SUPPORTED_CURRENCIES}
                keyExtractor={(item) => item}
                style={styles.list}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.option, item === value && styles.optionSelected]}
                    onPress={() => handleSelect(item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.optionLeft}>
                      <View style={styles.symbolWrap}>
                        <AppText style={styles.optionSymbol}>{CURRENCY_SYMBOLS[item]}</AppText>
                      </View>
                      <View>
                        <AppText style={styles.optionCode}>{item}</AppText>
                        <AppText style={styles.optionLabel}>{CURRENCY_LABELS[item]}</AppText>
                      </View>
                    </View>
                    {item === value && (
                      <Feather name="check" size={18} color={gc.primary} />
                    )}
                  </TouchableOpacity>
                )}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                showsVerticalScrollIndicator={false}
                bounces={false}
              />
            </View>
          </Pressable>
        );

        if (Platform.OS === 'web') {
          if (!open) return null;
          return (
            <View style={StyleSheet.absoluteFillObject} pointerEvents="auto">
              {sheetContent}
            </View>
          );
        }

        return (
          <Modal
            visible={open}
            transparent
            animationType="slide"
            onRequestClose={() => setOpen(false)}
            statusBarTranslucent
          >
            {sheetContent}
          </Modal>
        );
      })()}
    </>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    backgroundColor: gc.surface3,
    borderWidth: 1.5,
    borderColor: gc.border,
    borderRadius: radius.xl,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  symbol: {
    fontFamily: typography.monoMedium,
    fontSize: fontSize.base,
    color: gc.text,
  },
  code: {
    fontFamily: typography.sansSemiBold,
    fontSize: fontSize.sm,
    color: gc.text,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: gc.surface2,
    borderTopLeftRadius: radius['3xl'],
    borderTopRightRadius: radius['3xl'],
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: gc.border,
    paddingTop: spacing[2],
    paddingHorizontal: spacing[4],
    width: '100%',
  },
  list: {
    flexGrow: 0,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: gc.surface3,
    borderRadius: radius.full,
    alignSelf: 'center',
    marginBottom: spacing[5],
    borderWidth: 1,
    borderColor: gc.border,
  },
  sheetTitle: {
    fontFamily: typography.sansBold,
    fontSize: fontSize.lg,
    color: gc.text,
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
    backgroundColor: gc.primaryLight,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  symbolWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: gc.surface3,
    borderWidth: 1,
    borderColor: gc.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionSymbol: {
    fontFamily: typography.monoMedium,
    fontSize: fontSize.lg,
    color: gc.text,
  },
  optionCode: {
    fontFamily: typography.sansSemiBold,
    fontSize: fontSize.base,
    color: gc.text,
  },
  optionLabel: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.sm,
    color: gc.muted,
    marginTop: 1,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: gc.border,
    marginHorizontal: spacing[3],
  },
});
