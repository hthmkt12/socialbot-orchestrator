import type { ApprovalStatus } from './database.types';
export { asString, buildApprovalRequestedActionValue } from './approval-requested-action';

export type ApprovalTone = 'green' | 'red' | 'yellow' | 'blue' | 'gray' | 'orange' | 'teal';

export interface ApprovalStepConfig {
  stepLabel: string;
  requestedActionLabel: string;
  riskLabel: string;
  riskTone: ApprovalTone;
  riskSummary: string;
}

function humanizeStepType(stepType: string | null | undefined) {
  if (!stepType) return 'Sensitive Step';
  return stepType
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function getApprovalStatusLabel(status: ApprovalStatus) {
  switch (status) {
    case 'PENDING':
      return 'Awaiting Decision';
    case 'APPROVED':
      return 'Approved';
    case 'REJECTED':
      return 'Rejected';
    case 'EXPIRED':
      return 'Expired';
    default:
      return status;
  }
}

export function getApprovalStatusTone(status: ApprovalStatus): ApprovalTone {
  switch (status) {
    case 'PENDING':
      return 'yellow';
    case 'APPROVED':
      return 'green';
    case 'REJECTED':
      return 'red';
    case 'EXPIRED':
      return 'gray';
    default:
      return 'gray';
  }
}

export function getApprovalStepConfig(stepType: string | null | undefined): ApprovalStepConfig {
  switch (stepType) {
    case 'adb':
      return {
        stepLabel: 'ADB Command',
        requestedActionLabel: 'Command',
        riskLabel: 'High Risk',
        riskTone: 'red',
        riskSummary: 'Runs a direct device shell command and can change state outside normal macro guardrails.',
      };
    case 'run_autox':
      return {
        stepLabel: 'AutoX Script',
        requestedActionLabel: 'Script',
        riskLabel: 'High Risk',
        riskTone: 'red',
        riskSummary: 'Executes a device automation script that can tap, type, navigate, or branch beyond one bounded step.',
      };
    case 'approval_checkpoint':
      return {
        stepLabel: 'Manual Checkpoint',
        requestedActionLabel: 'Checkpoint',
        riskLabel: 'Human Gate',
        riskTone: 'yellow',
        riskSummary: 'Workflow explicitly pauses here so a reviewer can confirm the surrounding context before continuing.',
      };
    default:
      return {
        stepLabel: humanizeStepType(stepType),
        requestedActionLabel: 'Requested Action',
        riskLabel: 'Sensitive Action',
        riskTone: 'orange',
        riskSummary: 'This step changes device or workflow state and was configured to require manual review before execution.',
      };
  }
}

export function buildResolvedApprovalOutcomeSummary(status: ApprovalStatus) {
  switch (status) {
    case 'APPROVED':
      return 'Approval was granted and the run was requeued so the worker can resume from the waiting step.';
    case 'REJECTED':
      return 'Approval was rejected, the waiting step was marked failed, and the run was cancelled instead of continuing.';
    case 'EXPIRED':
      return 'The approval window expired before a reviewer acted. Relaunch or recreate the request if this action is still needed.';
    case 'PENDING':
    default:
      return 'Run is paused on this step until an operator or admin approves or rejects the request.';
  }
}
