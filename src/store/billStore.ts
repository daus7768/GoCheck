import { create } from 'zustand';
import type { Bill, Participant, LineItem, LineItemComputed, Currency, SplitType, BillCategory, BillPaymentMethod } from '../types';
import {
  createBillInDB,
  createParticipantsInDB,
  createLineItemsInDB,
  createShareLinkInDB,
  getOrganizerBills,
  uploadGroupPhoto,
  uploadReceiptPhoto,
  deleteBill as deleteBillFromDB,
} from '../lib/supabase';
import { colors } from '../theme/tokens';

function generateShareCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function pickAvatarColor(index: number): string {
  return colors.avatar[index % colors.avatar.length] ?? '#4F46E5';
}

interface CreateBillArgs {
  organizerId: string;
  title: string;
  description?: string;
  currency: Currency;
  splitType: SplitType;
  participants: Participant[];
  lineItems: LineItem[];
  taxRate: number;
  taxSst: boolean;
  taxService: boolean;
  taxServiceRate: number;
  dueDate: Date;
  reminderEnabled: boolean;
  groupPhotoUri?: string;
  receiptUri?: string;
  category?: BillCategory;
  paymentMethod?: BillPaymentMethod;
  paymentDetails?: string;
  isRecurring?: 'monthly' | 'yearly' | null;
}

interface BillStore {
  bills: Bill[];
  isLoading: boolean;
  isCreating: boolean;
  error: string | null;
  lastCreatedBill: Bill | null;
  draft: Partial<CreateBillArgs>;

  fetchBills: (organizerId: string) => Promise<void>;
  createBill: (args: CreateBillArgs) => Promise<Bill>;
  deleteBill: (billId: string, organizerId: string) => Promise<void>;
  clearError: () => void;
  clearLastCreated: () => void;
  setDraft: (partial: Partial<CreateBillArgs>) => void;
  resetDraft: () => void;
}

function mapParticipantRow(p: Record<string, unknown>, index: number): Participant {
  return {
    id: p['id'] as string,
    name: p['name'] as string,
    email: (p['email'] as string | undefined) ?? undefined,
    phone: (p['phone'] as string | undefined) ?? undefined,
    amount: Number(p['amount']),
    isPaid: Boolean(p['is_paid']),
    paidAt: (p['paid_at'] as string | null) ?? null,
    avatarColor: (p['avatar_color'] as string | undefined) ?? pickAvatarColor(index),
    shares: (p['shares'] as number | null | undefined) ?? undefined,
    percent: (p['percent'] as number | null | undefined) ?? undefined,
  };
}

function mapLineItemRow(li: Record<string, unknown>): LineItemComputed {
  const qty = Number(li['quantity']);
  const price = Number(li['unit_price']);
  return {
    id: li['id'] as string,
    description: (li['description'] as string) ?? '',
    quantity: qty,
    unitPrice: price,
    subtotal: qty * price,
  };
}

