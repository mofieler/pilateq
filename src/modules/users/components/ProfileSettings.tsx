'use client';

import { useState, useTransition, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { User, Phone, Lock, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { AvatarUploader } from './AvatarUploader';
import { AccountActions } from './AccountActions';
import { updateProfileAction, changePasswordAction } from '../actions/profile-settings.actions';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProfileSettingsProps {
  userId: string;
  name: string;
  email: string;
  phone?: string | null;
  avatarUrl?: string | null;
  hasPassword: boolean;
}

type FieldError = Record<string, string>;

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

function FormField({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-[#4e2b22]">
        {label}
      </label>
      {children}
      {error && (
        <p role="alert" className="flex items-center gap-1.5 text-xs text-red-600">
          <AlertCircle className="size-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

const inputClass =
  'min-h-[44px] w-full rounded-xl border border-[#ede8e5] bg-white px-4 py-2.5 text-sm text-[#4e2b22] placeholder:text-[#c4a88a] transition-colors focus:outline-none focus:ring-2 focus:ring-[#4e2b22]/30 focus:border-[#4e2b22]/50 disabled:opacity-60 disabled:cursor-not-allowed';

const primaryBtnClass =
  'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#4e2b22] px-5 py-2.5 text-sm font-semibold text-[#faf9f7] shadow-[0_4px_14px_rgba(78,43,34,0.25)] transition-all hover:bg-[#6b3d32] hover:shadow-[0_6px_20px_rgba(78,43,34,0.35)] hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none';

// ─── Profile Info Form ────────────────────────────────────────────────────────

function ProfileInfoForm({ name, phone }: { name: string; phone?: string | null }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formName, setFormName] = useState(name);
  const [formPhone, setFormPhone] = useState(phone ?? '');
  const [errors, setErrors] = useState<FieldError>({});
  const [saved, setSaved] = useState(false);

  const isDirty = formName !== name || formPhone !== (phone ?? '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setSaved(false);

    startTransition(async () => {
      const result = await updateProfileAction({ name: formName, phone: formPhone });
      if (result.success) {
        setSaved(true);
        router.refresh();
        toast.success('Profile saved!');
        setTimeout(() => setSaved(false), 3000);
      } else {
        toast.error(result.error ?? 'Failed to save');
        if (result.error?.toLowerCase().includes('name')) {
          setErrors({ name: result.error });
        }
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField id="profile-name" label="Display Name" error={errors.name}>
        <div className="relative">
          <User className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[#c4a88a]" aria-hidden />
          <input
            id="profile-name"
            type="text"
            value={formName}
            onChange={(e) => { setFormName(e.target.value); setSaved(false); }}
            maxLength={100}
            required
            disabled={isPending}
            autoComplete="name"
            placeholder="Your full name"
            className={`${inputClass} pl-10`}
          />
        </div>
      </FormField>

      <FormField id="profile-phone" label="Phone Number" error={errors.phone}>
        <div className="relative">
          <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[#c4a88a]" aria-hidden />
          <input
            id="profile-phone"
            type="tel"
            value={formPhone}
            onChange={(e) => { setFormPhone(e.target.value); setSaved(false); }}
            maxLength={50}
            disabled={isPending}
            autoComplete="tel"
            placeholder="+49 123 4567890"
            className={`${inputClass} pl-10`}
          />
        </div>
      </FormField>

      <div className="flex items-center justify-end gap-3 pt-1">
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-green-600">
            <CheckCircle2 className="size-4" aria-hidden /> Saved!
          </span>
        )}
        <button
          type="submit"
          disabled={isPending || !isDirty}
          className={primaryBtnClass}
        >
          {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {isPending ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}

// ─── Change Password Form ─────────────────────────────────────────────────────

function ChangePasswordForm() {
  const [isPending, startTransition] = useTransition();
  const [current, setCurrent] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [errors, setErrors] = useState<FieldError>({});
  const [saved, setSaved] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setSaved(false);

    const localErrors: FieldError = {};
    if (newPw.length < 8) localErrors.newPassword = 'At least 8 characters required';
    if (newPw !== confirm) localErrors.confirmPassword = "Passwords don't match";
    if (Object.keys(localErrors).length > 0) { setErrors(localErrors); return; }

    startTransition(async () => {
      const result = await changePasswordAction({
        currentPassword: current,
        newPassword: newPw,
        confirmPassword: confirm,
      });
      if (result.success) {
        setSaved(true);
        setCurrent(''); setNewPw(''); setConfirm('');
        toast.success('Password changed!');
        setTimeout(() => setSaved(false), 3000);
      } else {
        const msg = result.error ?? 'Failed to change password';
        toast.error(msg);
        if (msg.toLowerCase().includes('current')) setErrors({ current: msg });
        else if (msg.toLowerCase().includes("don't match")) setErrors({ confirmPassword: msg });
        else setErrors({ general: msg });
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField id="current-password" label="Current Password" error={errors.current}>
        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[#c4a88a]" aria-hidden />
          <input
            id="current-password"
            type={showCurrent ? 'text' : 'password'}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
            disabled={isPending}
            autoComplete="current-password"
            placeholder="Enter current password"
            className={`${inputClass} pl-10 pr-10`}
          />
          <button
            type="button"
            onClick={() => setShowCurrent((v) => !v)}
            aria-label={showCurrent ? 'Hide password' : 'Show password'}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md text-[#c4a88a] hover:text-[#8b6b5c] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4e2b22] focus-visible:ring-offset-2"
          >
            {showCurrent ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          </button>
        </div>
      </FormField>

      <FormField id="new-password" label="New Password" error={errors.newPassword}>
        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[#c4a88a]" aria-hidden />
          <input
            id="new-password"
            type={showNew ? 'text' : 'password'}
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            required
            minLength={8}
            disabled={isPending}
            autoComplete="new-password"
            placeholder="Minimum 8 characters"
            className={`${inputClass} pl-10 pr-10`}
          />
          <button
            type="button"
            onClick={() => setShowNew((v) => !v)}
            aria-label={showNew ? 'Hide password' : 'Show password'}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md text-[#c4a88a] hover:text-[#8b6b5c] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4e2b22] focus-visible:ring-offset-2"
          >
            {showNew ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          </button>
        </div>
      </FormField>

      <FormField id="confirm-password" label="Confirm New Password" error={errors.confirmPassword}>
        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[#c4a88a]" aria-hidden />
          <input
            id="confirm-password"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            disabled={isPending}
            autoComplete="new-password"
            placeholder="Repeat new password"
            className={`${inputClass} pl-10`}
          />
        </div>
      </FormField>

      {errors.general && (
        <p role="alert" className="flex items-center gap-1.5 text-xs text-red-600">
          <AlertCircle className="size-3.5 shrink-0" aria-hidden />
          {errors.general}
        </p>
      )}

      <div className="flex items-center justify-end gap-3 pt-1">
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-green-600">
            <CheckCircle2 className="size-4" aria-hidden /> Changed!
          </span>
        )}
        <button
          type="submit"
          disabled={isPending || !current || !newPw || !confirm}
          className={primaryBtnClass}
        >
          {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {isPending ? 'Changing…' : 'Change Password'}
        </button>
      </div>
    </form>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function ProfileSettings({ userId, name, email, phone, avatarUrl, hasPassword }: ProfileSettingsProps) {
  // Dummy handler — the profile page doesn't have an outside-click problem
  const handleCroppingChange = useCallback(() => {}, []);

  return (
    <div className="space-y-6">
      {/* Avatar */}
      <SectionCard
        title="Profile Picture"
        description="Upload a photo so instructors and the team can recognise you."
      >
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <AvatarUploader
            name={name}
            currentAvatarUrl={avatarUrl}
            onCroppingChange={handleCroppingChange}
          />
          <div className="text-sm text-[#8b6b5c] leading-relaxed sm:pt-2">
            <p>Click the camera icon to upload a new photo.</p>
            <p className="mt-1">You can drag to reposition and zoom to fit.</p>
            <p className="mt-1 text-xs text-[#c4a88a]">JPEG, PNG, or WebP · Max 5 MB</p>
          </div>
        </div>
      </SectionCard>

      {/* Profile Info */}
      <SectionCard
        title="Personal Information"
        description="Update your display name and contact phone number."
      >
        <ProfileInfoForm name={name} phone={phone} />
      </SectionCard>

      {/* Email — read-only, informational */}
      <SectionCard
        title="Email Address"
        description="Your email address is used to sign in and cannot be changed here."
      >
        <div className="flex items-center gap-3 rounded-xl border border-[#ede8e5] bg-[#f5f3f1]/60 px-4 py-3">
          <span className="text-sm text-[#6b3d32] font-medium">{email}</span>
          <span className="ml-auto rounded-full bg-[#6b8e6b]/15 px-2.5 py-0.5 text-xs font-medium text-[#4a7c4a]">Verified</span>
        </div>
        <p className="mt-2 text-xs text-[#a6856f]">
          To change your email, contact your studio directly.
        </p>
      </SectionCard>

      {/* Password */}
      {hasPassword && (
        <SectionCard
          title="Change Password"
          description="Choose a strong password of at least 8 characters."
        >
          <ChangePasswordForm />
        </SectionCard>
      )}

      {!hasPassword && (
        <SectionCard
          title="Password"
          description="Your account is connected via social login."
        >
          <p className="text-sm text-[#8b6b5c]">
            You signed in with Google — no password is set for this account.
          </p>
        </SectionCard>
      )}

      {/* Data & Privacy */}
      <AccountActions userId={userId} />
    </div>
  );
}
