import { CheckCircle, Timer, XCircle, Zap, type LucideIcon } from 'lucide-react';
import type { RunsStats } from './runs-page-types';

interface RunsSummaryStatsProps {
  stats: RunsStats;
}

interface StatCard {
  label: string;
  value: number;
  color: string;
  bg: string;
  icon: LucideIcon;
}

const getStatCards = (stats: RunsStats): StatCard[] => [
  { label: 'Total', value: stats.total, color: 'text-gray-900', bg: 'bg-gray-50', icon: Timer },
  { label: 'Running', value: stats.running, color: 'text-sky-600', bg: 'bg-sky-50', icon: Zap },
  {
    label: 'Completed',
    value: stats.completed,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    icon: CheckCircle,
  },
  { label: 'Failed', value: stats.failed, color: 'text-red-600', bg: 'bg-red-50', icon: XCircle },
];

export default function RunsSummaryStats({ stats }: RunsSummaryStatsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {getStatCards(stats).map((stat) => (
        <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className={`w-10 h-10 ${stat.bg} rounded-lg flex items-center justify-center`}>
            <stat.icon className={`w-5 h-5 ${stat.color}`} />
          </div>
          <div>
            <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-gray-500">{stat.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
