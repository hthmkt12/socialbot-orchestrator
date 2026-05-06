import type { RiskFilter, SummaryCohort } from './devices-page-types';

interface DeviceFleetSummaryProps {
  riskFilter: RiskFilter;
  stats: {
    total: number;
    offline: number;
  };
  summaryCohorts: SummaryCohort[];
  onDrill: (riskFilter: RiskFilter) => void;
}

export function DeviceFleetSummary({
  riskFilter,
  stats,
  summaryCohorts,
  onDrill,
}: DeviceFleetSummaryProps) {
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-3">
        {summaryCohorts.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => onDrill(s.riskFilter)}
            className={`bg-white rounded-xl border p-4 flex items-center gap-3 text-left transition-all hover:border-sky-300 hover:shadow-sm ${
              riskFilter === s.riskFilter && s.riskFilter !== 'ALL'
                ? 'border-sky-300 ring-2 ring-sky-100'
                : 'border-gray-200'
            }`}
          >
            <div className={`w-10 h-10 ${s.bg} rounded-lg flex items-center justify-center`}>
              <s.icon className={`w-5 h-5 ${s.color}`} />
            </div>
            <div>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
              {s.riskFilter !== 'ALL' && <p className="text-[10px] text-sky-600 mt-0.5">Drill into cohort</p>}
            </div>
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-500 mb-6">
        {stats.total} total devices, {stats.offline} offline. Healthy means fresh and online under the shared lifecycle policy.
      </p>
    </>
  );
}
