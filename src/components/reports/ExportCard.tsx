import React, { useState } from 'react';
import {
  View, Pressable, ActivityIndicator, StyleSheet, Alert,
} from 'react-native';
import { AppText } from '../AppText';
import { Feather } from '@expo/vector-icons';
import { colors, typography, spacing, radius } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import { GlowingCard } from '../effects/GlowingCard';
import { exportCSV } from '../../lib/exportCsv';
import { exportPDF } from '../../lib/exportPdf';
import type { Bill, Currency } from '../../types';

interface Props {
  bills: Bill[];
  currency: Currency;
  organizerName?: string;
}

export function ExportCard({ bills, currency, organizerName }: Props) {
  const { colors: c } = useTheme();
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const handleCsv = async () => {
    if (bills.length === 0) {
      Alert.alert('No data', 'Create some bills first before exporting.');
      return;
    }
    setIsExportingCsv(true);
    try {
      await exportCSV(bills, currency, { organizerName });
    } catch (e) {
      Alert.alert('Export failed', 'Could not export CSV. Please try again.');
    } finally {
      setIsExportingCsv(false);
    }
  };

  const handlePdf = async () => {
    if (bills.length === 0) {
      Alert.alert('No data', 'Create some bills first before exporting.');
      return;
    }
    setIsExportingPdf(true);
    try {
      await exportPDF(bills, currency, { organizerName });
    } catch (e) {
      Alert.alert('Export failed', 'Could not generate PDF. Please try again.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <GlowingCard radius={radius['2xl']} background={c.surface}>
      <View style={styles.card}>
      <AppText style={[styles.title, { color: c.textPrimary }]}>Export</AppText>
      <AppText style={[styles.sub, { color: c.textSecondary }]}>Download a full breakdown for accounting or tax filing.</AppText>
      <View style={styles.btnRow}>
        <Pressable
          style={({ pressed }) => [
            styles.btn,
            { borderColor: c.primaryBorder, backgroundColor: c.primarySurface },
            pressed && styles.btnPressed,
          ]}
          onPress={handleCsv}
          disabled={isExportingCsv}
        >
          {isExportingCsv ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Feather name="download" size={14} color={colors.primary} />
          )}
          <AppText style={[styles.btnLabel, styles.btnLabelPrimary]}>
            {isExportingCsv ? 'Preparing…' : 'Export CSV'}
          </AppText>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.btn,
            { borderColor: c.border, backgroundColor: c.surface },
            pressed && styles.btnPressed,
          ]}
          onPress={handlePdf}
          disabled={isExportingPdf}
        >
          {isExportingPdf ? (
            <ActivityIndicator size="small" color={c.textSecondary} />
          ) : (
            <Feather name="file-text" size={14} color={c.textSecondary} />
          )}
          <AppText style={[styles.btnLabel, { color: c.textPrimary }]}>{isExportingPdf ? 'Preparing…' : 'Export PDF'}</AppText>
        </Pressable>
      </View>
      </View>
    </GlowingCard>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing[4],
  },
  title: {
    fontFamily: typography.sansBold,
    fontSize: 14,
  },
  sub: {
    fontFamily: typography.sansRegular,
    fontSize: 12,
    marginTop: 2,
    marginBottom: spacing[3],
    lineHeight: 18,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: radius.xl,
    paddingVertical: 11,
  },
  btnPressed: {
    opacity: 0.85,
  },
  btnLabel: {
    fontFamily: typography.sansBold,
    fontSize: 12,
  },
  btnLabelPrimary: {
    color: colors.primary,
  },
});
