import DateTimePicker from '@react-native-community/datetimepicker';
import { Platform } from 'react-native';
import { colors } from '../../theme/tokens';

interface Props {
  value: Date;
  minimumDate?: Date;
  onChange: (date: Date) => void;
}

export function DatePickerField({ value, minimumDate, onChange }: Props) {
  return (
    <DateTimePicker
      value={value}
      mode="date"
      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
      minimumDate={minimumDate}
      onChange={(_, selected) => {
        if (selected) onChange(selected);
      }}
      accentColor={colors.primary}
      textColor={colors.textPrimary}
    />
  );
}
