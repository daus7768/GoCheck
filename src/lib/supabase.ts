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
  const response = await fetch(uri);
  const blob = await response.blob();
  const ext = uri.split('.').pop() ?? 'jpg';
  const path = `group-photos/${billId}.${ext}`;

  const { error } = await supabase.storage
    .from('bill-assets')
    .upload(path, blob, { upsert: true, contentType: `image/${ext}` });

  if (error) throw error;

  const { data } = supabase.storage.from('bill-assets').getPublicUrl(path);
  return data.publicUrl;
}
