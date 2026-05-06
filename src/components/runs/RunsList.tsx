import { Play, Search, Smartphone, Timer } from 'lucide-react';
import type { WorkflowRun } from '../../lib/database.types';
import { formatDuration } from '../../lib/format';
import Badge from '../ui/Badge';
import EmptyState from '../ui/EmptyState';
import Spinner from '../ui/Spinner';
import {
  getStatusIconClasses,
  isLiveRunStatus,
  runsPageStatusConfig,
} from './runs-page-status';

interface RunsListProps {
  runs: WorkflowRun[] | undefined;
  filteredRuns: WorkflowRun[];
  isLoading: boolean;
  onOpenRun: (run: WorkflowRun) => void;
}

export default function RunsList({ runs, filteredRuns, isLoading, onOpenRun }: RunsListProps) {
  if (isLoading) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  }

  if (!runs?.length) {
    return (
      <EmptyState
        icon={<Play className="w-6 h-6" />}
        title="No runs yet"
        description="Execute a macro to create your first workflow run."
      />
    );
  }

  if (filteredRuns.length === 0) {
    return (
      <div className="text-center py-16">
        <Search className="w-8 h-8 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500">No runs match your filters</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-w-4xl">
      {filteredRuns.map((run) => (
        <RunListItem key={run.id} run={run} onOpenRun={onOpenRun} />
      ))}
    </div>
  );
}

function RunListItem({ run, onOpenRun }: { run: WorkflowRun; onOpenRun: (run: WorkflowRun) => void }) {
  const status = runsPageStatusConfig[run.status] ?? runsPageStatusConfig.PENDING;
  const StatusIcon = status.icon;
  const isLive = isLiveRunStatus(run.status);
  const [bgClass, textClass] = getStatusIconClasses(status.variant).split(' ');

  return (
    <button
      onClick={() => onOpenRun(run)}
      className={`w-full bg-white rounded-xl border p-5 text-left hover:shadow-md transition-all flex items-center gap-4 ${
        isLive ? 'border-sky-200 hover:border-sky-300' : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${bgClass}`}>
        <StatusIcon className={`w-5 h-5 ${textClass} ${isLive ? 'animate-pulse' : ''}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-semibold text-gray-900">Run {run.id.slice(0, 8)}</span>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Smartphone className="w-3 h-3" />
            {run.target_type.replace(/_/g, ' ')}
          </span>
          <span>{new Date(run.created_at).toLocaleString()}</span>
          {run.finished_at && (
            <span className="flex items-center gap-1">
              <Timer className="w-3 h-3" />
              {formatDuration(run.started_at, run.finished_at)}
            </span>
          )}
        </div>
      </div>
      {isLive && <div className="w-2 h-2 rounded-full bg-sky-500 animate-pulse flex-shrink-0" />}
    </button>
  );
}
