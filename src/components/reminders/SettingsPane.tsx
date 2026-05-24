import { View, Text, Switch, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useReminderStore } from '../../store/reminderStore';
import { useBillStore } from '../../store/billStore';
import { buildQueueItems } from '../../lib/queueUtils';
import { REMINDER_PREVIEWS } from '../../lib/reminderTemplates';
import { colors, typography, fontSize, spacing, radius } from '../../theme/tokens';
import type { ReminderCadence, ReminderTone } from '../../types';

const CADENCE_OPTIONS: { value: ReminderCadence; label: string; helper: string }[] = [
  { value: 'manual', label: 'Manual', helper: 'All unpaid participants appear in the queue at all times.' },
  { value: 'smart', label: 'Smart', helper: 'Shows participants 3 days before due, on due date, and every 3 days after. Others are reachable from the bill detail.' },
  { value: 'aggressive', label: 'Aggressive', helper: 'All unpaid participants shown every day, overdue first. Use sparingly.' },
];

const TONE_OPTIONS: { value: ReminderTone; label: string }[] = [
  { value: 'friendly', label: 'Friendly' },
  { value: 'firm', label: 'Firm' },
  { value: 'final', label: 'Final' },
];

export function SettingsPane() {
  const { settings, setSetting, sent } = useReminderStore();
  const { bills } = useBillStore();

  const { items: queueItems } = buildQueueItems(bills, sent, settings, '');
  const hasOverdue = queueItems.some((item) => item.daysToDue < 0);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Card 1: Cadence */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Cadence</Text>
        <View style={styles.segmentRow}>
          {CADENCE_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              style={[styles.pill, settings.cadence === opt.value && styles.pillActive]}
              onPress={() => setSetting('cadence', opt.value)}
            >
              <Text style={[styles.pillText, settings.cadence === opt.value && styles.pillTextActive]}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.helperText}>
          {CADENCE_OPTIONS.find((o) => o.value === settings.cadence)?.helper}
        </Text>
      </View>

      {/* Card 2: Message Tone */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Message Tone</Text>
        <View style={styles.segmentRow}>
          {TONE_OPTIONS.map((opt) => {
            const isFinal = opt.value === 'final';
            const disabled = isFinal && !hasOverdue;
            const isActive = settings.tone === opt.value;
            return (
              <Pressable
                key={opt.value}
                style={[
                  styles.pill,
                  isActive && styles.pillActive,
                  disabled && styles.pillDisabled,
                ]}
                onPress={() => !disabled && setSetting('tone', opt.value)}
                disabled={disabled}
              >
                <Text style={[styles.pillText, isActive && styles.pillTextActive, disabled && styles.pillTextDisabled]}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {!hasOverdue && (
          <Text style={styles.finalNote}>Final tone available when at least one participant is overdue.</Text>
        )}
        <View style={styles.previewBox}>
          <Text style={styles.previewText}>{REMINDER_PREVIEWS[settings.tone]}</Text>
        </View>
      </View>

      {/* Card 3: Skip + Frequency Cap */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Skip &amp; Frequency Cap</Text>

        <View style={styles.toggleRow}>
          <Text style={styles.toggleTitle}>Skip already-paid people</Text>
          <Switch
            value={settings.skipPaid}
            onValueChange={(v) => setSetting('skipPaid', v)}
            trackColor={{ false: colors.gray200, true: colors.primary }}
            thumbColor={colors.white}
          />
        </View>

        <View style={styles.stepperRow}>
          <Text style={styles.sliderLabel}>Max reminders per person per week</Text>
          <View style={styles.stepper}>
            <Pressable
              style={[styles.stepBtn, settings.maxPerWeek <= 1 && styles.stepBtnDisabled]}
              onPress={() => settings.maxPerWeek > 1 && setSetting('maxPerWeek', settings.maxPerWeek - 1)}
              disabled={settings.maxPerWeek <= 1}
            >
              <Text style={styles.stepBtnText}>−</Text>
            </Pressable>
            <Text style={styles.stepValue}>{settings.maxPerWeek}</Text>
            <Pressable
              style={[styles.stepBtn, settings.maxPerWeek >= 7 && styles.stepBtnDisabled]}
              onPress={() => settings.maxPerWeek < 7 && setSetting('maxPerWeek', settings.maxPerWeek + 1)}
              disabled={settings.maxPerWeek >= 7}
            >
              <Text style={styles.stepBtnText}>+</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: spacing[4], gap: spacing[3] },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing[3],
  },
  cardTitle: {
    fontFamily: typography.sansSemiBold,
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },
  segmentRow: { flexDirection: 'row', gap: spacing[2] },
  pill: {
    flex: 1,
    paddingVertical: spacing[2],
    borderRadius: radius.md,
    backgroundColor: colors.gray100,
    alignItems: 'center',
  },
  pillActive: { backgroundColor: colors.primary },
  pillDisabled: { opacity: 0.4 },
  pillText: {
    fontFamily: typography.sansMedium,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  pillTextActive: { color: colors.white, fontFamily: typography.sansSemiBold },
  pillTextDisabled: { color: colors.textTertiary },
  helperText: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  finalNote: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.xs,
    color: colors.warning,
  },
  previewBox: {
    backgroundColor: colors.gray50,
    borderRadius: radius.md,
    padding: spacing[3],
    borderWidth: 1,
    borderColor: colors.border,
  },
  previewText: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleTitle: {
    fontFamily: typography.sansMedium,
    fontSize: fontSize.base,
    color: colors.textPrimary,
    flex: 1,
  },
  stepperRow: { gap: spacing[2] },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    alignSelf: 'flex-start',
    backgroundColor: colors.gray50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnDisabled: { opacity: 0.4 },
  stepBtnText: { fontFamily: typography.sansBold, fontSize: fontSize.md, color: colors.textPrimary },
  stepValue: { fontFamily: typography.monoMedium, fontSize: fontSize.lg, color: colors.textPrimary, minWidth: 32, textAlign: 'center' },
  sliderLabel: {
    fontFamily: typography.sansMedium,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },
});
