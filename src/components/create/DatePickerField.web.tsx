import { useRef } from 'react';
import { Pressable, View } from 'react-native';
import { format } from 'date-fns';
import { colors, radius, spacing } from '../../theme/tokens';

interface Props {
  value: Date;
  minimumDate?: Date;
  onChange: (date: Date) => void;
}

export function DatePickerField({ value, minimumDate, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const minStr = minimumDate ? format(minimumDate, 'yyyy-MM-dd') : undefined;
  const valueStr = format(value, 'yyyy-MM-dd');

  return (
    <View>
      <input
        ref={inputRef}
        type="date"
        value={valueStr}
        min={minStr}
        onChange={(e) => {
          if (e.target.value) onChange(new Date(e.target.value + 'T00:00:00'));
        }}
        style={{
          width: '100%',
          padding: '12px 16px',
          borderRadius: radius.xl,
          border: `1.5px solid ${colors.border}`,
          fontSize: 15,
          fontFamily: 'DMSans_400Regular, sans-serif',
          color: colors.textPrimary,
          backgroundColor: colors.surface,
          outline: 'none',
          cursor: 'pointer',
          boxSizing: 'border-box',
          accentColor: colors.primary,
        } as React.CSSProperties}
      />
    </View>
  );
}
