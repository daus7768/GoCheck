import { create } from 'zustand';
import type { Bill, Participant, LineItem, Currency, SplitType } from '../types';
import {
  createBillInDB,
  createParticipantsInDB,
  createShareLinkInDB,
  getOrganizerBills,
  uploadGroupPhoto,
} from '../lib/supabase';

function generateShareCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
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
  dueDate: Date;
  reminderEnabled: boolean;
  groupPhotoUri?: string;
}

interface BillStore {
  // State
  bills: Bill[];
  isLoading: boolean;
  isCreating: boolean;
  error: string | null;
  lastCreatedBill: Bill | null;

  // Draft state for create flow
  draft: Partial<CreateBillArgs>;

  // Actions
  fetchBills: (organizerId: string) => Promise<void>;
  createBill: (args: CreateBillArgs) => Promise<Bill>;
  clearError: () => void;
  clearLastCreated: () => void;
  setDraft: (partial: Partial<CreateBillArgs>) => void;
  resetDraft: () => void;
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
      const bills: Bill[] = (rows ?? []).map((row) => ({
        id: row.id,
        organizerId: row.organizer_id,
        title: row.title,
        description: row.description ?? undefined,
        totalAmount: Number(row.total_amount),
        currency: row.currency as Currency,
        dueDate: row.due_date,
        status: row.status,
        shareLink: row.share_link,
        participants: (row.participants ?? []).map((p: Record<string, unknown>) => ({
          id: p['id'] as string,
          name: p['name'] as string,
          email: p['email'] as string | undefined,
          amount: Number(p['amount']),
          isPaid: Boolean(p['is_paid']),
          paidAt: p['paid_at'] as string | null,
          avatarColor: '#4F46E5',
        })),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
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

      // Calculate total from line items or use participant amounts
      const lineItemSubtotal = args.lineItems.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0
      );
      const taxAmount = lineItemSubtotal * (args.taxRate / 100);
      const totalAmount = args.lineItems.length > 0
        ? lineItemSubtotal + taxAmount
        : args.participants.reduce((sum, p) => sum + p.amount, 0);

      // Upload group photo if provided
      let groupPhotoUrl: string | undefined;
      if (args.groupPhotoUri) {
        const tempId = generateId();
        groupPhotoUrl = await uploadGroupPhoto(tempId, args.groupPhotoUri);
      }

      // Insert bill
      const billRow = await createBillInDB({
        organizer_id: args.organizerId,
        title: args.title,
        description: args.description,
        total_amount: totalAmount,
        currency: args.currency,
        due_date: args.dueDate.toISOString(),
        status: 'active',
        share_link: shareCode,
      });

      // Insert participants
      const participantRows = await createParticipantsInDB(
        args.participants.map((p) => ({
          bill_id: billRow.id,
          name: p.name,
          email: p.email,
          amount: p.amount,
          is_paid: false,
        }))
      );

      // Insert share link record
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
        groupPhotoUrl,
        participants: (participantRows ?? []).map((p, i) => {
          const srcParticipant = args.participants[i];
          return {
            id: p.id,
            name: p.name,
            email: p.email ?? undefined,
            amount: Number(p.amount),
            isPaid: false,
            avatarColor: srcParticipant?.avatarColor ?? '#4F46E5',
          };
        }),
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

  clearError: () => set({ error: null }),
  clearLastCreated: () => set({ lastCreatedBill: null }),
  setDraft: (partial) => set((state) => ({ draft: { ...state.draft, ...partial } })),
  resetDraft: () => set({ draft: {} }),
}));
