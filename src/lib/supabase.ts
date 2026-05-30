import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import type { UserProfile } from '../types';

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
  category?: string;
  is_recurring?: string | null;
  group_photo_url?: string;
  split_type?: string;
  tax_rate?: number;
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
    phone?: string;
    amount: number;
    is_paid: boolean;
    avatar_color?: string;
    shares?: number | null;
    percent?: number | null;
  }>
) {
  const { data, error } = await supabase
    .from('participants')
    .insert(participants)
    .select();

  if (error) throw error;
  return data;
}

export async function createLineItemsInDB(
  items: Array<{
    bill_id: string;
    description: string;
    quantity: number;
    unit_price: number;
  }>
) {
  if (items.length === 0) return [];
  const { data, error } = await supabase
    .from('line_items')
    .insert(items)
    .select();

  if (error) throw error;
  return data ?? [];
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
      id, title, description, total_amount, currency, due_date, status, share_link,
      category, is_recurring, group_photo_url, split_type, tax_rate,
      created_at, updated_at,
      participants (
        id, name, email, phone, amount, is_paid, paid_at, avatar_color, shares, percent
      ),
      line_items (
        id, description, quantity, unit_price
      )
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
      id, title, description, total_amount, currency, due_date, status, share_link,
      category, is_recurring, group_photo_url, split_type, tax_rate,
      created_at, updated_at,
      participants (
        id, name, email, phone, amount, is_paid, paid_at, avatar_color, shares, percent
      ),
      line_items (
        id, description, quantity, unit_price
      )
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

export async function markParticipantUnpaid(participantId: string, billId: string) {
  const { data, error } = await supabase
    .from('participants')
    .update({ is_paid: false, paid_at: null })
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
    const commaIdx = uri.indexOf(',');
    const header = uri.slice(0, commaIdx);
    const base64 = uri.slice(commaIdx + 1);
    contentType = header.match(/data:([^;]+)/)?.[1] ?? 'image/jpeg';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    fileData = bytes;
  } else {
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

// ─── Profile Operations ────────────────────────────────────────────────────────

function rowToProfile(row: Record<string, unknown>): UserProfile {
  return {
    id: row.id as string,
    displayName: (row.display_name as string) ?? '',
    avatarUrl: (row.avatar_url as string | null) ?? null,
    defaultCurrency: (row.default_currency as UserProfile['defaultCurrency']) ?? 'MYR',
    darkMode: Boolean(row.dark_mode),
    offlineMode: Boolean(row.offline_mode),
    paymentMethods: (row.payment_methods as UserProfile['paymentMethods']) ?? [],
    notifPush: Boolean(row.notif_push ?? true),
    notifEmail: Boolean(row.notif_email ?? true),
    notifWhatsapp: Boolean(row.notif_whatsapp),
    notifDueSoon: Boolean(row.notif_due_soon ?? true),
    notifOverdue: Boolean(row.notif_overdue ?? true),
    notifWeeklyDigest: Boolean(row.notif_weekly_digest),
  };
}

export async function getProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return rowToProfile(data as Record<string, unknown>);
}

export async function upsertProfile(profile: Partial<UserProfile> & { id: string }): Promise<UserProfile> {
  const row: Record<string, unknown> = { id: profile.id };
  if (profile.displayName !== undefined) row.display_name = profile.displayName;
  if (profile.avatarUrl !== undefined) row.avatar_url = profile.avatarUrl;
  if (profile.defaultCurrency !== undefined) row.default_currency = profile.defaultCurrency;
  if (profile.darkMode !== undefined) row.dark_mode = profile.darkMode;
  if (profile.offlineMode !== undefined) row.offline_mode = profile.offlineMode;
  if (profile.paymentMethods !== undefined) row.payment_methods = profile.paymentMethods;
  if (profile.notifPush !== undefined) row.notif_push = profile.notifPush;
  if (profile.notifEmail !== undefined) row.notif_email = profile.notifEmail;
  if (profile.notifWhatsapp !== undefined) row.notif_whatsapp = profile.notifWhatsapp;
  if (profile.notifDueSoon !== undefined) row.notif_due_soon = profile.notifDueSoon;
  if (profile.notifOverdue !== undefined) row.notif_overdue = profile.notifOverdue;
  if (profile.notifWeeklyDigest !== undefined) row.notif_weekly_digest = profile.notifWeeklyDigest;

  const { data, error } = await supabase
    .from('user_profiles')
    .upsert(row, { onConflict: 'id' })
    .select()
    .single();
  if (error) throw error;
  return rowToProfile(data as Record<string, unknown>);
}
