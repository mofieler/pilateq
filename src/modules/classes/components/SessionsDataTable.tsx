'use client';

import { useState, useTransition, useEffect } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table';
import { format, isBefore, startOfDay } from 'date-fns';
import { MoreHorizontalIcon, Loader2Icon, ChevronDownIcon, ChevronRightIcon } from 'lucide-react';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
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
import { buttonVariants } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/StatusBadge';
import {
  cancelClassSessionAction,
  deleteClassSessionAction,
  updateClassSessionAction,
  getInstructorsAction,
} from '@/modules/classes/actions/class.actions';

// ─── Row type ─────────────────────────────────────────────────────────────────

export type SessionRow = {
  id: string;
  startsAt: Date;
  templateName: string;
  instructorName: string;
  instructorId: string | null;
  bookedCount: number;
  maxCapacity: number;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
};

// ─── Session Edit Dialog ──────────────────────────────────────────────────────

function SessionEditDialog({
  row,
  open,
  onOpenChange,
}: {
  row: SessionRow;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [instructors, setInstructors] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedInstructor, setSelectedInstructor] = useState<string | null>(row.instructorId);
  const [maxCapacity, setMaxCapacity] = useState<string>(String(row.maxCapacity));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Load instructors on mount
  useEffect(() => {
    if (open) {
      startTransition(async () => {
        const result = await getInstructorsAction();
        if (result.success) {
          setInstructors(result.data);
        }
      });
    }
  }, [open]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const capacity = parseInt(maxCapacity, 10);
    if (isNaN(capacity) || capacity < 1) {
      setError('Capacity must be a positive number.');
      return;
    }

    if (capacity < row.bookedCount) {
      setError(`Cannot reduce capacity below ${row.bookedCount} booked students.`);
      return;
    }

    startTransition(async () => {
      const result = await updateClassSessionAction({
        id: row.id,
        instructorId: selectedInstructor || null,
        maxCapacity: capacity,
      });

      if (result.success) {
        onOpenChange(false);
        toast.success('Session updated.');
      } else {
        setError(result.error ?? 'Failed to update session.');
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>Edit session</DialogTitle>
          <DialogDescription>
            Update the instructor or capacity. Credits cannot be changed once students are booked — cancel and create a new session instead.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sess-date" className="text-[#6b3d32] font-medium">Date & Time</Label>
            <div className="h-9 flex items-center rounded-md border border-input bg-[#faf9f7] px-3 text-sm text-[#6b3d32]">
              {format(row.startsAt, 'dd MMM yyyy, HH:mm')}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sess-instr" className="text-[#6b3d32] font-medium">Instructor</Label>
            <select
              id="sess-instr"
              value={selectedInstructor || ''}
              onChange={(e) => setSelectedInstructor(e.target.value || null)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">None</option>
              {instructors.map((i) => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sess-cap" className="text-[#6b3d32] font-medium">Max capacity</Label>
            <div className="text-xs text-[#8b6b5c] mb-1">Currently booked: {row.bookedCount} / {row.maxCapacity}</div>
            <input
              id="sess-cap"
              type="number"
              min={row.bookedCount}
              value={maxCapacity}
              onChange={(e) => setMaxCapacity(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {error && <p className="rounded-lg bg-[#c45c4a]/10 px-3 py-2 text-xs font-medium text-[#c45c4a]">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} className="bg-[#4e2b22] text-[#faf9f7] hover:bg-[#6b3d32]">
              {isPending
                ? <span className="flex items-center gap-2"><Loader2Icon className="size-4 animate-spin" />Saving…</span>
                : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_VARIANTS: Record<SessionRow['status'], import('@/components/shared/StatusBadge').StatusBadgeVariant> = {
  scheduled: 'info',
  in_progress: 'warning',
  completed: 'success',
  cancelled: 'danger',
};

const STATUS_LABELS: Record<SessionRow['status'], string> = {
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

function SessionStatusBadge({ status }: { status: SessionRow['status'] }) {
  return <StatusBadge variant={STATUS_VARIANTS[status]}>{STATUS_LABELS[status]}</StatusBadge>;
}

// ─── Actions cell ─────────────────────────────────────────────────────────────

type DialogMode = 'cancel' | 'delete' | 'edit' | null;

function SessionActionsCell({ row }: { row: SessionRow }) {
  const [dialog, setDialog]   = useState<DialogMode>(null);
  const [error, setError]     = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canEdit = row.status === 'scheduled';
  const canCancel = row.status === 'scheduled' || row.status === 'in_progress';
  const canDelete = row.status === 'cancelled' || row.status === 'scheduled';

  if (!canEdit && !canCancel && !canDelete) return null;

  function openDialog(mode: DialogMode) {
    setError(null);
    setDialog(mode);
  }

  function handleCancel() {
    setError(null);
    startTransition(async () => {
      const result = await cancelClassSessionAction({
        sessionId: row.id,
        reason: 'Cancelled by administrator',
      });
      if (result.success) {
        setDialog(null);
      } else {
        setError(result.error ?? 'Something went wrong.');
      }
    });
  }

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteClassSessionAction({ id: row.id });
      if (result.success) {
        setDialog(null);
      } else {
        setError(result.error ?? 'Something went wrong.');
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={buttonVariants({ variant: 'ghost', size: 'icon' })}
          aria-label="Open session actions"
        >
          <MoreHorizontalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canEdit && (
            <DropdownMenuItem onClick={() => openDialog('edit')}>
              Edit Session
            </DropdownMenuItem>
          )}
          {canCancel && (
            <DropdownMenuItem variant="destructive" onClick={() => openDialog('cancel')}>
              Cancel Session
            </DropdownMenuItem>
          )}
          {canDelete && (
            <DropdownMenuItem variant="destructive" onClick={() => openDialog('delete')}>
              Delete Session
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Cancel confirmation */}
      <AlertDialog open={dialog === 'cancel'} onOpenChange={(v) => { if (!isPending && !v) setDialog(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this session?</AlertDialogTitle>
            <AlertDialogDescription>
              All booked students will receive a full credit refund automatically. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && <p className="rounded-md bg-[#c45c4a]/10 px-3 py-2 text-sm text-[#c45c4a]">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Keep session</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleCancel} disabled={isPending}>
              {isPending ? 'Cancelling…' : 'Yes, cancel session'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation */}
      <AlertDialog open={dialog === 'delete'} onOpenChange={(v) => { if (!isPending && !v) setDialog(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this session?</AlertDialogTitle>
            <AlertDialogDescription>
              {row.bookedCount > 0
                ? `This session has ${row.bookedCount} booked student${row.bookedCount !== 1 ? 's' : ''}. They will be automatically cancelled and receive a full credit refund (including session credits). This cannot be undone.`
                : 'The session record will be permanently removed. This cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && <p className="rounded-md bg-[#c45c4a]/10 px-3 py-2 text-sm text-[#c45c4a]">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Keep session</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete} disabled={isPending}>
              {isPending
                ? (row.bookedCount > 0 ? 'Cancelling & deleting…' : 'Deleting…')
                : (row.bookedCount > 0 ? `Refund ${row.bookedCount} student${row.bookedCount !== 1 ? 's' : ''} & delete` : 'Delete session')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit dialog */}
      {dialog === 'edit' && (
        <SessionEditDialog row={row} open onOpenChange={(v) => { if (!v && !isPending) setDialog(null); }} />
      )}
    </>
  );
}

// ─── Column definitions ───────────────────────────────────────────────────────

const columns: ColumnDef<SessionRow>[] = [
  {
    accessorKey: 'startsAt',
    header: 'Date & Time',
    cell: ({ row }) => (
      <span className="whitespace-nowrap tabular-nums text-[#4e2b22]">
        {format(row.original.startsAt, 'dd MMM yyyy, HH:mm')}
      </span>
    ),
  },
  {
    accessorKey: 'templateName',
    header: 'Class',
    cell: ({ row }) => (
      <span className="font-medium text-[#4e2b22]">{row.original.templateName}</span>
    ),
  },
  {
    accessorKey: 'instructorName',
    header: 'Instructor',
    cell: ({ row }) => (
      <span className="text-[#6b3d32]">{row.original.instructorName}</span>
    ),
  },
  {
    id: 'capacity',
    header: 'Booked / Capacity',
    cell: ({ row }) => {
      const { bookedCount, maxCapacity } = row.original;
      const full = maxCapacity > 0 && bookedCount >= maxCapacity;
      return (
        <span className={`tabular-nums ${full ? 'font-semibold text-[#c45c4a]' : 'text-[#6b3d32]'}`}>
          {bookedCount} / {maxCapacity}
        </span>
      );
    },
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <SessionStatusBadge status={row.original.status} />,
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => <SessionActionsCell row={row.original} />,
  },
];

// ─────────────────────────────────────────────────────────────────────────────

interface SessionsDataTableProps {
  data: SessionRow[];
}

function SessionTable({ data, emptyText }: { data: SessionRow[]; emptyText: string }) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-[#ede8e5] bg-[#faf9f7]/80">
        <div className="h-24 flex items-center justify-center text-sm text-[#8b6b5c]">
          {emptyText}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#ede8e5] bg-[#faf9f7]/80">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="border-[#ede8e5] hover:bg-transparent">
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>

        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id} className="border-[#ede8e5]">
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function SessionsDataTable({ data }: SessionsDataTableProps) {
  const [showPast, setShowPast] = useState(false);

  const today = startOfDay(new Date());
  const upcoming = data.filter((s) => !isBefore(s.startsAt, today));
  const past = data.filter((s) => isBefore(s.startsAt, today));

  return (
    <div className="space-y-6">
      {/* Ongoing & Upcoming */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <h3 className="text-sm font-semibold text-[#4e2b22]">Ongoing &amp; Upcoming Classes</h3>
          <StatusBadge variant="info">{upcoming.length}</StatusBadge>
        </div>
        <SessionTable
          data={upcoming}
          emptyText="No upcoming sessions scheduled."
        />
      </section>

      {/* Past Classes — collapsed by default */}
      {past.length > 0 && (
        <section>
          <button
            type="button"
            onClick={() => setShowPast((v) => !v)}
            aria-expanded={showPast}
            aria-controls="past-classes-section"
            className="mb-3 flex w-full items-center justify-between rounded-lg border border-[#ede8e5] bg-[#faf9f7]/80 px-4 py-2.5 text-left transition-colors hover:bg-[#ede8e5]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4e2b22] focus-visible:ring-offset-2"
          >
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-[#6b3d32]">Past Classes</h3>
              <StatusBadge variant="info">{past.length}</StatusBadge>
            </div>
            {showPast ? (
              <ChevronDownIcon className="size-4 text-slate-500" />
            ) : (
              <ChevronRightIcon className="size-4 text-slate-500" />
            )}
          </button>

          {showPast && (
            <div id="past-classes-section">
              <SessionTable
                data={past}
                emptyText="No past sessions."
              />
            </div>
          )}
        </section>
      )}
    </div>
  );
}
