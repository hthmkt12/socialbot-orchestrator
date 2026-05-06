import { supabase } from '../lib/supabase';
import {
  getRunControlMode,
  isMissingRunControlFunction,
  requestRunControlFromBrowser,
} from '../lib/run-control-fallback';
import type {
  WorkflowRunControlAction,
  WorkflowRunControlResponse,
} from '../../packages/shared/src';

async function requestRunControl(
  runId: string,
  action: WorkflowRunControlAction
): Promise<WorkflowRunControlResponse> {
  const { data, error } = await supabase.functions.invoke('execute-run', {
    body: { runId, action },
  });
  if (error) throw error;

  const payload = data as WorkflowRunControlResponse | null;
  if (!payload?.success || !payload.status || !payload.outcome) {
    throw new Error(payload?.error ?? `Failed to ${action} run`);
  }

  return payload;
}

async function requestRunControlWithFallback(
  runId: string,
  action: WorkflowRunControlAction
): Promise<WorkflowRunControlResponse> {
  const mode = getRunControlMode();
  if (mode === 'browser') {
    return requestRunControlFromBrowser(runId, action);
  }

  try {
    return await requestRunControl(runId, action);
  } catch (error) {
    if (mode === 'edge') throw error;
    if (!isMissingRunControlFunction(error)) throw error;
    return requestRunControlFromBrowser(runId, action);
  }
}

export function requestRunStart(runId: string): Promise<WorkflowRunControlResponse> {
  return requestRunControlWithFallback(runId, 'start');
}

export function requestRunCancel(runId: string): Promise<WorkflowRunControlResponse> {
  return requestRunControlWithFallback(runId, 'cancel');
}
