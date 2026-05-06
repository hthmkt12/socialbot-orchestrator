import { AlertTriangle, CheckCircle2, Clock3, XCircle } from 'lucide-react';
import type { Approval } from '../../lib/database.types';
import { buildApprovalInsight } from '../../lib/approval-insights';
import Badge from '../ui/Badge';

interface ApprovalSummaryPanelProps {
  approval: Approval;
  compact?: boolean;
}

function getStatusIcon(status: Approval['status']) {
  switch (status) {
    case 'APPROVED':
      return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
    case 'REJECTED':
      return <XCircle className="w-4 h-4 text-red-600" />;
    case 'EXPIRED':
      return <Clock3 className="w-4 h-4 text-gray-500" />;
    case 'PENDING':
    default:
      return <AlertTriangle className="w-4 h-4 text-amber-600" />;
  }
}

function InfoCard({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{title}</p>
      <p className="mt-1 text-sm text-gray-700">{body}</p>
    </div>
  );
}

export default function ApprovalSummaryPanel({
  approval,
  compact = false,
}: ApprovalSummaryPanelProps) {
  const insight = buildApprovalInsight(approval);

  if (compact) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={insight.statusTone}>{insight.statusLabel}</Badge>
          <Badge variant={insight.riskTone}>{insight.riskLabel}</Badge>
          <Badge variant="gray">{insight.stepLabel}</Badge>
          {approval.step_id && <Badge variant="blue">Step {approval.step_id}</Badge>}
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            {insight.requestedActionLabel}
          </p>
          <p className="mt-1 text-sm font-medium text-gray-900">{insight.requestedActionValue}</p>
          <p className="mt-1 text-sm text-gray-600">{insight.reasonSummary}</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="flex items-center gap-2">
            {getStatusIcon(approval.status)}
            <p className="text-sm font-medium text-gray-900">
              {approval.status === 'PENDING' ? 'What happens next' : insight.resolvedOutcomeTitle}
            </p>
          </div>
          <p className="mt-2 text-sm text-gray-700">
            {approval.status === 'PENDING'
              ? insight.approveOutcomeSummary
              : insight.resolvedOutcomeSummary}
          </p>
        </div>

        {insight.reviewerSummary && (
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Reviewer Notes
            </p>
            <p className="mt-1 text-sm text-gray-700">{insight.reviewerSummary}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={insight.statusTone}>{insight.statusLabel}</Badge>
        <Badge variant={insight.riskTone}>{insight.riskLabel}</Badge>
        <Badge variant="gray">{insight.stepLabel}</Badge>
        {approval.step_id && <Badge variant="blue">Step {approval.step_id}</Badge>}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <InfoCard title={insight.requestedActionLabel} body={insight.requestedActionValue} />
        <InfoCard title="Why Review Is Required" body={insight.reasonSummary} />
        <InfoCard title="Risk To Device Or Run" body={insight.riskSummary} />
        {approval.status === 'PENDING' ? (
          <>
            <InfoCard title="If Approved" body={insight.approveOutcomeSummary} />
            <InfoCard title="If Rejected" body={insight.rejectOutcomeSummary} />
          </>
        ) : (
          <InfoCard title={insight.resolvedOutcomeTitle} body={insight.resolvedOutcomeSummary} />
        )}
      </div>

      {insight.reviewerSummary && (
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Reviewer Notes
          </p>
          <p className="mt-1 text-sm text-gray-700">{insight.reviewerSummary}</p>
        </div>
      )}
    </div>
  );
}
