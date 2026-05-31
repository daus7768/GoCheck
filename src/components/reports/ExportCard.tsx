import React, { useState } from 'react';
import {
  View, Text, Pressable, ActivityIndicator, StyleSheet, Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, typography, spacing, radius } from '../../theme/tokens';
import { GlowingCard } from '../effects/GlowingCard';
import { exportCSV } from '../../lib/exportCsv';
import { exportPDF } from '../../lib/exportPdf';
import type { Bill, Currency } from '../../types';

interface Props {
  bills: Bill[];
  currency: Currency;
}

export function ExportCard({ bills, currency }: Props) {
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const handleCsv = async () => {
    if (bills.length === 0) {
      Alert.alert('No data', 'Create some bills first before exporting.');
      return;
    }
    setIsExportingCsv(true);
    try {
      await exportCSV(bills, currency);
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
      await exportPDF(bills, currency);
    } catch (e) {
      Alert.alert('Export failed', 'Could not generate PDF. Please try again.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <GlowingCard radius={radius['2xl']} background={colors.surface}>
      <View style={styles.card}>
      <Text style={styles.title}>Export</Text>
      <Text style={styles.sub}>Download a full breakdown for accounting or tax filing.</Text>
      <View style={styles.btnRow}>
        <Pressable
          style={({ pressed }) => [
            styles.btn,
            styles.btnCsv,
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
          <Text style={[styles.btnLabel, styles.btnLabelPrimary]}>
            {isExportingCsv ? 'Preparing…' : 'Export CSV'}
          </Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.btn,
            styles.btnPdf,
            pressed && styles.btnPressed,
          ]}
          onPress={handlePdf}
          disabled={isExportingPdf}
        >
          {isExportingPdf ? (
            <ActivityIndicator size="small" color={colors.gray600} />
          ) : (
            <Feather name="file-text" size={14} color={colors.gray600} />
          )}
          <Text style={styles.btnLabel}>{isExportingPdf ? 'Preparing…' : 'Export PDF'}</Text>
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
    color: colors.gray900,
  },
  sub: {
    fontFamily: typography.sansRegular,
    fontSize: 12,
    color: colors.gray500,
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
  btnCsv: {
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primarySurface,
  },
  btnPdf: {
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  btnPressed: {
    opacity: 0.85,
  },
  btnLabel: {
    fontFamily: typography.sansBold,
    fontSize: 12,
    color: colors.gray700,
  },
  btnLabelPrimary: {
    color: colors.primary,
  },
});
