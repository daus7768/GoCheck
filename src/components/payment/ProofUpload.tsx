import { useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator, Image, Alert, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors, typography, fontSize, spacing, radius } from '../../theme/tokens';
import { scanPaymentProof, clearPaymentProof, supabase } from '../../lib/supabase';
import { ColourfulText } from '../effects/ColourfulText';
import type { ProofExtraction } from '../../types';

interface Props {
  token: string;
  organizerName: string;
  proofUrl?: string;
  proofSummary?: string;
  proofExtracted?: ProofExtraction;
  onChanged: () => void;
}

type UiState = 'idle' | 'uploading' | 'attached';
const gridLines = Array.from({ length: 8 }, (_, index) => index);

export function ProofUpload({ token, organizerName, proofUrl, proofSummary, proofExtracted, onChanged }: Props) {
  const [busy, setBusy] = useState<'upload' | 'clear' | null>(null);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [thumbExpiresAt, setThumbExpiresAt] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const uiState: UiState = busy === 'upload' ? 'uploading' : proofUrl ? 'attached' : 'idle';

  // Generate a fresh signed URL for the proof thumbnail (60s TTL)
  const getThumb = useCallback(async () => {
    if (!proofUrl) return null;
    if (thumbUrl && Date.now() < thumbExpiresAt) return thumbUrl;
    const { data, error } = await supabase.storage.from('payment-proofs').createSignedUrl(proofUrl, 60);
    if (error || !data) return null;
    setThumbUrl(data.signedUrl);
    setThumbExpiresAt(Date.now() + 55_000);
    return data.signedUrl;
  }, [proofUrl, thumbUrl, thumbExpiresAt]);

  // Whenever proofUrl changes (parent reloaded), refresh the thumb
  if (proofUrl && !thumbUrl) { void getThumb(); }

  // ── Image picking ─────────────────────────────────────────────────────────
  const handleScan = useCallback(async (base64: string, mimeType: 'image/jpeg' | 'image/png' | 'image/webp') => {
    setBusy('upload');
    try {
      const res = await scanPaymentProof(token, base64, mimeType);
      if (!res.success) {
        Alert.alert('Scan failed', res.error);
      }
      // Always reload — even on failure, the parent may want to clear stale state.
      onChanged();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not upload');
    } finally {
      setBusy(null);
    }
  }, [token, onChanged]);

  const handlePickWeb = () => fileInputRef.current?.click();

  const readWebFile = useCallback((file: File) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      Alert.alert('Wrong format', 'JPG, PNG, or WebP only');
      return;
    }
    if (file.size > 4_000_000) {
      Alert.alert('Image too large', 'Max 4 MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1] ?? '';
      void handleScan(base64, file.type as 'image/jpeg' | 'image/png' | 'image/webp');
    };
    reader.readAsDataURL(file);
  }, [handleScan]);

  const handleWebFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    readWebFile(file);
    e.target.value = '';
  };

  const webDropProps = Platform.OS === 'web' ? {
    onDragOver: (event: any) => {
      event.preventDefault();
      setDragActive(true);
    },
    onDragLeave: (event: any) => {
      event.preventDefault();
      setDragActive(false);
    },
    onDrop: (event: any) => {
      event.preventDefault();
      setDragActive(false);
      const file = event.dataTransfer?.files?.[0];
      if (file) readWebFile(file);
    },
  } : {};

  const handlePickMobile = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'GoCheck needs photo access to attach proof.');
      return;
    }
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      base64: true,
      allowsEditing: true,
    });
    if (r.canceled || !r.assets?.[0]) return;
    const a = r.assets[0];
    if (!a.base64) {
      Alert.alert('Error', 'Could not read image');
      return;
    }
    // Determine MIME from URI extension
    const ext = a.uri.toLowerCase().match(/\.(jpe?g|png|webp)(\?|$)/)?.[1];
    const mime: 'image/jpeg' | 'image/png' | 'image/webp' =
      ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    void handleScan(a.base64, mime);
  };

  const handleClear = async () => {
    setBusy('clear');
    try {
      await clearPaymentProof(token);
      setThumbUrl(null);
      onChanged();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not clear');
    } finally {
      setBusy(null);
    }
  };

  // ── Variant helpers ──────────────────────────────────────────────────────
  const variant = (() => {
    if (!proofUrl) return 'idle' as const;
    if (busy === 'upload') return 'uploading' as const;
    if (!proofExtracted) return 'unread' as const;
    if (proofExtracted.confidence < 0.7) return 'unread' as const;
    return proofExtracted.matchesExpected ? 'match' : 'mismatch';
  })();

  const variantTint =
    variant === 'match'    ? { bg: '#D1FAE5', icon: '#059669', label: '#065F46' } :
    variant === 'mismatch' ? { bg: '#FEF3C7', icon: '#B45309', label: '#92400E' } :
    variant === 'unread'   ? { bg: colors.gray100, icon: colors.textSecondary, label: colors.textPrimary } :
                             { bg: colors.gray50, icon: colors.textSecondary, label: colors.textPrimary };

  const variantIcon: keyof typeof Feather.glyphMap =
    variant === 'match'    ? 'check-circle' :
    variant === 'mismatch' ? 'alert-triangle' :
                             'info';

  // ── Render ───────────────────────────────────────────────────────────────
  if (uiState === 'idle') {
    return (
      <View style={[styles.root, styles.uploadRoot]}>
        <View style={styles.uploadHeader}>
          <View>
            <Text style={styles.label}>ATTACH PROOF OF PAYMENT</Text>
            <Text style={styles.hint}>Optional, but helps {organizerName} confirm faster</Text>
          </View>
          <View style={styles.fileChip}>
            <Text style={styles.fileChipText}>JPG PNG WebP</Text>
          </View>
        </View>
        {Platform.OS === 'web' && (
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleWebFile}
            style={{ display: 'none' }}
          />
        )}
        <Pressable
          {...webDropProps}
          onPress={Platform.OS === 'web' ? handlePickWeb : handlePickMobile}
          style={({ pressed }) => [
            styles.uploadDropzone,
            dragActive && styles.uploadDropzoneActive,
            pressed && styles.uploadDropzonePressed,
          ]}
        >
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(99,102,241,0)', 'rgba(99,102,241,0.16)', 'rgba(45,212,191,0.14)', 'rgba(99,102,241,0)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[styles.dropBeam, styles.dropBeamOne]}
          />
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(245,158,11,0)', 'rgba(245,158,11,0.12)', 'rgba(14,165,233,0.12)', 'rgba(245,158,11,0)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[styles.dropBeam, styles.dropBeamTwo]}
          />
          <View pointerEvents="none" style={styles.gridBackdrop}>
            {gridLines.map((line) => (
              <View
                key={`v-${line}`}
                style={[styles.gridLineVertical, { left: `${(line + 1) * 12.5}%` }]}
              />
            ))}
            {gridLines.map((line) => (
              <View
                key={`h-${line}`}
                style={[styles.gridLineHorizontal, { top: `${(line + 1) * 12.5}%` }]}
              />
            ))}
          </View>
          <View style={[styles.uploadIconWrap, dragActive && styles.uploadIconWrapActive]}>
            <Feather name={dragActive ? 'download-cloud' : 'upload-cloud'} size={24} color={colors.primary} />
          </View>
          <ColourfulText
            text={Platform.OS === 'web' ? 'Drop receipt here' : 'Choose receipt screenshot'}
            style={styles.uploadTitle}
            palette={['#111827', colors.primary, '#0EA5E9', colors.secondary, '#111827']}
            duration={3800}
            containerStyle={styles.uploadTitleRow}
          />
          <Text style={styles.uploadSubtitle}>
            {Platform.OS === 'web' ? 'or tap to browse your files' : 'Tap to attach a receipt screenshot'}
          </Text>
          <View style={styles.uploadAction}>
            <Feather name="paperclip" size={14} color="#FFFFFF" />
            <Text style={styles.uploadActionText}>Choose file</Text>
          </View>
        </Pressable>
      </View>
    );
  }

  if (uiState === 'uploading') {
    return (
      <View style={[styles.root, { backgroundColor: colors.gray50 }]}>
        <View style={styles.attachedRow}>
          <View style={styles.thumbWrap}>
            <ActivityIndicator color={colors.primary} />
          </View>
          <View style={styles.attachedInfo}>
            <Text style={styles.attachedTitle}>Reading receipt…</Text>
            <Text style={styles.hint}>This takes a couple of seconds</Text>
          </View>
        </View>
      </View>
    );
  }

  // attached
  return (
    <View style={[styles.root, { backgroundColor: variantTint.bg }]}>
      <View style={styles.attachedRow}>
        <View style={styles.thumbWrap}>
          {thumbUrl ? (
            <Image source={{ uri: thumbUrl }} style={styles.thumb} resizeMode="cover" />
          ) : (
            <ActivityIndicator color={colors.primary} />
          )}
        </View>
        <View style={styles.attachedInfo}>
          <View style={styles.attachedTitleRow}>
            <Feather name={variantIcon} size={14} color={variantTint.icon} />
            <Text style={[styles.attachedTitle, { color: variantTint.label }]} numberOfLines={2}>
              {proofSummary ?? 'Proof attached'}
            </Text>
          </View>
          {variant === 'mismatch' && (
            <Pressable onPress={Platform.OS === 'web' ? handlePickWeb : handlePickMobile} style={styles.reUploadHint}>
              <Text style={styles.reUploadText}>Re-upload</Text>
            </Pressable>
          )}
          {Platform.OS === 'web' && (
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleWebFile}
              style={{ display: 'none' }}
            />
          )}
        </View>
        <Pressable onPress={handleClear} disabled={busy !== null} style={styles.clearBtn}>
          {busy === 'clear'
            ? <ActivityIndicator size="small" color={colors.textSecondary} />
            : <Feather name="x" size={16} color={colors.textSecondary} />}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { borderRadius: radius['2xl'], padding: spacing[4], gap: spacing[2] },
  uploadRoot: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  uploadHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  label: { fontFamily: typography.sansBold, fontSize: 10, letterSpacing: 1, color: colors.textSecondary },
  hint: { fontFamily: typography.sansRegular, fontSize: fontSize.xs, color: colors.textSecondary },
  fileChip: {
    borderRadius: radius.full,
    backgroundColor: colors.gray50,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
  },
  fileChipText: { fontFamily: typography.monoMedium, fontSize: 9, color: colors.textSecondary },
  uploadDropzone: {
    minHeight: 188,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.primaryBorder,
    backgroundColor: '#FAFBFF',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[4],
    marginTop: spacing[2],
  },
  uploadDropzoneActive: {
    borderColor: colors.primary,
    backgroundColor: '#F4F7FF',
  },
  uploadDropzonePressed: {
    transform: [{ scale: 0.985 }],
    borderColor: colors.primary,
  },
  gridBackdrop: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.7,
  },
  dropBeam: {
    position: 'absolute',
    left: '-18%',
    right: '-18%',
    height: 62,
    borderRadius: 999,
  },
  dropBeamOne: {
    top: 24,
    transform: [{ rotate: '-12deg' }],
  },
  dropBeamTwo: {
    bottom: 22,
    transform: [{ rotate: '10deg' }],
  },
  gridLineVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E7FF',
  },
  gridLineHorizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E7FF',
  },
  uploadIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[3],
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 3,
  },
  uploadIconWrapActive: {
    transform: [{ translateY: -3 }],
    backgroundColor: colors.primarySurface,
  },
  uploadTitle: {
    fontFamily: typography.sansBold,
    fontSize: fontSize.md,
    textAlign: 'center',
  },
  uploadTitleRow: { justifyContent: 'center' },
  uploadSubtitle: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing[1],
  },
  uploadAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1.5],
    marginTop: spacing[4],
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2.5],
  },
  uploadActionText: { fontFamily: typography.sansBold, fontSize: fontSize.sm, color: '#FFFFFF' },
  pickBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing[2], paddingVertical: spacing[3],
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.primaryBorder,
    backgroundColor: colors.primarySurface, marginTop: spacing[2],
  },
  pickBtnText: { fontFamily: typography.sansSemiBold, fontSize: fontSize.sm, color: colors.primary },
  attachedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  thumbWrap: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.gray100, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  thumb: { width: 48, height: 48 },
  attachedInfo: { flex: 1, gap: 2 },
  attachedTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  attachedTitle: { flex: 1, fontFamily: typography.sansSemiBold, fontSize: fontSize.sm },
  reUploadHint: { alignSelf: 'flex-start' },
  reUploadText: { fontFamily: typography.sansMedium, fontSize: fontSize.xs, color: '#B45309', textDecorationLine: 'underline' },
  clearBtn: { padding: 4 },
});
