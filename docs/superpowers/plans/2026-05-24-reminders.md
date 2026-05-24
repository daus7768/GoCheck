# Reminders / Nudge Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a bell-icon entry point in the Bills tab header that opens a full Reminders screen (Queue / Sent / Settings panes) letting bill organizers send WhatsApp and email nudges to unpaid participants.

**Architecture:** A new Zustand `reminderStore` owns sent-reminder history, settings, and batch state. Queue items are computed on-the-fly from the bill store using a pure `buildQueueItems` utility. Sending is deep-link-only (wa.me / mailto) — no server; Supabase stores the log with 3× exponential retry.

**Tech Stack:** Expo 51, expo-router 3, React Native, Zustand, Supabase JS v2, react-native-reanimated, @expo/vector-icons (Feather), expo-haptics (via `src/lib/haptics.ts` wrapper)

---

## File Map

| Status | Path | Responsibility |
|--------|------|----------------|
| Modify | `src/types/index.ts` | Add `phone?` to Participant; add `ReminderRow`, `ReminderSettings`, `QueueItem` |
| Create | `src/lib/reminderTemplates.ts` | `formatCurrency`, `renderTemplate`, `REMINDER_PREVIEWS` |
| Create | `src/lib/queueUtils.ts` | `buildQueueItems`, `computeReliability` |
| Modify | `src/lib/supabase.ts` | Add `insertReminder`, `loadReminders`, `loadSettings`, `upsertSettings` |
| Create | `src/store/reminderStore.ts` | Zustand store: sent, settings, batch state, actions |
| Modify | `app/_layout.tsx` | Register `(modals)/reminders` Stack.Screen |
| Create | `app/(modals)/reminders.tsx` | Screen shell: header + 3-tab SegmentedControl |
| Create | `src/components/reminders/SettingsPane.tsx` | Three cards: cadence, tone, skip+cap |
| Create | `src/components/reminders/QueueRow.tsx` | Per-participant row with avatar, chips, channel buttons |
| Create | `src/components/reminders/BatchToast.tsx` | Sequential send banner |
| Create | `src/components/reminders/QueuePane.tsx` | Batch card + filtered+sorted list + empty state |
| Create | `src/components/reminders/SentRow.tsx` | Channel icon + name + relative time |
| Create | `src/components/reminders/SentPane.tsx` | Info note + sent list + empty state |
| Modify | `app/(tabs)/bills.tsx` | Add bell icon + badge to header |

---

## Task 1: Types + Template Utilities

**Files:**
- Modify: `src/types/index.ts`
- Create: `src/lib/reminderTemplates.ts`

- [ ] **Step 1: Add reminder types to `src/types/index.ts`**

Add `phone?: string` to `Participant` (after `email?`), and add these new interfaces after the `Payment` interface:

```typescript
// In Participant interface, after email?:
  phone?: string;

// After the Payment interface, before CURRENCY_SYMBOLS:

export type ReminderChannel = 'whatsapp' | 'email';

export type ReminderTone = 'friendly' | 'firm' | 'final';

export type ReminderCadence = 'manual' | 'smart' | 'aggressive';

export interface ReminderSettings {
  cadence: ReminderCadence;
  tone: ReminderTone;
  skipPaid: boolean;
  maxPerWeek: number;
}

export interface ReminderRow {
  id: string;
  billId: string;
  participantId: string;
  recipientName: string;
  channel: ReminderChannel;
  sentAt: string;
  syncFailed?: boolean;
}

export interface QueueItem {
  billId: string;
  billTitle: string;
  participantId: string;
  participantName: string;
  participantPhone?: string;
  participantEmail?: string;
  participantAvatarColor: string;
  amount: number;
  currency: Currency;
  dueDate: string;
  shareLink: string;
  daysToDue: number;
}

export type ReliabilityLabel = 'reliable' | 'on-time' | 'slow' | 'at-risk';
```

- [ ] **Step 2: Create `src/lib/reminderTemplates.ts`**

```typescript
import { CURRENCY_SYMBOLS } from '../types';
import type { Currency, ReminderTone } from '../types';

export function formatCurrency(amount: number, currency: Currency): string {
  const sym = CURRENCY_SYMBOLS[currency] ?? currency;
  return `${sym} ${amount.toFixed(2)}`;
}

interface TemplateTokens {
  name: string;
  bill: string;
  amount: string;
  when: string;
  days: number;
  link: string;
}

export function renderTemplate(tone: ReminderTone, tokens: TemplateTokens): string {
  const templates: Record<ReminderTone, string> = {
    friendly: `Hey {name}! Just a heads up — your share of "{bill}" ({amount}) is due {when}. Easy to settle from the link below. Cheers! 🙌\n{link}`,
    firm: `Hi {name}, your share of "{bill}" ({amount}) is due {when}. Please settle at your earliest convenience: {link}`,
    final: `{name} — final reminder. {amount} for "{bill}" is overdue by {days} days. Please pay today: {link}`,
  };
  return templates[tone]
    .replace(/{name}/g, tokens.name)
    .replace(/{bill}/g, tokens.bill)
    .replace(/{amount}/g, tokens.amount)
    .replace(/{when}/g, tokens.when)
    .replace(/{days}/g, String(tokens.days))
    .replace(/{link}/g, tokens.link);
}

export const REMINDER_PREVIEWS: Record<ReminderTone, string> = {
  friendly: `Hey {name}! Just a heads up — your share of "{bill}" ({amount}) is due {when}. Easy to settle from the link below. Cheers! 🙌`,
  firm: `Hi {name}, your share of "{bill}" ({amount}) is due {when}. Please settle at your earliest convenience: {link}`,
  final: `{name} — final reminder. {amount} for "{bill}" is overdue by {days} days. Please pay today: {link}`,
};

export function buildWhen(daysToDue: number): string {
  if (daysToDue === 0) return 'today';
  if (daysToDue > 0) return `in ${daysToDue} day${daysToDue === 1 ? '' : 's'}`;
  const abs = Math.abs(daysToDue);
  return `${abs} day${abs === 1 ? '' : 's'} ago`;
}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors (or no new errors introduced).

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts src/lib/reminderTemplates.ts
git commit -m "feat: add reminder types and template utilities"
```

