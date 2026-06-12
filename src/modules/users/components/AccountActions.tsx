'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Download, Loader2, Trash2, AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { deleteAccountAction } from '../actions/deleteAccount.action';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AccountActionsProps {
  userId: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function triggerJsonDownload(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#ede8e5]/80 bg-gradient-to-br from-[#faf9f7]/90 to-[#f5f3f1]/70 p-6 shadow-[0_4px_20px_rgba(78,43,34,0.04)]">
      <div className="mb-5">
        <h2 className="text-base font-semibold text-[#4e2b22]">{title}</h2>
        <p className="mt-0.5 text-sm text-[#8b6b5c]">{description}</p>
      </div>
      {children}
    </section>
  );
}

// ─── Data Export ──────────────────────────────────────────────────────────────

function ExportDataButton({ userId }: { userId: string }) {
  const [isPending, startTransition] = useTransition();

  const handleExport = () => {
    startTransition(async () => {
      try {
        const response = await fetch('/api/user/export');
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error ?? 'Export failed');
        }

        const blob = await response.blob();
        const contentDisposition = response.headers.get('content-disposition') ?? '';
        const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
        const filename = filenameMatch?.[1] ?? `data-export-${userId}.json`;

        triggerJsonDownload(blob, filename);
        toast.success('Data export downloaded');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Could not export data');
      }
    });
  };

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={isPending}
      className="inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-[#ede8e5] bg-white px-5 py-2.5 text-sm font-semibold text-[#4e2b22] shadow-sm transition-all hover:bg-[#faf9f7] hover:border-[#c4a88a] disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}
      {isPending ? 'Exporting…' : 'Export my data'}
    </button>
  );
}

// ─── Delete Account ───────────────────────────────────────────────────────────

function DeleteAccountDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleConfirm = () => {
    startTransition(async () => {
      try {
        const result = await deleteAccountAction();
        if (!result.success) {
          throw new Error(result.error ?? 'Failed to delete account');
        }

        toast.success('Account deactivated');
        onOpenChange(false);
        router.push('/login');
      } catch (error) {
        onOpenChange(false);
        toast.error(error instanceof Error ? error.message : 'Could not delete account');
      }
    });
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next: boolean) => {
        if (!next && isPending) return;
        onOpenChange(next);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="mx-auto mb-3 inline-flex size-12 items-center justify-center rounded-full bg-red-100 sm:mx-0">
            <AlertTriangle className="size-6 text-red-600" aria-hidden />
          </div>
          <AlertDialogTitle>Delete your account?</AlertDialogTitle>
          <AlertDialogDescription>
            Your account will be deactivated. Booking history and invoices are retained for legal/tax purposes.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <ul className="space-y-2 rounded-xl bg-[#faf9f7] p-4 text-sm text-[#6b3d32]">
          <li>• Future confirmed bookings will be cancelled and credits refunded where applicable.</li>
          <li>• Personal data such as phone number, avatar and password will be removed.</li>
          <li>• Name and email are kept only if required by invoice/financial records.</li>
          <li>• This action cannot be undone from the student dashboard.</li>
        </ul>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending} className="min-h-[44px]">Keep my account</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={handleConfirm}
            className="min-h-[44px] bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500 disabled:opacity-60"
          >
            {isPending ? (
              <span className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Deleting…
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Trash2 className="size-4" aria-hidden />
                Yes, delete my account
              </span>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DeleteAccountSection({ userId }: AccountActionsProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-red-700">Danger zone</p>
          <p className="text-sm text-[#8b6b5c]">
            Deleting your account will cancel future bookings and remove your profile data.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-red-700 disabled:opacity-60"
        >
          <Trash2 className="size-4" aria-hidden />
          Delete account
        </button>
      </div>

      <DeleteAccountDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function AccountActions({ userId }: AccountActionsProps) {
  return (
    <div className="space-y-6">
      <SectionCard
        title="Data & Privacy"
        description="Download a copy of your data or delete your account."
      >
        <div className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-[#4e2b22]">Export my data</p>
              <p className="text-sm text-[#8b6b5c]">Download your profile, bookings, credits and purchases as JSON.</p>
            </div>
            <ExportDataButton userId={userId} />
          </div>

          <div className="border-t border-[#ede8e5]" />

          <DeleteAccountSection userId={userId} />
        </div>
      </SectionCard>
    </div>
  );
}
