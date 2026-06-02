import { ReactNode } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { AppText } from '../AppText';
import { Feather } from '@expo/vector-icons';
import { colors, typography, fontSize, spacing, radius } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';

interface SettingRowProps {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  sub?: string;
  right?: ReactNode;
  onPress?: () => void;
  /** Hide the bottom hairline (use on the last row of a section). */
  last?: boolean;
}

export function SettingRow({ icon, label, sub, right, onPress, last }: SettingRowProps) {
  const { colors: c } = useTheme();

  const inner = (
    <>
      <View style={[styles.iconWrap, { backgroundColor: c.primarySurface }]}>
        <Feather name={icon} size={18} color={colors.primary} />
      </View>
      <View style={styles.textWrap}>
        <AppText style={[styles.label, { color: c.textPrimary }]}>{label}</AppText>
        {sub ? (
          <AppText style={[styles.sub, { color: c.textSecondary }]} numberOfLines={1}>
            {sub}
          </AppText>
        ) : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </>
  );

  const base = [styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.divider }];

  if (onPress) {
    return (
      <Pressable
        style={({ pressed }) => [...base, pressed && { backgroundColor: c.border }]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        {inner}
      </Pressable>
    );
  }

  return <View style={base}>{inner}</View>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3.5],
    gap: spacing[3],
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: { flex: 1, minWidth: 0 },
  label: {
    fontFamily: typography.sansMedium,
    fontSize: fontSize.base,
  },
  sub: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.xs,
    marginTop: 1,
  },
  right: { marginLeft: spacing[2] },
});
