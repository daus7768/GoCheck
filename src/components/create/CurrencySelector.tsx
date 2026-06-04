import { useState } from 'react';
import {
  View,
  Pressable,
  Modal,
  FlatList,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import { AppText } from '../AppText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { haptic, ImpactFeedbackStyle } from '../../lib/haptics';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useWebEscape } from '../../hooks/useWebEscape';
import type { Currency } from '../../types';
import { SUPPORTED_CURRENCIES, CURRENCY_SYMBOLS, CURRENCY_LABELS } from '../../types';
import { gc, typography, fontSize, spacing, radius } from '../../theme/tokens';

const SCREEN_HEIGHT = Dimensions.get('window').height;

// Per-currency accent — purely cosmetic, gives each symbol badge a distinct hue.
const CURRENCY_TINT: Record<Currency, string> = {
  MYR: '#1D9E75',
  USD: '#10B981',
  SGD: '#6366F1',
  GBP: '#8B5CF6',
  EUR: '#3B82F6',
  AUD: '#F59E0B',
  JPY: '#EC4899',
  CNY: '#EF4444',
};

function tintBg(hex: string) {
  // hex -> rgba at low alpha for the badge background
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},0.14)`;
}

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
          style={styles.tile}
          onPress={() => {
            haptic.impact(ImpactFeedbackStyle.Light);
            setOpen(true);
          }}
          onPressIn={() => { scale.value = withSpring(0.95, { damping: 20, stiffness: 400 }); }}
          onPressOut={() => { scale.value = withSpring(1, { damping: 20, stiffness: 400 }); }}
          accessibilityRole="button"
          accessibilityLabel={`Currency: ${value}. Tap to change`}
        >
          <View style={styles.tileTop}>
            <AppText style={styles.tileSymbol} palette={[gc.text, gc.text]}>{CURRENCY_SYMBOLS[value]}</AppText>
            <Feather name="chevron-down" size={14} color={gc.muted} />
          </View>
          <AppText style={styles.tileCode} palette={[gc.primary, gc.primary]}>{value}</AppText>
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

              <View style={styles.sheetHeader}>
                <View style={styles.sheetTitleWrap}>
                  <AppText style={styles.sheetTitle}>Select Currency</AppText>
                  <AppText style={styles.sheetSub} palette={[gc.muted, gc.muted]}>
                    Used for every amount on this bill
                  </AppText>
                </View>
                <Pressable
                  onPress={() => setOpen(false)}
                  style={styles.closeBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                >
                  <Feather name="x" size={16} color={gc.muted} />
                </Pressable>
              </View>

              <FlatList
                data={SUPPORTED_CURRENCIES}
                keyExtractor={(item) => item}
                style={styles.list}
                contentContainerStyle={styles.listContent}
                renderItem={({ item }) => {
                  const selected = item === value;
                  const tint = CURRENCY_TINT[item];
                  return (
                    <Pressable
                      style={[styles.option, selected && styles.optionSelected]}
                      onPress={() => handleSelect(item)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                    >
                      <View style={styles.optionLeft}>
                        <View style={[styles.symbolWrap, { backgroundColor: tintBg(tint), borderColor: tintBg(tint) }]}>
                          <AppText style={styles.optionSymbol} palette={[tint, tint]}>{CURRENCY_SYMBOLS[item]}</AppText>
                        </View>
                        <View>
                          <AppText style={styles.optionCode} palette={selected ? [gc.text, gc.text] : undefined}>{item}</AppText>
                          <AppText style={styles.optionLabel} palette={[gc.muted, gc.muted]}>{CURRENCY_LABELS[item]}</AppText>
                        </View>
                      </View>
                      {selected ? (
                        <LinearGradient
                          colors={[gc.primary, gc.primaryMid]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.checkCircle}
                        >
                          <Feather name="check" size={14} color={gc.white} />
                        </LinearGradient>
                      ) : (
                        <View style={styles.checkPlaceholder} />
                      )}
                    </Pressable>
                  );
                }}
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
  tile: {
    width: 78,
    height: 58,
    justifyContent: 'center',
    backgroundColor: gc.surface3,
    borderWidth: 1,
    borderColor: gc.border,
    borderRadius: radius.md,
    borderLeftWidth: 2.5,
    borderLeftColor: gc.primary,
    paddingHorizontal: spacing[3],
    gap: 2,
  },
  tileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tileSymbol: {
    fontFamily: typography.monoMedium,
    fontSize: fontSize.md,
    color: gc.text,
  },
  tileCode: {
    fontFamily: typography.sansSemiBold,
    fontSize: fontSize.xs,
    color: gc.primary,
    letterSpacing: 0.5,
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
  listContent: {
    paddingBottom: spacing[1],
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: gc.surface3,
    borderRadius: radius.full,
    alignSelf: 'center',
    marginBottom: spacing[4],
    borderWidth: 1,
    borderColor: gc.border,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing[4],
  },
  sheetTitleWrap: { flex: 1 },
  sheetTitle: {
    fontFamily: typography.sansBold,
    fontSize: fontSize.lg,
    color: gc.text,
  },
  sheetSub: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.sm,
    color: gc.muted,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: gc.surface3,
    borderWidth: 1,
    borderColor: gc.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[2.5],
    paddingHorizontal: spacing[3],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  optionSelected: {
    backgroundColor: gc.primaryLight,
    borderColor: gc.borderEm,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  symbolWrap: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionSymbol: {
    fontFamily: typography.monoMedium,
    fontSize: fontSize.md,
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
  checkCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: gc.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 4,
  },
  checkPlaceholder: {
    width: 26,
    height: 26,
  },
  separator: {
    height: spacing[1],
  },
});
