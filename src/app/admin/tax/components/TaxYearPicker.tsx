'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';

export function TaxYearPicker({ year }: { year: number }) {
  const router = useRouter();
  const params = useSearchParams();

  function navigate(y: number) {
    const sp = new URLSearchParams(params.toString());
    sp.set('year', String(y));
    router.push(`/admin/tax?${sp.toString()}`);
  }

  function handleExport() {
    window.open(`/api/admin/tax/export?year=${year}`, '_blank');
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => navigate(year - 1)}
          className="flex size-9 items-center justify-center rounded-xl border border-[#ede8e5] text-[#8b6b5c] hover:border-[#c4a88a] hover:text-[#4e2b22] hover:bg-[#fdf8f5] transition-all active:scale-95"
          aria-label="Previous year"
        >
          <ChevronLeft className="size-4" />
        </button>

        <span className="min-w-16 text-center font-bold text-xl text-[#4e2b22] select-none px-2">
          {year}
        </span>

        <button
          type="button"
          onClick={() => navigate(year + 1)}
          disabled={year >= new Date().getFullYear()}
          className="flex size-9 items-center justify-center rounded-xl border border-[#ede8e5] text-[#8b6b5c] hover:border-[#c4a88a] hover:text-[#4e2b22] hover:bg-[#fdf8f5] transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
          aria-label="Next year"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      <button
        type="button"
        onClick={handleExport}
        className="flex items-center gap-2 rounded-xl border border-[#4e2b22]/20 bg-[#4e2b22] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#6b3d32] transition-colors active:scale-95"
      >
        <Download className="size-4" />
        Export CSV
      </button>
    </div>
  );
}