export const useBillStore = create<BillStore>((set, get) => ({
  bills: [],
  isLoading: false,
  isCreating: false,
  error: null,
  lastCreatedBill: null,
  draft: {},

  fetchBills: async (organizerId) => {
    set({ isLoading: true, error: null });
    try {
      const rows = await getOrganizerBills(organizerId);
      const bills: Bill[] = (rows ?? []).map((row) => {
        const r = row as Record<string, unknown>;
        return {
        id: r['id'] as string,
        organizerId: r['organizer_id'] as string,
        title: r['title'] as string,
        description: (r['description'] as string | undefined) ?? undefined,
        totalAmount: Number(r['total_amount']),
        currency: r['currency'] as Currency,
        dueDate: r['due_date'] as string,
        status: r['status'] as Bill['status'],
        shareLink: r['share_link'] as string,
        category: ((r['category'] as string | undefined) ?? 'other') as Bill['category'],
        isRecurring: ((r['is_recurring'] as string | null | undefined) ?? null) as Bill['isRecurring'],
        groupPhotoUrl: (r['group_photo_url'] as string | undefined) ?? undefined,
        splitType: ((r['split_type'] as string | undefined) ?? 'equal') as SplitType,
        taxRate: Number(r['tax_rate'] ?? 0),
        participants: ((r['participants'] ?? []) as Record<string, unknown>[]).map(mapParticipantRow),
        lineItems: ((r['line_items'] ?? []) as Record<string, unknown>[]).map(mapLineItemRow),
        createdAt: r['created_at'] as string,
        updatedAt: r['updated_at'] as string,
        };
      });
      set({ bills, isLoading: false });
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch bills',
      });
    }
  },

  createBill: async (args) => {
    set({ isCreating: true, error: null });
    try {
      const shareCode = generateShareCode();

      const lineItemSubtotal = args.lineItems.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0
      );
      const effectiveBase = args.lineItems.length > 0
        ? lineItemSubtotal
        : args.participants.reduce((sum, p) => sum + p.amount, 0);
      const sstAdd = args.taxSst ? effectiveBase * 0.06 : 0;
      const serviceAdd = args.taxService ? effectiveBase * (args.taxServiceRate / 100) : 0;
      const totalAmount = effectiveBase + sstAdd + serviceAdd;

      const tempId = generateId();

      let groupPhotoUrl: string | undefined;
      if (args.groupPhotoUri) {
        groupPhotoUrl = await uploadGroupPhoto(tempId, args.groupPhotoUri);
      }

      let receiptUrl: string | undefined;
      if (args.receiptUri) {
        receiptUrl = await uploadReceiptPhoto(tempId, args.receiptUri);
      }

      const billRow = await createBillInDB({
        organizer_id: args.organizerId,
        title: args.title,
        description: args.description,
        total_amount: totalAmount,
        currency: args.currency,
        due_date: args.dueDate.toISOString(),
        status: 'active',
        share_link: shareCode,
        category: args.category ?? 'other',
        is_recurring: args.isRecurring ?? null,
        group_photo_url: groupPhotoUrl,
        split_type: args.splitType,
        tax_rate: args.taxRate,
        tax_sst: args.taxSst,
        tax_service: args.taxService,
        tax_service_rate: args.taxServiceRate,
        receipt_url: receiptUrl,
        payment_method: args.paymentMethod,
        payment_details: args.paymentDetails,
      });

      const participantRows = await createParticipantsInDB(
        args.participants.map((p, i) => ({
          bill_id: billRow.id,
          name: p.name,
          email: p.email,
          phone: p.phone,
          amount: p.amount,
          is_paid: false,
          avatar_color: p.avatarColor ?? pickAvatarColor(i),
          shares: p.shares ?? null,
          percent: p.percent ?? null,
        }))
      );

      const lineItemRows = await createLineItemsInDB(
        args.lineItems.map((li) => ({
          bill_id: billRow.id,
          description: li.description,
          quantity: li.quantity,
          unit_price: li.unitPrice,
        }))
      );

      await createShareLinkInDB({
        code: shareCode,
        bill_id: billRow.id,
        is_active: true,
      });

      const newBill: Bill = {
        id: billRow.id,
        organizerId: args.organizerId,
        title: args.title,
        description: args.description,
        totalAmount,
        currency: args.currency,
        dueDate: args.dueDate.toISOString(),
        status: 'active',
        shareLink: shareCode,
        category: args.category ?? 'other',
        isRecurring: args.isRecurring ?? null,
        groupPhotoUrl,
        receiptUrl,
        splitType: args.splitType,
        taxRate: args.taxRate,
        taxSst: args.taxSst,
        taxService: args.taxService,
        taxServiceRate: args.taxServiceRate,
        paymentMethod: args.paymentMethod,
        paymentDetails: args.paymentDetails,
        invoiceNumber: (billRow as Record<string, unknown>)['invoice_number'] as string | undefined,
        inviteToken: (billRow as Record<string, unknown>)['invite_token'] as string | undefined,
        participants: (participantRows ?? []).map((p, i) => ({
          id: p.id,
          name: p.name,
          email: p.email ?? undefined,
          phone: p.phone ?? undefined,
          amount: Number(p.amount),
          isPaid: false,
          avatarColor: (p.avatar_color as string | undefined) ?? pickAvatarColor(i),
          shares: (p.shares as number | undefined) ?? undefined,
          percent: (p.percent as number | undefined) ?? undefined,
        })),
        lineItems: (lineItemRows ?? []).map((li) => ({
          id: li.id,
          description: li.description,
          quantity: Number(li.quantity),
          unitPrice: Number(li.unit_price),
          subtotal: Number(li.quantity) * Number(li.unit_price),
        })),
        createdAt: billRow.created_at,
        updatedAt: billRow.updated_at,
      };

      set((state) => ({
        bills: [newBill, ...state.bills],
        isCreating: false,
        lastCreatedBill: newBill,
        draft: {},
      }));

      return newBill;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create bill';
      set({ isCreating: false, error: message });
      throw err;
    }
  },

  deleteBill: async (billId, organizerId) => {
    try {
      await deleteBillFromDB(billId, organizerId);
      set((state) => ({ bills: state.bills.filter((b) => b.id !== billId) }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to delete bill' });
      throw err;
    }
  },

  clearError: () => set({ error: null }),
  clearLastCreated: () => set({ lastCreatedBill: null }),
  setDraft: (partial) => set((state) => ({ draft: { ...state.draft, ...partial } })),
  resetDraft: () => set({ draft: {} }),
}));
