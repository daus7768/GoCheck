import { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  Pressable,
  Switch,
  Platform,
  KeyboardAvoidingView,
  Alert,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { format, addDays } from 'date-fns';
import { haptic, ImpactFeedbackStyle, NotificationFeedbackType } from '../../src/lib/haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  FadeInDown,
  FadeIn,
} from 'react-native-reanimated';

import { SplitTypeControl } from '../../src/components/create/SplitTypeControl';
import { ParticipantChip, AddParticipantChip } from '../../src/components/create/ParticipantChip';
import { LineItemRow, AddLineItemButton } from '../../src/components/create/LineItemRow';
import { CurrencySelector } from '../../src/components/create/CurrencySelector';
import { CreateBillCTA } from '../../src/components/create/CreateBillCTA';
import { BillCreatedSheet } from '../../src/components/bill/BillCreatedSheet';
import type { Bill } from '../../src/types';
import { AddParticipantModal } from '../../src/components/create/AddParticipantModal';
import { DatePickerField } from '../../src/components/create/DatePickerField';
import { useBillStore } from '../../src/store/billStore';
import { getOrganizerId } from '../../src/lib/organizer';
import type { Participant, LineItem, Currency, SplitType } from '../../src/types';
import { CURRENCY_SYMBOLS } from '../../src/types';
import { colors, typography, fontSize, spacing, radius, shadow } from '../../src/theme/tokens';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function distributeEqual(total: number, participants: Participant[]): Participant[] {
  if (participants.length === 0) return [];
  const base = Math.floor((total / participants.length) * 100) / 100;
  const remainder = Math.round((total - base * participants.length) * 100);
  return participants.map((p, i) => ({
    ...p,
    amount: i === 0 ? base + remainder / 100 : base,
  }));
}

// ─── Input Atom ───────────────────────────────────────────────────────────────

interface FieldInputProps {
  label: string;
  required?: boolean;
  icon?: React.ComponentProps<typeof Feather>['name'];
  children: React.ReactNode;
  error?: string;
  hint?: string;
}

function Field({ label, required, icon, children, error, hint }: FieldInputProps) {
  return (
    <View style={fieldStyles.container}>
      <View style={fieldStyles.labelRow}>
        {icon && <Feather name={icon} size={14} color={colors.textSecondary} />}
        <Text style={fieldStyles.label}>
          {label}
          {required && <Text style={fieldStyles.required}> *</Text>}
        </Text>
      </View>
      {children}
      {error ? (
        <Animated.Text entering={FadeIn.duration(200)} style={fieldStyles.error}>
          {error}
        </Animated.Text>
      ) : hint ? (
        <Text style={fieldStyles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  container: { marginBottom: spacing[5] },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    marginBottom: spacing[1.5],
  },
  label: {
    fontFamily: typography.sansSemiBold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },
  required: {
    color: colors.error,
  },
  error: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.xs,
    color: colors.error,
    marginTop: spacing[1],
  },
  hint: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing[1],
  },
});

// ─── Section Wrapper ──────────────────────────────────────────────────────────

function Section({ title, children, delay = 0 }: { title: string; children: React.ReactNode; delay?: number }) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(400).springify()}>
      <View style={sectionStyles.card}>
        <Text style={sectionStyles.title}>{title}</Text>
        {children}
      </View>
    </Animated.View>
  );
}

const sectionStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius['2xl'],
    padding: spacing[5],
    marginBottom: spacing[3],
    ...shadow.sm,
  },
  title: {
    fontFamily: typography.sansBold,
    fontSize: fontSize.base,
    color: colors.textPrimary,
    marginBottom: spacing[4],
  },
});

// ─── Create Screen ─────────────────────────────────────────────────────────────

