'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';

function getGreeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 21) return 'Good evening';
  return 'Good night';
}

export function DashboardGreeting({ name }: { name: string }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
  }, []);

  const greeting  = now ? getGreeting(now.getHours()) : '';
  const dateLabel = now ? format(now, 'EEEE, d MMMM yyyy') : '';

  return (
    <div className="relative">
      <p className="text-sm font-medium text-[#6b3d32]">{dateLabel}</p>
      <h1 className="mt-1">
        {greeting}, <span className="text-[#4e2b22] font-bold">{name}</span> 👋
      </h1>
      <p className="mt-2 text-sm text-[#6b3d32]">Ready for your next Pilates session?</p>
    </div>
  );
}
