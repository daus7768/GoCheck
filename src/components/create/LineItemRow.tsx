import { View, TextInput, Pressable, StyleSheet } from 'react-native';
import { AppText } from '../AppText';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { haptic, ImpactFeedbackStyle } from '../../lib/haptics';
import type { LineItem } from '../../types';
import { gc, typography, fontSize, spacing, radius } from '../../theme/tokens';

interface Props {
  item: LineItem;
  index: number;
  currencySymbol?: string;
  onUpdate: (id: string, field: keyof LineItem, value: string | number) => void;
  onRemove: (id: string) => void;
}

export function LineItemRow({ item, index, currencySymbol = 'RM', onUpdate, onRemove }: Props) {
  const subtotal = item.quantity * item.unitPrice;
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handleRemove = () => {
    haptic.impact(ImpactFeedbackStyle.Medium);
    scale.value = withTiming(0.95, { duration: 120 });
    opacity.value = withTiming(0, { duration: 200 }, (done) => {
      if (done) runOnJS(onRemove)(item.id);
    });
  };

  const incrementQty = () => {
    haptic.selection();
    onUpdate(item.id, 'quantity', item.quantity + 1);
  };

  const decrementQty = () => {
    if (item.quantity <= 1) return;
    haptic.selection();
    onUpdate(item.id, 'quantity', item.quantity - 1);
  };

  return (
    <Animated.View style={[styles.container, animStyle]}>
      {/* Row header */}
      <View style={styles.header}>
        <View style={styles.indexBadge}>
          <AppText style={styles.indexText} palette={[gc.primary, gc.primary]}>{index + 1}</AppText>
        </View>
        <TextInput
          style={styles.descInput}
          value={item.description}
          onChangeText={(v) => onUpdate(item.id, 'description', v)}
          placeholder="Item description"
          placeholderTextColor={gc.hint}
          returnKeyType="done"
          maxLength={80}
        />
        <Pressable
          onPress={handleRemove}
          style={styles.removeBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Remove line item"
        >
          <Feather name="trash-2" size={14} color={gc.danger} />
        </Pressable>
      </View>

      {/* Row controls */}
      <View style={styles.controls}>
        {/* Qty stepper */}
        <View style={styles.stepper}>
          <Pressable
            onPress={decrementQty}
            style={[styles.stepBtn, item.quantity <= 1 && styles.stepBtnDisabled]}
            disabled={item.quantity <= 1}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
          >
            <Feather name="minus" size={13} color={item.quantity <= 1 ? gc.hint : gc.text} />
          </Pressable>
          <AppText style={styles.qtyText} palette={[gc.text, gc.text]}>{item.quantity}</AppText>
          <Pressable
            onPress={incrementQty}
            style={styles.stepBtn}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
          >
            <Feather name="plus" size={13} color={gc.primary} />
          </Pressable>
        </View>

        <AppText style={styles.timesText} palette={[gc.muted, gc.muted]}>×</AppText>

        {/* Unit price */}
        <View style={styles.priceInputWrapper}>
          <AppText style={styles.priceUnit} palette={[gc.muted, gc.muted]}>{currencySymbol}</AppText>
          <TextInput
            style={styles.priceInput}
            value={item.unitPrice === 0 ? '' : String(item.unitPrice)}
            onChangeText={(v) => {
              const n = parseFloat(v) || 0;
              onUpdate(item.id, 'unitPrice', n);
            }}
            placeholder="0.00"
            placeholderTextColor={gc.hint}
            keyboardType="decimal-pad"
            returnKeyType="done"
            textAlign="right"
          />
        </View>

        {/* Subtotal */}
        <View style={styles.subtotalWrapper}>
          <AppText style={styles.equalsText} palette={[gc.muted, gc.muted]}>=</AppText>
          <AppText style={styles.subtotalText} palette={[gc.primary, gc.primary]}>
            {subtotal.toFixed(2)}
          </AppText>
        </View>
      </View>
    </Animated.View>
  );
}

export function AddLineItemButton({ onPress }: { onPress: () => void }) {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animStyle}>
      <Pressable
        style={styles.addBtn}
        onPress={() => {
          haptic.impact(ImpactFeedbackStyle.Light);
          onPress();
        }}
        onPressIn={() => { scale.value = withSpring(0.97, { damping: 20, stiffness: 400 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 20, stiffness: 400 }); }}
        accessibilityRole="button"
      >
        <View style={styles.addBtnIcon}>
          <Feather name="plus" size={16} color={gc.primary} />
        </View>
        <AppText style={styles.addBtnText} palette={[gc.primary, gc.primary]}>Add Line Item</AppText>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: gc.surface3,
    borderWidth: 1,
    borderColor: gc.border,
    borderRadius: radius.lg,
    padding: spacing[3],
    marginBottom: spacing[2],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  indexBadge: {
    width: 22,
    height: 22,
    borderRadius: radius.full,
    backgroundColor: gc.primaryLight,
    borderWidth: 1,
    borderColor: gc.borderEm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexText: {
    fontFamily: typography.sansBold,
    fontSize: 10,
    color: gc.primary,
  },
  descInput: {
    flex: 1,
    fontFamily: typography.sansRegular,
    fontSize: fontSize.base,
    color: gc.text,
    height: 36,
    borderBottomWidth: 1,
    borderBottomColor: gc.border,
    paddingBottom: spacing[1],
  },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: radius.md,
    backgroundColor: gc.dangerSurface,
    borderWidth: 1,
    borderColor: 'rgba(226,75,74,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: gc.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: gc.border,
    height: 36,
    paddingHorizontal: spacing[2],
    gap: spacing[2],
  },
  stepBtn: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnDisabled: {
    opacity: 0.4,
  },
  qtyText: {
    fontFamily: typography.monoMedium,
    fontSize: fontSize.base,
    color: gc.text,
    minWidth: 20,
    textAlign: 'center',
  },
  timesText: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.base,
    color: gc.muted,
  },
  priceInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    height: 36,
    backgroundColor: gc.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: gc.border,
    paddingHorizontal: spacing[2.5],
  },
  priceUnit: {
    fontFamily: typography.monoRegular,
    fontSize: fontSize.xs,
    color: gc.muted,
  },
  priceInput: {
    flex: 1,
    fontFamily: typography.monoMedium,
    fontSize: fontSize.base,
    color: gc.text,
    textAlign: 'right',
  },
  subtotalWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    minWidth: 72,
    justifyContent: 'flex-end',
  },
  equalsText: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.base,
    color: gc.muted,
  },
  subtotalText: {
    fontFamily: typography.monoMedium,
    fontSize: fontSize.base,
    color: gc.primary,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderWidth: 1.5,
    borderColor: gc.borderEm,
    borderStyle: 'dashed',
    borderRadius: radius.lg,
    backgroundColor: gc.primaryLight,
    justifyContent: 'center',
  },
  addBtnIcon: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    backgroundColor: gc.surface2,
    borderWidth: 1,
    borderColor: gc.borderEm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    fontFamily: typography.sansSemiBold,
    fontSize: fontSize.base,
    color: gc.primary,
  },
});
