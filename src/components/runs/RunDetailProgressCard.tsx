import type { RunStepStats } from './run-detail-types';

interface RunDetailProgressCardProps {
  barColor: string;
  isRunning: boolean;
  stepStats: RunStepStats;
}

export function RunDetailProgressCard({ barColor, isRunning, stepStats }: RunDetailProgressCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-gray-900">Progress</h3>
          {isRunning && <div className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />}
        </div>
        <span className="text-sm font-bold text-gray-700">{stepStats.percent}%</span>
      </div>
      <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden mb-3">
        <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${stepStats.percent}%` }} />
      </div>
      <div className="flex items-center gap-6 text-xs text-gray-500">
        <span>{stepStats.done} / {stepStats.total} steps complete</span>
        <span className="text-emerald-600">{stepStats.success} passed</span>
        {stepStats.failed > 0 && <span className="text-red-600">{stepStats.failed} failed</span>}
      </div>
    </div>
  );
}
