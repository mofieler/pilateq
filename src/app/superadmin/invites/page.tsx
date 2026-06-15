'use client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Plus, Mail, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  createStudioInviteAction,
  listInvitesAction,
  revokeInviteAction,
  type InviteListItem,
} from '@/modules/superadmin/actions/invite.actions';

export default function InvitesPage() {
  const [items, setItems] = useState<InviteListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ email: '', studioSlug: '', notes: '' });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'used' | 'expired'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    const result = await listInvitesAction(filter === 'all' ? undefined : filter);
    if (result.success) {
      setItems(result.items);
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setInviteLink('');
    setCreating(true);
    const result = await createStudioInviteAction({
      email: form.email,
      studioSlug: form.studioSlug,
      notes: form.notes,
    });
    setCreating(false);
    if (!result.success) {
      setError(result.error ?? 'Failed to create invite.');
      return;
    }
    setForm({ email: '', studioSlug: '', notes: '' });
    setSuccess('Invite created.');
    setInviteLink(result.link ?? '');
    await load();
  }

  async function handleRevoke(id: string) {
    if (!confirm('Revoke this invite?')) return;
    setError('');
    setSuccess('');
    const result = await revokeInviteAction(id);
    if (!result.success) {
      setError(result.error ?? 'Failed to revoke invite.');
      return;
    }
    setSuccess('Invite revoked.');
    await load();
  }

  async function copyLink() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy to clipboard.');
    }
  }

  function dismissBanner() {
    setError('');
    setSuccess('');
    setInviteLink('');
  }

  const hasBanner = error || success || inviteLink;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#4e2b22]">Studio invites</h1>
        <div className="flex gap-2">
          {(['all', 'pending', 'used', 'expired'] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? 'boutique' : 'outline'}
              size="sm"
              onClick={() => setFilter(f)}
              className="capitalize"
              disabled={creating}
            >
              {f}
            </Button>
          ))}
        </div>
      </div>

      <Card className="border-[#ede8e5] bg-white/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#4e2b22]">
            <Plus className="size-5" /> Create invite
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[#4e2b22]">Email (optional)</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="owner@example.com"
                className="bg-[#faf9f7]/80 border-[#ede8e5]"
                disabled={creating}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug" className="text-[#4e2b22]">Reserved slug (optional)</Label>
              <Input
                id="slug"
                value={form.studioSlug}
                onChange={(e) => setForm((p) => ({ ...p, studioSlug: e.target.value }))}
                placeholder="my-studio"
                className="bg-[#faf9f7]/80 border-[#ede8e5]"
                disabled={creating}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="notes" className="text-[#4e2b22]">Notes (optional)</Label>
              <div className="flex gap-2">
                <Input
                  id="notes"
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Why this invite was created"
                  className="bg-[#faf9f7]/80 border-[#ede8e5]"
                  disabled={creating}
                />
                <Button type="submit" variant="boutique" disabled={creating}>
                  {creating ? <Loader2 className="size-4 animate-spin" aria-label="Loading" /> : 'Create'}
                </Button>
              </div>
            </div>
          </form>
          {hasBanner && (
            <div
              role={error ? 'alert' : 'status'}
              className={`mt-4 rounded-xl p-3 text-sm break-all border flex items-start justify-between gap-3 ${
                error
                  ? 'bg-[#c45c4a]/10 text-[#c45c4a] border-[#c45c4a]/20'
                  : 'bg-[#c4a88a]/10 text-[#4e2b22] border-[#c4a88a]/20'
              }`}
            >
              <div className="flex flex-col gap-1">
                {error ? <span>{error}</span> : <span>{success}</span>}
                {inviteLink && <span className="font-medium">{inviteLink}</span>}
              </div>
              <div className="flex shrink-0 items-start gap-2">
                {inviteLink && (
                  <button
                    type="button"
                    onClick={copyLink}
                    className="text-xs font-medium text-[#6b3d32] hover:text-[#4e2b22] underline"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={dismissBanner}
                  aria-label="Dismiss"
                  className="text-[#6b3d32] hover:text-[#4e2b22]"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-[#ede8e5] bg-white/80">
        <CardHeader>
          <CardTitle className="text-[#4e2b22]">Invites</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-6 animate-spin text-[#4e2b22]" aria-label="Loading" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-center text-sm text-[#6b3d32] py-8">No invites found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#ede8e5] text-left text-[#6b3d32]">
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Email</th>
                    <th className="pb-2 font-medium">Slug</th>
                    <th className="pb-2 font-medium">Notes</th>
                    <th className="pb-2 font-medium">Created</th>
                    <th className="pb-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-[#ede8e5] last:border-0">
                      <td className="py-3">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-1.5">
                          <Mail className="size-3.5 text-[#8b6b5c]" />
                          {item.email ?? <span className="text-[#8b6b5c]">—</span>}
                        </div>
                      </td>
                      <td className="py-3 text-[#6b3d32]">{item.studioSlug ?? '—'}</td>
                      <td className="py-3 text-[#6b3d32] max-w-xs truncate">{item.notes ?? '—'}</td>
                      <td className="py-3 text-[#6b3d32]">{new Date(item.createdAt).toLocaleDateString()}</td>
                      <td className="py-3">
                        {item.status === 'pending' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Revoke"
                            onClick={() => handleRevoke(item.id)}
                          >
                            <Trash2 className="size-4 text-[#c45c4a]" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: InviteListItem['status'] }) {
  const styles = {
    pending: 'bg-[#fff8f0] text-[#8b6b5c] border-[#f5cba7]',
    used: 'bg-[#f0faf0] text-[#2d6a2d] border-[#b2dfb2]',
    expired: 'bg-[#f5f5f5] text-[#6b3d32] border-[#ede8e5]',
  };
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${styles[status]}`}>
      {status}
    </span>
  );
}
