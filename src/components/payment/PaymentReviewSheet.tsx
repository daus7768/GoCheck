import { useEffect, useState } from 'react';
import {
  Modal, View, StyleSheet, Pressable, ActivityIndicator, TextInput, Alert, Image, Platform,
} from 'react-native';
import { useWebEscape } from '../../hooks/useWebEscape';
import { AppText } from '../AppText';
import { Feather } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, cancelAnimation } from 'react-native-reanimated';
import { colors, typography, fontSize, spacing, radius, shadow } from '../../theme/tokens';
import { confirmPayment, rejectPayment } from '../../lib/supabase';
import { CURRENCY_SYMBOLS, type Participant, type Currency } from '../../types';
import { AISummaryBanner, getMatchLevel } from './AISummaryBanner';

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
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

  const matchLevel = getMatchLevel(participant?.proofExtracted);
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (matchLevel === 'high') {
      pulse.value = withRepeat(withTiming(1.05, { duration: 700 }), -1, true);
    } else {
      cancelAnimation(pulse);
      pulse.value = withTiming(1);
    }
    return () => { cancelAnimation(pulse); };
  }, [matchLevel, pulse]);

  const approveAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  useEffect(() => {
    if (!participant) {
      setRejectMode(false);
      setReason('');
      setBusy(null);
    }
  }, [participant?.id]);

  useWebEscape(!!participant, onClose);
  useWebEscape(!!viewerUrl, () => setViewerUrl(null));

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

  const reviewSheet = (
    <Pressable style={styles.backdrop} onPress={onClose}>
      <Pressable style={styles.sheet} onPress={() => {}}>
        <View style={styles.handle} />
        <AppText style={styles.title}>Review payment</AppText>
        <AppText style={styles.subtitle}>
          {participant.name} • {symbol}{participant.amount.toFixed(2)}
        </AppText>

        <AISummaryBanner
          proofUrl={participant.proofUrl}
          proofSummary={participant.proofSummary}
          proofExtracted={participant.proofExtracted}
          onImageTap={setViewerUrl}
        />

        {participant.submittedAt && (
          <AppText style={styles.meta}>
            Submitted {new Date(participant.submittedAt).toLocaleString()}
          </AppText>
        )}

        {!rejectMode ? (
          <View style={styles.actions}>
            <Pressable
              style={[styles.btn, styles.rejectBtn]}
              onPress={() => setRejectMode(true)}
              disabled={busy !== null}
            >
              <Feather name="x" size={18} color="#DC2626" />
              <AppText style={[styles.btnText, { color: '#DC2626' }]}>Reject</AppText>
            </Pressable>
            <Animated.View style={[{ flex: 1 }, approveAnimatedStyle]}>
              <Pressable
                style={[styles.btn, styles.approveBtn]}
                onPress={handleApprove}
                disabled={busy !== null}
              >
                {busy === 'approve'
                  ? <ActivityIndicator color="#FFF" />
                  : <>
                      <Feather name="check" size={18} color="#FFF" />
                      <AppText style={[styles.btnText, { color: '#FFF' }]}>Approve</AppText>
                    </>}
              </Pressable>
            </Animated.View>
          </View>
        ) : (
          <View style={styles.rejectBlock}>
            <AppText style={styles.rejectLabel}>Reason</AppText>
            <TextInput
              style={styles.rejectInput}
              placeholder="e.g. Amount looks short, try again"
              value={reason}
              onChangeText={setReason}
              multiline
            />
            <View style={styles.actions}>
              <Pressable style={[styles.btn, styles.cancelBtn]} onPress={() => setRejectMode(false)}>
                <AppText style={[styles.btnText, { color: colors.textSecondary }]}>Cancel</AppText>
              </Pressable>
              <Pressable
                style={[styles.btn, styles.rejectConfirmBtn]}
                onPress={handleReject}
                disabled={busy !== null}
              >
                {busy === 'reject'
                  ? <ActivityIndicator color="#FFF" />
                  : <AppText style={[styles.btnText, { color: '#FFF' }]}>Send rejection</AppText>}
              </Pressable>
            </View>
          </View>
        )}
      </Pressable>
    </Pressable>
  );

  const imageViewer = viewerUrl ? (
    <Pressable style={styles.viewerBackdrop} onPress={() => setViewerUrl(null)}>
      <Image source={{ uri: viewerUrl }} style={styles.viewerImage} resizeMode="contain" />
      <Pressable onPress={() => setViewerUrl(null)} style={styles.viewerClose}>
        <Feather name="x" size={24} color="#FFF" />
      </Pressable>
    </Pressable>
  ) : null;

  if (Platform.OS === 'web') {
    return (
      <>
        <View style={StyleSheet.absoluteFillObject} pointerEvents="auto">
          {reviewSheet}
        </View>
        {viewerUrl && (
          <View style={StyleSheet.absoluteFillObject} pointerEvents="auto">
            {imageViewer}
          </View>
        )}
      </>
    );
  }

  return (
    <>
      <Modal animationType="slide" transparent onRequestClose={onClose}>
        {reviewSheet}
      </Modal>

      <Modal visible={!!viewerUrl} transparent animationType="fade" onRequestClose={() => setViewerUrl(null)}>
        {imageViewer}
      </Modal>
    </>
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
  viewerBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.9)',
    alignItems: 'center', justifyContent: 'center',
  },
  viewerImage: { width: '90%', height: '90%' },
  viewerClose: {
    position: 'absolute', top: 40, right: 20,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
});
