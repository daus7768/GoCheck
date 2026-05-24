import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const supabaseUrl = (Constants.expoConfig?.extra?.supabaseUrl as string | undefined) ?? '';
const supabaseAnonKey = (Constants.expoConfig?.extra?.supabaseAnonKey as string | undefined) ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] Missing environment variables. Set supabaseUrl and supabaseAnonKey in app.json extra.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// ─── Bill Operations ───────────────────────────────────────────────────────────

export async function createBillInDB(payload: {
  organizer_id: string;
  title: string;
  description?: string;
  total_amount: number;
  currency: string;
  due_date: string;
  status: string;
  share_link: string;
}) {
  const { data, error } = await supabase
    .from('bills')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createParticipantsInDB(
  participants: Array<{
    bill_id: string;
    name: string;
    email?: string;
    amount: number;
    is_paid: boolean;
  }>
) {
  const { data, error } = await supabase
    .from('participants')
    .insert(participants)
    .select();

  if (error) throw error;
  return data;
}

export async function createShareLinkInDB(payload: {
  code: string;
  bill_id: string;
  is_active: boolean;
}) {
  const { data, error } = await supabase
    .from('share_links')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getBillByShareLink(code: string) {
  const { data, error } = await supabase
    .from('bills')
    .select(`
      *,
      participants (*)
    `)
    .eq('share_link', code)
    .single();

  if (error) throw error;
  return data;
}

export async function getOrganizerBills(organizerId: string) {
  const { data, error } = await supabase
    .from('bills')
    .select(`
      *,
      participants (*)
    `)
    .eq('organizer_id', organizerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function markParticipantPaid(participantId: string, billId: string) {
  const { data, error } = await supabase
    .from('participants')
    .update({ is_paid: true, paid_at: new Date().toISOString() })
    .eq('id', participantId)
    .eq('bill_id', billId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteBill(billId: string, organizerId: string) {
  const { error } = await supabase
    .from('bills')
    .delete()
    .eq('id', billId)
    .eq('organizer_id', organizerId);

  if (error) throw error;
}

export async function updateBillStatus(billId: string, status: 'active' | 'complete' | 'cancelled') {
  const { data, error } = await supabase
    .from('bills')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', billId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ─── Storage ───────────────────────────────────────────────────────────────────

export async function uploadGroupPhoto(billId: string, uri: string): Promise<string> {
  const path = `group-photos/${billId}.jpg`;

  let fileData: Blob | Uint8Array;
  let contentType = 'image/jpeg';

  if (uri.startsWith('data:')) {
    // Web: expo-image-picker returns a data: URI — decode base64 to binary
    const commaIdx = uri.indexOf(',');
    const header = uri.slice(0, commaIdx);
    const base64 = uri.slice(commaIdx + 1);
    contentType = header.match(/data:([^;]+)/)?.[1] ?? 'image/jpeg';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    fileData = bytes;
  } else {
    // Native: fetch the local file URI as a blob
    const response = await fetch(uri);
    fileData = await response.blob();
    contentType = (fileData as Blob).type || 'image/jpeg';
  }

  const { error } = await supabase.storage
    .from('bill-assets')
    .upload(path, fileData, { upsert: true, contentType });

  if (error) throw error;

  const { data } = supabase.storage.from('bill-assets').getPublicUrl(path);
  return data.publicUrl;
}

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
  if (!data) throw new Error('insertReminder: no data returned');
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
  if (error) {
    if (error.code === 'PGRST116') return { ...DEFAULT_SETTINGS };
    throw error;
  }
  if (!data) return { ...DEFAULT_SETTINGS };
  const overrides = typeof data.reminders === 'object' && data.reminders !== null
    ? (data.reminders as Record<string, unknown>)
    : {};
  return { ...DEFAULT_SETTINGS, ...overrides } as {
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
