'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Search, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { listUsersAction, type UserListItem } from '@/modules/superadmin/actions/users.actions';

export default function UsersPage() {
  const [items, setItems] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async (q: string) => {
    setLoading(true);
    setError('');
    const result = await listUsersAction(q || undefined);
    if (result.success) {
      setItems(result.items);
    } else {
      setError('Failed to load users.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load(searchQuery);
  }, [load, searchQuery]);

  // Reload with no search when the input is cleared manually.
  useEffect(() => {
    if (query === '' && searchQuery !== '') {
      setSearchQuery('');
    }
  }, [query, searchQuery]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearchQuery(query);
  }

  function handleClear() {
    setQuery('');
    setSearchQuery('');
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#4e2b22]">Users</h1>
      </div>

      <Card className="border-[#ede8e5] bg-white/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#4e2b22]">
            <Users className="size-5" /> Search users
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by email or name"
                className="bg-[#faf9f7]/80 border-[#ede8e5] pr-8"
              />
              {query && (
                <button
                  type="button"
                  onClick={handleClear}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#8b6b5c] hover:text-[#4e2b22]"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
            <Button type="submit" variant="boutique" disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" aria-label="Loading" /> : <Search className="size-4" />}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-[#ede8e5] bg-white/80">
        <CardHeader>
          <CardTitle className="text-[#4e2b22]">Results</CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <p role="alert" className="mb-4 rounded-xl p-3 text-sm border bg-[#c45c4a]/10 text-[#c45c4a] border-[#c45c4a]/20">
              {error}
            </p>
          )}
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-6 animate-spin text-[#4e2b22]" aria-label="Loading" />
            </div>
          ) : items.length === 0 ? (
            <p role="status" className="text-center text-sm text-[#6b3d32] py-8">No users found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#ede8e5] text-left text-[#6b3d32]">
                    <th className="pb-2 font-medium">Name</th>
                    <th className="pb-2 font-medium">Email</th>
                    <th className="pb-2 font-medium">Role</th>
                    <th className="pb-2 font-medium">Studio</th>
                    <th className="pb-2 font-medium">Verified</th>
                    <th className="pb-2 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-[#ede8e5] last:border-0">
                      <td className="py-3 font-medium text-[#4e2b22]">{item.name}</td>
                      <td className="py-3 text-[#6b3d32]">{item.email}</td>
                      <td className="py-3">
                        <RoleBadge role={item.role} />
                      </td>
                      <td className="py-3 text-[#6b3d32]">
                        {item.studioName ? `${item.studioName} (${item.studioSlug})` : '—'}
                      </td>
                      <td className="py-3 text-[#6b3d32]">
                        {item.emailVerified ? '✓' : '—'}
                      </td>
                      <td className="py-3 text-[#6b3d32]">{new Date(item.createdAt).toLocaleDateString()}</td>
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

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    superadmin: 'bg-[#4e2b22] text-white border-[#4e2b22]',
    admin: 'bg-[#fff8f0] text-[#8b6b5c] border-[#f5cba7]',
    instructor: 'bg-[#f0f4ff] text-[#4a5a8a] border-[#c7d2fe]',
    student: 'bg-[#f0faf0] text-[#2d6a2d] border-[#b2dfb2]',
  };
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${styles[role] ?? styles.student}`}>
      {role}
    </span>
  );
}