export default function CreateBillScreen() {
  const insets = useSafeAreaInsets();
  const { createBill, isCreating } = useBillStore();
  const scrollRef = useRef<ScrollView>(null);
  const titleRef = useRef<TextInput>(null);
  const descRef = useRef<TextInput>(null);

  // ── Form state ──
  const [title, setTitle] = useState('');
  const [titleError, setTitleError] = useState('');
  const [currency, setCurrency] = useState<Currency>('MYR');
  const [amountRaw, setAmountRaw] = useState('');
  const [amountError, setAmountError] = useState('');
  const [splitType, setSplitType] = useState<SplitType>('equal');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [participantsError, setParticipantsError] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [taxRateRaw, setTaxRateRaw] = useState('6');
  const [dueDate, setDueDate] = useState<Date>(addDays(new Date(), 7));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [description, setDescription] = useState('');
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [groupPhotoUri, setGroupPhotoUri] = useState<string | undefined>();
  const [addParticipantVisible, setAddParticipantVisible] = useState(false);
  const [ctaState, setCtaState] = useState<'idle' | 'loading' | 'success'>('idle');
  const [category, setCategory] = useState<'travel' | 'food' | 'housing' | 'other'>('other');
  const [createdBill, setCreatedBill] = useState<Bill | null>(null);
  const [showSuccessSheet, setShowSuccessSheet] = useState(false);

  // ── Derived values ──
  const totalAmount = parseFloat(amountRaw) || 0;
  const taxRate = parseFloat(taxRateRaw) || 0;

  const lineSubtotal = lineItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );
  const taxAmount = lineSubtotal * (taxRate / 100);
  const lineTotal = lineSubtotal + taxAmount;

  const effectiveTotal = lineItems.length > 0 ? lineTotal : totalAmount;
  const perPerson = participants.length > 0
    ? effectiveTotal / participants.length
    : 0;

  const currencySymbol = CURRENCY_SYMBOLS[currency];

  // ── Photo picker ──
  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo access to add a group photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setGroupPhotoUri(result.assets[0].uri);
      haptic.notification(NotificationFeedbackType.Success);
    }
  };

  // ── Participants ──
  const handleAddParticipant = useCallback((p: Participant) => {
    setParticipants((prev) => {
      const next = [...prev, p];
      if (splitType === 'equal' && effectiveTotal > 0) {
        return distributeEqual(effectiveTotal, next);
      }
      return next;
    });
    if (participantsError) setParticipantsError('');
  }, [splitType, effectiveTotal, participantsError]);

  const handleRemoveParticipant = useCallback((id: string) => {
    setParticipants((prev) => {
      const next = prev.filter((p) => p.id !== id);
      if (splitType === 'equal' && effectiveTotal > 0) {
        return distributeEqual(effectiveTotal, next);
      }
      return next;
    });
  }, [splitType, effectiveTotal]);

  const handleParticipantAmountChange = (id: string, value: string) => {
    const num = parseFloat(value) || 0;
    setParticipants((prev) => {
      const updated = prev.map((p) => {
        if (p.id !== id) return p;
        if (splitType === 'percent') {
          // Store in percent field; derive amount from total
          const amount = effectiveTotal > 0 ? (num / 100) * effectiveTotal : 0;
          return { ...p, percent: num, amount };
        }
        if (splitType === 'shares') {
          // Store in shares field; recompute all amounts proportionally
          return { ...p, shares: num };
        }
        // custom or equal
        return { ...p, amount: num };
      });

      if (splitType === 'shares') {
        const totalShares = updated.reduce((s, p) => s + (p.shares ?? 0), 0);
        return updated.map((p) => ({
          ...p,
          amount: totalShares > 0 && effectiveTotal > 0
            ? Math.round(((p.shares ?? 0) / totalShares) * effectiveTotal * 100) / 100
            : 0,
        }));
      }

      return updated;
    });
  };

  // ── Line items ──
  const handleAddLineItem = () => {
    haptic.impact(ImpactFeedbackStyle.Light);
    setLineItems((prev) => [
      ...prev,
      { id: generateId(), description: '', quantity: 1, unitPrice: 0 },
    ]);
  };

  const handleUpdateLineItem = (id: string, field: keyof LineItem, value: string | number) => {
    setLineItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleRemoveLineItem = (id: string) => {
    setLineItems((prev) => prev.filter((item) => item.id !== id));
  };

  // ── Validation ──
  const validate = (): boolean => {
    let valid = true;

    const trimTitle = title.trim();
    if (!trimTitle) {
      setTitleError('Bill title is required');
      valid = false;
    } else if (trimTitle.length < 3) {
      setTitleError('Title must be at least 3 characters');
      valid = false;
    } else if (trimTitle.length > 100) {
      setTitleError('Title must be 100 characters or fewer');
      valid = false;
    } else {
      setTitleError('');
    }

    if (lineItems.length === 0) {
      if (!amountRaw || parseFloat(amountRaw) <= 0) {
        setAmountError('Enter a valid amount greater than 0');
        valid = false;
      } else {
        setAmountError('');
      }
    } else {
      setAmountError('');
    }

    if (participants.length < 2) {
      setParticipantsError('Add at least 2 participants');
      valid = false;
    } else if (splitType === 'percent') {
      const total = participants.reduce((s, p) => s + (p.percent ?? 0), 0);
      if (Math.abs(total - 100) > 0.01) {
        setParticipantsError(`Percentages must add up to 100% (currently ${total.toFixed(1)}%)`);
        valid = false;
      } else {
        setParticipantsError('');
      }
    } else if (splitType === 'custom') {
      const amountTotal = participants.reduce((s, p) => s + p.amount, 0);
      if (effectiveTotal > 0 && Math.abs(amountTotal - effectiveTotal) > 0.02) {
        setParticipantsError(
          `Amounts must sum to ${CURRENCY_SYMBOLS[currency]}${effectiveTotal.toFixed(2)} (currently ${CURRENCY_SYMBOLS[currency]}${amountTotal.toFixed(2)})`
        );
        valid = false;
      } else {
        setParticipantsError('');
      }
    } else if (splitType === 'shares') {
      const hasShares = participants.every((p) => (p.shares ?? 0) > 0);
      if (!hasShares) {
        setParticipantsError('All participants need at least 1 share');
        valid = false;
      } else {
        setParticipantsError('');
      }
    } else {
      setParticipantsError('');
    }

    return valid;
  };

  const resetForm = useCallback(() => {
    setTitle('');
    setTitleError('');
    setCurrency('MYR');
    setAmountRaw('');
    setAmountError('');
    setSplitType('equal');
    setParticipants([]);
    setParticipantsError('');
    setLineItems([]);
    setTaxRateRaw('6');
    setDueDate(addDays(new Date(), 7));
    setShowDatePicker(false);
    setDescription('');
    setReminderEnabled(true);
    setGroupPhotoUri(undefined);
    setCategory('other');
    setCtaState('idle');
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, []);

  // ── Submit ──
  const handleCreate = async () => {
    if (showSuccessSheet) return;
    if (!validate()) {
      haptic.notification(NotificationFeedbackType.Error);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    setCtaState('loading');

    try {
      const bill = await createBill({
        organizerId: await getOrganizerId(),
        title: title.trim(),
        description: description.trim() || undefined,
        currency,
        splitType,
        participants:
          splitType === 'equal'
            ? distributeEqual(effectiveTotal, participants)
            : participants,
        lineItems,
        taxRate,
        dueDate,
        reminderEnabled,
        groupPhotoUri,
        category,
        isRecurring: null,
      });

      setCtaState('idle');
      setCreatedBill(bill);
      setShowSuccessSheet(true);
    } catch {
      setCtaState('idle');
      Alert.alert('Something went wrong', 'Could not create the bill. Please try again.', [
        { text: 'OK', style: 'cancel' },
      ]);
    }
  };

  const handleViewCreatedBill = useCallback(() => {
    setShowSuccessSheet(false);
    const id = createdBill?.id;
    setCreatedBill(null);
    if (id) {
      router.replace(`/(modals)/bill/${id}`);
    }
  }, [createdBill?.id]);

  const handleCreateAnother = useCallback(() => {
    setShowSuccessSheet(false);
    setCreatedBill(null);
    resetForm();
  }, [resetForm]);

  const isFormDirty = title.length > 0 || participants.length > 0 || lineItems.length > 0;

  const handleBack = () => {
    if (isFormDirty) {
      Alert.alert('Discard bill?', 'You have unsaved changes. Leave anyway?', [
        { text: 'Keep Editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => router.back() },
      ]);
    } else {
      router.back();
    }
  };

  return (
    <View style={styles.root}>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + spacing[2] }]}>
        <Pressable
          onPress={handleBack}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Feather name="chevron-left" size={22} color={colors.textPrimary} />
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>New Bill</Text>
          <Text style={styles.headerSub}>
            {participants.length > 0
              ? `${participants.length} participant${participants.length !== 1 ? 's' : ''}`
              : 'Split with your group'}
          </Text>
        </View>

        <Pressable
          onPress={() => {
            if (isFormDirty) {
              haptic.impact(ImpactFeedbackStyle.Light);
              // TODO: save draft
            }
          }}
          style={styles.draftBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Save draft"
        >
          <Text style={styles.draftBtnText}>Draft</Text>
        </Pressable>
      </View>

      {/* ── Scrollable body ─────────────────────────────────────────── */}
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: insets.bottom + 100 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Bill Identity ─────────────────────────────────────── */}
          <Section title="Bill Details" delay={50}>
            {/* Group photo */}
            <Pressable style={styles.photoRow} onPress={pickPhoto} accessibilityRole="button" accessibilityLabel="Add group photo">
              {groupPhotoUri ? (
                <Image source={{ uri: groupPhotoUri }} style={styles.photoThumb} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Feather name="camera" size={22} color={colors.gray400} />
                  <Text style={styles.photoLabel}>Group Photo</Text>
                </View>
              )}
              <View style={styles.photoMeta}>
                <Text style={styles.photoTitle}>
                  {groupPhotoUri ? 'Change photo' : 'Add group photo'}
                </Text>
                <Text style={styles.photoHint}>Optional · Square crop recommended</Text>
              </View>
              {groupPhotoUri && (
                <Pressable
                  onPress={() => setGroupPhotoUri(undefined)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.photoRemove}
                >
                  <Feather name="x" size={14} color={colors.textSecondary} />
                </Pressable>
              )}
            </Pressable>

            {/* Title */}
            <Field label="Bill Title" required icon="file-text" error={titleError}>
              <View
                style={[
                  styles.inputBox,
                  titleError ? styles.inputBoxError : null,
                  title.length > 0 ? styles.inputBoxFilled : null,
                ]}
              >
                <TextInput
                  ref={titleRef}
                  style={styles.inputText}
                  value={title}
                  onChangeText={(v) => {
                    setTitle(v);
                    if (titleError) setTitleError('');
                  }}
                  placeholder="e.g. Team Lunch @ Pavilion"
                  placeholderTextColor={colors.textTertiary}
                  autoCapitalize="words"
                  returnKeyType="next"
                  maxLength={100}
                  onSubmitEditing={() => descRef.current?.focus()}
                />
                {title.length > 80 && (
                  <Text style={styles.charCount}>{100 - title.length}</Text>
                )}
              </View>
            </Field>

            {/* Description */}
            <Field label="Description" icon="align-left" hint="What's this bill for? (optional)">
              <View style={[styles.inputBox, description.length > 0 && styles.inputBoxFilled]}>
                <TextInput
                  ref={descRef}
                  style={[styles.inputText, styles.textArea]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="e.g. End-of-quarter team gathering at The Pavilion, Level 6"
                  placeholderTextColor={colors.textTertiary}
                  multiline
                  numberOfLines={3}
                  maxLength={500}
                  returnKeyType="done"
                  blurOnSubmit
                />
              </View>
            </Field>

            {/* Category picker */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Category</Text>
              <View style={styles.chipRow}>
                {(
                  [
                    { key: 'travel', label: '✈ Travel', color: '#4F46E5' },
                    { key: 'food', label: '🍜 Food', color: '#f59e0b' },
                    { key: 'housing', label: '🏠 Housing', color: '#10B981' },
                    { key: 'other', label: '○ Other', color: '#94a3b8' },
                  ] as const
                ).map((item) => (
                  <Pressable
                    key={item.key}
                    style={[
                      styles.chip,
                      category === item.key && { backgroundColor: item.color, borderColor: item.color },
                    ]}
                    onPress={() => setCategory(item.key)}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                  >
                    <Text
                      style={[
                        styles.chipLabel,
                        category === item.key && { color: '#fff' },
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </Section>

          {/* ── Amount Block ──────────────────────────────────────── */}
          <Section title="Amount" delay={100}>
            <View style={styles.amountRow}>
              <CurrencySelector value={currency} onChange={setCurrency} />
              <View
                style={[
                  styles.amountInputWrapper,
                  amountError ? styles.inputBoxError : null,
                  parseFloat(amountRaw) > 0 && styles.inputBoxFilled,
                ]}
              >
                <TextInput
                  style={styles.amountInput}
                  value={amountRaw}
                  onChangeText={(v) => {
                    // Allow digits and single decimal point
                    const cleaned = v.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
                    setAmountRaw(cleaned);
                    if (amountError) setAmountError('');

                    const num = parseFloat(cleaned);
                    if (!isNaN(num) && splitType === 'equal' && participants.length > 0) {
                      setParticipants((prev) => distributeEqual(num, prev));
                    }
                  }}
                  placeholder="0.00"
                  placeholderTextColor={colors.gray300}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  textAlign="right"
                />
              </View>
            </View>

            {amountError && (
              <Text style={styles.amountError}>{amountError}</Text>
            )}

            {/* Per-person preview */}
            {participants.length >= 2 && effectiveTotal > 0 && (
              <Animated.View entering={FadeIn.duration(300)} style={styles.perPersonBadge}>
                <Feather name="users" size={13} color={colors.primary} />
                <Text style={styles.perPersonText}>
                  {currencySymbol}
                  {perPerson.toFixed(2)} per person
                </Text>
              </Animated.View>
            )}
          </Section>

          {/* ── Split Type ───────────────────────────────────────── */}
          <Section title="How to Split" delay={150}>
            <SplitTypeControl value={splitType} onChange={setSplitType} />
            <Text style={styles.splitHint}>
              {splitType === 'equal' && 'Amount divided equally among all participants.'}
              {splitType === 'custom' && 'Set a specific amount for each participant.'}
              {splitType === 'percent' && 'Assign a percentage share to each participant.'}
              {splitType === 'shares' && 'Assign weighted shares — amounts scale with total.'}
            </Text>
          </Section>

          {/* ── Participants ─────────────────────────────────────── */}
          <Section title={`Participants${participants.length > 0 ? ` (${participants.length})` : ''}`} delay={200}>
            {participantsError && (
              <Animated.View entering={FadeIn.duration(200)} style={styles.participantsErrorBadge}>
                <Feather name="alert-circle" size={13} color={colors.error} />
                <Text style={styles.participantsErrorText}>{participantsError}</Text>
              </Animated.View>
            )}

            {/* Chips row */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsRow}
            >
              {participants.slice(0, 5).map((p) => (
                <ParticipantChip
                  key={p.id}
                  participant={p}
                  onRemove={handleRemoveParticipant}
                />
              ))}
              {participants.length > 5 && (
                <AddParticipantChip
                  overflowCount={participants.length - 5}
                  onPress={() => setAddParticipantVisible(true)}
                />
              )}
              <AddParticipantChip onPress={() => setAddParticipantVisible(true)} />
            </ScrollView>

            {/* Custom amount inputs for non-equal splits */}
            {splitType !== 'equal' && participants.length > 0 && (
              <View style={styles.customAmountsContainer}>
                {participants.map((p) => (
                  <View key={p.id} style={styles.customAmountRow}>
                    <View
                      style={[
                        styles.customAvatar,
                        { backgroundColor: p.avatarColor },
                      ]}
                    >
                      <Text style={styles.customAvatarText}>
                        {p.name.slice(0, 1).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.customName} numberOfLines={1}>
                      {p.name}
                    </Text>
                    <View style={styles.customInputBox}>
                      {splitType === 'percent' && (
                        <Text style={styles.customInputUnit}>%</Text>
                      )}
                      {splitType === 'shares' && (
                        <Text style={styles.customInputUnit}>×</Text>
                      )}
                      {splitType === 'custom' && (
                        <Text style={styles.customInputUnit}>{currencySymbol}</Text>
                      )}
                      <TextInput
                        style={styles.customInput}
                        value={
                          splitType === 'percent'
                            ? (p.percent === 0 || p.percent == null ? '' : String(p.percent))
                            : splitType === 'shares'
                            ? (p.shares === 0 || p.shares == null ? '' : String(p.shares))
                            : (p.amount === 0 ? '' : String(p.amount))
                        }
                        onChangeText={(v) => handleParticipantAmountChange(p.id, v)}
                        placeholder="0"
                        placeholderTextColor={colors.textTertiary}
                        keyboardType="decimal-pad"
                        returnKeyType="done"
                        textAlign="right"
                      />
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Percent/shares computed amounts preview */}
            {(splitType === 'percent' || splitType === 'shares') && participants.length > 0 && effectiveTotal > 0 && (
              <View style={styles.equalPreview}>
                {participants.map((p) => (
                  <View key={p.id} style={styles.equalPreviewRow}>
                    <Text style={styles.equalPreviewName} numberOfLines={1}>{p.name}</Text>
                    <Text style={styles.equalPreviewAmount}>
                      = {currencySymbol}{p.amount.toFixed(2)}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Equal split preview */}
            {splitType === 'equal' && participants.length > 0 && effectiveTotal > 0 && (
              <View style={styles.equalPreview}>
                {participants.map((p) => (
                  <View key={p.id} style={styles.equalPreviewRow}>
                    <Text style={styles.equalPreviewName} numberOfLines={1}>
                      {p.name}
                    </Text>
                    <Text style={styles.equalPreviewAmount}>
                      {currencySymbol}{p.amount.toFixed(2)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </Section>

          {/* ── Line Items ───────────────────────────────────────── */}
          <Section title="Line Items" delay={250}>
            <Text style={styles.lineItemsHint}>
              Break down costs by item for invoice-grade tracking.
            </Text>

            {lineItems.map((item, index) => (
              <LineItemRow
                key={item.id}
                item={item}
                index={index}
                onUpdate={handleUpdateLineItem}
                onRemove={handleRemoveLineItem}
              />
            ))}

            <AddLineItemButton onPress={handleAddLineItem} />
          </Section>

          {/* ── Totals ───────────────────────────────────────────── */}
          {lineItems.length > 0 && (
            <Section title="Totals" delay={300}>
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Subtotal</Text>
                <Text style={styles.totalsValue}>
                  {currencySymbol}{lineSubtotal.toFixed(2)}
                </Text>
              </View>

              <View style={[styles.totalsRow, styles.taxRow]}>
                <Text style={styles.totalsLabel}>Tax rate</Text>
                <View style={styles.taxInputWrapper}>
                  <TextInput
                    style={styles.taxInput}
                    value={taxRateRaw}
                    onChangeText={(v) => {
                      const cleaned = v.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
                      if (parseFloat(cleaned) <= 100 || cleaned === '') {
                        setTaxRateRaw(cleaned);
                      }
                    }}
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                    maxLength={5}
                  />
                  <Text style={styles.taxPercent}>%</Text>
                </View>
              </View>

              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Tax</Text>
                <Text style={styles.totalsValue}>
                  {currencySymbol}{taxAmount.toFixed(2)}
                </Text>
              </View>

              <View style={styles.totalsDivider} />

              <View style={styles.totalsRow}>
                <Text style={styles.totalsFinalLabel}>Total</Text>
                <Text style={styles.totalsFinalValue}>
                  {currencySymbol}{lineTotal.toFixed(2)}
                </Text>
              </View>
            </Section>
          )}

          {/* ── Due Date ─────────────────────────────────────────── */}
          <Section title="Due Date & Reminders" delay={350}>
            <Field label="Due Date" required icon="calendar">
              <Pressable
                style={styles.dateChip}
                onPress={() => {
                  haptic.impact(ImpactFeedbackStyle.Light);
                  setShowDatePicker(true);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Due date: ${format(dueDate, 'dd MMM yyyy')}`}
              >
                <Feather name="calendar" size={16} color={colors.primary} />
                <Text style={styles.dateChipText}>
                  {format(dueDate, 'EEEE, dd MMMM yyyy')}
                </Text>
                <View style={styles.dateBadge}>
                  <Text style={styles.dateBadgeText}>
                    {Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days
                  </Text>
                </View>
              </Pressable>
            </Field>

            {showDatePicker && (
              <DatePickerField
                value={dueDate}
                minimumDate={addDays(new Date(), 1)}
                onChange={(selected) => {
                  setShowDatePicker(Platform.OS === 'ios');
                  setDueDate(selected);
                  haptic.selection();
                }}
              />
            )}

            {/* Quick presets */}
            <View style={styles.presets}>
              {([3, 7, 14, 30] as const).map((days) => {
                const d = addDays(new Date(), days);
                const active = format(dueDate, 'yyyy-MM-dd') === format(d, 'yyyy-MM-dd');
                return (
                  <Pressable
                    key={days}
                    style={[styles.presetChip, active && styles.presetChipActive]}
                    onPress={() => {
                      haptic.selection();
                      setDueDate(d);
                    }}
                  >
                    <Text style={[styles.presetText, active && styles.presetTextActive]}>
                      {days}d
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Reminder toggle */}
            <View style={styles.reminderRow}>
              <View style={styles.reminderInfo}>
                <Feather name="bell" size={16} color={reminderEnabled ? colors.primary : colors.gray400} />
                <View>
                  <Text style={styles.reminderLabel}>Send Reminders</Text>
                  <Text style={styles.reminderHint}>
                    Notify unpaid participants 2 days before due date
                  </Text>
                </View>
              </View>
              <Switch
                value={reminderEnabled}
                onValueChange={(v) => {
                  haptic.selection();
                  setReminderEnabled(v);
                }}
                trackColor={{ false: colors.gray200, true: colors.primaryLight }}
                thumbColor={reminderEnabled ? colors.primary : colors.gray400}
                ios_backgroundColor={colors.gray200}
              />
            </View>
          </Section>

          {/* Bottom spacer for CTA bar */}
          <View style={{ height: spacing[4] }} />
        </ScrollView>

        {/* ── Sticky CTA ───────────────────────────────────────────── */}
        <View
          style={[
            styles.ctaBar,
            { paddingBottom: Math.max(insets.bottom, spacing[4]) },
          ]}
        >
          {/* Summary strip */}
          {effectiveTotal > 0 && participants.length > 0 && (
            <View style={styles.ctaSummary}>
              <Text style={styles.ctaSummaryLabel}>
                {currencySymbol}{effectiveTotal.toFixed(2)} · {participants.length} people
              </Text>
              <Text style={styles.ctaSummaryValue}>
                {currencySymbol}{perPerson.toFixed(2)} each
              </Text>
            </View>
          )}

          <CreateBillCTA
            onPress={handleCreate}
            state={ctaState}
            disabled={
              showSuccessSheet ||
              ctaState !== 'idle' ||
              isCreating ||
              title.trim().length < 3 ||
              participants.length < 2
            }
          />
        </View>
      </KeyboardAvoidingView>

      <BillCreatedSheet
        visible={showSuccessSheet}
        bill={createdBill}
        canShare={Boolean(createdBill?.shareLink)}
        onViewBill={handleViewCreatedBill}
        onCreateAnother={handleCreateAnother}
      />

      {/* ── Add Participant Modal ──────────────────────────────────── */}
      <AddParticipantModal
        visible={addParticipantVisible}
        onClose={() => setAddParticipantVisible(false)}
        onAdd={handleAddParticipant}
        existingNames={participants.map((p) => p.name)}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[3],
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    ...shadow.sm,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.xl,
    backgroundColor: colors.gray50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: typography.sansBold,
    fontSize: fontSize.md,
    color: colors.textPrimary,
  },
  headerSub: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 1,
  },
  draftBtn: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.lg,
    backgroundColor: colors.gray100,
    minWidth: 44,
    alignItems: 'center',
  },
  draftBtnText: {
    fontFamily: typography.sansMedium,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  kav: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
  },

  // Photo
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginBottom: spacing[5],
    paddingBottom: spacing[5],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  photoPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: radius.xl,
    backgroundColor: colors.gray100,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1],
  },
  photoThumb: {
    width: 72,
    height: 72,
    borderRadius: radius.xl,
  },
  photoLabel: {
    fontFamily: typography.sansRegular,
    fontSize: 9,
    color: colors.textTertiary,
  },
  photoMeta: {
    flex: 1,
  },
  photoTitle: {
    fontFamily: typography.sansMedium,
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },
  photoHint: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  photoRemove: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Inputs
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray50,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing[3],
    minHeight: 52,
  },
  inputBoxFilled: {
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  inputBoxError: {
    borderColor: colors.error,
    backgroundColor: colors.errorSurface,
  },
  inputText: {
    flex: 1,
    fontFamily: typography.sansRegular,
    fontSize: fontSize.base,
    color: colors.textPrimary,
    paddingVertical: spacing[3],
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  charCount: {
    fontFamily: typography.monoRegular,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginLeft: spacing[2],
  },

  // Amount
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  amountInputWrapper: {
    flex: 1,
    backgroundColor: colors.gray50,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing[3],
    height: 64,
    justifyContent: 'center',
  },
  amountInput: {
    fontFamily: typography.monoMedium,
    fontSize: fontSize['3xl'],
    color: colors.textPrimary,
    textAlign: 'right',
  },
  amountError: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.xs,
    color: colors.error,
    marginTop: spacing[1],
  },
  perPersonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    marginTop: spacing[3],
    backgroundColor: colors.primarySurface,
    borderRadius: radius.full,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    alignSelf: 'flex-start',
  },
  perPersonText: {
    fontFamily: typography.sansMedium,
    fontSize: fontSize.sm,
    color: colors.primary,
  },

  // Split hint
  splitHint: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing[3],
    lineHeight: fontSize.sm * 1.5,
  },

  // Participants
  participantsErrorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    backgroundColor: colors.errorSurface,
    borderRadius: radius.full,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    alignSelf: 'flex-start',
    marginBottom: spacing[3],
  },
  participantsErrorText: {
    fontFamily: typography.sansMedium,
    fontSize: fontSize.xs,
    color: colors.error,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: spacing[2],
    paddingBottom: spacing[2],
  },

  // Custom amounts
  customAmountsContainer: {
    marginTop: spacing[4],
    gap: spacing[2],
  },
  customAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: colors.gray50,
    borderRadius: radius.lg,
    padding: spacing[3],
  },
  customAvatar: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customAvatarText: {
    fontFamily: typography.sansBold,
    fontSize: 13,
    color: colors.white,
  },
  customName: {
    flex: 1,
    fontFamily: typography.sansMedium,
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },
  customInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing[2],
    height: 38,
    minWidth: 80,
  },
  customInputUnit: {
    fontFamily: typography.monoRegular,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginRight: spacing[1],
  },
  customInput: {
    flex: 1,
    fontFamily: typography.monoMedium,
    fontSize: fontSize.base,
    color: colors.textPrimary,
    textAlign: 'right',
  },

  // Equal preview
  equalPreview: {
    marginTop: spacing[4],
    backgroundColor: colors.gray50,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  equalPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2.5],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  equalPreviewName: {
    fontFamily: typography.sansMedium,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    flex: 1,
    marginRight: spacing[4],
  },
  equalPreviewAmount: {
    fontFamily: typography.monoMedium,
    fontSize: fontSize.sm,
    color: colors.primary,
  },

  // Line items hint
  lineItemsHint: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing[4],
    lineHeight: fontSize.sm * 1.5,
  },

  // Totals
  totalsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[2.5],
  },
  taxRow: {
    alignItems: 'center',
  },
  totalsLabel: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.base,
    color: colors.textSecondary,
  },
  totalsValue: {
    fontFamily: typography.monoMedium,
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },
  taxInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing[2],
    height: 36,
    minWidth: 72,
  },
  taxInput: {
    fontFamily: typography.monoMedium,
    fontSize: fontSize.base,
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'right',
  },
  taxPercent: {
    fontFamily: typography.monoRegular,
    fontSize: fontSize.base,
    color: colors.textSecondary,
    marginLeft: spacing[0.5],
  },
  totalsDivider: {
    height: 2,
    backgroundColor: colors.gray100,
    borderRadius: radius.full,
    marginVertical: spacing[2],
  },
  totalsFinalLabel: {
    fontFamily: typography.sansBold,
    fontSize: fontSize.lg,
    color: colors.textPrimary,
  },
  totalsFinalValue: {
    fontFamily: typography.monoMedium,
    fontSize: fontSize.xl,
    color: colors.primary,
  },

  // Date
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: colors.primarySurface,
    borderWidth: 1.5,
    borderColor: colors.primaryBorder,
    borderRadius: radius.lg,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  dateChipText: {
    flex: 1,
    fontFamily: typography.sansMedium,
    fontSize: fontSize.base,
    color: colors.primary,
  },
  dateBadge: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
  },
  dateBadgeText: {
    fontFamily: typography.sansBold,
    fontSize: fontSize.xs,
    color: colors.white,
  },
  presets: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[3],
    marginBottom: spacing[4],
  },
  presetChip: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    backgroundColor: colors.gray100,
    borderWidth: 1,
    borderColor: colors.border,
  },
  presetChipActive: {
    backgroundColor: colors.primarySurface,
    borderColor: colors.primary,
  },
  presetText: {
    fontFamily: typography.sansMedium,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  presetTextActive: {
    color: colors.primary,
    fontFamily: typography.sansSemiBold,
  },

  // Reminder
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.gray50,
    borderRadius: radius.lg,
    padding: spacing[4],
  },
  reminderInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    flex: 1,
    marginRight: spacing[3],
  },
  reminderLabel: {
    fontFamily: typography.sansSemiBold,
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },
  reminderHint: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: fontSize.xs * 1.5,
  },

  // Category picker
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontFamily: typography.sansMedium,
    fontSize: 13,
    color: colors.gray700,
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipLabel: {
    fontFamily: typography.sansMedium,
    fontSize: 12,
    color: colors.gray600,
  },

  // CTA bar
  ctaBar: {
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    ...shadow.md,
  },
  ctaSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[3],
  },
  ctaSummaryLabel: {
    fontFamily: typography.sansMedium,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  ctaSummaryValue: {
    fontFamily: typography.monoMedium,
    fontSize: fontSize.base,
    color: colors.primary,
  },
});
