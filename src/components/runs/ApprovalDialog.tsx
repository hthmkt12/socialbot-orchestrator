import { AlertCircle } from 'lucide-react';
import { useAuthStore } from '../../stores/auth';
import { useUIStore } from '../../stores/ui';
import { canManageApprovals, getRoleLabel } from '../../lib/role-access';
import type { Approval } from '../../lib/database.types';
import ApprovalSummaryPanel from './ApprovalSummaryPanel';
import ApprovalDialogActions from './approval-dialog-actions';
import { useApprovalDialogActions } from './use-approval-dialog-actions';
import Modal from '../ui/Modal';
import RoleAccessNotice from '../ui/RoleAccessNotice';

interface ApprovalDialogProps {
  approval: Approval;
  onClose: () => void;
  onApproved: () => void;
  onRejected: () => void;
  readOnly?: boolean;
}

export function ApprovalDialog({
  approval,
  onClose,
  onApproved,
  onRejected,
  readOnly = false,
}: ApprovalDialogProps) {
  const addToast = useUIStore((state) => state.addToast);
  const profile = useAuthStore((state) => state.profile);
  const reviewerId = useAuthStore((state) => state.session?.user?.id);
  const canResolveApproval = !readOnly && canManageApprovals(profile?.role);
  const actions = useApprovalDialogActions({
    addToast,
    approval,
    canResolveApproval,
    onApproved,
    onClose,
    onRejected,
    reviewerId,
  });

  return (
    <Modal open onClose={onClose} title="Approval Required" maxWidth="max-w-2xl">
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-yellow-900 mb-1">Manual Approval Needed</h4>
            <p className="text-sm text-yellow-800">
              Review the request below before you let the run continue.
            </p>
          </div>
        </div>

        <ApprovalSummaryPanel approval={approval} />

        {!canResolveApproval ? (
          <div className="space-y-3">
            <RoleAccessNotice
              title={`${getRoleLabel(profile?.role)} role can inspect but not resolve approvals`}
              detail="Use the approvals list to review context, then ask an operator or admin to approve or reject this step."
            />
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <ApprovalDialogActions
            loading={actions.loading}
            onApprove={actions.handleApprove}
            onReject={actions.handleReject}
            onRejectToggle={
              actions.showRejectForm
                ? actions.resetRejectForm
                : () => actions.setShowRejectForm(true)
            }
            rejectionReason={actions.rejectionReason}
            setRejectionReason={actions.setRejectionReason}
            showRejectForm={actions.showRejectForm}
          />
        )}
      </div>
    </Modal>
  );
}
