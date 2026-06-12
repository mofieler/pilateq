'use client';

import Link from 'next/link';
import {
  Building2,
  Users,
  Dumbbell,
  CreditCard,
  CalendarDays,
  Wallet,
  FileCheck,
  CheckCircle2,
  Circle,
  ArrowRight,
} from 'lucide-react';

export interface AdminSetupChecklistProps {
  identityComplete: boolean;
  instructorsCount: number;
  templatesCount: number;
  packagesCount: number;
  sessionsCount: number;
  paymentProvidersEnabled: boolean;
  waiverSigned: boolean;
}

interface ChecklistItem {
  key: string;
  label: string;
  description: string;
  icon: React.ElementType;
  href: string;
  completed: boolean;
}

export function AdminSetupChecklist(props: AdminSetupChecklistProps) {
  const {
    identityComplete,
    instructorsCount,
    templatesCount,
    packagesCount,
    sessionsCount,
    paymentProvidersEnabled,
    waiverSigned,
  } = props;

  const items: ChecklistItem[] = [
    {
      key: 'identity',
      label: 'Identity settings',
      description: 'Studio name, contact info, and tax details',
      icon: Building2,
      href: '/admin/settings/general',
      completed: identityComplete,
    },
    {
      key: 'instructors',
      label: 'Instructors',
      description: `${instructorsCount} instructor${instructorsCount === 1 ? '' : 's'} set up`,
      icon: Users,
      href: '/admin/templates',
      completed: instructorsCount > 0,
    },
    {
      key: 'templates',
      label: 'Class templates',
      description: `${templatesCount} template${templatesCount === 1 ? '' : 's'} created`,
      icon: Dumbbell,
      href: '/admin/templates',
      completed: templatesCount > 0,
    },
    {
      key: 'packages',
      label: 'Credit packages',
      description: `${packagesCount} package${packagesCount === 1 ? '' : 's'} defined`,
      icon: CreditCard,
      href: '/admin/credits',
      completed: packagesCount > 0,
    },
    {
      key: 'sessions',
      label: 'Scheduled sessions',
      description: `${sessionsCount} upcoming session${sessionsCount === 1 ? '' : 's'}`,
      icon: CalendarDays,
      href: '/admin/classes',
      completed: sessionsCount > 0,
    },
    {
      key: 'payments',
      label: 'Payment providers',
      description: paymentProvidersEnabled ? 'At least one provider enabled' : 'No payment provider enabled',
      icon: Wallet,
      href: '/admin/settings/payments',
      completed: paymentProvidersEnabled,
    },
    {
      key: 'waiver',
      label: 'Waiver signed',
      description: waiverSigned ? 'Liability waiver signed' : 'Liability waiver not signed',
      icon: FileCheck,
      href: '/waiver',
      completed: waiverSigned,
    },
  ];

  const completedCount = items.filter((i) => i.completed).length;
  const totalCount = items.length;
  const allComplete = completedCount === totalCount;

  return (
    <div className="rounded-2xl border border-[#ede8e5]/80 bg-gradient-to-br from-[#faf9f7]/80 to-[#ede8e5]/40 p-6 shadow-[0_4px_20px_rgba(78,43,34,0.04)]">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#4e2b22]">Setup checklist</h2>
          <p className="text-sm text-[#8b6b5c]">
            {allComplete
              ? 'Your studio is fully configured. Nice work!'
              : 'Complete these steps to get your studio ready for students.'}
          </p>
        </div>
        <div className="inline-flex items-center gap-2 self-start rounded-full bg-white/60 px-3 py-1.5 text-sm font-medium text-[#4e2b22] border border-[#ede8e5]">
          <span className="text-[#4a7c4a]">{completedCount}</span>
          <span className="text-[#8b6b5c]">/</span>
          <span className="text-[#8b6b5c]">{totalCount}</span>
          <span className="text-[#8b6b5c]">completed</span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={[
                'group flex items-start gap-3 rounded-xl border p-4 transition-all',
                item.completed
                  ? 'border-[#4a7c4a]/20 bg-[#4a7c4a]/5 hover:bg-[#4a7c4a]/10'
                  : 'border-[#ede8e5] bg-white/60 hover:border-[#c4a88a]/50 hover:bg-[#faf9f7]/80',
              ].join(' ')}
            >
              <div
                className={[
                  'mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg transition-colors',
                  item.completed ? 'bg-[#4a7c4a]/10 text-[#4a7c4a]' : 'bg-[#ede8e5]/60 text-[#8b6b5c]',
                ].join(' ')}
              >
                <Icon className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-[#4e2b22]">{item.label}</h3>
                  {item.completed ? (
                    <CheckCircle2 className="size-4 text-[#4a7c4a]" aria-label="Completed" />
                  ) : (
                    <Circle className="size-4 text-[#c4a88a]" aria-label="Pending" />
                  )}
                </div>
                <p className="mt-0.5 text-xs text-[#8b6b5c]">{item.description}</p>
              </div>
              <ArrowRight
                className={[
                  'size-4 shrink-0 self-center opacity-0 transition-all group-hover:opacity-100',
                  item.completed ? 'text-[#4a7c4a]' : 'text-[#4e2b22]',
                ].join(' ')}
              />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
