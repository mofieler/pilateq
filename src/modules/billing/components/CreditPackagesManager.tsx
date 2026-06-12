'use client';

import { useState, useTransition, useEffect } from 'react';
import { PlusIcon, Loader2Icon, PencilIcon, Trash2Icon, ChevronUpIcon, ChevronDownIcon } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  createCreditPackageAction,
  updateCreditPackageAction,
  deleteCreditPackageAction,
  reorderCreditPackagesAction,
} from '@/modules/billing/actions/creditPackage.actions';
import type { CreditPackage } from '@/db/schema';
import type { CreditType } from '@/lib/config/class-types';
import {
  getCreditPackCategoryConfig,
  type CreditPackCategory,
} from '@/lib/config/financial-config';
import { CheckCircleIcon } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  packages: CreditPackage[];
};

// ─── Derivation helpers ──────────────────────────────────────────────────────

function deriveCreditType(category: CreditPackCategory): CreditType {
  return category === 'session' ? 'session' : 'pass';
}

function categoryLabel(category: CreditPackCategory): string {
  return getCreditPackCategoryConfig(category)?.label ?? category;
}

// ─── Form state ──────────────────────────────────────────────────────────────

type FormState = {
  name: string;
  description: string;
  creditsAmount: string;
  category: CreditPackCategory;
  priceEur: string;
  validityWeeks: string;
  isActive: boolean;
  stripePriceId: string;
};

const EMPTY_FORM: FormState = {
  name: '', description: '', creditsAmount: '', category: 'credit',
  priceEur: '', validityWeeks: '52', isActive: true, stripePriceId: '',
};

function fromPackage(p: CreditPackage): FormState {
  return {
    name:          p.name,
    description:   p.description ?? '',
    creditsAmount: String(p.creditsAmount),
    category:      (p.category as CreditPackCategory) ?? 'credit',
    priceEur:      (p.priceCents / 100).toFixed(2),
    validityWeeks: String(Math.ceil((p.validityDays ?? 365) / 7)),
    isActive:      p.isActive,
    stripePriceId: p.stripePriceId ?? '',
  };
}

// (Removed 2026-05-18) CreditTypeCards — the unified wallet system means a
// credit pack always grants 'pass' credits and a session pack always grants
// 'session' credits. The category toggle alone derives the credit type.

// ─── Form dialog ─────────────────────────────────────────────────────────────

