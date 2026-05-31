import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
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
        <Text style={styles.label}>Amount due</Text>
        <Text style={styles.amount}>{symbol}{amount.toFixed(2)}</Text>
        {dueDate && <Text style={styles.sub}>Due {format(new Date(dueDate), 'EEEE, d MMM yyyy')}</Text>}
      </View>
    );
  }

  if (status === 'pending') {
    return (
      <View style={[styles.root, styles.pending]}>
        <ActivityIndicator color="#B45309" />
        <Text style={[styles.label, { color: '#B45309' }]}>Waiting for {organizerName} to confirm</Text>
      </View>
    );
  }

  if (status === 'confirmed') {
    return (
      <View style={[styles.root, styles.confirmed]}>
        <Feather name="check-circle" size={32} color="#059669" />
        <Text style={[styles.amount, { color: '#059669' }]}>Paid ✓</Text>
        {confirmedAt && <Text style={[styles.sub, { color: '#059669' }]}>on {format(new Date(confirmedAt), 'd MMM yyyy, HH:mm')}</Text>}
      </View>
    );
  }

  // rejected
  return (
    <View style={[styles.root, styles.rejected]}>
      <Feather name="alert-circle" size={28} color="#DC2626" />
      <Text style={[styles.label, { color: '#DC2626' }]}>Payment couldn't be confirmed</Text>
      {rejectedReason && <Text style={styles.sub}>{rejectedReason}</Text>}
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
