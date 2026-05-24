import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
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
import { colors, typography, fontSize, spacing, radius } from '../../theme/tokens';

interface Props {
  item: LineItem;
  index: number;
  onUpdate: (id: string, field: keyof LineItem, value: string | number) => void;
  onRemove: (id: string) => void;
}

export function LineItemRow({ item, index, onUpdate, onRemove }: Props) {
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
          <Text style={styles.indexText}>{index + 1}</Text>
        </View>
        <TextInput
          style={styles.descInput}
          value={item.description}
          onChangeText={(v) => onUpdate(item.id, 'description', v)}
          placeholder="Item description"
          placeholderTextColor={colors.textTertiary}
          returnKeyType="done"
          maxLength={80}
        />
        <Pressable
          onPress={handleRemove}
          style={styles.removeBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Remove line item"
        >
          <Feather name="trash-2" size={14} color={colors.error} />
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
            <Feather name="minus" size={12} color={item.quantity <= 1 ? colors.textDisabled : colors.textSecondary} />
          </Pressable>
          <Text style={styles.qtyText}>{item.quantity}</Text>
          <Pressable
            onPress={incrementQty}
            style={styles.stepBtn}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
          >
            <Feather name="plus" size={12} color={colors.textSecondary} />
          </Pressable>
        </View>

        <Text style={styles.timesText}>×</Text>

        {/* Unit price */}
        <View style={styles.priceInputWrapper}>
          <TextInput
            style={styles.priceInput}
            value={item.unitPrice === 0 ? '' : String(item.unitPrice)}
            onChangeText={(v) => {
              const n = parseFloat(v) || 0;
              onUpdate(item.id, 'unitPrice', n);
            }}
            placeholder="0.00"
            placeholderTextColor={colors.textTertiary}
            keyboardType="decimal-pad"
            returnKeyType="done"
          />
        </View>

        {/* Subtotal */}
        <View style={styles.subtotalWrapper}>
          <Text style={styles.equalsText}>=</Text>
          <Text style={styles.subtotalText}>
            {subtotal.toFixed(2)}
          </Text>
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
          <Feather name="plus" size={16} color={colors.primary} />
        </View>
        <Text style={styles.addBtnText}>Add Line Item</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing[3],
    marginBottom: spacing[2],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[2],
  },
  indexBadge: {
    width: 22,
    height: 22,
    borderRadius: radius.full,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexText: {
    fontFamily: typography.sansBold,
    fontSize: 10,
    color: colors.primary,
  },
  descInput: {
    flex: 1,
    fontFamily: typography.sansRegular,
    fontSize: fontSize.base,
    color: colors.textPrimary,
    height: 36,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing[1],
  },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: radius.md,
    backgroundColor: colors.errorSurface,
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
    backgroundColor: colors.gray50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    height: 34,
    paddingHorizontal: spacing[2],
    gap: spacing[2],
  },
  stepBtn: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnDisabled: {
    opacity: 0.4,
  },
  qtyText: {
    fontFamily: typography.monoMedium,
    fontSize: fontSize.base,
    color: colors.textPrimary,
    minWidth: 20,
    textAlign: 'center',
  },
  timesText: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.base,
    color: colors.textSecondary,
  },
  priceInputWrapper: {
    flex: 1,
    height: 34,
    backgroundColor: colors.gray50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    paddingHorizontal: spacing[2],
  },
  priceInput: {
    fontFamily: typography.monoRegular,
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },
  subtotalWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    minWidth: 70,
  },
  equalsText: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.base,
    color: colors.textSecondary,
  },
  subtotalText: {
    fontFamily: typography.monoMedium,
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderWidth: 1.5,
    borderColor: colors.primaryBorder,
    borderStyle: 'dashed',
    borderRadius: radius.lg,
    justifyContent: 'center',
  },
  addBtnIcon: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    fontFamily: typography.sansSemiBold,
    fontSize: fontSize.base,
    color: colors.primary,
  },
});