function PackageFormDialog({
  open, onOpenChange, editingPackage,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editingPackage: CreditPackage | null;
}) {
  const isEdit = editingPackage !== null;
  const [form, setForm] = useState<FormState>(
    isEdit ? fromPackage(editingPackage!) : EMPTY_FORM,
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Reset form whenever editingPackage changes — fixes stale data when switching
  // between edit targets while the dialog component stays mounted.
  useEffect(() => {
    setForm(isEdit ? fromPackage(editingPackage!) : EMPTY_FORM);
    setError(null);
  }, [editingPackage, isEdit]);

  const handleOpen = (v: boolean) => {
    if (!isPending) {
      if (!v) setError(null);
      onOpenChange(v);
    }
  };

  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const setText =
    (k: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const isSession = form.category === 'session';

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const creditsAmount = parseInt(form.creditsAmount, 10);
    const priceCents    = Math.round(parseFloat(form.priceEur) * 100);
    const validityWeeks = parseInt(form.validityWeeks, 10);
    const validityDays  = validityWeeks * 7;

    if (isNaN(creditsAmount) || creditsAmount < 1) { setError('Credits must be a positive whole number.'); return; }
    if (isNaN(priceCents)    || priceCents < 0)    { setError('Price must be 0 or more.'); return; }
    if (isNaN(validityWeeks) || validityWeeks < 1) { setError('Validity weeks must be positive.'); return; }

    const derivedCreditType = deriveCreditType(form.category);

    startTransition(async () => {
      const payload = {
        name:          form.name,
        description:   form.description || null,
        creditsAmount,
        creditType:    derivedCreditType,
        category:      form.category,
        priceCents,
        currency:      'eur',
        validityDays,
        validityWeeks,
        sortOrder:     0,
        isActive:      form.isActive,
        stripePriceId: form.stripePriceId || null,
      };

      const result = isEdit
        ? await updateCreditPackageAction({ id: editingPackage!.id, ...payload })
        : await createCreditPackageAction(payload);

      if (result.success) {
        onOpenChange(false);
        toast.success(isEdit ? 'Package updated.' : 'Package created.');
      } else {
        setError(result.error ?? 'Something went wrong.');
      }
    });
  }

  const dialogTitle = isEdit
    ? `Edit ${isSession ? 'session' : 'credit'} package`
    : `New ${isSession ? 'session' : 'credit'} package`;

  const dialogDescription = isSession
    ? 'Session packages grant private 1:1 sessions. Pick the equipment students will use.'
    : 'Credit packages grant group-class credits. Pick the class type students can attend.';

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="sm:max-w-lg" showCloseButton>
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Category toggle */}
          <div className="space-y-1.5">
            <Label className="text-[#6b3d32] font-medium">Package type *</Label>
            <div className="inline-flex rounded-lg border border-[#ede8e5] bg-[#faf9f7] p-1 w-full">
              {(['credit', 'session'] as CreditPackCategory[]).map((cat) => {
                const cfg = getCreditPackCategoryConfig(cat);
                const active = form.category === cat;
                return (
                  <button
                    type="button"
                    key={cat}
                    onClick={() => setField('category', cat)}
                    disabled={isPending}
                    className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      active
                        ? 'bg-white text-[#4e2b22] shadow-sm'
                        : 'text-[#8b6b5c] hover:text-[#4e2b22]'
                    }`}
                  >
                    {cfg?.label ?? cat}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-[#8b6b5c]">
              {getCreditPackCategoryConfig(form.category)?.description}
            </p>
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="pkg-name" className="text-[#6b3d32] font-medium">Name *</Label>
            <Input
              id="pkg-name"
              value={form.name}
              onChange={setText('name')}
              required
              placeholder={isSession ? 'e.g. 5 Private Reformer Sessions' : 'e.g. 10 Mat Classes'}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="pkg-desc" className="text-[#6b3d32] font-medium">
              Description <span className="text-[#8b6b5c]">(optional)</span>
            </Label>
            <textarea
              id="pkg-desc"
              value={form.description}
              onChange={setText('description')}
              rows={2}
              placeholder="Shown to students on the pricing page"
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          </div>

          {/* Credits */}
          <div className="space-y-1.5">
            <Label htmlFor="pkg-credits" className="text-[#6b3d32] font-medium">
              {isSession ? 'Sessions *' : 'Credits *'}
            </Label>
            <Input
              id="pkg-credits"
              type="number"
              min={1}
              value={form.creditsAmount}
              onChange={setText('creditsAmount')}
              required
            />
          </div>

          {/* Credit type is fully derived from the category toggle now —
              'credit' → 'pass' credits, 'session' → 'session' credits. */}

          {/* Price + validity */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pkg-price" className="text-[#6b3d32] font-medium">Price (EUR) *</Label>
              <Input
                id="pkg-price"
                type="number"
                min={0}
                step="0.01"
                value={form.priceEur}
                onChange={setText('priceEur')}
                required
                placeholder="89.00"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pkg-validity-weeks" className="text-[#6b3d32] font-medium">
                Validity (weeks) *
              </Label>
              <Input
                id="pkg-validity-weeks"
                type="number"
                min={1}
                value={form.validityWeeks}
                onChange={setText('validityWeeks')}
                required
              />
              <p className="text-xs text-[#8b6b5c] mt-1">
                Credits expire after {form.validityWeeks || 0} week(s) ({(parseInt(form.validityWeeks) || 0) * 7} days)
              </p>
            </div>
          </div>

          {/* Stripe */}
          <div className="space-y-1.5">
            <Label htmlFor="pkg-stripe" className="text-[#6b3d32] font-medium">
              Stripe Price ID <span className="text-[#8b6b5c]">(Phase 2)</span>
            </Label>
            <Input
              id="pkg-stripe"
              value={form.stripePriceId}
              onChange={setText('stripePriceId')}
              placeholder="price_..."
            />
          </div>

          {/* Active toggle */}
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setField('isActive', e.target.checked)}
              className="size-4 rounded border-slate-300"
            />
            <span className="text-sm text-[#4e2b22]">Active (visible to students)</span>
          </label>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpen(false)} disabled={isPending}>Cancel</Button>
            <Button type="submit" disabled={isPending} className="bg-emerald-600 text-white hover:bg-emerald-700">
              {isPending
                ? <span className="flex items-center gap-2"><Loader2Icon className="size-4 animate-spin" />Saving…</span>
                : isEdit ? 'Save changes' : 'Create package'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────

export function CreditPackagesManager({ packages }: Props) {
  const [createOpen, setCreateOpen]       = useState(false);
  const [editTarget, setEditTarget]       = useState<CreditPackage | null>(null);
  const [deleteTarget, setDeleteTarget]   = useState<CreditPackage | null>(null);
  const [deleteError, setDeleteError]     = useState<string | null>(null);
  const [toggling, startToggleTransition] = useTransition();
  const [deleting, startDelete]           = useTransition();
  const [reordering, startReorder]        = useTransition();

  // Local order for optimistic UI — synced when server prop changes
  const [orderedPackages, setOrderedPackages] = useState(packages);
  useEffect(() => { setOrderedPackages(packages); }, [packages]);

  function toggleActive(pkg: CreditPackage) {
    startToggleTransition(async () => {
      const result = await updateCreditPackageAction({ id: pkg.id, isActive: !pkg.isActive });
      if (result.success) {
        toast.success(result.data.isActive ? 'Package activated.' : 'Package deactivated.');
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    startDelete(async () => {
      const result = await deleteCreditPackageAction({ id: deleteTarget.id });
      if (result.success) {
        setDeleteTarget(null);
        toast.success('Package deleted.');
      } else {
        setDeleteError(result.error);
      }
    });
  }

  function moveItem(index: number, direction: -1 | 1) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= orderedPackages.length) return;

    const next = [...orderedPackages];
    const [moved] = next.splice(index, 1);
    next.splice(newIndex, 0, moved);
    setOrderedPackages(next);

    startReorder(async () => {
      const result = await reorderCreditPackagesAction({
        orderedIds: next.map((p) => p.id),
      });
      if (!result.success) {
        toast.error(result.error ?? 'Failed to save order.');
        setOrderedPackages(packages); // revert on error
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#8b6b5c]">{packages.length} package{packages.length !== 1 ? 's' : ''}</p>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs sm:text-sm font-semibold hover:bg-emerald-700 active:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 transition-all"
        >
          <PlusIcon className="size-4" />
          <span className="hidden sm:inline">New Package</span>
          <span className="sm:hidden">Add</span>
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-xs sm:text-sm min-w-full">
          <thead>
            <tr className="border-b border-slate-100 text-left bg-slate-50">
              {['', 'Package', 'Type', 'Credits', 'Price', 'Validity', 'Status', ''].map((h) => (
                <th key={h} className="px-2 sm:px-4 py-2 sm:py-3 text-xs font-semibold uppercase tracking-wide text-[#6b3d32] whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orderedPackages.length === 0 && (
              <tr><td colSpan={8} className="py-12 text-center text-sm text-[#8b6b5c]">No packages yet. Create your first credit or session package to get started.</td></tr>
            )}
            {orderedPackages.map((pkg, idx) => {
              const cat = (pkg.category ?? 'credit') as CreditPackCategory;
              const cfg = getCreditPackCategoryConfig(cat);
              const isFirst = idx === 0;
              const isLast  = idx === orderedPackages.length - 1;
              return (
                <tr key={pkg.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="px-2 sm:px-4 py-2 sm:py-3">
                    <div className="flex flex-col items-center gap-0.5">
                      <button
                        onClick={() => moveItem(idx, -1)}
                        disabled={isFirst || reordering}
                        className="inline-flex items-center justify-center min-h-[44px] w-[44px] rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-600 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 active:bg-slate-300 transition-all"
                        title="Move up"
                      >
                        <ChevronUpIcon className="size-4" />
                      </button>
                      <button
                        onClick={() => moveItem(idx, 1)}
                        disabled={isLast || reordering}
                        className="inline-flex items-center justify-center min-h-[44px] w-[44px] rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-600 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 active:bg-slate-300 transition-all"
                        title="Move down"
                      >
                        <ChevronDownIcon className="size-4" />
                      </button>
                    </div>
                  </td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3">
                    <p className="font-medium text-slate-900 text-xs sm:text-sm">{pkg.name}</p>
                    {pkg.description && <p className="mt-0.5 text-xs text-slate-400 line-clamp-1 hidden sm:block">{pkg.description}</p>}
                  </td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${cfg?.badgeStyle ?? 'bg-slate-100 text-slate-700'}`}>
                      {categoryLabel(cat)}
                    </span>
                  </td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 tabular-nums text-slate-700 text-xs sm:text-sm">{pkg.creditsAmount}</td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 tabular-nums text-slate-700 text-xs sm:text-sm">
                    €{(pkg.priceCents / 100).toFixed(2)}
                  </td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-slate-500 text-xs sm:text-sm whitespace-nowrap">{pkg.validityDays}d</td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3">
                    <button
                      onClick={() => toggleActive(pkg)}
                      disabled={toggling}
                      className={`inline-flex items-center justify-center min-h-[44px] px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-95 ${
                        pkg.isActive
                          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 focus-visible:ring-emerald-400'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200 focus-visible:ring-slate-400'
                      }`}
                    >
                      {pkg.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3">
                    <div className="flex items-center gap-1 flex-col sm:flex-row">
                      <button
                        onClick={() => setEditTarget(pkg)}
                        className="inline-flex items-center justify-center gap-1 min-h-[44px] px-3 py-2 rounded-lg text-xs sm:text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 active:bg-slate-200 transition-all w-full sm:w-auto"
                      >
                        <PencilIcon className="size-4" />
                        <span className="hidden sm:inline">Edit</span>
                      </button>
                      <button
                        onClick={() => { setDeleteError(null); setDeleteTarget(pkg); }}
                        className="inline-flex items-center justify-center gap-1 min-h-[44px] px-3 py-2 rounded-lg text-xs sm:text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 active:bg-red-100 transition-all w-full sm:w-auto"
                      >
                        <Trash2Icon className="size-4" />
                        <span className="hidden sm:inline">Delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Dialogs */}
      <PackageFormDialog open={createOpen} onOpenChange={setCreateOpen} editingPackage={null} />
      <PackageFormDialog open={editTarget !== null} onOpenChange={(v) => { if (!v) setEditTarget(null); }} editingPackage={editTarget} />

      <AlertDialog open={deleteTarget !== null} onOpenChange={(v) => { if (!v && !deleting) { setDeleteTarget(null); setDeleteError(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{deleteTarget?.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the package. If students have purchased it, the delete will be blocked — deactivate it instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{deleteError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete package'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
