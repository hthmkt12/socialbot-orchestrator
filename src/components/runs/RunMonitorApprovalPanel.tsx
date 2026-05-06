import { CheckSquare } from 'lucide-react';
import ApprovalSummaryPanel from './ApprovalSummaryPanel';
import type { Approval } from './run-monitor-types';

interface RunMonitorApprovalPanelProps {
  approval: Approval;
  canResolveApproval: boolean;
  pendingApprovalCount: number;
  onOpenApproval: () => void;
}

export function RunMonitorApprovalPanel({
  approval,
  canResolveApproval,
  pendingApprovalCount,
  onOpenApproval,
}: RunMonitorApprovalPanelProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-amber-200 p-6 mb-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
            Approval Queue
          </p>
          <h2 className="text-lg font-semibold text-gray-900 mt-1">
            Run is paused for manual review
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Reviewer context is summarized here so the operator can decide without opening raw payload fields.
          </p>
        </div>
        <button
          onClick={onOpenApproval}
          className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg ${
            canResolveApproval
              ? 'bg-amber-500 text-white hover:bg-amber-600'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <CheckSquare className="w-4 h-4" />
          {canResolveApproval ? 'Review Approval' : 'Open Approval Context'}
        </button>
      </div>

      <div className="mt-4">
        <ApprovalSummaryPanel approval={approval} />
      </div>

      {pendingApprovalCount > 1 && (
        <p className="mt-3 text-xs text-gray-500">
          Showing the first pending request. {pendingApprovalCount - 1} more approval
          {pendingApprovalCount - 1 === 1 ? '' : 's'} are queued for this run.
        </p>
      )}
    </div>
  );
}
