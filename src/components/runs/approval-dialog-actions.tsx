import { CheckCircle2, XCircle } from 'lucide-react';
import Spinner from '../ui/Spinner';

interface ApprovalDialogActionsProps {
  loading: boolean;
  onApprove: () => void;
  onReject: () => void;
  onRejectToggle: () => void;
  rejectionReason: string;
  setRejectionReason: (value: string) => void;
  showRejectForm: boolean;
}

export default function ApprovalDialogActions({
  loading,
  onApprove,
  onReject,
  onRejectToggle,
  rejectionReason,
  setRejectionReason,
  showRejectForm,
}: ApprovalDialogActionsProps) {
  if (!showRejectForm) {
    return (
      <div className="flex gap-3">
        <button
          onClick={onApprove}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {loading ? (
            <Spinner size="sm" />
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5" />
              Approve
            </>
          )}
        </button>
        <button
          onClick={onRejectToggle}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          <XCircle className="w-5 h-5" />
          Reject
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Reason for Rejection
        </label>
        <textarea
          value={rejectionReason}
          onChange={(e) => setRejectionReason(e.target.value)}
          placeholder="Explain why this approval is being rejected..."
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
        />
      </div>
      <div className="flex gap-3">
        <button
          onClick={onReject}
          disabled={loading || !rejectionReason.trim()}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {loading ? (
            <Spinner size="sm" />
          ) : (
            <>
              <XCircle className="w-5 h-5" />
              Confirm Rejection
            </>
          )}
        </button>
        <button
          onClick={onRejectToggle}
          disabled={loading}
          className="px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
