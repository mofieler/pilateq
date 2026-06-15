'use client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Plus, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  listStudiosAction,
  createStudioAction,
  updateStudioStatusAction,
  type StudioListItem,
} from '@/modules/superadmin/actions/studio.actions';
import type { StudioStatus } from '@/modules/superadmin/actions/studio.actions';

export default function StudiosPage() {
  const [items, setItems] = useState<StudioListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', slug: '', ownerEmail: '', ownerPassword: '' });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filter, setFilter] = useState<StudioStatus | 'all'>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await listStudiosAction(filter === 'all' ? undefined : filter);
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
    setCreating(true);
    const result = await createStudioAction({
      name: form.name,
      slug: form.slug,
      ownerEmail: form.ownerEmail,
      ownerPassword: form.ownerPassword,
    });
    setCreating(false);
    if (!result.success) {
      setError(result.error ?? 'Failed to create studio.');
      return;
    }
    setForm({ name: '', slug: '', ownerEmail: '', ownerPassword: '' });
    setSuccess(`Studio "${form.name}" created. Owner must verify their email before logging in.`);
    await load();
  }

  async function handleStatus(id: string, status: 'onboarding' | 'active' | 'suspended') {
    setUpdatingId(id);
    setError('');
    setSuccess('');
    const result = await updateStudioStatusAction(id, status);
    setUpdatingId(null);
    if (!result.success) {
      setError(result.error ?? `Failed to update studio status to ${status}.`);
      return;
    }
    setSuccess(`Studio status updated to ${status}.`);
    await load();
  }

  const actionDisabled = updatingId !== null || creating;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#4e2b22]">Studios</h1>
        <div className="flex gap-2">
          {(['all', 'onboarding', 'active', 'suspended'] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? 'boutique' : 'outline'}
              size="sm"
              onClick={() => setFilter(f)}
              className="capitalize"
              disabled={actionDisabled}
            >
              {f}
            </Button>
          ))}
        </div>
      </div>

      <Card className="border-[#ede8e5] bg-white/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#4e2b22]">
            <Plus className="size-5" /> Create studio
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-[#4e2b22]">Studio name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="My Pilates Studio"
                className="bg-[#faf9f7]/80 border-[#ede8e5]"
                disabled={creating}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug" className="text-[#4e2b22]">Slug / subdomain</Label>
              <Input
                id="slug"
                value={form.slug}
                onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value.toLowerCase() }))}
                placeholder="my-studio"
                className="bg-[#faf9f7]/80 border-[#ede8e5]"
                disabled={creating}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ownerEmail" className="text-[#4e2b22]">Owner email</Label>
              <Input
                id="ownerEmail"
                type="email"
                value={form.ownerEmail}
                onChange={(e) => setForm((p) => ({ ...p, ownerEmail: e.target.value }))}
                placeholder="owner@example.com"
                className="bg-[#faf9f7]/80 border-[#ede8e5]"
                disabled={creating}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ownerPassword" className="text-[#4e2b22]">Owner password</Label>
              <div className="flex gap-2">
                <Input
                  id="ownerPassword"
                  type="password"
                  value={form.ownerPassword}
                  onChange={(e) => setForm((p) => ({ ...p, ownerPassword: e.target.value }))}
                  placeholder="Min. 8 chars, letter + number"
                  className="bg-[#faf9f7]/80 border-[#ede8e5]"
                  disabled={creating}
                />
                <Button type="submit" variant="boutique" disabled={creating}>
                  {creating ? <Loader2 className="size-4 animate-spin" aria-label="Loading" /> : 'Create'}
                </Button>
              </div>
            </div>
          </form>
          {error && (
            <p role="alert" className="mt-4 rounded-xl p-3 text-sm border bg-[#c45c4a]/10 text-[#c45c4a] border-[#c45c4a]/20">
              {error}
            </p>
          )}
          {success && (
            <p role="status" className="mt-4 rounded-xl p-3 text-sm border bg-[#f0faf0] text-[#2d6a2d] border-[#b2dfb2]">
              {success}
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="border-[#ede8e5] bg-white/80">
        <CardHeader>
          <CardTitle className="text-[#4e2b22]">All studios</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-6 animate-spin text-[#4e2b22]" aria-label="Loading" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-center text-sm text-[#6b3d32] py-8">No studios found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#ede8e5] text-left text-[#6b3d32]">
                    <th className="pb-2 font-medium">Name</th>
                    <th className="pb-2 font-medium">Slug</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Owner</th>
                    <th className="pb-2 font-medium">Created</th>
                    <th className="pb-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-[#ede8e5] last:border-0">
                      <td className="py-3 font-medium text-[#4e2b22]">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="size-3.5 text-[#8b6b5c]" />
                          {item.name}
                        </div>
                      </td>
                      <td className="py-3 text-[#6b3d32]">{item.slug}</td>
                      <td className="py-3">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="py-3 text-[#6b3d32]">{item.ownerEmail ?? '—'}</td>
                      <td className="py-3 text-[#6b3d32]">{new Date(item.createdAt).toLocaleDateString()}</td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-2">
                          {item.status !== 'active' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStatus(item.id, 'active')}
                              disabled={actionDisabled}
                            >
                              {updatingId === item.id ? <Loader2 className="size-4 animate-spin" aria-label="Loading" /> : 'Activate'}
                            </Button>
                          )}
                          {item.status !== 'suspended' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStatus(item.id, 'suspended')}
                              disabled={actionDisabled}
                            >
                              {updatingId === item.id ? <Loader2 className="size-4 animate-spin" aria-label="Loading" /> : 'Suspend'}
                            </Button>
                          )}
                          {item.status !== 'onboarding' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStatus(item.id, 'onboarding')}
                              disabled={actionDisabled}
                            >
                              {updatingId === item.id ? <Loader2 className="size-4 animate-spin" aria-label="Loading" /> : 'Reset to onboarding'}
                            </Button>
                          )}
                        </div>
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

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    onboarding: 'bg-[#fff8f0] text-[#8b6b5c] border-[#f5cba7]',
    active: 'bg-[#f0faf0] text-[#2d6a2d] border-[#b2dfb2]',
    suspended: 'bg-[#f5f5f5] text-[#6b3d32] border-[#ede8e5]',
  };
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${styles[status] ?? styles.onboarding}`}>
      {status}
    </span>
  );
}
