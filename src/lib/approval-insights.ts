import type { Approval } from './database.types';
import {
  asString,
  buildApprovalRequestedActionValue,
  buildResolvedApprovalOutcomeSummary,
  getApprovalStatusLabel,
  getApprovalStatusTone,
  getApprovalStepConfig,
  type ApprovalTone,
} from './approval-insight-helpers';

export interface ApprovalInsight {
  statusLabel: string;
  statusTone: ApprovalTone;
  stepLabel: string;
  requestedActionLabel: string;
  requestedActionValue: string;
  reasonSummary: string;
  riskLabel: string;
  riskTone: ApprovalTone;
  riskSummary: string;
  approveOutcomeSummary: string;
  rejectOutcomeSummary: string;
  resolvedOutcomeTitle: string;
  resolvedOutcomeSummary: string;
  reviewerSummary?: string;
}

export function buildApprovalInsight(approval: Approval): ApprovalInsight {
  const stepConfig = getApprovalStepConfig(approval.step_type);
  const reviewerSummary = asString(approval.reviewer_notes);

  return {
    statusLabel: getApprovalStatusLabel(approval.status),
    statusTone: getApprovalStatusTone(approval.status),
    stepLabel: stepConfig.stepLabel,
    requestedActionLabel: stepConfig.requestedActionLabel,
    requestedActionValue: buildApprovalRequestedActionValue(approval, stepConfig),
    reasonSummary: approval.reason || 'No reason provided.',
    riskLabel: stepConfig.riskLabel,
    riskTone: stepConfig.riskTone,
    riskSummary: stepConfig.riskSummary,
    approveOutcomeSummary: 'Run leaves the waiting state and is requeued so backend execution can continue from this step.',
    rejectOutcomeSummary: 'Run stops here, this waiting step is recorded as failed, and the overall run is cancelled.',
    resolvedOutcomeTitle:
      approval.status === 'PENDING' ? 'Awaiting Reviewer' : `${getApprovalStatusLabel(approval.status)} Outcome`,
    resolvedOutcomeSummary: buildResolvedApprovalOutcomeSummary(approval.status),
    reviewerSummary,
  };
}
