import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, typography, fontSize, spacing, radius } from '../../theme/tokens';
import { supabase } from '../../lib/supabase';
import type { ProofExtraction } from '../../types';

export type MatchLevel = 'high' | 'medium' | 'none';

export function getMatchLevel(extracted: ProofExtraction | undefined): MatchLevel {
  if (!extracted || !extracted.matchesExpected) return 'none';
  return extracted.confidence >= 0.9 ? 'high' : 'medium';
}

interface Props {
  proofUrl?: string;
  proofSummary?: string;
  proofExtracted?: ProofExtraction;
  onImageTap: (signedUrl: string) => void;
}

type BannerVariant = 'matchHigh' | 'matchMedium' | 'mismatch' | 'unread';

function variantOf(extracted?: ProofExtraction): BannerVariant {
  if (!extracted) return 'unread';
  if (!extracted.matchesExpected) return 'mismatch';
  return extracted.confidence >= 0.9 ? 'matchHigh' : 'matchMedium';
}

const TINTS: Record<BannerVariant, { bg: string; icon: string; label: string }> = {
  matchHigh:   { bg: '#D1FAE5', icon: '#059669', label: '#065F46' },
  matchMedium: { bg: '#ECFDF5', icon: '#059669', label: '#065F46' },
  mismatch:    { bg: '#FEF3C7', icon: '#B45309', label: '#92400E' },
  unread:      { bg: colors.gray100, icon: colors.textSecondary, label: colors.textPrimary },
};

const ICONS: Record<BannerVariant, keyof typeof Feather.glyphMap> = {
  matchHigh:   'check-circle',
  matchMedium: 'check-circle',
  mismatch:    'alert-triangle',
  unread:      'info',
};

export function AISummaryBanner({ proofUrl, proofSummary, proofExtracted, onImageTap }: Props) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!proofUrl) { setThumbUrl(null); return; }
      const { data, error } = await supabase.storage.from('payment-proofs').createSignedUrl(proofUrl, 60);
      if (!cancelled && data && !error) setThumbUrl(data.signedUrl);
    }
    void load();
    return () => { cancelled = true; };
  }, [proofUrl]);

  // Hide entirely if there's no proof
  if (!proofUrl) return null;

  const variant = variantOf(proofExtracted);
  const tint = TINTS[variant];

  const handleTap = async () => {
    if (!proofUrl) return;
    // Fetch a fresh signed URL just for the viewer (independent of the thumb's TTL)
    const { data, error } = await supabase.storage.from('payment-proofs').createSignedUrl(proofUrl, 60);
    if (data && !error) onImageTap(data.signedUrl);
  };

  return (
    <Pressable onPress={handleTap} style={[styles.root, { backgroundColor: tint.bg }]}>
      <View style={styles.thumbWrap}>
        {thumbUrl ? (
          <Image source={{ uri: thumbUrl }} style={styles.thumb} resizeMode="cover" />
        ) : (
          <ActivityIndicator color={tint.icon} />
        )}
      </View>
      <View style={styles.info}>
        <View style={styles.titleRow}>
          <Feather name={ICONS[variant]} size={14} color={tint.icon} />
          <Text style={[styles.summary, { color: tint.label }]} numberOfLines={3}>
            {proofSummary ?? 'Proof attached — tap to view'}
          </Text>
        </View>
        <Text style={[styles.viewHint, { color: tint.label }]}>Tap to view full receipt</Text>
      </View>
      <Feather name="chevron-right" size={16} color={tint.icon} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    padding: spacing[3], borderRadius: radius.xl,
  },
  thumbWrap: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.gray100, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  thumb: { width: 44, height: 44 },
  info: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  summary: { flex: 1, fontFamily: typography.sansSemiBold, fontSize: fontSize.sm },
  viewHint: { fontFamily: typography.sansRegular, fontSize: fontSize.xs, opacity: 0.75 },
});
