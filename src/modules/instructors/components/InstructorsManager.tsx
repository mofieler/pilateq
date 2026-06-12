'use client';

import { useState, useTransition, useEffect } from 'react';
import {
  PlusIcon,
  Loader2Icon,
  PencilIcon,
  Trash2Icon,
  UserIcon,
  MailIcon,
  PhoneIcon,
  ImageIcon,
} from 'lucide-react';
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
import { Switch } from '@/components/ui/switch';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  createInstructorAction,
  updateInstructorAction,
  deleteInstructorAction,
} from '@/modules/instructors/actions/instructor.actions';
import type { InstructorRow } from '@/modules/instructors/actions/instructor.actions';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  instructors: InstructorRow[];
};

type FormState = {
  name: string;
  email: string;
  phone: string;
  bio: string;
  avatarUrl: string;
  isActive: boolean;
  createAccount: boolean;
  password: string;
};

const EMPTY_FORM: FormState = {
  name: '',
  email: '',
  phone: '',
  bio: '',
  avatarUrl: '',
  isActive: true,
  createAccount: false,
  password: '',
};

function fromInstructor(i: InstructorRow): FormState {
  return {
    name: i.name ?? '',
    email: i.email,
    phone: i.phone ?? '',
    bio: i.bio ?? '',
    avatarUrl: i.avatarUrl ?? '',
    isActive: i.isActive,
    createAccount: false,
    password: '',
  };
}

// ─── Form dialog ──────────────────────────────────────────────────────────────

