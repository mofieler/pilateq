export const dynamic = 'force-dynamic';
export const revalidate = 0;

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Mail, Building2, Users, Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChangePasswordCard } from '@/components/superadmin/ChangePasswordCard';

export default function SuperadminDashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="size-8 text-[#4e2b22]" />
        <div>
          <h1 className="text-2xl font-bold text-[#4e2b22]">Platform administration</h1>
          <p className="text-sm text-[#6b3d32]">Manage studios, invite links, and platform users.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <DashboardCard
          href="/superadmin/invites"
          icon={<Mail className="size-6" />}
          title="Invite links"
          description="Create and revoke invite-only studio claim links."
        />
        <DashboardCard
          href="/superadmin/studios"
          icon={<Building2 className="size-6" />}
          title="Studios"
          description="View all studios and create them directly."
        />
        <DashboardCard
          href="/superadmin/users"
          icon={<Users className="size-6" />}
          title="Users"
          description="Browse platform users across all studios."
        />
      </div>

      <ChangePasswordCard />
    </div>
  );
}

function DashboardCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link href={href}>
      <Card className="h-full cursor-pointer border-[#ede8e5] bg-white/80 transition-shadow hover:shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg text-[#4e2b22]">{icon} {title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[#6b3d32]">{description}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
