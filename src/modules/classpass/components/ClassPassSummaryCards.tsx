'use client';

interface ProviderInfo {
  key: string;
  displayName: string;
}

interface Summary {
  [providerKey: string]: {
    confirmed: number;
    reconciled: number;
    pending: number;
    rejected: number;
  };
}

interface Props {
  summary: Summary;
  providers: ProviderInfo[];
}

export function ClassPassSummaryCards({ summary, providers }: Props) {
  const enabledProviders = providers.filter((p) => summary[p.key]);

  if (enabledProviders.length === 0) {
    return (
      <div className="rounded-lg border border-[#ede8e5] bg-white p-6 text-sm text-[#8b6b5c]">
        No class pass partners are configured. Enable them in{' '}
        <a href="/admin/settings/class-passes" className="text-[#4e2b22] underline">
          Studio Settings → Class Passes
        </a>
        .
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {enabledProviders.map((provider) => {
        const stats = summary[provider.key] ?? { confirmed: 0, reconciled: 0, pending: 0, rejected: 0 };
        return (
          <div
            key={provider.key}
            className="rounded-lg border border-[#ede8e5]/80 bg-gradient-to-br from-[#faf9f7]/80 to-[#ede8e5]/40 p-5"
          >
            <p className="text-sm font-medium text-[#6b3d32]">{provider.displayName}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-[#8b6b5c]">Confirmed</p>
                <p className="text-lg font-bold text-[#4e2b22]">{stats.confirmed}</p>
              </div>
              <div>
                <p className="text-[#8b6b5c]">Reconciled</p>
                <p className="text-lg font-bold text-[#4e2b22]">{stats.reconciled}</p>
              </div>
              <div>
                <p className="text-[#8b6b5c]">Pending</p>
                <p className="text-lg font-bold text-[#4e2b22]">{stats.pending}</p>
              </div>
              <div>
                <p className="text-[#8b6b5c]">Rejected</p>
                <p className="text-lg font-bold text-[#4e2b22]">{stats.rejected}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
