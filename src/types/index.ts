export type Currency = 'MYR' | 'USD' | 'SGD' | 'GBP' | 'EUR' | 'AUD' | 'JPY' | 'CNY';

export type SplitType = 'equal' | 'custom' | 'percent' | 'shares';

export type BillStatus = 'active' | 'complete' | 'cancelled';

export type PaymentStatus = 'pending' | 'confirmed' | 'failed';

export interface Participant {
  id: string;
  name: string;
  email?: string;
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
