import {
  handleCancelControlAction,
  handleStartControlAction,
  type ControlRunRecord,
  type RunControlAction,
  type WorkflowRunControlStore,
} from '../../packages/shared/src';
import { supabase } from './supabase';

export type RunControlMode = 'auto' | 'edge' | 'browser';

function assertNoError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function toControlRunRecord(data: { id: string; status: string; summary_json: unknown } | null) {
  if (!data) return null;
  return {
    id: data.id,
    status: data.status,
    summaryJson: (data.summary_json as Record<string, unknown> | null) ?? null,
  } satisfies ControlRunRecord;
}

export function isMissingRunControlFunction(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /function.*not.*found|failed to send|404|non-2xx|edge function/i.test(message);
}

export function getRunControlMode(): RunControlMode {
  const mode = import.meta.env.VITE_RUN_CONTROL_MODE;
  return mode === 'edge' || mode === 'browser' ? mode : 'auto';
}

function createBrowserControlStore(): WorkflowRunControlStore {
  return {
    async getRun(runId) {
      const { data, error } = await supabase
        .from('workflow_runs')
        .select('id, status, summary_json')
        .eq('id', runId)
        .maybeSingle();
      assertNoError(error);
      return toControlRunRecord(data);
    },
    async queuePendingRun(runId, summaryJson) {
      const { data, error } = await supabase
        .from('workflow_runs')
        .update({ status: 'QUEUED', summary_json: summaryJson })
        .eq('id', runId)
        .eq('status', 'PENDING')
        .select('id, status, summary_json')
        .maybeSingle();
      assertNoError(error);
      return toControlRunRecord(data);
    },
    async updateRunSummary(runId, summaryJson) {
      const { error } = await supabase
        .from('workflow_runs')
        .update({ summary_json: summaryJson })
        .eq('id', runId);
      assertNoError(error);
    },
    async cancelActiveRun(runId, now, summaryJson) {
      const { data, error } = await supabase
        .from('workflow_runs')
        .update({
          status: 'CANCELLED',
          cancelled_at: now,
          finished_at: now,
          execution_owner: null,
          execution_claim_token: null,
          execution_lease_expires_at: null,
          execution_heartbeat_at: null,
          summary_json: summaryJson,
        })
        .eq('id', runId)
        .in('status', ['PENDING', 'QUEUED', 'RUNNING', 'WAITING_APPROVAL'])
        .select('id, status, summary_json')
        .maybeSingle();
      assertNoError(error);
      return toControlRunRecord(data);
    },
    async cleanupCancelledRun(runId, now) {
      const { data: pending, error: pendingError } = await supabase
        .from('run_steps')
        .select('id')
        .eq('workflow_run_id', runId)
        .in('status', ['PENDING', 'RUNNING', 'RETRYING', 'WAITING_APPROVAL']);
      assertNoError(pendingError);

      const ids = (pending ?? []).map((row) => row.id);
      if (ids.length > 0) {
        const { error } = await supabase
          .from('run_steps')
          .update({ status: 'CANCELLED', finished_at: now })
          .in('id', ids);
        assertNoError(error);
      }

      const { error: lockError } = await supabase.from('device_locks').delete().eq('workflow_run_id', runId);
      assertNoError(lockError);
      const { error: approvalError } = await supabase
        .from('approvals')
        .update({ status: 'EXPIRED' })
        .eq('workflow_run_id', runId)
        .eq('status', 'PENDING');
      assertNoError(approvalError);
    },
  };
}

export async function requestRunControlFromBrowser(runId: string, action: RunControlAction) {
  const store = createBrowserControlStore();
  const run = await store.getRun(runId);
  if (!run) throw new Error('Run not found');
  return action === 'start'
    ? handleStartControlAction(store, run)
    : handleCancelControlAction(store, run);
}
