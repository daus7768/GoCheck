import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { UserProfile, ParticipantView, PaymentFlowStatus, ProofExtraction } from '../types';

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
    detectSessionInUrl: Platform.OS === 'web',
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
  tax_sst?: boolean;
  tax_service?: boolean;
  tax_service_rate?: number;
  receipt_url?: string;
  payment_method?: string;
  payment_details?: string;
}) {
  const { data, error } = await supabase
    .from('bills')
    .insert(payload)
    .select('*, invoice_number, invite_token')
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
    .rpc('get_bill_by_share_link', { p_code: code });
  if (error) throw error;
  if (!data) throw new Error('Bill not found');
  return data as {
    id: string;
    title: string;
    description: string | null;
    total_amount: number;
    currency: string;
    due_date: string;
    status: string;
    share_link: string;
    category: string | null;
    is_recurring: string | null;
    group_photo_url: string | null;
    split_type: string | null;
    tax_rate: number | null;
    created_at: string;
    updated_at: string;
    participants: Array<{
      id: string; name: string; email: string | null; phone: string | null;
      amount: number; is_paid: boolean; paid_at: string | null;
      avatar_color: string; shares: number | null; percent: number | null;
    }>;
    line_items: Array<{
      id: string; description: string; quantity: number; unit_price: number;
    }>;
  };
}

export async function getOrganizerBills(organizerId: string) {
  const { data, error } = await supabase
    .from('bills')
    .select(`
      id, title, description, total_amount, currency, due_date, status, share_link,
      category, is_recurring, group_photo_url, split_type, tax_rate,
      tax_sst, tax_service, tax_service_rate, payment_method, payment_details,
      receipt_url, invite_token, invoice_number,
      created_at, updated_at,
      participants (
        id, name, email, phone, amount, is_paid, paid_at, avatar_color, shares, percent,
        access_token, payment_status, proof_url, submitted_at, confirmed_at, rejected_reason,
        proof_extracted, proof_summary
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

export async function markParticipantPaidByShareLink(
  shareCode: string,
  participantId: string
): Promise<{ id: string; bill_id: string; is_paid: boolean; paid_at: string } | { already_paid: boolean }> {
  const { data, error } = await supabase
    .rpc('mark_participant_paid', {
      p_share_code: shareCode,
      p_participant_id: participantId,
    });
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

export async function uploadReceiptPhoto(billId: string, uri: string): Promise<string> {
  const path = `receipts/${billId}.jpg`;

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

export async function uploadAvatarPhoto(userId: string, uri: string): Promise<string> {
  const path = `avatars/${userId}-${Date.now()}.jpg`;

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
    expoPushToken: (row.expo_push_token as string | null) ?? undefined,
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
  if (profile.expoPushToken !== undefined) row.expo_push_token = profile.expoPushToken;

  const { data, error } = await supabase
    .from('user_profiles')
    .upsert(row, { onConflict: 'id' })
    .select()
    .single();
  if (error) throw error;
  return rowToProfile(data as Record<string, unknown>);
}

// ─── Participant Payment Flow (migration 008) ─────────────────────────────────

export async function getParticipantView(token: string): Promise<ParticipantView | null> {
  const { data, error } = await supabase.rpc('get_participant_view', { p_token: token });
  if (error) throw error;
  return data as ParticipantView | null;
}

export type SubmitPaymentResult =
  | { paymentStatus: PaymentFlowStatus; submittedAt: string; already_confirmed?: never }
  | { already_confirmed: true; paymentStatus?: never; submittedAt?: never };

export async function submitPayment(
  token: string,
  proofUrl?: string,
  note?: string,
): Promise<SubmitPaymentResult> {
  const { data, error } = await supabase.rpc('submit_payment', {
    p_token: token,
    p_proof_url: proofUrl ?? null,
    p_note: note ?? null,
  });
  if (error) throw error;
  return data;
}

export async function confirmPayment(participantId: string): Promise<{ paymentStatus: PaymentFlowStatus; confirmedAt: string }> {
  const { data, error } = await supabase.rpc('confirm_payment', { p_participant_id: participantId });
  if (error) throw error;
  return data;
}

export async function rejectPayment(participantId: string, reason: string): Promise<{ paymentStatus: PaymentFlowStatus; rejectedReason: string }> {
  const { data, error } = await supabase.rpc('reject_payment', {
    p_participant_id: participantId,
    p_reason: reason,
  });
  if (error) throw error;
  return data;
}

// ─── Layer A: scan + clear proof ──────────────────────────────────────────────

export type ScanProofResult =
  | { success: true; summary: string; extracted: ProofExtraction; proofUrl: string }
  | { success: false; error: string };

export async function scanPaymentProof(
  token: string,
  imageBase64: string,
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp',
): Promise<ScanProofResult> {
  const { data, error } = await supabase.functions.invoke('scan-payment-proof', {
    body: { token, imageBase64, mimeType },
  });
  if (error) return { success: false, error: error.message };
  return data as ScanProofResult;
}

export async function clearPaymentProof(token: string): Promise<{ id: string; cleared: boolean }> {
  const { data, error } = await supabase.rpc('clear_payment_proof', { p_token: token });
  if (error) throw error;
  return data as { id: string; cleared: boolean };
}
