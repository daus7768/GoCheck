import { View, Switch, Pressable, StyleSheet, ScrollView } from 'react-native';
import { AppText } from '../AppText';
import { useReminderStore } from '../../store/reminderStore';
import { useBillStore } from '../../store/billStore';
import { buildQueueItems } from '../../lib/queueUtils';
import { REMINDER_PREVIEWS } from '../../lib/reminderTemplates';
import { typography, fontSize, spacing, radius } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import { GlowingCard } from '../effects/GlowingCard';
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

export function SettingsPane({ organizerId }: { organizerId: string }) {
  const { colors } = useTheme();
  const { settings, setSetting, sent } = useReminderStore();
  const { bills } = useBillStore();

  const { items: queueItems } = buildQueueItems(bills, sent, settings, organizerId);
  const hasOverdue = queueItems.some((item) => item.daysToDue < 0);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Card 1: Cadence */}
      <GlowingCard radius={radius.xl} background={colors.surface}>
      <View style={styles.card}>
        <AppText style={[styles.cardTitle, { color: colors.textPrimary }]}>Cadence</AppText>
        <View style={styles.segmentRow}>
          {CADENCE_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              style={[
                styles.pill,
                { backgroundColor: colors.gray100 },
                settings.cadence === opt.value && { backgroundColor: colors.primary },
              ]}
              onPress={() => setSetting('cadence', opt.value)}
            >
              <AppText style={[
                styles.pillText,
                { color: colors.textSecondary },
                settings.cadence === opt.value && { color: colors.white, fontFamily: typography.sansSemiBold },
              ]}>
                {opt.label}
              </AppText>
            </Pressable>
          ))}
        </View>
        <AppText style={[styles.helperText, { color: colors.textSecondary }]}>
          {CADENCE_OPTIONS.find((o) => o.value === settings.cadence)?.helper}
        </AppText>
      </View>
      </GlowingCard>

      {/* Card 2: Message Tone */}
      <GlowingCard radius={radius.xl} background={colors.surface}>
      <View style={styles.card}>
        <AppText style={[styles.cardTitle, { color: colors.textPrimary }]}>Message Tone</AppText>
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
                  { backgroundColor: colors.gray100 },
                  isActive && { backgroundColor: colors.primary },
                  disabled && styles.pillDisabled,
                ]}
                onPress={() => !disabled && setSetting('tone', opt.value)}
                disabled={disabled}
              >
                <AppText style={[
                  styles.pillText,
                  { color: colors.textSecondary },
                  isActive && { color: colors.white, fontFamily: typography.sansSemiBold },
                  disabled && { color: colors.textTertiary },
                ]}>
                  {opt.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
        {!hasOverdue && (
          <AppText style={[styles.finalNote, { color: colors.warning }]}>Final tone available when at least one participant is overdue.</AppText>
        )}
        <View style={[styles.previewBox, { backgroundColor: colors.gray50, borderColor: colors.border }]}>
          <AppText style={[styles.previewText, { color: colors.textSecondary }]}>{REMINDER_PREVIEWS[settings.tone]}</AppText>
        </View>
      </View>
      </GlowingCard>

      {/* Card 3: Skip + Frequency Cap */}
      <GlowingCard radius={radius.xl} background={colors.surface}>
      <View style={styles.card}>
        <AppText style={[styles.cardTitle, { color: colors.textPrimary }]}>Skip &amp; Frequency Cap</AppText>

        <View style={styles.toggleRow}>
          <AppText style={[styles.toggleTitle, { color: colors.textPrimary }]}>Skip already-paid people</AppText>
          <Switch
            value={settings.skipPaid}
            onValueChange={(v) => setSetting('skipPaid', v)}
            trackColor={{ false: colors.gray200, true: colors.primary }}
            thumbColor={colors.white}
          />
        </View>

        <View style={styles.stepperRow}>
          <AppText style={[styles.sliderLabel, { color: colors.textPrimary }]}>Max reminders per person per week</AppText>
          <View style={[styles.stepper, { backgroundColor: colors.gray50, borderColor: colors.border }]}>
            <Pressable
              style={[styles.stepBtn, { backgroundColor: colors.gray100 }, settings.maxPerWeek <= 1 && styles.stepBtnDisabled]}
              onPress={() => settings.maxPerWeek > 1 && setSetting('maxPerWeek', settings.maxPerWeek - 1)}
              disabled={settings.maxPerWeek <= 1}
            >
              <AppText style={[styles.stepBtnText, { color: colors.textPrimary }]}>−</AppText>
            </Pressable>
            <AppText style={[styles.stepValue, { color: colors.textPrimary }]}>{settings.maxPerWeek}</AppText>
            <Pressable
              style={[styles.stepBtn, { backgroundColor: colors.gray100 }, settings.maxPerWeek >= 7 && styles.stepBtnDisabled]}
              onPress={() => settings.maxPerWeek < 7 && setSetting('maxPerWeek', settings.maxPerWeek + 1)}
              disabled={settings.maxPerWeek >= 7}
            >
              <AppText style={[styles.stepBtnText, { color: colors.textPrimary }]}>+</AppText>
            </Pressable>
          </View>
        </View>
      </View>
      </GlowingCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: spacing[4], gap: spacing[3] },
  card: {
    padding: spacing[4],
    gap: spacing[3],
  },
  cardTitle: {
    fontFamily: typography.sansSemiBold,
    fontSize: fontSize.base,
  },
  segmentRow: { flexDirection: 'row', gap: spacing[2] },
  pill: {
    flex: 1,
    paddingVertical: spacing[2],
    borderRadius: radius.md,
    alignItems: 'center',
  },
  pillDisabled: { opacity: 0.4 },
  pillText: {
    fontFamily: typography.sansMedium,
    fontSize: fontSize.sm,
  },
  helperText: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  finalNote: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.xs,
  },
  previewBox: {
    borderRadius: radius.md,
    padding: spacing[3],
    borderWidth: 1,
  },
  previewText: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.sm,
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
    flex: 1,
  },
  stepperRow: { gap: spacing[2] },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    alignSelf: 'flex-start',
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnDisabled: { opacity: 0.4 },
  stepBtnText: { fontFamily: typography.sansBold, fontSize: fontSize.md },
  stepValue: { fontFamily: typography.monoMedium, fontSize: fontSize.lg, minWidth: 32, textAlign: 'center' },
  sliderLabel: {
    fontFamily: typography.sansMedium,
    fontSize: fontSize.sm,
  },
});
