import { cn } from '@/lib/utils';

export type StatusBadgeVariant = 'success' | 'warning' | 'danger' | 'info';

interface StatusBadgeProps {
  variant: StatusBadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<StatusBadgeVariant, string> = {
  success: 'bg-[#6b8e6b]/15 text-[#4a7c4a] border-[#6b8e6b]/20',
  warning: 'bg-[#d4a574]/15 text-[#b58a5c] border-[#d4a574]/20',
  danger: 'bg-[#c45c4a]/10 text-[#c45c4a] border-[#c45c4a]/20',
  info: 'bg-[#c4a88a]/15 text-[#6b3d32] border-[#c4a88a]/20',
};

export function StatusBadge({ variant, children, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-lg border px-2.5 py-1 text-[11px] font-semibold',
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
