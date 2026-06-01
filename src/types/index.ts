export type Currency = 'MYR' | 'USD' | 'SGD' | 'GBP' | 'EUR' | 'AUD' | 'JPY' | 'CNY';

export type SplitType = 'equal' | 'custom' | 'percent' | 'shares';

export type BillStatus = 'active' | 'complete' | 'cancelled';

export type BillCategory = 'travel' | 'food' | 'housing' | 'sports' | 'events' | 'other';

export type BillPaymentMethod = 'duitnow' | 'bank_transfer' | 'ewallet' | 'cash';

export type PaymentStatus = 'pending' | 'confirmed' | 'failed';

export type PaymentFlowStatus = 'unpaid' | 'pending' | 'confirmed' | 'rejected';

export interface ProofExtraction {
  amount: number | null;
  currency: string | null;
  reference: string | null;
  bank: string | null;
  date: string | null;
  confidence: number;
  matchesExpected: boolean;
}

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
  // ── Per-participant payment flow (migration 008) ──
  accessToken?: string;
  paymentStatus: PaymentFlowStatus;
  proofUrl?: string;
  submittedAt?: string;
  confirmedAt?: string;
  rejectedReason?: string;
  proofExtracted?: ProofExtraction;
  proofSummary?: string;
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
  category?: BillCategory;
  isRecurring?: 'monthly' | 'yearly' | null;
  splitType?: SplitType;
  taxRate?: number;
  taxSst?: boolean;
  taxService?: boolean;
  taxServiceRate?: number;
  groupPhotoUrl?: string;
  receiptUrl?: string;
  paymentMethod?: BillPaymentMethod;
  paymentDetails?: string;
  inviteToken?: string;
  invoiceNumber?: string;
  participants: Participant[];
  lineItems?: LineItemComputed[];
  createdAt: string;
  updatedAt: string;
}

export interface ParticipantView {
  participant: {
    id: string;
    name: string;
    amount: number;
    paymentStatus: PaymentFlowStatus;
    proofUrl?: string;
    submittedAt?: string;
    confirmedAt?: string;
    rejectedReason?: string;
    proofExtracted?: ProofExtraction;
    proofSummary?: string;
  };
  bill: {
    id: string;
    title: string;
    description?: string;
    currency: Currency;
    dueDate: string;
    status: BillStatus;
    invoiceNumber?: string;
    paymentMethod?: BillPaymentMethod;
    paymentDetails?: string;
  };
  organizer: {
    displayName: string;
    avatarUrl?: string;
  };
  socialProof: {
    paidCount: number;
    totalCount: number;
  };
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
  taxSst: boolean;
  taxService: boolean;
  taxServiceRate: number;
  dueDate: Date;
  description: string;
  reminderEnabled: boolean;
  groupPhotoUri?: string;
  receiptUri?: string;
  paymentMethod?: BillPaymentMethod;
  paymentDetails?: string;
  category: BillCategory;
}

export interface GeminiScanResult {
  title: string | null;
  description: string | null;
  total_amount: number;
  currency: string;
  subtotal: number;
  tax_sst: boolean;
  tax_sst_amount: number;
  tax_service: boolean;
  tax_service_rate: number;
  tax_service_amount: number;
  line_items: Array<{ name: string; quantity: number; unit_price: number; subtotal: number }>;
  payment_method: string | null;
  date: string | null;
  confidence: number;
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
  participantAccessToken?: string;
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

export type PaymentMethodKey = 'duitnow' | 'card' | 'paypal' | 'bank_transfer';

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodKey, string> = {
  duitnow: 'DuitNow',
  card: 'Credit / Debit Card',
  paypal: 'PayPal',
  bank_transfer: 'Bank Transfer',
};

export const PAYMENT_METHOD_SUBTITLES: Record<PaymentMethodKey, string> = {
  duitnow: 'Instant transfer',
  card: 'Visa / Mastercard',
  paypal: 'paypal.me',
  bank_transfer: 'Direct bank transfer',
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
  expoPushToken?: string;
}

export interface SecuritySettings {
  pinEnabled: boolean;
  biometricEnabled: boolean;
  autoLockDuration: number;
}

export const AUTO_LOCK_OPTIONS: { label: string; value: number }[] = [
  { label: '1 minute', value: 60 },
  { label: '5 minutes', value: 300 },
  { label: '15 minutes', value: 900 },
  { label: '30 minutes', value: 1800 },
  { label: 'Never', value: -1 },
];

export function autoLockLabel(seconds: number): string {
  const option = AUTO_LOCK_OPTIONS.find(o => o.value === seconds);
  if (option) return seconds === -1 ? 'Never' : `After ${option.label} idle`;
  return 'After 5 minutes idle';
}