---

## Task 2: Supabase Reminder Functions

**Files:**
- Modify: `src/lib/supabase.ts`

- [ ] **Step 1: Read current end of `src/lib/supabase.ts`** to find the right insertion point.

- [ ] **Step 2: Add the four new functions at the bottom of `src/lib/supabase.ts`**

```typescript
// ── Reminders ────────────────────────────────────────────────────────────────

interface InsertReminderArgs {
  organizer_id: string;
  bill_id: string;
  participant_id: string;
  recipient_name: string;
  channel: string;
}

export async function insertReminder(args: InsertReminderArgs): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from('reminders')
    .insert({
      organizer_id: args.organizer_id,
      bill_id: args.bill_id,
      participant_id: args.participant_id,
      recipient_name: args.recipient_name,
      channel: args.channel,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data as { id: string };
}

export async function loadReminders(organizerId: string): Promise<Array<{
  id: string;
  bill_id: string;
  participant_id: string;
  recipient_name: string;
  channel: string;
  sent_at: string;
}>> {
  const { data, error } = await supabase
    .from('reminders')
    .select('id, bill_id, participant_id, recipient_name, channel, sent_at')
    .eq('organizer_id', organizerId)
    .order('sent_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Array<{
    id: string;
    bill_id: string;
    participant_id: string;
    recipient_name: string;
    channel: string;
    sent_at: string;
  }>;
}

const DEFAULT_SETTINGS = {
  cadence: 'smart',
  tone: 'friendly',
  skipPaid: true,
  maxPerWeek: 2,
} as const;

export async function loadSettings(organizerId: string): Promise<{
  cadence: string;
  tone: string;
  skipPaid: boolean;
  maxPerWeek: number;
}> {
  const { data, error } = await supabase
    .from('user_settings')
    .select('reminders')
    .eq('organizer_id', organizerId)
    .single();
  if (error || !data) return { ...DEFAULT_SETTINGS };
  return { ...DEFAULT_SETTINGS, ...(data.reminders as object) } as {
    cadence: string;
    tone: string;
    skipPaid: boolean;
    maxPerWeek: number;
  };
}

export async function upsertSettings(
  organizerId: string,
  reminders: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase
    .from('user_settings')
    .upsert(
      { organizer_id: organizerId, reminders, updated_at: new Date().toISOString() },
      { onConflict: 'organizer_id' }
    );
  if (error) throw error;
}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabase.ts
git commit -m "feat: add Supabase reminder functions (insert, load, settings)"
```

---

## Task 3: Queue Computation Utility

**Files:**
- Create: `src/lib/queueUtils.ts`

- [ ] **Step 1: Create `src/lib/queueUtils.ts`**

```typescript
import type { Bill, ReminderRow, ReminderSettings, QueueItem, ReliabilityLabel } from '../types';

export function computeReliability(name: string, bills: Bill[]): ReliabilityLabel | null {
  const history: number[] = [];
  for (const bill of bills) {
    const p = bill.participants.find((pt) => pt.name === name && pt.isPaid && pt.paidAt);
    if (!p?.paidAt) continue;
    const paid = new Date(p.paidAt).getTime();
    const due = new Date(bill.dueDate).getTime();
    const daysLate = Math.round((paid - due) / 86_400_000);
    history.push(daysLate);
  }
  if (history.length === 0) return null;
  const avg = history.reduce((s, d) => s + d, 0) / history.length;
  if (avg < 0) return 'reliable';
  if (avg === 0) return 'on-time';
  if (avg <= 7) return 'slow';
  return 'at-risk';
}

function daysToDue(dueDate: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - now.getTime()) / 86_400_000);
}

function remindersThisWeek(
  sent: ReminderRow[],
  billId: string,
  participantId: string
): number {
  const weekAgo = Date.now() - 7 * 86_400_000;
  return sent.filter(
    (r) =>
      r.billId === billId &&
      r.participantId === participantId &&
      new Date(r.sentAt).getTime() >= weekAgo
  ).length;
}

export function buildQueueItems(
  bills: Bill[],
  sent: ReminderRow[],
  settings: ReminderSettings,
  organizerId: string
): { items: QueueItem[]; limitReached: QueueItem[] } {
  const items: QueueItem[] = [];
  const limitReached: QueueItem[] = [];

  for (const bill of bills) {
    if (bill.status !== 'active') continue;
    for (const p of bill.participants) {
      // Filter 1: skip paid
      if (settings.skipPaid && p.isPaid) continue;

      // Filter 2: don't nudge the organizer (skip if participant ID matches organizer ID)
      if (p.id === organizerId) continue;

      const dtd = daysToDue(bill.dueDate);

      // Filter 3: cadence visibility
      if (settings.cadence === 'smart') {
        const lastSent = sent
          .filter((r) => r.billId === bill.id && r.participantId === p.id)
          .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())[0];
        const daysSinceLast = lastSent
          ? Math.round((Date.now() - new Date(lastSent.sentAt).getTime()) / 86_400_000)
          : Infinity;
        const showSmart = dtd <= 3 || dtd <= 0 || daysSinceLast >= 3;
        if (!showSmart) continue;
      }

      const item: QueueItem = {
        billId: bill.id,
        billTitle: bill.title,
        participantId: p.id,
        participantName: p.name,
        participantPhone: p.phone,
        participantEmail: p.email,
        participantAvatarColor: p.avatarColor,
        amount: p.amount,
        currency: bill.currency,
        dueDate: bill.dueDate,
        shareLink: bill.shareLink,
        daysToDue: dtd,
      };

      // Filter 4: maxPerWeek
      const weekCount = remindersThisWeek(sent, bill.id, p.id);
      if (weekCount >= settings.maxPerWeek) {
        limitReached.push(item);
      } else {
        items.push(item);
      }
    }
  }

  // Sort: overdue first (negative daysToDue), then soonest due
  items.sort((a, b) => a.daysToDue - b.daysToDue);
  limitReached.sort((a, b) => a.daysToDue - b.daysToDue);

  return { items, limitReached };
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/queueUtils.ts
git commit -m "feat: add queue computation utility with cadence + maxPerWeek filters"
```

