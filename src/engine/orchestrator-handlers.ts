import { createApprovalRequest } from '../lib/approval-service';
import { supabase } from '../lib/supabase';
import type { CancellationToken } from './types';

const APPROVAL_POLL_INTERVAL_MS = 3_000;
const APPROVAL_TIMEOUT_MS = 24 * 60 * 60 * 1000;

export function buildApprovalHandler(
  runId: string,
  userId: string,
  cancellation: CancellationToken
): (stepId: string, reason: string, stepType?: string) => Promise<boolean> {
  return async (stepId: string, reason: string, stepType?: string): Promise<boolean> => {
    const approval = await createApprovalRequest({
      workflowRunId: runId,
      stepId,
      stepType: stepType ?? 'approval_checkpoint',
      reason,
      requestedById: userId,
    });

    const deadline = Date.now() + APPROVAL_TIMEOUT_MS;

    while (Date.now() < deadline) {
      if (cancellation.cancelled) return false;
      await waitForApprovalPoll(cancellation);
      if (cancellation.cancelled) return false;

      const { data } = await supabase
        .from('approvals')
        .select('status')
        .eq('id', approval.id)
        .maybeSingle();

      if (!data) return false;
      if (data.status === 'APPROVED') return true;
      if (data.status === 'REJECTED' || data.status === 'EXPIRED') return false;
    }

    await supabase.from('approvals').update({ status: 'EXPIRED' }).eq('id', approval.id);
    return false;
  };
}

export function buildScreenshotHandler(runId: string, deviceId: string) {
  return async (stepId: string, base64: string): Promise<string | null> => {
    const { data: artifact } = await supabase
      .from('artifacts')
      .insert({
        workflow_run_id: runId,
        device_id: deviceId,
        type: 'SCREENSHOT',
        storage_key: `screenshots/${runId}/${deviceId}/${stepId}_${Date.now()}.png`,
        content_type: 'image/png',
        size: base64.length,
        metadata_json: { stepId, encoding: 'base64', timestamp: new Date().toISOString() },
      })
      .select('id')
      .maybeSingle();

    return artifact?.id ?? null;
  };
}

async function waitForApprovalPoll(cancellation: CancellationToken): Promise<void> {
  const sleepEnd = Date.now() + APPROVAL_POLL_INTERVAL_MS;
  while (Date.now() < sleepEnd) {
    if (cancellation.cancelled) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}
