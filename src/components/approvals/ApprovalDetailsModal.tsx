import Modal from '../ui/Modal';
import type { Approval } from '../../lib/database.types';
import { ApprovalDetailsContent } from './approval-details-sections';

interface ApprovalDetailsModalProps {
  approval: Approval | null;
  canResolve: boolean;
  processing: boolean;
  readOnlyTitle: string;
  rejectionNotes: string;
  showRejectForm: boolean;
  onApprove: (approvalId: string) => void;
  onCancelReject: () => void;
  onClose: () => void;
  onConfirmReject: (approvalId: string, notes: string) => void;
  onRejectionNotesChange: (notes: string) => void;
  onShowRejectForm: () => void;
}

export function ApprovalDetailsModal({
  approval,
  canResolve,
  processing,
  readOnlyTitle,
  rejectionNotes,
  showRejectForm,
  onApprove,
  onCancelReject,
  onClose,
  onConfirmReject,
  onRejectionNotesChange,
  onShowRejectForm,
}: ApprovalDetailsModalProps) {
  return (
    <Modal open={!!approval} onClose={onClose} title="Approval Details" maxWidth="max-w-2xl">
      {approval && (
        <ApprovalDetailsContent
          approval={approval}
          canResolve={canResolve}
          processing={processing}
          readOnlyTitle={readOnlyTitle}
          rejectionNotes={rejectionNotes}
          showRejectForm={showRejectForm}
          onApprove={onApprove}
          onCancelReject={onCancelReject}
          onConfirmReject={onConfirmReject}
          onRejectionNotesChange={onRejectionNotesChange}
          onShowRejectForm={onShowRejectForm}
        />
      )}
    </Modal>
  );
}
