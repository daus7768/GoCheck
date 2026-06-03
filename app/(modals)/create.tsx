import { useState, useRef, useCallback } from 'react';
import {
  View,
  TextInput,
  ScrollView,
  StyleSheet,
  Pressable,
  Switch,
  Platform,
  KeyboardAvoidingView,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { format, addDays } from 'date-fns';
import { haptic, ImpactFeedbackStyle, NotificationFeedbackType } from '../../src/lib/haptics';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';

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
import { useProfileStore } from '../../src/store/profileStore';
import type { Participant, LineItem, Currency, SplitType, BillCategory, BillPaymentMethod } from '../../src/types';
import { CURRENCY_SYMBOLS } from '../../src/types';
import { colors, gc, typography, fontSize, spacing, radius, shadow } from '../../src/theme/tokens';
import { useReceiptScan } from '../../src/hooks/useReceiptScan';
import { useTitleSuggest } from '../../src/hooks/useTitleSuggest';
import { useSplitSuggest } from '../../src/hooks/useSplitSuggest';
import { BeamBackground } from '../../src/components/create/BeamBackground';
import { GlowingSection } from '../../src/components/create/GlowingSection';
import { StatusBar } from 'expo-status-bar';
import { AppText } from '../../src/components/AppText';

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
  badge?: string;
  children: React.ReactNode;
  error?: string;
  hint?: string;
}

function Field({ label, required, icon, badge, children, error, hint }: FieldInputProps) {
  return (
    <View style={fieldStyles.container}>
      <View style={fieldStyles.labelRow}>
        {icon && <Feather name={icon} size={14} color={colors.textSecondary} />}
        <AppText style={fieldStyles.label}>
          {label}
          {required && <AppText style={fieldStyles.required}> *</AppText>}
        </AppText>
        {badge && (
          <View style={fieldStyles.badge}>
            <AppText style={fieldStyles.badgeText}>{badge}</AppText>
          </View>
        )}
      </View>
      {children}
      {error ? (
        <Animated.Text entering={FadeIn.duration(200)} style={fieldStyles.error}>
          {error}
        </Animated.Text>
      ) : hint ? (
        <AppText style={fieldStyles.hint}>{hint}</AppText>
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
    fontFamily: typography.sansMedium,
    fontSize: 11,
    color: gc.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  required: { color: gc.danger },
  badge: {
    backgroundColor: gc.amber,
    borderRadius: radius.full,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    marginLeft: spacing[1],
  },
  badgeText: {
    fontFamily: typography.sansBold,
    fontSize: 9,
    color: gc.surface,
    letterSpacing: 0.5,
  },
  error: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.xs,
    color: gc.danger,
    marginTop: spacing[1],
  },
  hint: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.xs,
    color: gc.muted,
    marginTop: spacing[1],
  },
});

// ─── Section Wrapper ──────────────────────────────────────────────────────────

function Section({
  title,
  children,
  delay = 0,
  icon,
}: {
  title: string;
  children: React.ReactNode;
  delay?: number;
  icon?: React.ComponentProps<typeof Feather>['name'];
}) {
  return (
    <GlowingSection title={title} delay={delay} icon={icon}>
      {children}
    </GlowingSection>
  );
}

// ─── AI Pill ──────────────────────────────────────────────────────────────────

function AiBadge({ loading, label, onPress }: { loading: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={[aiStyles.pill, loading && aiStyles.pillDisabled]}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      {loading ? (
        <ActivityIndicator size={10} color={colors.primary} />
      ) : (
        <Feather name="zap" size={11} color={colors.primary} />
      )}
      <AppText style={aiStyles.label}>{loading ? 'Thinking…' : label}</AppText>
    </Pressable>
  );
}

const aiStyles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    backgroundColor: gc.primaryLight,
    borderWidth: 1,
    borderColor: gc.borderEm,
    borderRadius: radius.full,
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1],
    alignSelf: 'flex-start',
    marginTop: spacing[2],
  },
  pillDisabled: { opacity: 0.6 },
  label: {
    fontFamily: typography.sansMedium,
    fontSize: 11,
    color: gc.primary,
  },
});

// ─── Suggestion Chips ─────────────────────────────────────────────────────────

function SuggestionChips({ items, onSelect }: { items: string[]; onSelect: (v: string) => void }) {
  if (items.length === 0) return null;
  return (
    <View style={chipStyles.row}>
      {items.map((s) => (
        <Pressable key={s} onPress={() => onSelect(s)} style={chipStyles.chip} hitSlop={{ top: 6, bottom: 6 }}>
          <AppText style={chipStyles.label}>{s}</AppText>
        </Pressable>
      ))}
    </View>
  );
}

const chipStyles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginTop: spacing[2] },
  chip: {
    backgroundColor: gc.surface3,
    borderWidth: 1,
    borderColor: gc.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
  },
  label: {
    fontFamily: typography.sansMedium,
    fontSize: fontSize.xs,
    color: gc.text,
  },
});

// ─── Tax Chip ─────────────────────────────────────────────────────────────────

function TaxChip({ label, active, onToggle }: { label: string; active: boolean; onToggle: () => void }) {
  return (
    <Pressable
      onPress={() => { haptic.selection(); onToggle(); }}
      style={[taxStyles.chip, active && taxStyles.chipActive]}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
    >
      {active && <Feather name="check" size={11} color="#fff" />}
      <AppText style={[taxStyles.label, active && taxStyles.labelActive]}>{label}</AppText>
    </Pressable>
  );
}

const taxStyles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: gc.border,
    backgroundColor: gc.surface3,
  },
  chipActive: {
    backgroundColor: gc.primary,
    borderColor: gc.primary,
  },
  label: {
    fontFamily: typography.sansMedium,
    fontSize: fontSize.sm,
    color: gc.muted,
  },
  labelActive: { color: gc.white },
});

// ─── Payment Method Pill ──────────────────────────────────────────────────────

const PAYMENT_OPTIONS: { key: BillPaymentMethod; label: string; icon: React.ComponentProps<typeof Feather>['name'] }[] = [
  { key: 'duitnow', label: 'DuitNow QR', icon: 'smartphone' },
  { key: 'bank_transfer', label: 'Bank Transfer', icon: 'credit-card' },
  { key: 'ewallet', label: 'eWallet', icon: 'dollar-sign' },
  { key: 'cash', label: 'Cash', icon: 'briefcase' },
];

// ─── Create Screen ─────────────────────────────────────────────────────────────