---

## Task 4: Reminder Store

**Files:**
- Create: `src/store/reminderStore.ts`

- [ ] **Step 1: Create `src/store/reminderStore.ts`**

```typescript
import { create } from 'zustand';
import type { ReminderRow, ReminderSettings, QueueItem } from '../types';
import { getOrganizerId } from '../lib/organizer';
import {
  insertReminder,
  loadReminders as fetchReminders,
  loadSettings as fetchSettings,
  upsertSettings,
} from '../lib/supabase';

const DEFAULT_SETTINGS: ReminderSettings = {
  cadence: 'smart',
  tone: 'friendly',
  skipPaid: true,
  maxPerWeek: 2,
};

interface ReminderStore {
  sent: ReminderRow[];
  settings: ReminderSettings;
  batchQueue: QueueItem[];
  batchPointer: number;
  isLoading: boolean;

  loadReminders: () => Promise<void>;
  loadSettings: () => Promise<void>;
  sendReminder: (item: QueueItem, channel: 'whatsapp' | 'email') => Promise<void>;
  setSetting: <K extends keyof ReminderSettings>(key: K, value: ReminderSettings[K]) => Promise<void>;
  startBatch: (queue: QueueItem[]) => void;
  advanceBatch: () => void;
  clearBatch: () => void;
}

export const useReminderStore = create<ReminderStore>((set, get) => ({
  sent: [],
  settings: { ...DEFAULT_SETTINGS },
  batchQueue: [],
  batchPointer: 0,
  isLoading: false,

  loadReminders: async () => {
    try {
      set({ isLoading: true });
      const organizerId = await getOrganizerId();
      const rows = await fetchReminders(organizerId);
      const sent: ReminderRow[] = rows.map((r) => ({
        id: r.id,
        billId: r.bill_id,
        participantId: r.participant_id,
        recipientName: r.recipient_name,
        channel: r.channel as 'whatsapp' | 'email',
        sentAt: r.sent_at,
        syncFailed: false,
      }));
      set({ sent, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  loadSettings: async () => {
    try {
      const organizerId = await getOrganizerId();
      const raw = await fetchSettings(organizerId);
      set({
        settings: {
          cadence: (raw.cadence as ReminderSettings['cadence']) ?? DEFAULT_SETTINGS.cadence,
          tone: (raw.tone as ReminderSettings['tone']) ?? DEFAULT_SETTINGS.tone,
          skipPaid: typeof raw.skipPaid === 'boolean' ? raw.skipPaid : DEFAULT_SETTINGS.skipPaid,
          maxPerWeek: typeof raw.maxPerWeek === 'number' ? raw.maxPerWeek : DEFAULT_SETTINGS.maxPerWeek,
        },
      });
    } catch {
      // keep defaults
    }
  },

  sendReminder: async (item: QueueItem, channel: 'whatsapp' | 'email') => {
    const tempId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const row: ReminderRow = {
      id: tempId,
      billId: item.billId,
      participantId: item.participantId,
      recipientName: item.participantName,
      channel,
      sentAt: new Date().toISOString(),
      syncFailed: false,
    };
    set((s) => ({ sent: [row, ...s.sent] }));

    const organizerId = await getOrganizerId();
    const delays = [100, 200, 400];
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const inserted = await insertReminder({
          organizer_id: organizerId,
          bill_id: item.billId,
          participant_id: item.participantId,
          recipient_name: item.participantName,
          channel,
        });
        set((s) => ({
          sent: s.sent.map((r) => (r.id === tempId ? { ...r, id: inserted.id } : r)),
        }));
        return;
      } catch {
        if (attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
        }
      }
    }
    set((s) => ({
      sent: s.sent.map((r) => (r.id === tempId ? { ...r, syncFailed: true } : r)),
    }));
  },

  setSetting: async (key, value) => {
    const next = { ...get().settings, [key]: value };
    set({ settings: next });
    try {
      const organizerId = await getOrganizerId();
      await upsertSettings(organizerId, next as unknown as Record<string, unknown>);
    } catch {
      // settings saved locally even if Supabase fails
    }
  },

  startBatch: (queue: QueueItem[]) => set({ batchQueue: queue, batchPointer: 0 }),
  advanceBatch: () => set((s) => ({ batchPointer: s.batchPointer + 1 })),
  clearBatch: () => set({ batchQueue: [], batchPointer: 0 }),
}));
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/store/reminderStore.ts
git commit -m "feat: add Zustand reminder store with send, batch, and settings"
```

---

## Task 5: Screen Shell + Route Registration

**Files:**
- Create: `app/(modals)/reminders.tsx`
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Register the route in `app/_layout.tsx`**

After the `(modals)/share/[code]` Stack.Screen block (around line 72), add:

```typescript
      <Stack.Screen
        name="(modals)/reminders"
        options={{
          presentation: 'card',
          animation: Platform.OS === 'web' ? 'none' : 'slide_from_right',
          headerShown: false,
        }}
      />
```

- [ ] **Step 2: Create `app/(modals)/reminders.tsx`**

