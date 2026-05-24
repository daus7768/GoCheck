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
      const VALID_CADENCES: ReminderSettings['cadence'][] = ['manual', 'smart', 'aggressive'];
      const VALID_TONES: ReminderSettings['tone'][] = ['friendly', 'firm', 'final'];
      set({
        settings: {
          cadence: VALID_CADENCES.includes(raw.cadence as ReminderSettings['cadence'])
            ? (raw.cadence as ReminderSettings['cadence'])
            : DEFAULT_SETTINGS.cadence,
          tone: VALID_TONES.includes(raw.tone as ReminderSettings['tone'])
            ? (raw.tone as ReminderSettings['tone'])
            : DEFAULT_SETTINGS.tone,
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