export default function CreateBillScreen() {
  const insets = useSafeAreaInsets();
  const { createBill, isCreating, setDraft } = useBillStore();
  const sessionUserId = useProfileStore(s => s.session?.user.id) ?? '';
  const scrollRef = useRef<ScrollView>(null);
  const titleRef = useRef<TextInput>(null);
  const descRef = useRef<TextInput>(null);
  const paymentDetailsRef = useRef<TextInput>(null);

  // ── Gemini hooks ──
  const { scanState, scanResult, scanError, scanReceipt, resetScan } = useReceiptScan();
  const { suggestions: titleSuggestions, loading: titleLoading, suggest: suggestTitle, clear: clearSuggestions } = useTitleSuggest();
  const { suggestion: splitSuggestion, loading: splitLoading, suggest: suggestSplit, clear: clearSplitSuggestion } = useSplitSuggest();

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
  const [taxSst, setTaxSst] = useState(false);
  const [taxService, setTaxService] = useState(false);
  const [taxServiceRate] = useState(10);
  const [dueDate, setDueDate] = useState<Date>(addDays(new Date(), 7));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [description, setDescription] = useState('');
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [groupPhotoUri, setGroupPhotoUri] = useState<string | undefined>();
  const [receiptUri, setReceiptUri] = useState<string | undefined>();
  const [addParticipantVisible, setAddParticipantVisible] = useState(false);
  const [ctaState, setCtaState] = useState<'idle' | 'loading' | 'success'>('idle');
  const [category, setCategory] = useState<BillCategory>('other');
  const [createdBill, setCreatedBill] = useState<Bill | null>(null);
  const [showSuccessSheet, setShowSuccessSheet] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<BillPaymentMethod | undefined>();
  const [paymentDetails, setPaymentDetails] = useState('');
  const [descFocused, setDescFocused] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);

  // ── Derived values ──
  const baseAmount = parseFloat(amountRaw) || 0;
  const lineSubtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const effectiveBase = lineItems.length > 0 ? lineSubtotal : baseAmount;
  const sstAdd = taxSst ? effectiveBase * 0.06 : 0;
  const serviceAdd = taxService ? effectiveBase * (taxServiceRate / 100) : 0;
  const effectiveTotal = effectiveBase + sstAdd + serviceAdd;
  const perPerson = participants.length > 0 ? effectiveTotal / participants.length : 0;
  const currencySymbol = CURRENCY_SYMBOLS[currency];

  // ── Photo pickers ──
  const pickGroupPhoto = async () => {
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

  const pickReceiptPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo access to scan a receipt.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setReceiptUri(uri);
      haptic.notification(NotificationFeedbackType.Success);
      // Trigger Gemini receipt scan
      const scanned = await scanReceipt(uri);
      if (scanned) {
        if (!title && scanned.title) setTitle(scanned.title);
        if (!description && scanned.description) setDescription(scanned.description);
        if (!amountRaw && scanned.total_amount > 0) setAmountRaw(String(scanned.total_amount));
        if (scanned.tax_sst) setTaxSst(true);
        if (scanned.tax_service) setTaxService(true);
        if (scanned.payment_method) setPaymentMethod(scanned.payment_method as BillPaymentMethod);
        if (lineItems.length === 0 && scanned.line_items.length > 0) {
          setLineItems(scanned.line_items.map(li => ({
            id: generateId(),
            description: li.name,
            quantity: li.quantity,
            unitPrice: li.unit_price,
          })));
        }
      }
    }
  };

  // ── Participants ──
  const handleAddParticipant = useCallback((p: Participant) => {
    setParticipants((prev) => {
      const next = [...prev, p];
      if (splitType === 'equal' && effectiveTotal > 0) return distributeEqual(effectiveTotal, next);
      return next;
    });
    if (participantsError) setParticipantsError('');
  }, [splitType, effectiveTotal, participantsError]);

  const handleRemoveParticipant = useCallback((id: string) => {
    setParticipants((prev) => {
      const next = prev.filter((p) => p.id !== id);
      if (splitType === 'equal' && effectiveTotal > 0) return distributeEqual(effectiveTotal, next);
      return next;
    });
  }, [splitType, effectiveTotal]);

  const handleParticipantAmountChange = (id: string, value: string) => {
    const num = parseFloat(value) || 0;
    setParticipants((prev) => {
      const updated = prev.map((p) => {
        if (p.id !== id) return p;
        if (splitType === 'percent') {
          return { ...p, percent: num, amount: effectiveTotal > 0 ? (num / 100) * effectiveTotal : 0 };
        }
        if (splitType === 'shares') return { ...p, shares: num };
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
    setLineItems((prev) => [...prev, { id: generateId(), description: '', quantity: 1, unitPrice: 0 }]);
  };
  const handleUpdateLineItem = (id: string, field: keyof LineItem, value: string | number) => {
    setLineItems((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };
  const handleRemoveLineItem = (id: string) => {
    setLineItems((prev) => prev.filter((item) => item.id !== id));
  };

  // ── AI actions ──
  const handleSuggestTitle = async () => {
    await suggestTitle(description, category);
  };
  const handleApplyTitleSuggestion = (s: string) => {
    setTitle(s);
    clearSuggestions();
    haptic.selection();
  };

  const handleSuggestSplit = async () => {
    await suggestSplit({
      title, description, category,
      totalAmount: effectiveTotal,
      currency,
      participantCount: participants.length,
      lineItems,
    });
  };
  const handleApplySplitSuggestion = () => {
    if (!splitSuggestion) return;
    setSplitType(splitSuggestion.recommended as SplitType);
    clearSplitSuggestion();
    haptic.selection();
  };

  // ── Validation ──
  const validate = (): boolean => {
    let valid = true;
    const trimTitle = title.trim();
    if (!trimTitle) { setTitleError('Bill title is required'); valid = false; }
    else if (trimTitle.length < 3) { setTitleError('Title must be at least 3 characters'); valid = false; }
    else if (trimTitle.length > 100) { setTitleError('Title must be 100 characters or fewer'); valid = false; }
    else setTitleError('');

    if (lineItems.length === 0) {
      if (!amountRaw || parseFloat(amountRaw) <= 0) { setAmountError('Enter a valid amount greater than 0'); valid = false; }
      else setAmountError('');
    } else {
      setAmountError('');
    }

    if (participants.length < 1) { setParticipantsError('Add at least 1 participant'); valid = false; }
    else if (splitType === 'percent') {
      const total = participants.reduce((s, p) => s + (p.percent ?? 0), 0);
      if (Math.abs(total - 100) > 0.01) { setParticipantsError(`Percentages must add up to 100% (currently ${total.toFixed(1)}%)`); valid = false; }
      else setParticipantsError('');
    } else if (splitType === 'custom') {
      const amountTotal = participants.reduce((s, p) => s + p.amount, 0);
      if (effectiveTotal > 0 && Math.abs(amountTotal - effectiveTotal) > 0.02) {
        setParticipantsError(`Amounts must sum to ${currencySymbol}${effectiveTotal.toFixed(2)} (currently ${currencySymbol}${amountTotal.toFixed(2)})`);
        valid = false;
      } else setParticipantsError('');
    } else if (splitType === 'shares') {
      const hasShares = participants.every((p) => (p.shares ?? 0) > 0);
      if (!hasShares) { setParticipantsError('All participants need at least 1 share'); valid = false; }
      else setParticipantsError('');
    } else setParticipantsError('');

    return valid;
  };

  const handleSaveDraft = useCallback(() => {
    setDraft({
      title: title.trim() || undefined,
      description: description.trim() || undefined,
      currency,
      splitType,
      participants,
      lineItems,
      taxSst,
      taxService,
      taxServiceRate,
      dueDate,
      reminderEnabled,
      category,
      paymentMethod,
      paymentDetails: paymentDetails.trim() || undefined,
    });
    haptic.notification(NotificationFeedbackType.Success);
    setDraftSaved(true);
    setTimeout(() => setDraftSaved(false), 2000);
  }, [title, description, currency, splitType, participants, lineItems, taxSst, taxService, taxServiceRate, dueDate, reminderEnabled, category, paymentMethod, paymentDetails, setDraft]);

  const resetForm = useCallback(() => {
    setTitle(''); setTitleError(''); setCurrency('MYR'); setAmountRaw(''); setAmountError('');
    setSplitType('equal'); setParticipants([]); setParticipantsError(''); setLineItems([]);
    setTaxSst(false); setTaxService(false); setDueDate(addDays(new Date(), 7));
    setShowDatePicker(false); setDescription(''); setReminderEnabled(true);
    setGroupPhotoUri(undefined); setReceiptUri(undefined); setCategory('other');
    setPaymentMethod(undefined); setPaymentDetails(''); setCtaState('idle');
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
        organizerId: sessionUserId,
        title: title.trim(),
        description: description.trim() || undefined,
        currency,
        splitType,
        participants: splitType === 'equal' ? distributeEqual(effectiveTotal, participants) : participants,
        lineItems,
        taxRate: 0,
        taxSst,
        taxService,
        taxServiceRate,
        dueDate,
        reminderEnabled,
        groupPhotoUri,
        receiptUri,
        category,
        paymentMethod,
        paymentDetails: paymentDetails.trim() || undefined,
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
    if (id) router.replace(`/(modals)/bill/${id}`);
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

  // Line items vs total mismatch warning
  const lineItemsTotal = lineItems.reduce((s, li) => s + li.quantity * li.unitPrice, 0);
  const showLineItemsMismatch = lineItems.length > 0 && baseAmount > 0
    && Math.abs(lineItemsTotal - baseAmount) > 0.01;

  const showSuggestTitle = description.length >= 10 || category !== 'other';
  const showSuggestSplit = effectiveTotal > 0 && participants.length >= 2;
  const paymentNeedsDetails = paymentMethod === 'bank_transfer' || paymentMethod === 'duitnow';

  return (
    <BeamBackground>
      <StatusBar style="light" />
      {/* ── Header ──────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + spacing[2] }]}>
        <Pressable
          onPress={handleBack}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Feather name="chevron-left" size={22} color={gc.text} />
        </Pressable>

        <View style={styles.headerCenter}>
          <AppText style={styles.headerTitle}>New Bill</AppText>
          <AppText style={styles.headerSub}>
            {participants.length > 0
              ? `${participants.length} participant${participants.length !== 1 ? 's' : ''}`
              : 'Draft · saved just now'}
          </AppText>
        </View>

        <Pressable
          style={[styles.draftBtn, draftSaved && styles.draftBtnSaved]}
          onPress={handleSaveDraft}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Save draft"
        >
          {draftSaved ? (
            <Feather name="check" size={12} color={gc.primary} />
          ) : (
            <Feather name="bookmark" size={11} color={gc.muted} />
          )}
          <AppText style={[styles.draftBtnText, draftSaved && styles.draftBtnTextSaved]}>
            {draftSaved ? 'Saved' : 'Draft'}
          </AppText>
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
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Bill Details ──────────────────────────────────────── */}
          <Section title="Bill Details" icon="file-text" delay={50}>
            {/* Group photo */}
            <Pressable style={styles.photoRow} onPress={pickGroupPhoto} accessibilityRole="button" accessibilityLabel="Add group photo">
              {groupPhotoUri ? (
                <Image source={{ uri: groupPhotoUri }} style={styles.photoThumb} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Feather name="camera" size={22} color={colors.gray400} />
                  <AppText style={styles.photoLabel}>Group Photo</AppText>
                </View>
              )}
              <View style={styles.photoMeta}>
                <AppText style={styles.photoTitle}>{groupPhotoUri ? 'Change photo' : 'Add group photo'}</AppText>
                <AppText style={styles.photoHint}>Optional · Square crop recommended</AppText>
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
              <View style={[styles.inputBox, titleError ? styles.inputBoxError : null, title.length > 0 ? styles.inputBoxFilled : null]}>
                <TextInput
                  ref={titleRef}
                  style={styles.inputText}
                  value={title}
                  onChangeText={(v) => { setTitle(v); if (titleError) setTitleError(''); }}
                  placeholder="e.g. Team Lunch @ Pavilion"
                  placeholderTextColor={colors.textTertiary}
                  autoCapitalize="words"
                  returnKeyType="next"
                  maxLength={100}
                  onSubmitEditing={() => descRef.current?.focus()}
                />
                {title.length > 80 && <AppText style={styles.charCount}>{100 - title.length}</AppText>}
              </View>
            </Field>

            {/* Description */}
            <Field label="Description" icon="align-left" hint="What's this bill for? (optional)">
              <View style={[styles.inputBox, descFocused ? styles.inputBoxFocused : description.length > 0 && styles.inputBoxFilled]}>
                <TextInput
                  ref={descRef}
                  style={[styles.inputText, styles.textArea]}
                  value={description}
                  onChangeText={setDescription}
                  onFocus={() => setDescFocused(true)}
                  onBlur={() => setDescFocused(false)}
                  placeholder="e.g. End-of-quarter team gathering at The Pavilion, Level 6"
                  placeholderTextColor={colors.textTertiary}
                  multiline
                  numberOfLines={3}
                  maxLength={500}
                  returnKeyType="done"
                  blurOnSubmit
                  underlineColorAndroid="transparent"
                />
              </View>
              {showSuggestTitle && (
                <AiBadge
                  loading={titleLoading}
                  label="AI: suggest title"
                  onPress={handleSuggestTitle}
                />
              )}
              <SuggestionChips items={titleSuggestions} onSelect={handleApplyTitleSuggestion} />
            </Field>

            {/* Category — 6 pills */}
            <View style={styles.fieldGroup}>
              <AppText style={styles.fieldLabel}>Category</AppText>
              <View style={styles.chipRow}>
                {(
                  [
                    { key: 'travel', label: '✈ Travel', color: '#4F46E5' },
                    { key: 'food', label: '🍜 Food', color: '#f59e0b' },
                    { key: 'housing', label: '🏠 Housing', color: '#10B981' },
                    { key: 'sports', label: '⚽ Sports', color: '#3B82F6' },
                    { key: 'events', label: '🎉 Events', color: '#EC4899' },
                    { key: 'other', label: '○ Other', color: '#94a3b8' },
                  ] as const
                ).map((item) => (
                  <Pressable
                    key={item.key}
                    style={[styles.chip, category === item.key && { backgroundColor: item.color, borderColor: item.color }]}
                    onPress={() => { setCategory(item.key); haptic.selection(); }}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                  >
                    <AppText style={[styles.chipLabel, category === item.key && { color: '#fff' }]}>
                      {item.label}
                    </AppText>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Receipt photo */}
            <Field label="Receipt" badge="NEW" icon="file">
              <Pressable
                onPress={pickReceiptPhoto}
                style={[styles.receiptBtn, receiptUri ? styles.receiptBtnFilled : null]}
                accessibilityRole="button"
                accessibilityLabel="Scan or upload receipt"
              >
                {scanState === 'scanning' || scanState === 'converting' ? (
                  <>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <AppText style={styles.receiptBtnText}>
                      {scanState === 'converting' ? 'Preparing…' : 'Scanning receipt with AI…'}
                    </AppText>
                  </>
                ) : receiptUri ? (
                  <>
                    <Feather name="check-circle" size={16} color={colors.primary} />
                    <AppText style={styles.receiptBtnText}>Receipt attached · tap to change</AppText>
                    <Pressable
                      onPress={() => { setReceiptUri(undefined); resetScan(); }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={styles.photoRemove}
                    >
                      <Feather name="x" size={13} color={colors.textSecondary} />
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Feather name="camera" size={16} color={colors.primary} />
                    <AppText style={styles.receiptBtnText}>Scan or upload receipt</AppText>
                    <Feather name="zap" size={13} color={colors.textSecondary} />
                  </>
                )}
              </Pressable>

              {scanState === 'review' && scanResult && (
                <Animated.View entering={FadeIn.duration(300)} style={styles.scanBanner}>
                  <Feather name="check-circle" size={13} color={colors.primary} />
                  <AppText style={styles.scanBannerText}>
                    Receipt scanned ({Math.round(scanResult.confidence * 100)}% confidence) · review the filled fields
                  </AppText>
                  <Pressable onPress={resetScan} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Feather name="x" size={13} color={colors.textSecondary} />
                  </Pressable>
                </Animated.View>
              )}

              {scanState === 'error' && (
                <Animated.View entering={FadeIn.duration(200)} style={styles.scanError}>
                  <View style={styles.scanErrorHeader}>
                    <Feather name="alert-circle" size={14} color={gc.danger} />
                    <AppText style={styles.scanErrorTitle}>Resit tidak dapat dibaca</AppText>
                  </View>
                  <AppText style={styles.scanErrorText}>
                    {scanError ?? 'Could not read receipt. Fill in details manually.'}
                  </AppText>
                  <View style={styles.scanErrorActions}>
                    <Pressable
                      onPress={() => receiptUri && scanReceipt(receiptUri)}
                      style={styles.scanRetryBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Feather name="refresh-cw" size={12} color={gc.white} />
                      <AppText style={styles.scanRetryText}>Cuba semula</AppText>
                    </Pressable>
                    <Pressable
                      onPress={() => { setReceiptUri(undefined); resetScan(); }}
                      style={styles.scanDismissBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <AppText style={styles.scanDismissText}>Isi manual</AppText>
                    </Pressable>
                  </View>
                </Animated.View>
              )}
            </Field>
          </Section>

          {/* ── Amount Block ──────────────────────────────────────── */}
          <Section title="Amount & Tax" icon="dollar-sign" delay={100}>
            <View style={styles.amountRow}>
              <CurrencySelector value={currency} onChange={setCurrency} />
              <View style={[styles.amountInputWrapper, amountError ? styles.inputBoxError : null, parseFloat(amountRaw) > 0 && styles.inputBoxFilled]}>
                <TextInput
                  style={styles.amountInput}
                  value={amountRaw}
                  onChangeText={(v) => {
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
            {amountError && <AppText style={styles.amountError}>{amountError}</AppText>}

            {/* Tax toggles */}
            <View style={styles.taxRow}>
              <AppText style={styles.taxRowLabel}>Tax</AppText>
              <View style={styles.taxChips}>
                <TaxChip label="SST 6%" active={taxSst} onToggle={() => setTaxSst(v => !v)} />
                <TaxChip label={`Service ${taxServiceRate}%`} active={taxService} onToggle={() => setTaxService(v => !v)} />
              </View>
            </View>

            {(taxSst || taxService) && effectiveBase > 0 && (
              <Animated.View entering={FadeIn.duration(200)} style={styles.taxBreakdown}>
                <View style={styles.taxBreakdownRow}>
                  <AppText style={styles.taxBreakdownLabel}>Subtotal</AppText>
                  <AppText style={styles.taxBreakdownValue}>{currencySymbol}{effectiveBase.toFixed(2)}</AppText>
                </View>
                {taxSst && (
                  <View style={styles.taxBreakdownRow}>
                    <AppText style={styles.taxBreakdownLabel}>SST (6%)</AppText>
                    <AppText style={styles.taxBreakdownValue}>+{currencySymbol}{sstAdd.toFixed(2)}</AppText>
                  </View>
                )}
                {taxService && (
                  <View style={styles.taxBreakdownRow}>
                    <AppText style={styles.taxBreakdownLabel}>Service ({taxServiceRate}%)</AppText>
                    <AppText style={styles.taxBreakdownValue}>+{currencySymbol}{serviceAdd.toFixed(2)}</AppText>
                  </View>
                )}
                <View style={[styles.taxBreakdownRow, styles.taxBreakdownTotal]}>
                  <AppText style={styles.taxBreakdownTotalLabel}>Total</AppText>
                  <AppText style={styles.taxBreakdownTotalValue}>{currencySymbol}{effectiveTotal.toFixed(2)}</AppText>
                </View>
              </Animated.View>
            )}

            {/* Per-person preview */}
            {participants.length >= 2 && effectiveTotal > 0 && (
              <Animated.View entering={FadeIn.duration(300)} style={styles.perPersonBadge}>
                <Feather name="users" size={13} color={colors.primary} />
                <AppText style={styles.perPersonText}>
                  {currencySymbol}{perPerson.toFixed(2)} per person
                </AppText>
              </Animated.View>
            )}
          </Section>

          {/* ── Split Type ───────────────────────────────────────── */}
          <Section title="How to Split" icon="git-branch" delay={150}>
            {/* AI split suggest */}
            {showSuggestSplit && !splitSuggestion && (
              <AiBadge loading={splitLoading} label="AI: suggest split" onPress={handleSuggestSplit} />
            )}
            {splitSuggestion && (
              <Animated.View entering={FadeIn.duration(300)} style={styles.splitSuggestionCard}>
                <View style={styles.splitSuggestionLeft}>
                  <View style={styles.splitSuggestionHeader}>
                    <Feather name="zap" size={12} color={colors.primary} />
                    <AppText style={styles.splitSuggestionTag}>AI Recommendation</AppText>
                  </View>
                  <AppText style={styles.splitSuggestionRec}>{splitSuggestion.recommended} split</AppText>
                  <AppText style={styles.splitSuggestionReason}>{splitSuggestion.reason}</AppText>
                </View>
                <Pressable onPress={handleApplySplitSuggestion} style={styles.splitApplyBtn}>
                  <AppText style={styles.splitApplyText}>Apply</AppText>
                </Pressable>
              </Animated.View>
            )}

            <SplitTypeControl value={splitType} onChange={setSplitType} />
            <AppText style={styles.splitHint}>
              {splitType === 'equal' && 'Amount divided equally among all participants.'}
              {splitType === 'custom' && 'Set a specific amount for each participant.'}
              {splitType === 'percent' && 'Assign a percentage share to each participant.'}
              {splitType === 'shares' && 'Assign weighted shares — amounts scale with total.'}
            </AppText>
          </Section>

          {/* ── Participants ─────────────────────────────────────── */}
          <Section title={`Participants${participants.length > 0 ? ` (${participants.length})` : ''}`} icon="users" delay={200}>
            {participantsError && (
              <Animated.View entering={FadeIn.duration(200)} style={styles.participantsErrorBadge}>
                <Feather name="alert-circle" size={13} color={colors.error} />
                <AppText style={styles.participantsErrorText}>{participantsError}</AppText>
              </Animated.View>
            )}

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
              {participants.slice(0, 5).map((p) => (
                <ParticipantChip key={p.id} participant={p} onRemove={handleRemoveParticipant} />
              ))}
              {participants.length > 5 && (
                <AddParticipantChip overflowCount={participants.length - 5} onPress={() => setAddParticipantVisible(true)} />
              )}
              <AddParticipantChip onPress={() => setAddParticipantVisible(true)} />
            </ScrollView>

            {splitType !== 'equal' && participants.length > 0 && (
              <View style={styles.customAmountsContainer}>
                {participants.map((p) => (
                  <View key={p.id} style={styles.customAmountRow}>
                    <View style={[styles.customAvatar, { backgroundColor: p.avatarColor }]}>
                      <AppText style={styles.customAvatarText}>{p.name.slice(0, 1).toUpperCase()}</AppText>
                    </View>
                    <AppText style={styles.customName} numberOfLines={1}>{p.name}</AppText>
                    <View style={styles.customInputBox}>
                      {splitType === 'percent' && <AppText style={styles.customInputUnit}>%</AppText>}
                      {splitType === 'shares' && <AppText style={styles.customInputUnit}>×</AppText>}
                      {splitType === 'custom' && <AppText style={styles.customInputUnit}>{currencySymbol}</AppText>}
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

            {(splitType === 'percent' || splitType === 'shares' || splitType === 'equal') && participants.length > 0 && effectiveTotal > 0 && (
              <View style={styles.equalPreview}>
                {participants.map((p) => (
                  <View key={p.id} style={styles.equalPreviewRow}>
                    <AppText style={styles.equalPreviewName} numberOfLines={1}>{p.name}</AppText>
                    <AppText style={styles.equalPreviewAmount}>
                      {splitType === 'percent' ? `${p.percent ?? 0}% = ` : ''}
                      {currencySymbol}{p.amount.toFixed(2)}
                    </AppText>
                  </View>
                ))}
              </View>
            )}
          </Section>

          {/* ── Line Items ───────────────────────────────────────── */}
          <Section title="Line Items" icon="list" delay={250}>
            <AppText style={styles.lineItemsHint}>Break down costs by item for invoice-grade tracking.</AppText>
            {lineItems.map((item, index) => (
              <LineItemRow key={item.id} item={item} index={index} onUpdate={handleUpdateLineItem} onRemove={handleRemoveLineItem} />
            ))}
            <AddLineItemButton onPress={handleAddLineItem} />
            {showLineItemsMismatch && (
              <Animated.View entering={FadeIn.duration(200)} style={styles.mismatchWarning}>
                <Feather name="alert-triangle" size={13} color="#B45309" />
                <AppText style={styles.mismatchText}>
                  Line items ({currencySymbol}{lineItemsTotal.toFixed(2)}) differ from total ({currencySymbol}{baseAmount.toFixed(2)})
                </AppText>
              </Animated.View>
            )}
          </Section>

          {/* ── Totals ───────────────────────────────────────────── */}
          {lineItems.length > 0 && (
            <Section title="Totals" icon="bar-chart-2" delay={300}>
              <View style={styles.totalsRow}>
                <AppText style={styles.totalsLabel}>Subtotal</AppText>
                <AppText style={styles.totalsValue}>{currencySymbol}{lineSubtotal.toFixed(2)}</AppText>
              </View>
              {taxSst && (
                <View style={styles.totalsRow}>
                  <AppText style={styles.totalsLabel}>SST (6%)</AppText>
                  <AppText style={styles.totalsValue}>{currencySymbol}{(lineSubtotal * 0.06).toFixed(2)}</AppText>
                </View>
              )}
              {taxService && (
                <View style={styles.totalsRow}>
                  <AppText style={styles.totalsLabel}>Service ({taxServiceRate}%)</AppText>
                  <AppText style={styles.totalsValue}>{currencySymbol}{(lineSubtotal * taxServiceRate / 100).toFixed(2)}</AppText>
                </View>
              )}
              <View style={styles.totalsDivider} />
              <View style={styles.totalsRow}>
                <AppText style={styles.totalsFinalLabel}>Total</AppText>
                <AppText style={styles.totalsFinalValue}>{currencySymbol}{effectiveTotal.toFixed(2)}</AppText>
              </View>
            </Section>
          )}

          {/* ── Payment Method ───────────────────────────────────── */}
          <Section title="Payment Method" icon="credit-card" delay={320}>
            <View style={styles.paymentGrid}>
              {PAYMENT_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.key}
                  style={[styles.paymentPill, paymentMethod === opt.key && styles.paymentPillActive]}
                  onPress={() => { haptic.selection(); setPaymentMethod(prev => prev === opt.key ? undefined : opt.key); }}
                  hitSlop={{ top: 6, bottom: 6 }}
                >
                  <Feather name={opt.icon} size={15} color={paymentMethod === opt.key ? '#fff' : colors.textSecondary} />
                  <AppText style={[styles.paymentPillLabel, paymentMethod === opt.key && styles.paymentPillLabelActive]}>
                    {opt.label}
                  </AppText>
                </Pressable>
              ))}
            </View>

            {paymentNeedsDetails && (
              <Animated.View entering={FadeInDown.duration(250).springify()} style={{ marginTop: spacing[3] }}>
                <Field label={paymentMethod === 'bank_transfer' ? 'Bank Details' : 'Payment Details'} icon="info">
                  <View style={[styles.inputBox, paymentDetails.length > 0 && styles.inputBoxFilled]}>
                    <TextInput
                      ref={paymentDetailsRef}
                      style={[styles.inputText, styles.textArea]}
                      value={paymentDetails}
                      onChangeText={setPaymentDetails}
                      placeholder={
                        paymentMethod === 'bank_transfer'
                          ? 'Maybank · 1234 5678 · John Doe'
                          : 'DuitNow ID or QR reference'
                      }
                      placeholderTextColor={colors.textTertiary}
                      multiline
                      numberOfLines={2}
                      maxLength={300}
                      returnKeyType="done"
                      blurOnSubmit
                    />
                  </View>
                </Field>
              </Animated.View>
            )}
          </Section>

          {/* ── Due Date ─────────────────────────────────────────── */}
          <Section title="Due Date & Reminders" icon="calendar" delay={350}>
            <Field label="Due Date" required icon="calendar">
              <Pressable
                style={styles.dateChip}
                onPress={() => { haptic.impact(ImpactFeedbackStyle.Light); setShowDatePicker(true); }}
                accessibilityRole="button"
                accessibilityLabel={`Due date: ${format(dueDate, 'dd MMM yyyy')}`}
              >
                <Feather name="calendar" size={16} color={colors.primary} />
                <AppText style={styles.dateChipText}>{format(dueDate, 'EEEE, dd MMMM yyyy')}</AppText>
                <View style={styles.dateBadge}>
                  <AppText style={styles.dateBadgeText}>
                    {Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days
                  </AppText>
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

            <View style={styles.presets}>
              {([3, 7, 14, 30] as const).map((days) => {
                const d = addDays(new Date(), days);
                const active = format(dueDate, 'yyyy-MM-dd') === format(d, 'yyyy-MM-dd');
                return (
                  <Pressable
                    key={days}
                    style={[styles.presetChip, active && styles.presetChipActive]}
                    onPress={() => { haptic.selection(); setDueDate(d); }}
                  >
                    <AppText style={[styles.presetText, active && styles.presetTextActive]}>{days}d</AppText>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.reminderRow}>
              <View style={styles.reminderInfo}>
                <Feather name="bell" size={16} color={reminderEnabled ? gc.primary : gc.muted} />
                <View style={styles.reminderTextBlock}>
                  <AppText style={styles.reminderLabel}>Send Reminders</AppText>
                  <AppText style={styles.reminderHint}>Notify unpaid participants 2 days before due date</AppText>
                </View>
              </View>
              <Switch
                value={reminderEnabled}
                onValueChange={(v) => { haptic.selection(); setReminderEnabled(v); }}
                trackColor={{ false: gc.surface2, true: gc.primaryGlow }}
                thumbColor={reminderEnabled ? gc.primary : gc.muted}
                ios_backgroundColor={gc.surface2}
              />
            </View>
          </Section>

          <View style={{ height: spacing[4] }} />
        </ScrollView>

        {/* ── Sticky CTA ───────────────────────────────────────────── */}
        <View style={[styles.ctaBar, { paddingBottom: Math.max(insets.bottom, spacing[4]) }]}>
          {effectiveTotal > 0 && participants.length > 0 && (
            <View style={styles.ctaSummary}>
              <AppText style={styles.ctaSummaryLabel}>
                {currencySymbol}{effectiveTotal.toFixed(2)} · {participants.length} people
              </AppText>
              <AppText style={styles.ctaSummaryValue}>{currencySymbol}{perPerson.toFixed(2)} each</AppText>
            </View>
          )}
          <CreateBillCTA
            onPress={handleCreate}
            state={ctaState}
            disabled={showSuccessSheet || ctaState !== 'idle' || isCreating || title.trim().length < 3 || participants.length < 1}
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

      <AddParticipantModal
        visible={addParticipantVisible}
        onClose={() => setAddParticipantVisible(false)}
        onAdd={handleAddParticipant}
        existingNames={participants.map((p) => p.name)}
      />
    </BeamBackground>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[3],
    backgroundColor: 'rgba(13,17,23,0.85)',
    borderBottomWidth: 0.5,
    borderBottomColor: gc.border,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: radius.full,
    backgroundColor: gc.surface2, borderWidth: 1, borderColor: gc.border,
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { alignItems: 'center' },
  headerTitle: { fontFamily: typography.sansBold, fontSize: fontSize.md, color: gc.text },
  headerSub: { fontFamily: typography.sansRegular, fontSize: 10, color: gc.hint, marginTop: 2 },
  draftBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1],
    paddingHorizontal: spacing[2.5], paddingVertical: spacing[1],
    borderRadius: radius.full, backgroundColor: gc.surface2,
    borderWidth: 1, borderColor: gc.border,
    minWidth: 52,
  },
  draftBtnSaved: { borderColor: gc.borderEm, backgroundColor: gc.primaryLight },
  draftBtnText: { fontFamily: typography.sansMedium, fontSize: 11, color: gc.muted },
  draftBtnTextSaved: { color: gc.primary },
  kav: { flex: 1 },
  scroll: { paddingHorizontal: spacing[4], paddingTop: spacing[4] },

  // Photo
  photoRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    marginBottom: spacing[5], paddingBottom: spacing[5],
    borderBottomWidth: 0.5, borderBottomColor: gc.border,
  },
  photoPlaceholder: {
    width: 64, height: 64, borderRadius: radius.lg, backgroundColor: gc.surface3,
    borderWidth: 1.5, borderColor: gc.border, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: spacing[1],
  },
  photoThumb: { width: 64, height: 64, borderRadius: radius.lg },
  photoLabel: { fontFamily: typography.sansRegular, fontSize: 9, color: gc.hint },
  photoMeta: { flex: 1 },
  photoTitle: { fontFamily: typography.sansMedium, fontSize: fontSize.sm, color: gc.text },
  photoHint: { fontFamily: typography.sansRegular, fontSize: fontSize.xs, color: gc.muted, marginTop: 2 },
  photoRemove: {
    width: 26, height: 26, borderRadius: radius.full,
    backgroundColor: gc.surface3, borderWidth: 1, borderColor: gc.border,
    alignItems: 'center', justifyContent: 'center',
  },

  // Receipt
  receiptBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: gc.primaryLight, borderWidth: 1, borderColor: gc.borderEm,
    borderRadius: radius.lg, paddingHorizontal: spacing[4], paddingVertical: spacing[3],
  },
  receiptBtnFilled: { backgroundColor: gc.primaryLight, borderColor: gc.primary },
  receiptBtnText: { flex: 1, fontFamily: typography.sansMedium, fontSize: fontSize.sm, color: gc.primary },
  scanBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: spacing[2],
    backgroundColor: gc.primaryLight, borderRadius: radius.lg,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderWidth: 1, borderColor: gc.borderEm,
  },
  scanBannerText: { flex: 1, fontFamily: typography.sansRegular, fontSize: fontSize.xs, color: gc.primary },
  scanError: {
    marginTop: spacing[2],
    backgroundColor: gc.dangerSurface, borderRadius: radius.lg,
    paddingHorizontal: spacing[3], paddingVertical: spacing[3],
    borderWidth: 1, borderColor: gc.danger,
    gap: spacing[2],
  },
  scanErrorHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[1.5] },
  scanErrorTitle: { fontFamily: typography.sansBold, fontSize: fontSize.sm, color: gc.danger },
  scanErrorText: { fontFamily: typography.sansRegular, fontSize: fontSize.xs, color: gc.text, lineHeight: fontSize.xs * 1.5 },
  scanErrorActions: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[1] },
  scanRetryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1.5],
    backgroundColor: gc.danger, borderRadius: radius.md,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
  },
  scanRetryText: { fontFamily: typography.sansBold, fontSize: fontSize.xs, color: gc.white },
  scanDismissBtn: {
    backgroundColor: 'transparent', borderRadius: radius.md,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderWidth: 1, borderColor: gc.border,
  },
  scanDismissText: { fontFamily: typography.sansMedium, fontSize: fontSize.xs, color: gc.muted },

  // Inputs
  inputBox: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: gc.surface3,
    borderWidth: 1, borderColor: gc.border, borderRadius: radius.md,
    paddingHorizontal: spacing[3], minHeight: 48,
  },
  inputBoxFilled: { borderColor: gc.borderEm, backgroundColor: gc.surface3 },
  inputBoxFocused: { borderColor: 'transparent', backgroundColor: gc.surface3 },
  inputBoxError: { borderColor: gc.danger, backgroundColor: gc.dangerSurface },
  inputText: { flex: 1, fontFamily: typography.sansRegular, fontSize: 14, color: gc.text, paddingVertical: spacing[2.5] },
  textArea: { minHeight: 72, textAlignVertical: 'top' },
  charCount: { fontFamily: typography.monoRegular, fontSize: fontSize.xs, color: gc.muted, marginLeft: spacing[2] },

  // Amount
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  amountInputWrapper: {
    flex: 1, backgroundColor: gc.surface3, borderWidth: 1, borderColor: gc.border,
    borderRadius: radius.md, paddingHorizontal: spacing[3], height: 58, justifyContent: 'center',
    borderLeftWidth: 2.5, borderLeftColor: gc.primary,
  },
  amountInput: { fontFamily: typography.sansBold, fontSize: 24, color: gc.text, textAlign: 'right' },
  amountError: { fontFamily: typography.sansRegular, fontSize: fontSize.xs, color: gc.danger, marginTop: spacing[1] },

  // Tax
  taxRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginTop: spacing[3] },
  taxRowLabel: { fontFamily: typography.sansMedium, fontSize: 11, color: gc.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  taxChips: { flexDirection: 'row', gap: spacing[2] },
  taxBreakdown: {
    marginTop: spacing[3], backgroundColor: gc.surface3, borderRadius: radius.md,
    padding: spacing[3], gap: spacing[1], borderWidth: 1, borderColor: gc.border,
  },
  taxBreakdownRow: { flexDirection: 'row', justifyContent: 'space-between' },
  taxBreakdownLabel: { fontFamily: typography.sansRegular, fontSize: fontSize.sm, color: gc.muted },
  taxBreakdownValue: { fontFamily: typography.monoMedium, fontSize: fontSize.sm, color: gc.text },
  taxBreakdownTotal: { marginTop: spacing[2], paddingTop: spacing[2], borderTopWidth: 0.5, borderTopColor: gc.border },
  taxBreakdownTotalLabel: { fontFamily: typography.sansBold, fontSize: fontSize.base, color: gc.text },
  taxBreakdownTotalValue: { fontFamily: typography.sansBold, fontSize: fontSize.lg, color: gc.primary },

  perPersonBadge: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1.5], marginTop: spacing[3],
    backgroundColor: gc.primaryLight, borderRadius: radius.md,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2.5],
    borderWidth: 1, borderColor: gc.borderEm,
  },
  perPersonText: { fontFamily: typography.sansBold, fontSize: fontSize.sm, color: gc.primary },

  // Split suggestion
  splitSuggestionCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    backgroundColor: gc.primaryLight, borderRadius: radius.md,
    padding: spacing[3], marginBottom: spacing[3],
    borderWidth: 1, borderColor: gc.borderEm,
  },
  splitSuggestionLeft: { flex: 1 },
  splitSuggestionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], marginBottom: 2 },
  splitSuggestionTag: { fontFamily: typography.sansMedium, fontSize: 10, color: gc.primary, textTransform: 'uppercase', letterSpacing: 0.5 },
  splitSuggestionRec: { fontFamily: typography.sansBold, fontSize: fontSize.base, color: gc.text, textTransform: 'capitalize' },
  splitSuggestionReason: { fontFamily: typography.sansRegular, fontSize: fontSize.xs, color: gc.muted, marginTop: 2 },
  splitApplyBtn: { backgroundColor: gc.primary, borderRadius: radius.md, paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  splitApplyText: { fontFamily: typography.sansBold, fontSize: fontSize.sm, color: gc.white },

  splitHint: {
    fontFamily: typography.sansRegular, fontSize: fontSize.sm, color: gc.muted,
    marginTop: spacing[3], lineHeight: fontSize.sm * 1.5,
  },

  // Participants
  participantsErrorBadge: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1],
    backgroundColor: gc.dangerSurface, borderRadius: radius.full,
    paddingHorizontal: spacing[3], paddingVertical: spacing[1.5],
    alignSelf: 'flex-start', marginBottom: spacing[3],
    borderWidth: 1, borderColor: gc.danger,
  },
  participantsErrorText: { fontFamily: typography.sansMedium, fontSize: fontSize.xs, color: gc.danger },
  chipsRow: { flexDirection: 'row', gap: spacing[2], paddingBottom: spacing[2] },

  customAmountsContainer: { marginTop: spacing[4], gap: spacing[2] },
  customAmountRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    backgroundColor: gc.surface3, borderRadius: radius.md, padding: spacing[3],
    borderWidth: 1, borderColor: gc.border,
  },
  customAvatar: { width: 32, height: 32, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  customAvatarText: { fontFamily: typography.sansBold, fontSize: 13, color: gc.white },
  customName: { flex: 1, fontFamily: typography.sansMedium, fontSize: fontSize.sm, color: gc.text },
  customInputBox: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: gc.surface,
    borderWidth: 1, borderColor: gc.border, borderRadius: radius.sm,
    paddingHorizontal: spacing[2], height: 36, minWidth: 80,
  },
  customInputUnit: { fontFamily: typography.monoRegular, fontSize: fontSize.sm, color: gc.muted, marginRight: spacing[1] },
  customInput: { flex: 1, fontFamily: typography.monoMedium, fontSize: fontSize.sm, color: gc.text, textAlign: 'right' },

  equalPreview: { marginTop: spacing[4], backgroundColor: gc.surface3, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: gc.border },
  equalPreviewRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[3], paddingVertical: spacing[2.5],
    borderBottomWidth: 0.5, borderBottomColor: gc.border,
  },
  equalPreviewName: { fontFamily: typography.sansMedium, fontSize: fontSize.sm, color: gc.text, flex: 1, marginRight: spacing[4] },
  equalPreviewAmount: { fontFamily: typography.monoMedium, fontSize: fontSize.sm, color: gc.primary },

  // Line items
  lineItemsHint: { fontFamily: typography.sansRegular, fontSize: fontSize.sm, color: gc.muted, marginBottom: spacing[4], lineHeight: fontSize.sm * 1.5 },
  mismatchWarning: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: spacing[3],
    backgroundColor: gc.amberSurface, borderRadius: radius.md, padding: spacing[3],
    borderWidth: 1, borderColor: gc.amber,
  },
  mismatchText: { flex: 1, fontFamily: typography.sansRegular, fontSize: fontSize.xs, color: gc.amber },

  // Totals
  totalsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing[2.5] },
  totalsLabel: { fontFamily: typography.sansRegular, fontSize: fontSize.sm, color: gc.muted },
  totalsValue: { fontFamily: typography.monoMedium, fontSize: fontSize.sm, color: gc.text },
  totalsDivider: { height: 1, backgroundColor: gc.border, marginVertical: spacing[2] },
  totalsFinalLabel: { fontFamily: typography.sansBold, fontSize: fontSize.base, color: gc.text },
  totalsFinalValue: { fontFamily: typography.sansBold, fontSize: fontSize.lg, color: gc.primary },

  // Payment method
  paymentGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  paymentPill: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingHorizontal: spacing[3], paddingVertical: spacing[2.5],
    borderRadius: radius.md, borderWidth: 1, borderColor: gc.border,
    backgroundColor: gc.surface3,
    minWidth: '47%',
  },
  paymentPillActive: { backgroundColor: gc.primaryLight, borderColor: gc.primary },
  paymentPillLabel: { fontFamily: typography.sansMedium, fontSize: fontSize.sm, color: gc.muted },
  paymentPillLabelActive: { color: gc.primary },

  // Date
  dateChip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: gc.primaryLight, borderWidth: 1, borderColor: gc.borderEm,
    borderRadius: radius.md, paddingHorizontal: spacing[3], paddingVertical: spacing[3],
  },
  dateChipText: { flex: 1, fontFamily: typography.sansMedium, fontSize: fontSize.sm, color: gc.text },
  dateBadge: { backgroundColor: gc.primary, borderRadius: radius.full, paddingHorizontal: spacing[2], paddingVertical: 2 },
  dateBadgeText: { fontFamily: typography.sansBold, fontSize: 10, color: gc.white },
  presets: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[3], marginBottom: spacing[4] },
  presetChip: { paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.full, backgroundColor: gc.surface3, borderWidth: 1, borderColor: gc.border },
  presetChipActive: { backgroundColor: gc.primary, borderColor: gc.primary },
  presetText: { fontFamily: typography.sansMedium, fontSize: fontSize.sm, color: gc.muted },
  presetTextActive: { color: gc.white, fontFamily: typography.sansBold },

  // Reminder
  reminderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: gc.surface3, borderRadius: radius.md,
    paddingVertical: spacing[3], paddingLeft: spacing[3], paddingRight: spacing[2],
    borderWidth: 1, borderColor: gc.border, gap: spacing[3],
  },
  reminderInfo: { flexDirection: 'row', alignItems: 'center', gap: spacing[2.5], flex: 1, minWidth: 0 },
  reminderTextBlock: { flex: 1, minWidth: 0 },
  reminderLabel: { fontFamily: typography.sansBold, fontSize: fontSize.sm, color: gc.text },
  reminderHint: { fontFamily: typography.sansRegular, fontSize: fontSize.xs, color: gc.muted, marginTop: 2, lineHeight: fontSize.xs * 1.6, flexWrap: 'wrap' },

  // Category
  fieldGroup: { marginBottom: 16 },
  fieldLabel: {
    fontFamily: typography.sansMedium, fontSize: 11, color: gc.muted,
    marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full,
    borderWidth: 1, borderColor: gc.border, backgroundColor: gc.surface3,
  },
  chipLabel: { fontFamily: typography.sansMedium, fontSize: 12, color: gc.muted },

  // CTA
  ctaBar: {
    backgroundColor: 'rgba(13,17,23,0.92)', borderTopWidth: 0.5,
    borderTopColor: gc.border, paddingHorizontal: spacing[4], paddingTop: spacing[3],
  },
  ctaSummary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[3] },
  ctaSummaryLabel: { fontFamily: typography.sansMedium, fontSize: fontSize.sm, color: gc.muted },
  ctaSummaryValue: { fontFamily: typography.sansBold, fontSize: fontSize.base, color: gc.primary },
});
