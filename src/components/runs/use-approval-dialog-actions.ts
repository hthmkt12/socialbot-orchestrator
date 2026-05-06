import { useState } from 'react';
import { processApprovalDecision } from '../../lib/approval-service';
import type { Approval } from '../../lib/database.types';

interface UseApprovalDialogActionsArgs {
  addToast: (message: string, tone: 'success' | 'error') => void;
  approval: Approval;
  canResolveApproval: boolean;
  onApproved: () => void;
  onClose: () => void;
  onRejected: () => void;
  reviewerId?: string;
}

export function useApprovalDialogActions({
  addToast,
  approval,
  canResolveApproval,
  onApproved,
  onClose,
  onRejected,
  reviewerId,
}: UseApprovalDialogActionsArgs) {
  const [loading, setLoading] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  const handleApprove = async () => {
    if (!canResolveApproval) {
      addToast('Only operators and admins can resolve approvals', 'error');
      return;
    }
    if (!reviewerId) {
      addToast('You must be logged in to approve', 'error');
      return;
    }

    setLoading(true);
    try {
      await processApprovalDecision({
        approvalId: approval.id,
        approved: true,
        reviewerId,
      });
      addToast('Approval granted successfully', 'success');
      onApproved();
      onClose();
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Failed to approve', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!canResolveApproval) {
      addToast('Only operators and admins can resolve approvals', 'error');
      return;
    }
    if (!rejectionReason.trim()) {
      addToast('Please provide a reason for rejection', 'error');
      return;
    }
    if (!reviewerId) {
      addToast('You must be logged in to reject', 'error');
      return;
    }

    setLoading(true);
    try {
      await processApprovalDecision({
        approvalId: approval.id,
        approved: false,
        reviewerId,
        reviewerNotes: rejectionReason,
      });
      addToast('Approval rejected', 'success');
      onRejected();
      onClose();
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Failed to reject', 'error');
    } finally {
      setLoading(false);
    }
  };

  const resetRejectForm = () => {
    setShowRejectForm(false);
    setRejectionReason('');
  };

  return {
    handleApprove,
    handleReject,
    loading,
    rejectionReason,
    resetRejectForm,
    setRejectionReason,
    setShowRejectForm,
    showRejectForm,
  };
}
