import { CheckSquare, Pause, Play, X } from 'lucide-react';
import type { WorkflowRun } from './run-monitor-types';

interface RunMonitorHeaderProps {
  autoRefresh: boolean;
  canCancelRun: boolean;
  canResolveApproval: boolean;
  pendingApprovalCount: number;
  run: WorkflowRun;
  runId: string | undefined;
  onBack: () => void;
  onCancelRun: () => void;
  onOpenApproval: () => void;
  onToggleAutoRefresh: () => void;
}

export function RunMonitorHeader({
  autoRefresh,
  canCancelRun,
  canResolveApproval,
  pendingApprovalCount,
  run,
  runId,
  onBack,
  onCancelRun,
  onOpenApproval,
  onToggleAutoRefresh,
}: RunMonitorHeaderProps) {
  return (
    <div className="mb-6 flex items-center justify-between">
      <div>
        <button
          onClick={onBack}
          className="text-sm text-gray-600 hover:text-gray-900 mb-2"
        >
          Back to Runs
        </button>
        <h1 className="text-3xl font-bold text-gray-900">Run Monitor</h1>
        <p className="text-sm text-gray-500 mt-1">Run ID: {runId}</p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={onToggleAutoRefresh}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${
            autoRefresh
              ? 'bg-blue-50 border-blue-200 text-blue-700'
              : 'bg-white border-gray-300 text-gray-700'
          }`}
        >
          {autoRefresh ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
        </button>
        {pendingApprovalCount > 0 && (
          <button
            onClick={onOpenApproval}
            className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg ${
              canResolveApproval
                ? 'bg-yellow-600 hover:bg-yellow-700 animate-pulse'
                : 'bg-gray-600 hover:bg-gray-700'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            {canResolveApproval ? 'Pending Approval' : 'Approval Details'} ({pendingApprovalCount})
          </button>
        )}
        {['PENDING', 'QUEUED', 'RUNNING', 'WAITING_APPROVAL'].includes(run.status) && canCancelRun && (
          <button
            onClick={onCancelRun}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            <X className="w-4 h-4" />
            Cancel Run
          </button>
        )}
      </div>
    </div>
  );
}
