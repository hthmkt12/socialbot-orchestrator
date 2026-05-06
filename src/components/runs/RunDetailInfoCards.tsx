import { Smartphone, Timer } from 'lucide-react';
import Badge from '../ui/Badge';
import { formatDuration } from '../../lib/format';
import type { WorkflowRun } from '../../lib/database.types';
import { getRunStatusBadgeVariant } from './run-detail-status';

interface RunDetailInfoCardsProps {
  isRunning: boolean;
  run: WorkflowRun;
}

export function RunDetailInfoCards({ isRunning, run }: RunDetailInfoCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-xs text-gray-500 mb-1">Status</p>
        <Badge variant={getRunStatusBadgeVariant(run.status) as 'green'}>{run.status.replace(/_/g, ' ')}</Badge>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-xs text-gray-500 mb-1">Target</p>
        <div className="flex items-center gap-1.5">
          <Smartphone className="w-4 h-4 text-gray-400" />
          <p className="text-sm font-medium text-gray-900">{run.target_type.replace(/_/g, ' ')}</p>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-xs text-gray-500 mb-1">Started</p>
        <p className="text-sm font-medium text-gray-900">{run.started_at ? new Date(run.started_at).toLocaleString() : '--'}</p>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-xs text-gray-500 mb-1">Duration</p>
        <div className="flex items-center gap-1.5">
          <Timer className="w-4 h-4 text-gray-400" />
          <p className="text-sm font-medium text-gray-900">
            {formatDuration(run.started_at, run.finished_at || (isRunning ? new Date().toISOString() : null))}
          </p>
        </div>
      </div>
    </div>
  );
}
