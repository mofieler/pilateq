'use client';

import { useState } from 'react';
import { KeyRound, Loader2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { changeSuperadminPasswordAction } from '@/modules/superadmin/actions/account.actions';

export function ChangePasswordCard() {
  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [show, setShow] = useState({ current: false, new: false, confirm: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  function updateField(name: keyof typeof form, value: string) {
    setForm((p) => ({ ...p, [name]: value }));
    setError('');
    setSuccess('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    const result = await changeSuperadminPasswordAction(form);
    setLoading(false);

    if (!result.success) {
      setError(result.error ?? 'Could not change password.');
      return;
    }

    setSuccess('Password changed successfully.');
    setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
  }

  return (
    <Card className="border-[#ede8e5] bg-white/80">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[#4e2b22]">
          <KeyRound className="size-5" /> Change superadmin password
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <PasswordField
            id="currentPassword"
            label="Current password"
            value={form.currentPassword}
            onChange={(v) => updateField('currentPassword', v)}
            show={show.current}
            onToggle={() => setShow((s) => ({ ...s, current: !s.current }))}
            disabled={loading}
          />
          <PasswordField
            id="newPassword"
            label="New password"
            value={form.newPassword}
            onChange={(v) => updateField('newPassword', v)}
            show={show.new}
            onToggle={() => setShow((s) => ({ ...s, new: !s.new }))}
            disabled={loading}
          />
          <PasswordField
            id="confirmPassword"
            label="Confirm new password"
            value={form.confirmPassword}
            onChange={(v) => updateField('confirmPassword', v)}
            show={show.confirm}
            onToggle={() => setShow((s) => ({ ...s, confirm: !s.confirm }))}
            disabled={loading}
          />

          {error && (
            <p role="alert" className="rounded-xl bg-[#c45c4a]/10 p-3 text-sm text-[#c45c4a] border border-[#c45c4a]/20">
              {error}
            </p>
          )}
          {success && (
            <p role="status" className="rounded-xl bg-[#f0faf0] p-3 text-sm text-[#2d6a2d] border border-[#b2dfb2]">
              {success}
            </p>
          )}

          <Button type="submit" variant="boutique" disabled={loading} className="min-w-[140px]">
            {loading ? <Loader2 className="size-4 animate-spin" aria-label="Loading" /> : 'Update password'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  show,
  onToggle,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  show: boolean;
  onToggle: () => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-[#4e2b22]">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="bg-[#faf9f7]/80 border-[#ede8e5] pr-10"
        />
        <button
          type="button"
          onClick={onToggle}
          disabled={disabled}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8b6b5c] hover:text-[#4e2b22]"
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </div>
  );
}
