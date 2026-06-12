import { CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';

export function formatPrice(cents: number, currency: string): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

export const STATUS_CONFIG = {
  pending:   { label: 'Pending',   color: 'bg-[#d4a574]/15 text-[#b58a5c] border-[#d4a574]/30', icon: Clock },
  paid:      { label: 'Paid',      color: 'bg-[#6b8e6b]/15 text-[#4a7c4a] border-[#6b8e6b]/30', icon: CheckCircle },
  overdue:   { label: 'Overdue',   color: 'bg-[#c45c4a]/15 text-[#c45c4a] border-[#c45c4a]/30', icon: AlertTriangle },
  failed:    { label: 'Failed',    color: 'bg-[#8b6b5c]/15 text-[#8b6b5c] border-[#8b6b5c]/30', icon: XCircle },
  cancelled: { label: 'Cancelled', color: 'bg-[#ede8e5] text-[#8b6b5c] border-[#ede8e5]',        icon: XCircle },
} satisfies Record<string, { label: string; color: string; icon: React.ElementType }>;