```typescript
import { useEffect, useState, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, LayoutChangeEvent } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { colors, typography, fontSize, spacing, radius, animation } from '../../src/theme/tokens';
import { useReminderStore } from '../../src/store/reminderStore';
import { useBillStore } from '../../src/store/billStore';
import { buildQueueItems } from '../../src/lib/queueUtils';
import { QueuePane } from '../../src/components/reminders/QueuePane';
import { SentPane } from '../../src/components/reminders/SentPane';
import { SettingsPane } from '../../src/components/reminders/SettingsPane';

type Tab = 'queue' | 'sent' | 'settings';
const TABS: { value: Tab; label: string }[] = [
  { value: 'queue', label: 'Queue' },
  { value: 'sent', label: 'Sent' },
  { value: 'settings', label: 'Settings' },
];

export default function RemindersScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<Tab>('queue');
  const { sent, settings, loadReminders, loadSettings } = useReminderStore();
  const { bills } = useBillStore();

  const segWidth = useSharedValue(0);
  const pillX = useSharedValue(0);
  const tabIndex = TABS.findIndex((t) => t.value === activeTab);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = (e.nativeEvent.layout.width - 8) / TABS.length;
    segWidth.value = w;
    pillX.value = tabIndex * w + 4;
  };

  useEffect(() => {
    if (segWidth.value > 0) {
      pillX.value = withSpring(tabIndex * segWidth.value + 4, animation.springSnappy);
    }
  }, [tabIndex]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value }],
    width: segWidth.value,
  }));

  useEffect(() => {
    loadReminders();
    loadSettings();
  }, []);

  const { items: queueItems } = buildQueueItems(bills, sent, settings, '');
  const badgeCount = queueItems.length;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="arrow-left" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>Reminders</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Segmented tabs */}
      <View style={styles.tabBar}>
        <View style={styles.tabContainer} onLayout={onLayout}>
          <Animated.View style={[styles.tabPill, pillStyle]} />
          {TABS.map((tab) => {
            const isActive = tab.value === activeTab;
            return (
              <Pressable
                key={tab.value}
                style={styles.tabSegment}
                onPress={() => setActiveTab(tab.value)}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
              >
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                  {tab.label}
                  {tab.value === 'queue' && badgeCount > 0 ? ` (${badgeCount})` : ''}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Pane */}
      <View style={styles.pane}>
        {activeTab === 'queue' && <QueuePane />}
        {activeTab === 'sent' && <SentPane />}
        {activeTab === 'settings' && <SettingsPane />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontFamily: typography.sansBold,
    fontSize: fontSize.lg,
    color: colors.textPrimary,
  },
  headerRight: { width: 36 },
  tabBar: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.gray100,
    borderRadius: radius.lg,
    padding: 4,
    position: 'relative',
    height: 44,
  },
  tabPill: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  tabSegment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  tabLabel: {
    fontFamily: typography.sansMedium,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  tabLabelActive: {
    fontFamily: typography.sansSemiBold,
    color: colors.textPrimary,
  },
  pane: { flex: 1 },
});
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: errors about missing component files — these are expected and will be resolved in subsequent tasks.

- [ ] **Step 4: Commit**

```bash
git add app/_layout.tsx app/(modals)/reminders.tsx
git commit -m "feat: add reminders screen shell with 3-tab segmented control"
```

---

## Task 6: SettingsPane

**Files:**
- Create: `src/components/reminders/SettingsPane.tsx`

- [ ] **Step 1: Create `src/components/reminders/SettingsPane.tsx`**

```typescript
import { View, Text, Switch, Pressable, StyleSheet, ScrollView } from 'react-native';
import Slider from '@react-native-community/slider';
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
          <View style={styles.toggleLabel}>
            <Text style={styles.toggleTitle}>Skip already-paid people</Text>
          </View>
          <Switch
            value={settings.skipPaid}
            onValueChange={(v) => setSetting('skipPaid', v)}
            trackColor={{ false: colors.gray200, true: colors.primary }}
            thumbColor={colors.white}
          />
        </View>

        <View style={styles.sliderRow}>
          <Text style={styles.sliderLabel}>Max {settings.maxPerWeek} per week</Text>
          <Slider
            style={styles.slider}
            minimumValue={1}
            maximumValue={7}
            step={1}
            value={settings.maxPerWeek}
            onValueChange={(v) => setSetting('maxPerWeek', Math.round(v))}
            minimumTrackTintColor={colors.primary}
            maximumTrackTintColor={colors.gray200}
            thumbTintColor={colors.primary}
          />
          <View style={styles.sliderEndLabels}>
            <Text style={styles.sliderEndText}>1</Text>
            <Text style={styles.sliderEndText}>7</Text>
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
  toggleLabel: { flex: 1 },
  toggleTitle: {
    fontFamily: typography.sansMedium,
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },
  sliderRow: { gap: spacing[1] },
  sliderLabel: {
    fontFamily: typography.sansMedium,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },
  slider: { width: '100%', height: 40 },
  sliderEndLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -spacing[2],
  },
  sliderEndText: {
    fontFamily: typography.monoRegular,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
});
```

> **Note on Slider:** `@react-native-community/slider` may not be installed. Check with `npx expo install @react-native-community/slider`. If unavailable, use a simple stepper (minus/plus buttons) as fallback — see step 2.

- [ ] **Step 2: Check if slider package exists**

```bash
node -e "require('@react-native-community/slider'); console.log('ok')" 2>&1
```

If it throws: Replace the Slider import and usage in SettingsPane.tsx with this stepper pattern instead:

```typescript
// Replace Slider with stepper in sliderRow section:
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

// Add to StyleSheet:
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
```

Also remove the Slider import line entirely if using stepper.

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: errors only for missing QueuePane/SentPane (imported in reminders.tsx). SettingsPane itself should type-check cleanly. Fix any errors in this file.

- [ ] **Step 4: Commit**

```bash
git add src/components/reminders/SettingsPane.tsx
git commit -m "feat: add SettingsPane (cadence, tone, skipPaid, maxPerWeek)"
```

---

## Task 7: QueueRow

**Files:**
- Create: `src/components/reminders/QueueRow.tsx`

- [ ] **Step 1: Create `src/components/reminders/QueueRow.tsx`**

```typescript
import { View, Text, Pressable, StyleSheet, Linking } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { haptic } from '../../lib/haptics';
import { useReminderStore } from '../../store/reminderStore';
import { useBillStore } from '../../store/billStore';
import { buildWhen, renderTemplate, formatCurrency } from '../../lib/reminderTemplates';
import { computeReliability } from '../../lib/queueUtils';
import { colors, typography, fontSize, spacing, radius } from '../../theme/tokens';
import type { QueueItem, ReminderRow, ReliabilityLabel } from '../../types';

