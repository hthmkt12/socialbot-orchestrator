import { ShieldCheck } from 'lucide-react';
import EmptyState from '../ui/EmptyState';
import Spinner from '../ui/Spinner';
import type { Approval } from '../../lib/database.types';
import type { ApprovalFilterTab } from './approvals-page-types';
import { ApprovalCard } from './approvals-list-sections';

interface ApprovalsListProps {
  approvals: Approval[] | undefined;
  canResolve: boolean;
  filtered: Approval[];
  isLoading: boolean;
  processing: boolean;
  tab: ApprovalFilterTab;
  onApprove: (approvalId: string) => void;
  onOpenDetails: (approval: Approval) => void;
  onOpenReject: (approval: Approval) => void;
  onOpenRun: (runId: string) => void;
}

export function ApprovalsList({
  approvals,
  canResolve,
  filtered,
  isLoading,
  processing,
  tab,
  onApprove,
  onOpenDetails,
  onOpenReject,
  onOpenRun,
}: ApprovalsListProps) {
  if (isLoading) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  }

  if (!approvals?.length) {
    return (
      <EmptyState
        icon={<ShieldCheck className="w-6 h-6" />}
        title="No approvals"
        description="Approval requests will appear here when workflows require manual authorization."
      />
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="text-center py-16">
        <ShieldCheck className="w-8 h-8 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500">
          {tab === 'PENDING' ? 'No pending approvals' : 'No resolved approvals'}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-3">
      {filtered.map((approval) => (
        <ApprovalCard
          key={approval.id}
          approval={approval}
          canResolve={canResolve}
          processing={processing}
          onApprove={onApprove}
          onOpenDetails={onOpenDetails}
          onOpenReject={onOpenReject}
          onOpenRun={onOpenRun}
        />
      ))}
    </div>
  );
}
