'use client';

import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Shield, AlertCircle, CheckCircle2, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AuditLogListItem } from '@/modules/admin/actions/auditLog.actions';

interface Props {
  initialLogs: AuditLogListItem[];
}

const SEVERITY_STYLES: Record<string, { icon: React.ElementType; color: string; bg: string; border: string }> = {
  low: {
    icon: CheckCircle2,
    color: 'text-[#6b8e6b]',
    bg: 'bg-[#6b8e6b]/8',
    border: 'border-[#6b8e6b]/20',
  },
  medium: {
    icon: Shield,
    color: 'text-[#8b5a3c]',
    bg: 'bg-[#8b5a3c]/8',
    border: 'border-[#8b5a3c]/20',
  },
  high: {
    icon: AlertCircle,
    color: 'text-[#d4a574]',
    bg: 'bg-[#d4a574]/10',
    border: 'border-[#d4a574]/25',
  },
  critical: {
    icon: AlertCircle,
    color: 'text-[#c45c4a]',
    bg: 'bg-[#c45c4a]/8',
    border: 'border-[#c45c4a]/20',
  },
};

function formatAction(action: string): string {
  return action
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function AuditLogRow({ log }: { log: AuditLogListItem }) {
  const styles = SEVERITY_STYLES[log.severity] ?? SEVERITY_STYLES.low;
  const Icon = styles.icon;

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl border px-3.5 py-3 transition-colors',
        styles.border,
        styles.bg
      )}
    >
      <Icon className={cn('size-4 shrink-0 mt-0.5', styles.color)} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-sm font-semibold text-[#4e2b22]">{formatAction(log.action)}</span>
          <span className="text-xs text-[#8b6b5c]">{log.resource}</span>
        </div>
        <p className="text-xs text-[#6b3d32] mt-0.5">
          {log.actorName ?? 'Unknown'} {log.actorEmail ? `· ${log.actorEmail}` : ''}
        </p>
        <p className="text-[11px] text-[#a6856f] mt-1">
          {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
          {!log.success && (
            <span className="ml-2 font-medium text-[#c45c4a]">Failed</span>
          )}
        </p>
      </div>
    </div>
  );
}

export function AdminAuditLogWidget({ initialLogs }: Props) {
  const [logs] = useState<AuditLogListItem[]>(initialLogs);

  if (logs.length === 0) {
    return (
      <div className="rounded-lg border border-[#ede8e5]/80 bg-gradient-to-br from-[#faf9f7]/80 to-[#ede8e5]/40 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[#4e2b22]">Recent Admin Activity</h2>
        </div>
        <div className="flex flex-col items-center justify-center py-10 text-center rounded-xl border border-dashed border-[#ede8e5] bg-[#faf9f7]/30">
          <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-[#ede8e5]/50">
            <FileText className="size-5 text-[#c4a88a]" />
          </div>
          <p className="text-sm font-semibold text-[#4e2b22]">No recent admin activity</p>
          <p className="text-xs text-[#8b6b5c] mt-1 max-w-xs">
            Audit entries will appear here when admins perform security, financial, or configuration actions.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#ede8e5]/80 bg-gradient-to-br from-[#faf9f7]/80 to-[#ede8e5]/40 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-[#4e2b22]">Recent Admin Activity</h2>
        <span className="text-xs text-[#8b6b5c]">{logs.length} events</span>
      </div>
      <div className="space-y-3">
        {logs.map((log) => (
          <AuditLogRow key={log.id} log={log} />
        ))}
      </div>
    </div>
  );
}
