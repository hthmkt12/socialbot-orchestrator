import { logAudit } from './audit';
import { supabase } from './supabase';
import {
  cancelWorkflowRunForRejectedApproval,
  fetchApprovalRecord,
  fetchWorkflowRunStatus,
  markApprovalStepRejected,
  refreshApprovalStatus,
  requeueWorkflowRun,
  updateApprovalRecord,
} from './approval-service-helpers';

interface CreateApprovalParams {
  workflowRunId: string;
  stepId: string;
  stepType: string;
  reason: string;
  requestedById: string;
  metadata?: Record<string, unknown>;
}

interface ApprovalDecision {
  approvalId: string;
  approved: boolean;
  reviewerId: string;
  reviewerNotes?: string;
}

export async function createApprovalRequest(params: CreateApprovalParams) {
  const { data: approval, error } = await supabase
    .from('approvals')
    .insert({
      workflow_run_id: params.workflowRunId,
      requested_by_user_id: params.requestedById,
      step_id: params.stepId,
      step_type: params.stepType,
      reason: params.reason,
      status: 'PENDING',
      metadata: params.metadata || {},
    })
    .select()
    .maybeSingle();

  if (error) throw new Error(`Failed to create approval request: ${error.message}`);
  if (!approval) throw new Error('Approval insert returned no data');

  await supabase
    .from('workflow_runs')
    .update({ status: 'WAITING_APPROVAL' })
    .eq('id', params.workflowRunId);

  await supabase
    .from('run_steps')
    .update({ status: 'WAITING_APPROVAL' })
    .eq('workflow_run_id', params.workflowRunId)
    .eq('step_id', params.stepId);

  await logAudit('approval.requested', 'approval', approval.id, {
    workflowRunId: params.workflowRunId,
    stepId: params.stepId,
    stepType: params.stepType,
    reason: params.reason,
  });

  return approval;
}

export async function processApprovalDecision(decision: ApprovalDecision) {
  const approval = await fetchApprovalRecord(decision.approvalId);
  if (approval.status === 'APPROVED') return { success: true, resumed: true };
  if (approval.status === 'REJECTED' || approval.status === 'EXPIRED') {
    return { success: true, resumed: false };
  }

  const newStatus = decision.approved ? 'APPROVED' : 'REJECTED';
  const reviewedAt = new Date().toISOString();

  const updatedApproval = await updateApprovalRecord({
    approvalId: decision.approvalId,
    newStatus,
    reviewedAt,
    reviewerId: decision.reviewerId,
    reviewerNotes: decision.reviewerNotes,
  });

  if (!updatedApproval) {
    const latestStatus = await refreshApprovalStatus(decision.approvalId);
    return { success: true, resumed: latestStatus === 'APPROVED' };
  }

  if (decision.approved) {
    const runStatus = await fetchWorkflowRunStatus(approval.workflow_run_id);
    if (runStatus !== 'WAITING_APPROVAL') {
      return { success: true, resumed: runStatus === 'QUEUED' || runStatus === 'RUNNING' };
    }

    await requeueWorkflowRun(approval.workflow_run_id);

    await logAudit('approval.approved', 'approval', decision.approvalId, {
      workflowRunId: approval.workflow_run_id,
      stepId: approval.step_id,
      reviewerNotes: decision.reviewerNotes,
      requeued: true,
    });

    return { success: true, resumed: true };
  }

  await markApprovalStepRejected({
    reviewedAt,
    reviewerNotes: decision.reviewerNotes,
    runId: approval.workflow_run_id,
    stepId: approval.step_id,
  });
  await cancelWorkflowRunForRejectedApproval(approval.workflow_run_id, reviewedAt);

  await logAudit('approval.rejected', 'approval', decision.approvalId, {
    workflowRunId: approval.workflow_run_id,
    stepId: approval.step_id,
    reviewerNotes: decision.reviewerNotes,
  });

  return { success: true, resumed: false };
}

export function generateApprovalReason(stepType: string, stepData?: Record<string, unknown>): string {
  switch (stepType) {
    case 'adb':
      return `ADB command execution requires approval: ${String(stepData?.command ?? 'unknown command')}`;
    case 'run_autox':
      return `AutoX script execution requires approval: ${String(stepData?.scriptName ?? 'unknown script')}`;
    default:
      return 'This sensitive operation requires manual approval before execution';
  }
}
