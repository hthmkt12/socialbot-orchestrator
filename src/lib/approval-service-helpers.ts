import { supabase } from './supabase';

export interface ApprovalRecord {
  id: string;
  status: string;
  step_id: string;
  workflow_run_id: string;
}

export async function fetchApprovalRecord(approvalId: string) {
  const { data: approval, error } = await supabase
    .from('approvals')
    .select('*, workflow_run_id, step_id')
    .eq('id', approvalId)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch approval: ${error.message}`);
  if (!approval) throw new Error('Approval not found');

  return approval as ApprovalRecord & Record<string, unknown>;
}

export async function updateApprovalRecord({
  approvalId,
  newStatus,
  reviewedAt,
  reviewerId,
  reviewerNotes,
}: {
  approvalId: string;
  newStatus: 'APPROVED' | 'REJECTED';
  reviewedAt: string;
  reviewerId: string;
  reviewerNotes?: string;
}) {
  const { data: updatedApproval, error } = await supabase
    .from('approvals')
    .update({
      status: newStatus,
      reviewed_by_user_id: reviewerId,
      reviewed_at: reviewedAt,
      reviewer_notes: reviewerNotes || null,
    })
    .eq('status', 'PENDING')
    .eq('id', approvalId)
    .select('status')
    .maybeSingle();

  if (error) throw new Error(`Failed to update approval: ${error.message}`);
  return updatedApproval;
}

export async function refreshApprovalStatus(approvalId: string) {
  const { data: latestApproval, error } = await supabase
    .from('approvals')
    .select('status')
    .eq('id', approvalId)
    .maybeSingle();

  if (error) throw new Error(`Failed to refresh approval: ${error.message}`);
  return latestApproval?.status;
}

export async function fetchWorkflowRunStatus(runId: string) {
  const { data: run, error } = await supabase
    .from('workflow_runs')
    .select('status')
    .eq('id', runId)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch workflow run: ${error.message}`);
  if (!run) throw new Error('Workflow run not found');

  return run.status as string;
}

export async function requeueWorkflowRun(runId: string) {
  const { error } = await supabase
    .from('workflow_runs')
    .update({
      status: 'QUEUED',
      execution_owner: null,
      execution_claim_token: null,
      execution_lease_expires_at: null,
      execution_heartbeat_at: null,
    })
    .eq('id', runId);

  if (error) throw new Error(`Failed to requeue workflow run: ${error.message}`);
}

export async function markApprovalStepRejected({
  reviewedAt,
  reviewerNotes,
  runId,
  stepId,
}: {
  reviewedAt: string;
  reviewerNotes?: string;
  runId: string;
  stepId: string;
}) {
  const { error } = await supabase
    .from('run_steps')
    .update({
      status: 'FAILED',
      error_json: {
        code: 'APPROVAL_REJECTED',
        message: 'Approval rejected',
        reviewerNotes,
        timestamp: reviewedAt,
      },
    })
    .eq('workflow_run_id', runId)
    .eq('step_id', stepId);

  if (error) throw new Error(`Failed to update run steps: ${error.message}`);
}

export async function cancelWorkflowRunForRejectedApproval(runId: string, reviewedAt: string) {
  const { error } = await supabase
    .from('workflow_runs')
    .update({
      status: 'CANCELLED',
      cancelled_at: reviewedAt,
      finished_at: reviewedAt,
      execution_owner: null,
      execution_claim_token: null,
      execution_lease_expires_at: null,
      execution_heartbeat_at: null,
    })
    .eq('id', runId);

  if (error) throw new Error(`Failed to update workflow run: ${error.message}`);
}
