'use client';

import { useState, useTransition } from 'react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { updateClassPassCheckinStatusAction } from '../actions/classPass.actions';
import { toast } from 'sonner';

interface CheckinRow {
  checkin: {
    id: string;
    providerKey: string;
    status: string;
    createdAt: Date | null;
    checkedInAt: Date | null;
    notes: string | null;
  };
  userName: string | null;
  userEmail: string | null;
  sessionStartsAt: Date | null;
  className: string | null;
}

interface ProviderOption {
  key: string;
  label: string;
}

interface Props {
  checkins: CheckinRow[];
  providers: ProviderOption[];
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-emerald-100 text-emerald-800',
  reconciled: 'bg-blue-100 text-blue-800',
  rejected: 'bg-red-100 text-red-800',
};

export function ClassPassCheckinTable({ checkins, providers }: Props) {
  const [rows, setRows] = useState(checkins);
  const [isPending, startTransition] = useTransition();

  function updateStatus(id: string, status: 'pending' | 'confirmed' | 'reconciled' | 'rejected') {
    startTransition(async () => {
      try {
        await updateClassPassCheckinStatusAction(id, status);
        setRows((current) =>
          current.map((row) => (row.checkin.id === id ? { ...row, checkin: { ...row.checkin, status } } : row))
        );
        toast.success(`Status updated to ${status}`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Update failed');
      }
    });
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-[#ede8e5] bg-white p-8 text-center text-sm text-[#8b6b5c]">
        No class pass check-ins this month.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#ede8e5] bg-white shadow-sm overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date / Class</TableHead>
            <TableHead>Student</TableHead>
            <TableHead>Provider</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const provider = providers.find((p) => p.key === row.checkin.providerKey);
            return (
              <TableRow key={row.checkin.id}>
                <TableCell>
                  <p className="font-medium text-[#4e2b22]">{row.className ?? 'Unknown class'}</p>
                  <p className="text-xs text-[#8b6b5c]">
                    {row.sessionStartsAt ? format(new Date(row.sessionStartsAt), 'EEE, MMM d · HH:mm') : '—'}
                  </p>
                </TableCell>
                <TableCell>
                  <p className="text-sm text-[#4e2b22]">{row.userName ?? 'Unknown'}</p>
                  <p className="text-xs text-[#8b6b5c]">{row.userEmail}</p>
                </TableCell>
                <TableCell className="text-sm text-[#6b3d32]">{provider?.label ?? row.checkin.providerKey}</TableCell>
                <TableCell>
                  <Badge className={STATUS_STYLES[row.checkin.status] ?? 'bg-gray-100 text-gray-800'}>
                    {row.checkin.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {row.checkin.status !== 'confirmed' && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isPending}
                        onClick={() => updateStatus(row.checkin.id, 'confirmed')}
                      >
                        Confirm
                      </Button>
                    )}
                    {row.checkin.status !== 'reconciled' && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isPending}
                        onClick={() => updateStatus(row.checkin.id, 'reconciled')}
                      >
                        Reconcile
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
