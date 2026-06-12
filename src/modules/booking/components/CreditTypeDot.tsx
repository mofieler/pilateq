import { cn } from '@/lib/utils';

export type CreditTypeDotType =
  | 'pass'
  | 'mat_pass'
  | 'reformer_pass'
  | 'session'
  | string;

const creditColor: Record<string, string> = {
  pass: '#c4a88a',
  reformer_pass: '#c4a88a',
  mat_pass: '#6b8e6b',
  session: '#4e2b22',
};

interface CreditTypeDotProps {
  creditType: CreditTypeDotType;
  size?: number;
  className?: string;
}

export function CreditTypeDot({
  creditType,
  size = 10,
  className,
}: CreditTypeDotProps) {
  return (
    <span
      className={cn('inline-block shrink-0 rounded-full', className)}
      style={{
        width: size,
        height: size,
        backgroundColor: creditColor[creditType] ?? '#c4a88a',
      }}
      aria-hidden
    />
  );
}
