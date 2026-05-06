import { formatDistanceToNow } from 'date-fns';
import type { DeviceStatus, RunStep, WorkflowRun } from './run-monitor-types';
import { RunStatusBadge } from './run-monitor-status';

export function RunMonitorSummaryPanel({
  completedSteps,
  deviceStatuses,
  failedSteps,
  progressPercent,
  run,
  steps,
  totalSteps,
}: {
  completedSteps: number;
  deviceStatuses: DeviceStatus[];
  failedSteps: number;
  progressPercent: number;
  run: WorkflowRun;
  steps: RunStep[];
  totalSteps: number;
}) {
  const pendingStepCount = steps.filter((step) =>
    step.status === 'PENDING' || step.status === 'RUNNING' || step.status === 'RETRYING'
  ).length;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">Overall Status</h2>
          <RunStatusBadge status={run.status} />
        </div>
        {run.started_at && (
          <p className="text-sm text-gray-500">
            Started {formatDistanceToNow(new Date(run.started_at), { addSuffix: true })}
          </p>
        )}
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>Progress</span>
          <span>{completedSteps} / {totalSteps} steps completed</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-blue-600 h-3 rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mt-6">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">{deviceStatuses.length}</div>
          <div className="text-sm text-gray-500">Devices</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">{completedSteps}</div>
          <div className="text-sm text-gray-500">Completed</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-red-600">{failedSteps}</div>
          <div className="text-sm text-gray-500">Failed</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">{pendingStepCount}</div>
          <div className="text-sm text-gray-500">Pending</div>
        </div>
      </div>
    </div>
  );
}
