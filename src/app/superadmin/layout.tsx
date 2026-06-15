import type { ReactNode } from 'react';
import Link from 'next/link';
import { Shield, Mail, Building2, Users } from 'lucide-react';
import { SuperadminNavLink } from '@/components/superadmin/nav-link';

export const metadata = {
  title: 'Superadmin — PilatesOS',
};

export default function SuperadminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <header className="sticky top-0 z-30 border-b border-[#ede8e5] bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/superadmin" className="flex items-center gap-2 text-[#4e2b22]">
            <Shield className="size-6" />
            <span className="font-bold">Superadmin</span>
          </Link>
          <nav className="flex items-center gap-1 sm:gap-4">
            <SuperadminNavLink href="/superadmin/invites" icon={<Mail className="size-4" />} label="Invites" />
            <SuperadminNavLink href="/superadmin/studios" icon={<Building2 className="size-4" />} label="Studios" />
            <SuperadminNavLink href="/superadmin/users" icon={<Users className="size-4" />} label="Users" />
            <Link
              href="/"
              className="ml-2 text-sm font-medium text-[#6b3d32] hover:text-[#4e2b22]"
            >
              Exit
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
