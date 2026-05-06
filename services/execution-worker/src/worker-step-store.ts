import type { SupabaseClient } from '@supabase/supabase-js';
import type { MacroStep } from '../../../src/contracts/macro';
import type { RunStepStatus } from '../../../src/lib/database.types';

interface StepErrorPayload {
  code: string;
  message: string;
  timestamp?: string;
  [key: string]: unknown;
}

interface PersistStepParams {
  runId: string;
  step: MacroStep;
  deviceId: string;
  stepIndex: number;
  status: RunStepStatus;
  retryCount: number;
  output?: Record<string, unknown>;
  errorPayload?: StepErrorPayload | null;
  screenshotArtifactId?: string | null;
}

export interface StoredRunStepRecord {
  stepId: string;
  status: RunStepStatus;
  output: Record<string, unknown>;
  retryCount: number;
}

export async function persistRunStep(
  supabase: SupabaseClient,
  params: PersistStepParams
) {
  const { data: existing, error: lookupError } = await supabase
    .from('run_steps')
    .select('id')
    .eq('workflow_run_id', params.runId)
    .eq('step_id', params.step.id)
    .eq('device_id', params.deviceId)
    .maybeSingle();

  if (lookupError) throw new Error(lookupError.message);

  const now = new Date().toISOString();
  const isTerminal = ['SUCCESS', 'FAILED', 'CANCELLED', 'SKIPPED'].includes(params.status);
  const record: Record<string, unknown> = {
    status: params.status,
    retry_count: params.retryCount,
    output_json: params.output ?? {},
    error_json: params.errorPayload ?? null,
  };

  if (params.status === 'RUNNING') record.started_at = now;
  if (isTerminal) record.finished_at = now;
  if (params.screenshotArtifactId) record.screenshot_artifact_id = params.screenshotArtifactId;

  if (existing) {
    const { error } = await supabase.from('run_steps').update(record).eq('id', existing.id);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabase.from('run_steps').insert({
    workflow_run_id: params.runId,
    device_id: params.deviceId,
    step_index: params.stepIndex,
    step_id: params.step.id,
    step_type: params.step.type,
    input_json: params.step.params as Record<string, unknown>,
    ...record,
  });

  if (error) throw new Error(error.message);
}

export async function loadPersistedRunSteps(
  supabase: SupabaseClient,
  runId: string,
  deviceId: string
) {
  const { data, error } = await supabase
    .from('run_steps')
    .select('step_id, status, output_json, retry_count')
    .eq('workflow_run_id', runId)
    .eq('device_id', deviceId);

  if (error) throw new Error(error.message);

  return (data ?? []).reduce<Map<string, StoredRunStepRecord>>((records, step) => {
    records.set(step.step_id, {
      stepId: step.step_id,
      status: step.status,
      output: typeof step.output_json === 'object' && step.output_json !== null && !Array.isArray(step.output_json)
        ? (step.output_json as Record<string, unknown>)
        : {},
      retryCount: step.retry_count ?? 0,
    });
    return records;
  }, new Map());
}

export async function aggregateRunResults(supabase: SupabaseClient, runId: string) {
  const { data: steps, error } = await supabase
    .from('run_steps')
    .select('device_id, status')
    .eq('workflow_run_id', runId);

  if (error) throw new Error(error.message);
  if (!steps || steps.length === 0) {
    return {
      totalDevices: 0,
      successfulDevices: 0,
      failedDevices: 0,
      totalSteps: 0,
      completedSteps: 0,
      failedSteps: 0,
      avgCompletionRate: 0,
    };
  }

  const deviceMap = new Map<string, { completed: number; failed: number; total: number }>();
  for (const step of steps) {
    const current = deviceMap.get(step.device_id) ?? { completed: 0, failed: 0, total: 0 };
    current.total += 1;
    if (step.status === 'SUCCESS' || step.status === 'SKIPPED') current.completed += 1;
    if (step.status === 'FAILED') current.failed += 1;
    deviceMap.set(step.device_id, current);
  }

  let successfulDevices = 0;
  let failedDevices = 0;
  let completedSteps = 0;
  let failedSteps = 0;
  let totalSteps = 0;

  for (const data of deviceMap.values()) {
    totalSteps += data.total;
    completedSteps += data.completed;
    failedSteps += data.failed;
    if (data.failed === 0 && data.completed === data.total) successfulDevices += 1;
    if (data.failed > 0) failedDevices += 1;
  }

  return {
    totalDevices: deviceMap.size,
    successfulDevices,
    failedDevices,
    totalSteps,
    completedSteps,
    failedSteps,
    avgCompletionRate: totalSteps > 0 ? completedSteps / totalSteps : 0,
  };
}
