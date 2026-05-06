import { CheckCircle, Clock, Eye, XCircle } from 'lucide-react';
import ApprovalSummaryPanel from '../runs/ApprovalSummaryPanel';
import Badge from '../ui/Badge';
import type { Approval } from '../../lib/database.types';

const statusIcon: Record<string, typeof Clock> = {
  PENDING: Clock,
  APPROVED: CheckCircle,
  REJECTED: XCircle,
  EXPIRED: Clock,
};

interface ApprovalCardProps {
  approval: Approval;
  canResolve: boolean;
  processing: boolean;
  onApprove: (approvalId: string) => void;
  onOpenDetails: (approval: Approval) => void;
  onOpenReject: (approval: Approval) => void;
  onOpenRun: (runId: string) => void;
}

export function ApprovalCard({
  approval,
  canResolve,
  processing,
  onApprove,
  onOpenDetails,
  onOpenReject,
  onOpenRun,
}: ApprovalCardProps) {
  const StatusIcon = statusIcon[approval.status] ?? Clock;

  return (
    <div className={`bg-white rounded-xl border p-5 transition-all ${
      approval.status === 'PENDING' ? 'border-amber-200' : 'border-gray-200'
    }`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4 flex-1">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${getStatusBackground(approval.status)}`}>
            <StatusIcon className={`w-5 h-5 ${getStatusIconColor(approval.status)}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <button onClick={() => onOpenRun(approval.workflow_run_id)} className="text-sm font-semibold text-blue-600 hover:text-blue-700">
                Run {approval.workflow_run_id.slice(0, 8)}
              </button>
              {approval.requested_by && (
                <span className="text-xs text-gray-400">Requested by {approval.requested_by}</span>
              )}
            </div>
            <ApprovalSummaryPanel approval={approval} compact />
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span>Requested {new Date(approval.created_at).toLocaleString()}</span>
              {approval.reviewed_at && (
                <span>Reviewed {new Date(approval.reviewed_at).toLocaleString()}</span>
              )}
            </div>
          </div>
        </div>

        <ApprovalCardActions
          approval={approval}
          canResolve={canResolve}
          processing={processing}
          onApprove={onApprove}
          onOpenDetails={onOpenDetails}
          onOpenReject={onOpenReject}
        />
      </div>
    </div>
  );
}

function ApprovalCardActions({
  approval,
  canResolve,
  processing,
  onApprove,
  onOpenDetails,
  onOpenReject,
}: Omit<ApprovalCardProps, 'onOpenRun'>) {
  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      <button onClick={() => onOpenDetails(approval)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
        <Eye className="w-3.5 h-3.5" /> Details
      </button>
      {approval.status === 'PENDING' && canResolve && (
        <>
          <button onClick={() => onOpenReject(approval)} disabled={processing} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-red-50 text-red-700 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50">
            <XCircle className="w-3.5 h-3.5" /> Reject
          </button>
          <button onClick={() => onApprove(approval.id)} disabled={processing} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg transition-colors disabled:opacity-50">
            <CheckCircle className="w-3.5 h-3.5" /> Approve
          </button>
        </>
      )}
      {approval.status === 'PENDING' && !canResolve && <Badge variant="gray">Read-only</Badge>}
    </div>
  );
}

function getStatusBackground(status: string) {
  if (status === 'PENDING') return 'bg-amber-50';
  if (status === 'APPROVED') return 'bg-emerald-50';
  if (status === 'REJECTED') return 'bg-red-50';
  return 'bg-gray-50';
}

function getStatusIconColor(status: string) {
  if (status === 'PENDING') return 'text-amber-500';
  if (status === 'APPROVED') return 'text-emerald-500';
  if (status === 'REJECTED') return 'text-red-500';
  return 'text-gray-400';
}
