import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { AppText } from '../AppText';
import { Feather } from '@expo/vector-icons';
import { format } from 'date-fns';
import { colors, typography, fontSize, spacing, radius } from '../../theme/tokens';
import type { PaymentFlowStatus, Currency } from '../../types';
import { CURRENCY_SYMBOLS } from '../../types';

interface Props {
  status: PaymentFlowStatus;
  amount: number;
  currency: Currency;
  dueDate?: string;
  organizerName: string;
  confirmedAt?: string;
  rejectedReason?: string;
}

export function StatusCard({ status, amount, currency, dueDate, organizerName, confirmedAt, rejectedReason }: Props) {
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;

  if (status === 'unpaid') {
    return (
      <View style={[styles.root, styles.unpaid]}>
        <AppText style={styles.label}>Amount due</AppText>
        <AppText style={styles.amount}>{symbol}{amount.toFixed(2)}</AppText>
        {dueDate && <AppText style={styles.sub}>Due {format(new Date(dueDate), 'EEEE, d MMM yyyy')}</AppText>}
      </View>
    );
  }

  if (status === 'pending') {
    return (
      <View style={[styles.root, styles.pending]}>
        <ActivityIndicator color="#B45309" />
        <AppText style={[styles.label, { color: '#B45309' }]}>Waiting for {organizerName} to confirm</AppText>
      </View>
    );
  }

  if (status === 'confirmed') {
    return (
      <View style={[styles.root, styles.confirmed]}>
        <Feather name="check-circle" size={32} color="#059669" />
        <AppText style={[styles.amount, { color: '#059669' }]}>Paid ✓</AppText>
        {confirmedAt && <AppText style={[styles.sub, { color: '#059669' }]}>on {format(new Date(confirmedAt), 'd MMM yyyy, HH:mm')}</AppText>}
      </View>
    );
  }

  // rejected
  return (
    <View style={[styles.root, styles.rejected]}>
      <Feather name="alert-circle" size={28} color="#DC2626" />
      <AppText style={[styles.label, { color: '#DC2626' }]}>Payment couldn't be confirmed</AppText>
      {rejectedReason && <AppText style={styles.sub}>{rejectedReason}</AppText>}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { borderRadius: radius['2xl'], padding: spacing[5], alignItems: 'center', gap: spacing[2] },
  unpaid:    { backgroundColor: '#EFF6FF' },
  pending:   { backgroundColor: '#FEF3C7' },
  confirmed: { backgroundColor: '#D1FAE5' },
  rejected:  { backgroundColor: '#FEE2E2' },
  label:  { fontFamily: typography.sansMedium, fontSize: fontSize.sm, color: colors.textSecondary },
  amount: { fontFamily: typography.sansBold, fontSize: fontSize['4xl'], color: colors.textPrimary },
  sub:    { fontFamily: typography.sansRegular, fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center' },
});
