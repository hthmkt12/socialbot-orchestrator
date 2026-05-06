import { CheckCircle, XCircle } from 'lucide-react';
import ApprovalSummaryPanel from '../runs/ApprovalSummaryPanel';
import RoleAccessNotice from '../ui/RoleAccessNotice';
import Spinner from '../ui/Spinner';
import type { Approval } from '../../lib/database.types';
import {
  ApprovalFacts,
  ApprovalMetadata,
} from './approval-details-facts';

interface ApprovalDetailsContentProps {
  approval: Approval;
  canResolve: boolean;
  processing: boolean;
  readOnlyTitle: string;
  rejectionNotes: string;
  showRejectForm: boolean;
  onApprove: (approvalId: string) => void;
  onCancelReject: () => void;
  onConfirmReject: (approvalId: string, notes: string) => void;
  onRejectionNotesChange: (notes: string) => void;
  onShowRejectForm: () => void;
}

export function ApprovalDetailsContent({
  approval,
  canResolve,
  processing,
  readOnlyTitle,
  rejectionNotes,
  showRejectForm,
  onApprove,
  onCancelReject,
  onConfirmReject,
  onRejectionNotesChange,
  onShowRejectForm,
}: ApprovalDetailsContentProps) {
  return (
    <div className="space-y-4">
      <ApprovalSummaryPanel approval={approval} />
      <ApprovalFacts approval={approval} />
      <ApprovalMetadata approval={approval} />

      {approval.status === 'PENDING' && !showRejectForm && canResolve && (
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onShowRejectForm}
            disabled={processing}
            className="px-4 py-2 bg-red-50 text-red-700 hover:bg-red-100 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            Reject
          </button>
          <button
            onClick={() => onApprove(approval.id)}
            disabled={processing}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {processing ? <Spinner size="sm" /> : <CheckCircle className="w-4 h-4" />}
            Approve
          </button>
        </div>
      )}

      {approval.status === 'PENDING' && !canResolve && (
        <RoleAccessNotice
          title={readOnlyTitle}
          detail="Use this dialog to inspect the approval context. Ask an operator or admin to take the final action."
        />
      )}

      {approval.status === 'PENDING' && showRejectForm && canResolve && (
        <RejectForm
          notes={rejectionNotes}
          processing={processing}
          onCancel={onCancelReject}
          onChange={onRejectionNotesChange}
          onConfirm={() => onConfirmReject(approval.id, rejectionNotes)}
        />
      )}
    </div>
  );
}

function RejectForm({
  notes,
  processing,
  onCancel,
  onChange,
  onConfirm,
}: {
  notes: string;
  processing: boolean;
  onCancel: () => void;
  onChange: (notes: string) => void;
  onConfirm: () => void;
}) {
  return (
    <div className="space-y-3 pt-2 border-t border-gray-200">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Reason for Rejection
        </label>
        <textarea
          value={notes}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Explain why this approval is being rejected..."
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          disabled={processing}
          className="px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={processing || !notes.trim()}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {processing ? <Spinner size="sm" /> : <XCircle className="w-4 h-4" />}
          Confirm Rejection
        </button>
      </div>
    </div>
  );
}
