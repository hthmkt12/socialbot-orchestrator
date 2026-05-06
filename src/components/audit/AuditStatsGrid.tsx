import { Clock, FileText, Filter, ScrollText, Settings } from 'lucide-react';
import type { AuditLogStats } from './audit-page-types';

interface AuditStatsGridProps {
  stats: AuditLogStats;
}

const STAT_CARDS = [
  { key: 'total', label: 'Total Events', color: 'text-gray-900', bg: 'bg-gray-50', icon: ScrollText },
  { key: 'today', label: 'Today', color: 'text-sky-600', bg: 'bg-sky-50', icon: Clock },
  { key: 'actions', label: 'Action Types', color: 'text-teal-600', bg: 'bg-teal-50', icon: FileText },
  { key: 'resources', label: 'Resource Types', color: 'text-orange-600', bg: 'bg-orange-50', icon: Settings },
  { key: 'linked', label: 'Linked Context', color: 'text-amber-600', bg: 'bg-amber-50', icon: Filter },
] as const;

export function AuditStatsGrid({ stats }: AuditStatsGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
      {STAT_CARDS.map((card) => (
        <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className={`w-10 h-10 ${card.bg} rounded-lg flex items-center justify-center`}>
            <card.icon className={`w-5 h-5 ${card.color}`} />
          </div>
          <div>
            <p className={`text-xl font-bold ${card.color}`}>{stats[card.key]}</p>
            <p className="text-xs text-gray-500">{card.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