function getInitials(name: string): string {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

const RELIABILITY_CONFIG: Record<ReliabilityLabel, { label: string; color: string; bg: string }> = {
  reliable: { label: 'Reliable', color: '#059669', bg: '#ECFDF5' },
  'on-time': { label: 'On-time', color: '#4F46E5', bg: '#EEF2FF' },
  slow: { label: 'Slow', color: '#D97706', bg: '#FFFBEB' },
  'at-risk': { label: 'At-risk', color: '#DC2626', bg: '#FEF2F2' },
};

interface Props {
  item: QueueItem;
  remindersForItem: ReminderRow[];
}

export function QueueRow({ item, remindersForItem }: Props) {
  const { settings, sendReminder } = useReminderStore();
  const { bills } = useBillStore();

  const reliability = computeReliability(item.participantName, bills);
  const reliabilityConfig = reliability ? RELIABILITY_CONFIG[reliability] : null;
  const askedCount = remindersForItem.filter(
    (r) => r.billId === item.billId && r.participantId === item.participantId
  ).length;

  const isOverdue = item.daysToDue < 0;

  const buildMessage = (tone = settings.tone) => {
    return renderTemplate(tone, {
      name: item.participantName,
      bill: item.billTitle,
      amount: formatCurrency(item.amount, item.currency),
      when: buildWhen(item.daysToDue),
      days: isOverdue ? Math.abs(item.daysToDue) : 0,
      link: `https://gocheck.app/bill/${item.shareLink}`,
    });
  };

  const handleWhatsApp = () => {
    haptic.impact();
    const message = buildMessage();
    const encoded = encodeURIComponent(message);
    const url = item.participantPhone
      ? `https://wa.me/${item.participantPhone}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;
    Linking.openURL(url);
    sendReminder(item, 'whatsapp');
  };

  const handleEmail = () => {
    haptic.impact();
    const message = buildMessage();
    const subject = encodeURIComponent(`Reminder: ${item.billTitle}`);
    const body = encodeURIComponent(message);
    Linking.openURL(`mailto:${item.participantEmail}?subject=${subject}&body=${body}`);
    sendReminder(item, 'email');
  };

  const dueLabelColor = isOverdue ? colors.error : item.daysToDue <= 3 ? colors.warning : colors.textSecondary;
  const dueLabel = isOverdue
    ? `${Math.abs(item.daysToDue)}d overdue`
    : item.daysToDue === 0
    ? 'Due today'
    : `Due in ${item.daysToDue}d`;

  return (
    <View style={styles.row}>
      <View style={styles.left}>
        {/* Avatar */}
        <View style={[styles.avatar, { backgroundColor: item.participantAvatarColor }]}>
          <Text style={styles.avatarText}>{getInitials(item.participantName)}</Text>
        </View>

        {/* Info */}
        <View style={styles.info}>
          {/* Name row */}
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{item.participantName}</Text>
            {/* Fixed-width reliability slot */}
            <View style={styles.reliabilitySlot}>
              {reliabilityConfig ? (
                <View style={[styles.chip, { backgroundColor: reliabilityConfig.bg }]}>
                  <Text style={[styles.chipText, { color: reliabilityConfig.color }]}>
                    {reliabilityConfig.label}
                  </Text>
                </View>
              ) : null}
            </View>
            {askedCount > 0 && (
              <View style={styles.askedChip}>
                <Text style={styles.askedText}>asked {askedCount}×</Text>
              </View>
            )}
          </View>

          {/* Bill + amount */}
          <Text style={styles.billMeta} numberOfLines={1}>
            {item.billTitle} · {formatCurrency(item.amount, item.currency)}
          </Text>

          {/* Due label */}
          <Text style={[styles.dueLabel, { color: dueLabelColor }]}>{dueLabel}</Text>
        </View>
      </View>

      {/* Channel buttons */}
      <View style={styles.actions}>
        <Pressable style={styles.waBtn} onPress={handleWhatsApp}>
          <Feather name="message-circle" size={14} color="#25D366" />
          <Text style={styles.waBtnText}>WhatsApp</Text>
        </Pressable>
        {item.participantEmail ? (
          <Pressable style={styles.emailBtn} onPress={handleEmail}>
            <Feather name="mail" size={14} color={colors.primary} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing[3],
    marginBottom: spacing[2],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  left: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2] },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontFamily: typography.sansBold,
    fontSize: fontSize.sm,
    color: colors.white,
  },
  info: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], flexWrap: 'wrap' },
  name: {
    fontFamily: typography.sansSemiBold,
    fontSize: fontSize.base,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  reliabilitySlot: { width: 60, height: 20 },
  chip: {
    borderRadius: radius.full,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  chipText: { fontFamily: typography.sansMedium, fontSize: fontSize['2xs'] },
  askedChip: {
    backgroundColor: colors.gray100,
    borderRadius: radius.full,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
  },
  askedText: {
    fontFamily: typography.sansMedium,
    fontSize: fontSize['2xs'],
    color: colors.textSecondary,
  },
  billMeta: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  dueLabel: {
    fontFamily: typography.sansMedium,
    fontSize: fontSize.xs,
  },
  actions: { flexDirection: 'row', gap: spacing[2], alignItems: 'center' },
  waBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: radius.md,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1.5],
  },
  waBtnText: {
    fontFamily: typography.sansMedium,
    fontSize: fontSize.xs,
    color: '#15803D',
  },
  emailBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: colors.primarySurface,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors in QueueRow itself.

- [ ] **Step 3: Commit**

```bash
git add src/components/reminders/QueueRow.tsx
git commit -m "feat: add QueueRow with reliability chip, asked count, and channel buttons"
```

---

## Task 8: BatchToast

**Files:**
- Create: `src/components/reminders/BatchToast.tsx`

- [ ] **Step 1: Create `src/components/reminders/BatchToast.tsx`**

```typescript
import { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Linking } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { haptic } from '../../lib/haptics';
import { useReminderStore } from '../../store/reminderStore';
import { renderTemplate, formatCurrency, buildWhen } from '../../lib/reminderTemplates';
import { colors, typography, fontSize, spacing, radius, animation } from '../../theme/tokens';

export function BatchToast() {
  const { batchQueue, batchPointer, settings, sendReminder, advanceBatch, clearBatch } =
    useReminderStore();

  const translateY = useSharedValue(80);
  const opacity = useSharedValue(0);

  const isActive = batchQueue.length > 0;
  const isDone = batchPointer >= batchQueue.length;

  useEffect(() => {
    if (isActive) {
      translateY.value = withSpring(0, animation.springSnappy);
      opacity.value = withTiming(1, { duration: 200 });
    } else {
      translateY.value = withTiming(80, { duration: 200 });
      opacity.value = withTiming(0, { duration: 150 });
    }
  }, [isActive]);

  useEffect(() => {
    if (isDone && isActive) {
      const timer = setTimeout(() => clearBatch(), 2500);
      return () => clearTimeout(timer);
    }
  }, [isDone, isActive]);

  const toastStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!isActive) return null;

  const handleSendNext = () => {
    if (batchPointer >= batchQueue.length) return;
    haptic.impact();
    const item = batchQueue[batchPointer];
    const isOverdue = item.daysToDue < 0;
    const message = renderTemplate(settings.tone, {
      name: item.participantName,
      bill: item.billTitle,
      amount: formatCurrency(item.amount, item.currency),
      when: buildWhen(item.daysToDue),
      days: isOverdue ? Math.abs(item.daysToDue) : 0,
      link: `https://gocheck.app/bill/${item.shareLink}`,
    });
    const encoded = encodeURIComponent(message);
    const url = item.participantPhone
      ? `https://wa.me/${item.participantPhone}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;
    Linking.openURL(url);
    sendReminder(item, 'whatsapp');
    advanceBatch();
  };

  return (
    <Animated.View style={[styles.toast, toastStyle]}>
      <View style={styles.toastContent}>
        <Feather name="send" size={16} color={colors.white} />
        <Text style={styles.toastText}>
          {isDone
            ? `All ${batchQueue.length} reminders sent 🎉`
            : `${batchPointer} of ${batchQueue.length} sent — tap to continue`}
        </Text>
      </View>
      {!isDone && (
        <Pressable style={styles.nextBtn} onPress={handleSendNext}>
          <Text style={styles.nextBtnText}>Send next</Text>
          <Feather name="chevron-right" size={14} color={colors.primary} />
        </Pressable>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    bottom: spacing[6],
    left: spacing[4],
    right: spacing[4],
    backgroundColor: colors.textPrimary,
    borderRadius: radius.xl,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 100,
  },
  toastContent: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  toastText: {
    fontFamily: typography.sansMedium,
    fontSize: fontSize.sm,
    color: colors.white,
    flex: 1,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    backgroundColor: colors.white,
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
  },
  nextBtnText: {
    fontFamily: typography.sansSemiBold,
    fontSize: fontSize.sm,
    color: colors.primary,
  },
});
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors in BatchToast.

- [ ] **Step 3: Commit**

```bash
git add src/components/reminders/BatchToast.tsx
git commit -m "feat: add BatchToast for sequential Send All flow"
```

---

## Task 9: QueuePane

**Files:**
- Create: `src/components/reminders/QueuePane.tsx`

- [ ] **Step 1: Create `src/components/reminders/QueuePane.tsx`**

```typescript
import { View, Text, Pressable, FlatList, StyleSheet, Linking } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { haptic } from '../../lib/haptics';
import { useReminderStore } from '../../store/reminderStore';
import { useBillStore } from '../../store/billStore';
import { buildQueueItems } from '../../lib/queueUtils';
import { renderTemplate, formatCurrency, buildWhen } from '../../lib/reminderTemplates';
import { QueueRow } from './QueueRow';
import { BatchToast } from './BatchToast';
import { colors, typography, fontSize, spacing, radius } from '../../theme/tokens';
import type { QueueItem } from '../../types';

export function QueuePane() {
  const { sent, settings, sendReminder, startBatch, advanceBatch } = useReminderStore();
  const { bills } = useBillStore();

  const { items, limitReached } = buildQueueItems(bills, sent, settings, '');

  const remindersForItem = (item: QueueItem) =>
    sent.filter((r) => r.billId === item.billId && r.participantId === item.participantId);

  const openLinkAndSend = (item: QueueItem) => {
    const isOverdue = item.daysToDue < 0;
    const message = renderTemplate(settings.tone, {
      name: item.participantName,
      bill: item.billTitle,
      amount: formatCurrency(item.amount, item.currency),
      when: buildWhen(item.daysToDue),
      days: isOverdue ? Math.abs(item.daysToDue) : 0,
      link: `https://gocheck.app/bill/${item.shareLink}`,
    });
    const encoded = encodeURIComponent(message);
    const url = item.participantPhone
      ? `https://wa.me/${item.participantPhone}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;
    Linking.openURL(url);
    sendReminder(item, 'whatsapp');
  };

  const handleSendAll = () => {
    if (items.length === 0) return;
    haptic.impact();
    startBatch(items);
    openLinkAndSend(items[0]);
    advanceBatch();
  };

  if (items.length === 0 && limitReached.length === 0) {
    return (
      <View style={styles.empty}>
        <Feather name="check-circle" size={48} color={colors.gray300} />
        <Text style={styles.emptyTitle}>All caught up</Text>
        <Text style={styles.emptyHint}>Nobody to nudge right now.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={[...items, ...limitReached]}
        keyExtractor={(item) => `${item.billId}_${item.participantId}`}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          items.length > 0 ? (
            <View style={styles.batchCard}>
              <View style={styles.batchInfo}>
                <Text style={styles.batchTitle}>Send all {items.length} reminders</Text>
                <Text style={styles.batchSub}>{settings.tone} tone · via WhatsApp</Text>
              </View>
              <Pressable style={styles.batchBtn} onPress={handleSendAll}>
                <Feather name="send" size={14} color={colors.white} />
                <Text style={styles.batchBtnText}>Send all</Text>
              </Pressable>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const isLimitReached = limitReached.includes(item);
          if (isLimitReached) {
            return (
              <View style={styles.limitRow}>
                <View style={[styles.limitAvatar, { backgroundColor: item.participantAvatarColor }]}>
                  <Text style={styles.limitAvatarText}>
                    {item.participantName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.limitName}>{item.participantName}</Text>
                <View style={styles.limitBadge}>
                  <Text style={styles.limitBadgeText}>Limit reached</Text>
                </View>
              </View>
            );
          }
          return (
            <QueueRow
              item={item}
              remindersForItem={remindersForItem(item)}
            />
          );
        }}
      />
      <BatchToast />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: spacing[4] },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    padding: spacing[8],
  },
  emptyTitle: {
    fontFamily: typography.sansSemiBold,
    fontSize: fontSize.lg,
    color: colors.textPrimary,
  },
  emptyHint: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.base,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  batchCard: {
    borderRadius: radius.xl,
    padding: spacing[4],
    marginBottom: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primary,
  },
  batchInfo: { gap: 4, flex: 1 },
  batchTitle: {
    fontFamily: typography.sansBold,
    fontSize: fontSize.base,
    color: colors.white,
  },
  batchSub: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.75)',
  },
  batchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  batchBtnText: {
    fontFamily: typography.sansSemiBold,
    fontSize: fontSize.sm,
    color: colors.white,
  },
  limitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    marginBottom: spacing[1],
    opacity: 0.6,
  },
  limitAvatar: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  limitAvatarText: {
    fontFamily: typography.sansBold,
    fontSize: 10,
    color: colors.white,
  },
  limitName: {
    flex: 1,
    fontFamily: typography.sansMedium,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  limitBadge: {
    backgroundColor: colors.gray100,
    borderRadius: radius.full,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
  },
  limitBadgeText: {
    fontFamily: typography.sansMedium,
    fontSize: fontSize['2xs'],
    color: colors.textSecondary,
  },
});
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors (SentPane import in reminders.tsx may still error — acceptable here).

- [ ] **Step 3: Commit**

```bash
git add src/components/reminders/QueuePane.tsx
git commit -m "feat: add QueuePane with batch card, queue rows, and limit-reached rows"
```

---

## Task 10: SentRow + SentPane

**Files:**
- Create: `src/components/reminders/SentRow.tsx`
- Create: `src/components/reminders/SentPane.tsx`

- [ ] **Step 1: Create `src/components/reminders/SentRow.tsx`**

```typescript
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { colors, typography, fontSize, spacing, radius } from '../../theme/tokens';
import type { ReminderRow } from '../../types';

interface Props {
  row: ReminderRow;
}

export function SentRow({ row }: Props) {
  const isWhatsApp = row.channel === 'whatsapp';
  const iconColor = isWhatsApp ? '#25D366' : colors.primary;
  const iconBg = isWhatsApp ? '#F0FDF4' : colors.primarySurface;
  const channelLabel = isWhatsApp ? 'WhatsApp' : 'Email';
  const iconName = isWhatsApp ? 'message-circle' : 'mail';

  const timeAgo = (() => {
    try {
      return formatDistanceToNow(new Date(row.sentAt), { addSuffix: true });
    } catch {
      return '';
    }
  })();

  return (
    <View style={styles.row}>
      <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
        <Feather name={iconName as 'message-circle' | 'mail'} size={18} color={iconColor} />
      </View>
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{row.recipientName}</Text>
          {row.syncFailed && (
            <Feather name="alert-triangle" size={14} color={colors.warning} />
          )}
        </View>
        <Text style={styles.meta}>via {channelLabel} · {timeAgo}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  info: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  name: {
    fontFamily: typography.sansMedium,
    fontSize: fontSize.base,
    color: colors.textPrimary,
    flex: 1,
  },
  meta: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
});
```

- [ ] **Step 2: Create `src/components/reminders/SentPane.tsx`**

```typescript
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useReminderStore } from '../../store/reminderStore';
import { SentRow } from './SentRow';
import { colors, typography, fontSize, spacing, radius } from '../../theme/tokens';

export function SentPane() {
  const { sent } = useReminderStore();

  return (
    <View style={styles.container}>
      <FlatList
        data={sent}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.infoNote}>
            <Feather name="info" size={14} color={colors.textSecondary} />
            <Text style={styles.infoText}>
              Reminders are logged when sent — confirm delivery in your WhatsApp or email outbox.
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="send" size={48} color={colors.gray300} />
            <Text style={styles.emptyTitle}>No reminders sent yet</Text>
            <Text style={styles.emptyHint}>Send your first reminder from the Queue tab.</Text>
          </View>
        }
        renderItem={({ item }) => <SentRow row={item} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: spacing[4] },
  infoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
    backgroundColor: colors.gray50,
    borderRadius: radius.md,
    padding: spacing[3],
    marginBottom: spacing[3],
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoText: {
    flex: 1,
    fontFamily: typography.sansRegular,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing[12],
    gap: spacing[2],
  },
  emptyTitle: {
    fontFamily: typography.sansSemiBold,
    fontSize: fontSize.lg,
    color: colors.textPrimary,
  },
  emptyHint: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.base,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/reminders/SentRow.tsx src/components/reminders/SentPane.tsx
git commit -m "feat: add SentRow and SentPane with sync-failed indicator and info note"
```

---

## Task 11: Bell Icon in Bills Header

**Files:**
- Modify: `app/(tabs)/bills.tsx`

- [ ] **Step 1: Add imports to `app/(tabs)/bills.tsx`**

At the top of the file, add these imports (after existing imports):

```typescript
import { useReminderStore } from '../../src/store/reminderStore';
import { buildQueueItems } from '../../src/lib/queueUtils';
```

- [ ] **Step 2: Compute badge count inside `BillsScreen`**

Inside the `BillsScreen` component function body, after the existing hook calls, add:

```typescript
  const { sent, settings } = useReminderStore();
  const { items: queueItems } = buildQueueItems(bills, sent, settings, '');
  const bellBadge = queueItems.length;
```

- [ ] **Step 3: Replace the header `<View style={styles.header}>` block**

The current header (lines ~135–144) is:
```typescript
      <View style={styles.header}>
        <Text style={styles.title}>My Bills</Text>
        <Pressable
          style={styles.headerCreateBtn}
          onPress={() => router.push('/(modals)/create')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="plus" size={20} color={colors.primary} />
        </Pressable>
      </View>
```

Replace with:
```typescript
      <View style={styles.header}>
        <Text style={styles.title}>My Bills</Text>
        <View style={styles.headerActions}>
          <Pressable
            style={styles.headerBtn}
            onPress={() => router.push('/(modals)/reminders')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="bell" size={20} color={colors.primary} />
            {bellBadge > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeCount}>{bellBadge > 99 ? '99+' : bellBadge}</Text>
              </View>
            )}
          </Pressable>
          <Pressable
            style={styles.headerBtn}
            onPress={() => router.push('/(modals)/create')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="plus" size={20} color={colors.primary} />
          </Pressable>
        </View>
      </View>
```

- [ ] **Step 4: Add new styles to the StyleSheet**

In the `StyleSheet.create({...})` at the bottom, add:

```typescript
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  badgeCount: {
    fontFamily: typography.sansBold,
    fontSize: 9,
    color: colors.white,
    lineHeight: 12,
  },
```

Also rename the existing `headerCreateBtn` style to `headerBtn` (or keep it as-is and only add the above new styles if headerCreateBtn already exists and is reused elsewhere — remove `headerCreateBtn` since it's no longer referenced).

- [ ] **Step 5: Final TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors. This is the acceptance criterion AC #13.

- [ ] **Step 6: Verify acceptance criteria manually**

Run `npm run dev` and check in the browser:
- Bell icon appears in Bills tab header next to `+`
- Badge shows count of filtered queue items (0 → badge hidden)
- Tapping bell pushes to Reminders screen
- Queue tab shows batch card + rows (if active bills exist with unpaid participants)
- Sent tab shows info note, empty state initially
- Settings tab shows 3 cards: Cadence, Message Tone (Final disabled when no overdue), Skip & Frequency Cap
- Tone change updates preview instantly
- Settings survive a screen reload (test by changing cadence to "Aggressive", navigating away, coming back)

- [ ] **Step 7: Commit**

```bash
git add app/(tabs)/bills.tsx
git commit -m "feat: add bell icon with queue badge to Bills header, wire reminders nav"
```

---

## Supabase Migrations (Run in Supabase Dashboard SQL Editor)

Before testing end-to-end, run these SQL statements in the Supabase project's SQL editor:

```sql
-- Add phone column to participants (email already exists)
alter table participants
  add column if not exists phone text;

-- Create reminders table
create table if not exists reminders (
  id uuid primary key default gen_random_uuid(),
  organizer_id text not null,
  bill_id uuid references bills(id) on delete cascade,
  participant_id uuid references participants(id) on delete cascade,
  recipient_name text not null,
  channel text not null check (channel in ('whatsapp','email','sms')),
  sent_at timestamptz default now(),
  created_at timestamptz default now()
);

create index if not exists reminders_organizer_sent
  on reminders(organizer_id, sent_at desc);

create index if not exists reminders_bill_participant
  on reminders(bill_id, participant_id);

-- Create user_settings table
create table if not exists user_settings (
  organizer_id text primary key,
  reminders jsonb not null default '{
    "cadence": "smart",
    "tone": "friendly",
    "skipPaid": true,
    "maxPerWeek": 2
  }'::jsonb,
  updated_at timestamptz default now()
);
```

---

## Self-Review Checklist

### Spec Coverage

| Spec Requirement | Task |
|-----------------|------|
| Bell badge = queue.length (AC #1) | Task 11 |
| Queue ordered daysToDue ASC (AC #2) | Task 3 (buildQueueItems sort) |
| Send all sequential flow (AC #3) | Tasks 8+9 (BatchToast + QueuePane.handleSendAll) |
| "asked N×" chip = lifetime count (AC #4) | Task 7 (QueueRow askedCount) |
| Reliability chip slot fixed width (AC #5) | Task 7 (reliabilitySlot: width 60) |
| Tone preview same render frame (AC #6) | Task 6 (REMINDER_PREVIEWS is static, settings.tone reactive) |
| WhatsApp always, Email only if email exists (AC #7) | Task 7 (QueueRow channel buttons) |
| All four settings round-trip Supabase (AC #8) | Tasks 2+4 (upsertSettings + setSetting) |
| Sent tab shows ⓘ note (AC #9) | Task 10 (SentPane ListHeaderComponent) |
| Empty queue → check-circle state (AC #10) | Task 9 (QueuePane empty branch) |
| Empty sent → send-icon state (AC #11) | Task 10 (SentPane ListEmptyComponent) |
| Activity tab unchanged (AC #12) | No modifications to activity tab |
| tsc passes (AC #13) | Task 11 Step 5 |
| syncFailed ⚠ icon | Task 10 (SentRow alert-triangle icon) |
| Final tone disabled when no overdue | Task 6 (SettingsPane hasOverdue check) |
| organizerId from getOrganizerId() | Tasks 4 (reminderStore uses getOrganizerId) |
| formatCurrency for {amount} token | Tasks 1+7 (formatCurrency used in renderTemplate calls) |
| Ad-hoc send during batch allowed | Tasks 7+9 (QueueRow sendReminder doesn't touch batchPointer) |
| 3× retry with exponential backoff | Task 4 (reminderStore.sendReminder loop) |
| Supabase migrations | Separate SQL section |
