import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ApprovalDetailsModal } from '../components/approvals/ApprovalDetailsModal';
import { ApprovalFocusBanner } from '../components/approvals/ApprovalFocusBanner';
import { ApprovalTabs } from '../components/approvals/ApprovalTabs';
import { ApprovalsList } from '../components/approvals/ApprovalsList';
import type { ApprovalFilterTab } from '../components/approvals/approvals-page-types';
import Header from '../components/layout/Header';
import RoleAccessNotice from '../components/ui/RoleAccessNotice';
import { useApprovals, useResolveApproval } from '../hooks/useApprovals';
import { canManageApprovals, getRoleLabel } from '../lib/role-access';
import { useAuthStore } from '../stores/auth';
import { useUIStore } from '../stores/ui';
import type { Approval } from '../lib/database.types';

export default function ApprovalsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: approvals, isLoading } = useApprovals();
  const resolveApproval = useResolveApproval();
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const addToast = useUIStore((s) => s.addToast);
  const [tab, setTab] = useState<ApprovalFilterTab>('PENDING');
  const [detailApproval, setDetailApproval] = useState<Approval | null>(null);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectionNotes, setRejectionNotes] = useState('');
  const canResolve = canManageApprovals(profile?.role);
  const focusedApprovalId = searchParams.get('approvalId');
  const focusedRunId = searchParams.get('runId');
  const processing = resolveApproval.isPending;

  const clearAuditFocus = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('approvalId');
    next.delete('runId');
    setSearchParams(next, { replace: true });
  };

  const closeDetails = () => {
    setDetailApproval(null);
    setShowRejectForm(false);
    setRejectionNotes('');
    if (focusedApprovalId || focusedRunId) clearAuditFocus();
  };

  const handleResolve = async (id: string, approved: boolean, notes?: string) => {
    if (!canResolve) {
      addToast('Only operators and admins can resolve approvals', 'error');
      return;
    }
    if (!session?.user?.id) {
      addToast('You must be logged in to approve', 'error');
      return;
    }
    try {
      const result = await resolveApproval.mutateAsync({
        approvalId: id,
        approved,
        reviewerId: session.user.id,
        reviewerNotes: notes,
      });
      if (result.outcome === 'already_resolved') {
        addToast(`Approval is no longer pending (${result.status})`, 'info');
        setDetailApproval(null);
        setShowRejectForm(false);
        setRejectionNotes('');
        return;
      }
      addToast(`Approval ${approved ? 'approved' : 'rejected'}`, 'success');
      setDetailApproval(null);
      setShowRejectForm(false);
      setRejectionNotes('');
    } catch {
      addToast('Failed to resolve approval', 'error');
    }
  };

  const openRejectForm = (approval: Approval) => {
    setDetailApproval(approval);
    setShowRejectForm(true);
  };

  const pendingCount = approvals?.filter((approval) => approval.status === 'PENDING').length ?? 0;
  const filtered = useMemo(() => {
    if (!approvals) return [];
    if (tab === 'ALL') return approvals;
    if (tab === 'PENDING') return approvals.filter((approval) => approval.status === 'PENDING');
    return approvals.filter((approval) => approval.status !== 'PENDING');
  }, [approvals, tab]);

  useEffect(() => {
    if (focusedApprovalId || focusedRunId) {
      setTab('ALL');
    }
  }, [focusedApprovalId, focusedRunId]);

  useEffect(() => {
    if (!approvals?.length || (!focusedApprovalId && !focusedRunId)) return;
    const matched = approvals.find((approval) => {
      if (focusedApprovalId && approval.id === focusedApprovalId) return true;
      if (focusedRunId && approval.workflow_run_id === focusedRunId) return true;
      return false;
    });

    if (matched) {
      setDetailApproval((current) => (current?.id === matched.id ? current : matched));
    }
  }, [approvals, focusedApprovalId, focusedRunId]);

  return (
    <>
      <Header
        title="Approvals"
        subtitle={`${pendingCount} pending approval${pendingCount !== 1 ? 's' : ''}`}
      />

      <div className="flex-1 overflow-auto p-6">
        {(focusedApprovalId || focusedRunId) && <ApprovalFocusBanner onClear={clearAuditFocus} />}
        {!canResolve && (
          <div className="mb-5">
            <RoleAccessNotice
              title={`${getRoleLabel(profile?.role)} role can inspect but not resolve approvals`}
              detail="You can review approval requests and outcomes, but only operators and admins can approve or reject them."
            />
          </div>
        )}
        <ApprovalTabs pendingCount={pendingCount} tab={tab} onChange={setTab} />
        <ApprovalsList
          approvals={approvals}
          canResolve={canResolve}
          filtered={filtered}
          isLoading={isLoading}
          processing={processing}
          tab={tab}
          onApprove={(approvalId) => handleResolve(approvalId, true)}
          onOpenDetails={setDetailApproval}
          onOpenReject={openRejectForm}
          onOpenRun={(runId) => navigate(`/runs/${runId}/monitor`)}
        />
      </div>

      <ApprovalDetailsModal
        approval={detailApproval}
        canResolve={canResolve}
        processing={processing}
        readOnlyTitle={`${getRoleLabel(profile?.role)} role is read-only here`}
        rejectionNotes={rejectionNotes}
        showRejectForm={showRejectForm}
        onApprove={(approvalId) => handleResolve(approvalId, true)}
        onCancelReject={() => {
          setShowRejectForm(false);
          setRejectionNotes('');
        }}
        onClose={closeDetails}
        onConfirmReject={(approvalId, notes) => handleResolve(approvalId, false, notes)}
        onRejectionNotesChange={setRejectionNotes}
        onShowRejectForm={() => setShowRejectForm(true)}
      />
    </>
  );
}
