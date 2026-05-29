export type Currency = 'MYR' | 'USD' | 'SGD' | 'GBP' | 'EUR' | 'AUD' | 'JPY' | 'CNY';

export type SplitType = 'equal' | 'custom' | 'percent' | 'shares';

export type BillStatus = 'active' | 'complete' | 'cancelled';

export type PaymentStatus = 'pending' | 'confirmed' | 'failed';

export interface Participant {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  amount: number;
  isPaid: boolean;
  paidAt?: string | null;
  avatarColor: string;
  shares?: number;
  percent?: number;
}

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface LineItemComputed extends LineItem {
  subtotal: number;
}

export interface BillSummary {
  totalAmount: number;
  amountCollected: number;
  remainingAmount: number;
  percentagePaid: number;
  participantsPaid: number;
  participantsTotal: number;
}

export interface Bill {
  id: string;
  organizerId: string;
  title: string;
  description?: string;
  totalAmount: number;
  currency: Currency;
  dueDate: string;
  status: BillStatus;
  shareLink: string;
  category?: 'travel' | 'food' | 'housing' | 'other';
  isRecurring?: 'monthly' | 'yearly' | null;
  participants: Participant[];
  lineItems?: LineItemComputed[];
  taxRate?: number;
  groupPhotoUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBillPayload {
  organizerId: string;
  title: string;
  description?: string;
  totalAmount: number;
  currency: Currency;
  dueDate: string;
  splitType: SplitType;
  taxRate: number;
  groupPhotoUrl?: string;
  reminderEnabled: boolean;
  participants: Array<{
    name: string;
    email?: string;
    amount: number;
  }>;
  lineItems?: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
  }>;
}

export interface CreateBillFormValues {
  title: string;
  currency: Currency;
  splitType: SplitType;
  participants: Participant[];
  lineItems: LineItem[];
  taxRate: string;
  dueDate: Date;
  description: string;
  reminderEnabled: boolean;
  groupPhotoUri?: string;
}

export interface Payment {
  id: string;
  billId: string;
  participantId: string;
  amount: number;
  status: PaymentStatus;
  confirmedAt?: string;
  timestamp: string;
}

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

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  MYR: 'RM',
  USD: '$',
  SGD: 'S$',
  GBP: '£',
  EUR: '€',
  AUD: 'A$',
  JPY: '¥',
  CNY: '¥',
};

export const CURRENCY_LABELS: Record<Currency, string> = {
  MYR: 'Malaysian Ringgit',
  USD: 'US Dollar',
  SGD: 'Singapore Dollar',
  GBP: 'British Pound',
  EUR: 'Euro',
  AUD: 'Australian Dollar',
  JPY: 'Japanese Yen',
  CNY: 'Chinese Yuan',
};

export const SUPPORTED_CURRENCIES: Currency[] = [
  'MYR', 'USD', 'SGD', 'GBP', 'EUR', 'AUD',
];

export const SPLIT_TYPE_LABELS: Record<SplitType, string> = {
  equal: 'Equal',
  custom: 'Custom',
  percent: 'Percent',
  shares: 'Shares',
};

// ─── Profile & Auth ────────────────────────────────────────────────────────────

export type PaymentMethodKey = 'duitnow' | 'card' | 'paypal' | 'bank';

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodKey, string> = {
  duitnow: 'DuitNow',
  card: 'Card via Stripe',
  paypal: 'PayPal',
  bank: 'Bank Transfer',
};

export const PAYMENT_METHOD_SUBTITLES: Record<PaymentMethodKey, string> = {
  duitnow: 'Instant transfer · MYR',
  card: 'Visa ending 4242',
  paypal: 'paypal.me/user',
  bank: 'Direct bank transfer',
};

export interface UserProfile {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  defaultCurrency: Currency;
  darkMode: boolean;
  offlineMode: boolean;
  paymentMethods: PaymentMethodKey[];
  notifPush: boolean;
  notifEmail: boolean;
  notifWhatsapp: boolean;
  notifDueSoon: boolean;
  notifOverdue: boolean;
  notifWeeklyDigest: boolean;
}

export interface SecuritySettings {
  pinEnabled: boolean;
  biometricEnabled: boolean;
  autoLockDuration: number; // seconds; -1 = never
}

export const AUTO_LOCK_OPTIONS: { label: string; value: number }[] = [
  { label: '1 minute', value: 60 },
  { label: '5 minutes', value: 300 },
  { label: '15 minutes', value: 900 },
  { label: '30 minutes', value: 1800 },
  { label: 'Never', value: -1 },
];

export function autoLockLabel(seconds: number): string {
  if (seconds === -1) return 'Never';
  const option = AUTO_LOCK_OPTIONS.find(o => o.value === seconds);
  return option ? `After ${option.label} idle` : 'After 5 minutes idle';
}