function InstructorFormDialog({
  open,
  onOpenChange,
  editingInstructor,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editingInstructor: InstructorRow | null;
}) {
  const isEdit = editingInstructor !== null;
  const [form, setForm] = useState<FormState>(
    isEdit ? fromInstructor(editingInstructor!) : EMPTY_FORM,
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setForm(isEdit ? fromInstructor(editingInstructor!) : EMPTY_FORM);
    setError(null);
  }, [editingInstructor, isEdit]);

  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const setText =
    (k: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) { setError('Name is required.'); return; }
    if (!form.email.trim()) { setError('Email is required.'); return; }
    if (!isEdit && form.createAccount && form.password.length < 8) {
      setError('Password must be at least 8 characters when creating a login account.');
      return;
    }

    startTransition(async () => {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim() || null,
        bio: form.bio.trim() || null,
        avatarUrl: form.avatarUrl.trim() || null,
        isActive: form.isActive,
        ...(isEdit
          ? { id: editingInstructor!.id }
          : {
              createAccount: form.createAccount,
              password: form.createAccount ? form.password : null,
            }),
      };

      const result = isEdit
        ? await updateInstructorAction(payload as { id: string } & Omit<FormState, 'createAccount' | 'password'>)
        : await createInstructorAction(payload as FormState);

      if (result.success) {
        onOpenChange(false);
        toast.success(isEdit ? 'Instructor updated.' : 'Instructor created.');
      } else {
        setError(result.error ?? 'Something went wrong.');
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isPending) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg" showCloseButton>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Instructor' : 'New Instructor'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update contact details, bio, and active status.'
              : 'Create a teacher record. Optionally create a login account so they can access the instructor portal.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-[#6b3d32] font-medium">Name *</Label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#8b6b5c]" />
                <Input
                  id="name"
                  value={form.name}
                  onChange={setText('name')}
                  placeholder="e.g. Jane Doe"
                  className="pl-9"
                  disabled={isPending}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[#6b3d32] font-medium">Email *</Label>
              <div className="relative">
                <MailIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#8b6b5c]" />
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={setText('email')}
                  placeholder="jane@studio.com"
                  className="pl-9"
                  disabled={isPending || isEdit}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-[#6b3d32] font-medium">Phone</Label>
              <div className="relative">
                <PhoneIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#8b6b5c]" />
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={setText('phone')}
                  placeholder="+1 234 567 890"
                  className="pl-9"
                  disabled={isPending}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="avatarUrl" className="text-[#6b3d32] font-medium">Avatar URL</Label>
              <div className="relative">
                <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#8b6b5c]" />
                <Input
                  id="avatarUrl"
                  value={form.avatarUrl}
                  onChange={setText('avatarUrl')}
                  placeholder="https://..."
                  className="pl-9"
                  disabled={isPending}
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bio" className="text-[#6b3d32] font-medium">Bio</Label>
            <textarea
              id="bio"
              value={form.bio}
              onChange={setText('bio')}
              placeholder="Short bio, certifications, teaching style..."
              rows={3}
              disabled={isPending}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-[#ede8e5] bg-[#faf9f7] p-3">
            <div>
              <p className="text-sm font-medium text-[#4e2b22]">Active</p>
              <p className="text-xs text-[#8b6b5c]">Inactive instructors cannot be assigned to classes.</p>
            </div>
            <Switch
              checked={form.isActive}
              onCheckedChange={(v) => setField('isActive', v)}
              disabled={isPending}
            />
          </div>

          {!isEdit && (
            <>
              <div className="flex items-center justify-between rounded-lg border border-[#ede8e5] bg-[#faf9f7] p-3">
                <div>
                  <p className="text-sm font-medium text-[#4e2b22]">Create login account</p>
                  <p className="text-xs text-[#8b6b5c]">Allow this instructor to sign in to the dashboard.</p>
                </div>
                <Switch
                  checked={form.createAccount}
                  onCheckedChange={(v) => setField('createAccount', v)}
                  disabled={isPending}
                />
              </div>

              {form.createAccount && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                  <Label htmlFor="password" className="text-[#6b3d32] font-medium">Initial password *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={form.password}
                    onChange={setText('password')}
                    placeholder="At least 8 characters"
                    disabled={isPending}
                  />
                </div>
              )}
            </>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-[#4e2b22] text-[#faf9f7] hover:bg-[#6b3d32]"
            >
              {isPending ? (
                <span className="flex items-center gap-2">
                  <Loader2Icon className="size-4 animate-spin" />
                  Saving...
                </span>
              ) : (
                isEdit ? 'Save Changes' : 'Create Instructor'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────

export function InstructorsManager({ instructors }: Props) {
  const [items, setItems] = useState<InstructorRow[]>(instructors);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<InstructorRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InstructorRow | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setItems(instructors);
  }, [instructors]);

  function handleEdit(item: InstructorRow) {
    setEditing(item);
    setDialogOpen(true);
  }

  function handleAdd() {
    setEditing(null);
    setDialogOpen(true);
  }

  function handleDelete(item: InstructorRow) {
    startTransition(async () => {
      const result = await deleteInstructorAction({ id: item.id });
      if (result.success) {
        setItems((prev) => prev.filter((i) => i.id !== item.id));
        setDeleteTarget(null);
        toast.success('Instructor removed.');
      } else {
        toast.error(result.error ?? 'Failed to remove instructor.');
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[#4e2b22]">
          {items.length} {items.length === 1 ? 'instructor' : 'instructors'}
        </h2>
        <Button
          onClick={handleAdd}
          className="bg-[#4e2b22] text-[#faf9f7] hover:bg-[#6b3d32] min-h-[44px]"
        >
          <PlusIcon className="mr-1.5 size-4" />
          Add Instructor
        </Button>
      </div>

      <div className="rounded-2xl border border-[#ede8e5]/80 bg-white shadow-[0_4px_14px_rgba(78,43,34,0.04)] overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-[#ede8e5]/60 hover:bg-transparent">
                <TableHead className="text-[#6b3d32]">Instructor</TableHead>
                <TableHead className="text-[#6b3d32]">Contact</TableHead>
                <TableHead className="text-[#6b3d32]">Bio</TableHead>
                <TableHead className="text-[#6b3d32]">Status</TableHead>
                <TableHead className="text-right text-[#6b3d32]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow className="border-0">
                  <TableCell colSpan={5} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-[#8b6b5c]">
                      <UserIcon className="size-8 opacity-40" />
                      <p className="text-sm font-medium">No instructors yet</p>
                      <p className="text-xs">Add your first instructor to assign them to classes.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.id} className="border-[#ede8e5]/60">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {item.avatarUrl ? (
                          <img
                            src={item.avatarUrl}
                            alt={item.name ?? ''}
                            className="size-10 rounded-full object-cover ring-2 ring-[#ede8e5]"
                          />
                        ) : (
                          <span className="inline-flex size-10 items-center justify-center rounded-full bg-[#ede8e5] text-[#6b3d32] text-sm font-semibold">
                            {(item.name ?? '?').charAt(0).toUpperCase()}
                          </span>
                        )}
                        <span className="font-medium text-[#4e2b22]">{item.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col text-xs text-[#6b3d32]">
                        <span>{item.email}</span>
                        {item.phone && <span className="text-[#8b6b5c]">{item.phone}</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="max-w-xs truncate text-xs text-[#6b3d32]">
                        {item.bio ?? '—'}
                      </p>
                    </TableCell>
                    <TableCell>
                      {item.isActive ? (
                        <span className="inline-flex items-center rounded-full bg-[#6b8e6b]/10 px-2.5 py-1 text-xs font-semibold text-[#4a7c4a]">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-[#ede8e5] px-2.5 py-1 text-xs font-semibold text-[#8b6b5c]">
                          Inactive
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(item)}
                          className="inline-flex size-9 items-center justify-center rounded-xl text-[#6b3d32] hover:bg-[#ede8e5]/60 transition-colors"
                          aria-label="Edit instructor"
                        >
                          <PencilIcon className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(item)}
                          className="inline-flex size-9 items-center justify-center rounded-xl text-[#c45c4a] hover:bg-[#c45c4a]/10 transition-colors"
                          aria-label="Remove instructor"
                        >
                          <Trash2Icon className="size-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <InstructorFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingInstructor={editing}
      />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove instructor?</AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate the instructor and soft-delete their user account.
              Classes and bookings they were assigned to remain in the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
              disabled={isPending}
              className="bg-[#c45c4a] text-white hover:bg-[#b54a3a]"
            >
              {isPending ? (
                <span className="flex items-center gap-2">
                  <Loader2Icon className="size-4 animate-spin" />
                  Removing...
                </span>
              ) : (
                'Remove'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
