import type { CreditType } from '@/lib/config/class-types';

export type PaymentMethod = 'stripe' | 'pay_at_studio' | 'bank_transfer' | 'cash' | 'sound_healing_credits';

export interface CreditPurchase {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  userAvatarUrl: string | null;
  packageName: string | null;
  creditsAmount: number;
  creditType: CreditType;
  priceCents: number;
  currency: string;
  paymentMethod: PaymentMethod;
  paymentStatus: 'pending' | 'paid' | 'failed' | 'cancelled' | 'overdue';
  paymentDueDate: string | null;
  paidAt: string | null;
  createdAt: string;
  adminNotes: string | null;
  invoiceNumber: string | null;
  invoiceIssuedAt: string | null;
  reminderCount: number;
  lastReminderAt: string | null;
}

export type StatusFilter = 'all' | 'pending' | 'paid' | 'overdue' | 'pay_at_studio';
