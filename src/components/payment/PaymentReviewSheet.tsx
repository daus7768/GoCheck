import { useEffect, useState } from 'react';
import {
  Modal, View, Text, StyleSheet, Pressable, ActivityIndicator, TextInput, Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, typography, fontSize, spacing, radius, shadow } from '../../theme/tokens';
import { confirmPayment, rejectPayment } from '../../lib/supabase';
import { CURRENCY_SYMBOLS, type Participant, type Currency } from '../../types';

interface Props {
  participant: Participant | null;
  currency: Currency;
  onClose: () => void;
  onChanged: () => void;
}

export function PaymentReviewSheet({ participant, currency, onClose, onChanged }: Props) {
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [rejectMode, setRejectMode] = useState(false);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!participant) {
      setRejectMode(false);
      setReason('');
      setBusy(null);
    }
  }, [participant?.id]);

  if (!participant) return null;

  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;

  const handleApprove = async () => {
    setBusy('approve');
    try {
      await confirmPayment(participant.id);
      onChanged();
      onClose();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not approve.');
    } finally {
      setBusy(null);
    }
  };

  const handleReject = async () => {
    if (reason.trim().length === 0) {
      Alert.alert('Reason needed', 'Tell the participant why you are rejecting.');
      return;
    }
    setBusy('reject');
    try {
      await rejectPayment(participant.id, reason.trim());
      onChanged();
      onClose();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not reject.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <Text style={styles.title}>Review payment</Text>
          <Text style={styles.subtitle}>
            {participant.name} • {symbol}{participant.amount.toFixed(2)}
          </Text>

          {participant.submittedAt && (
            <Text style={styles.meta}>
              Submitted {new Date(participant.submittedAt).toLocaleString()}
            </Text>
          )}

          {!rejectMode ? (
            <View style={styles.actions}>
              <Pressable
                style={[styles.btn, styles.rejectBtn]}
                onPress={() => setRejectMode(true)}
                disabled={busy !== null}
              >
                <Feather name="x" size={18} color="#DC2626" />
                <Text style={[styles.btnText, { color: '#DC2626' }]}>Reject</Text>
              </Pressable>
              <Pressable
                style={[styles.btn, styles.approveBtn]}
                onPress={handleApprove}
                disabled={busy !== null}
              >
                {busy === 'approve'
                  ? <ActivityIndicator color="#FFF" />
                  : <>
                      <Feather name="check" size={18} color="#FFF" />
                      <Text style={[styles.btnText, { color: '#FFF' }]}>Approve</Text>
                    </>}
              </Pressable>
            </View>
          ) : (
            <View style={styles.rejectBlock}>
              <Text style={styles.rejectLabel}>Reason</Text>
              <TextInput
                style={styles.rejectInput}
                placeholder="e.g. Amount looks short, try again"
                value={reason}
                onChangeText={setReason}
                multiline
              />
              <View style={styles.actions}>
                <Pressable style={[styles.btn, styles.cancelBtn]} onPress={() => setRejectMode(false)}>
                  <Text style={[styles.btnText, { color: colors.textSecondary }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.btn, styles.rejectConfirmBtn]}
                  onPress={handleReject}
                  disabled={busy !== null}
                >
                  {busy === 'reject'
                    ? <ActivityIndicator color="#FFF" />
                    : <Text style={[styles.btnText, { color: '#FFF' }]}>Send rejection</Text>}
                </Pressable>
              </View>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFF', borderTopLeftRadius: radius['3xl'], borderTopRightRadius: radius['3xl'], padding: spacing[5], gap: spacing[3], ...shadow.lg },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.gray200 },
  title: { fontFamily: typography.sansBold, fontSize: fontSize.lg, color: colors.textPrimary },
  subtitle: { fontFamily: typography.sansMedium, fontSize: fontSize.base, color: colors.textSecondary },
  meta: { fontFamily: typography.sansRegular, fontSize: fontSize.xs, color: colors.textSecondary },
  actions: { flexDirection: 'row', gap: spacing[3], marginTop: spacing[2] },
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2], paddingVertical: spacing[3.5], borderRadius: radius.xl },
  approveBtn: { backgroundColor: '#059669' },
  rejectBtn:  { backgroundColor: '#FEE2E2' },
  cancelBtn:  { backgroundColor: colors.gray100 },
  rejectConfirmBtn: { backgroundColor: '#DC2626' },
  btnText: { fontFamily: typography.sansSemiBold, fontSize: fontSize.base },
  rejectBlock: { gap: spacing[2] },
  rejectLabel: { fontFamily: typography.sansBold, fontSize: fontSize.xs, color: colors.textSecondary, letterSpacing: 1, textTransform: 'uppercase' },
  rejectInput: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing[3], minHeight: 80, fontFamily: typography.sansRegular, fontSize: fontSize.sm, color: colors.textPrimary, textAlignVertical: 'top' },
});
