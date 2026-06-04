import { PremiumCalendar } from './PremiumCalendar';

interface Props {
  value: Date;
  minimumDate?: Date;
  onChange: (date: Date) => void;
}

export function DatePickerField(props: Props) {
  return <PremiumCalendar {...props} />;
}
