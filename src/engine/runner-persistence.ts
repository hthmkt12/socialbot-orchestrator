import type { MacroStep } from '../contracts/macro';
import type { RunStepStatus } from '../lib/database.types';
import { supabase } from '../lib/supabase';
import type { StructuredError } from './types';

export async function persistRunnerStepFinal(
  runId: string,
  step: MacroStep,
  deviceId: string,
  stepIndex: number,
  status: RunStepStatus,
  retryCount: number,
  output?: Record<string, unknown>,
  errorPayload?: StructuredError | { code: string; message: string; timestamp: string },
  screenshotArtifactId?: string | null
): Promise<void> {
  const { data: existing } = await supabase
    .from('run_steps')
    .select('id')
    .eq('workflow_run_id', runId)
    .eq('step_id', step.id)
    .eq('device_id', deviceId)
    .maybeSingle();

  const now = new Date().toISOString();
  const isTerminal = ['SUCCESS', 'FAILED', 'CANCELLED', 'SKIPPED'].includes(status);
  const record: Record<string, unknown> = {
    status,
    retry_count: retryCount,
    output_json: output ?? {},
    error_json: errorPayload ?? null,
  };

  if (status === 'RUNNING') record.started_at = now;
  if (isTerminal) record.finished_at = now;
  if (screenshotArtifactId) record.screenshot_artifact_id = screenshotArtifactId;

  if (existing) {
    await supabase.from('run_steps').update(record).eq('id', existing.id);
    return;
  }

  await supabase.from('run_steps').insert({
    workflow_run_id: runId,
    device_id: deviceId,
    step_index: stepIndex,
    step_id: step.id,
    step_type: step.type,
    input_json: step.params as Record<string, unknown>,
    ...record,
  });
}

export async function aggregatePersistedRunResults(runId: string): Promise<{
  totalDevices: number;
  successfulDevices: number;
  failedDevices: number;
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  avgCompletionRate: number;
}> {
  const { data: steps } = await supabase
    .from('run_steps')
    .select('device_id, status')
    .eq('workflow_run_id', runId);

  if (!steps?.length) {
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
    const existing = deviceMap.get(step.device_id) ?? { completed: 0, failed: 0, total: 0 };
    existing.total++;
    if (step.status === 'SUCCESS' || step.status === 'SKIPPED') existing.completed++;
    if (step.status === 'FAILED') existing.failed++;
    deviceMap.set(step.device_id, existing);
  }

  let totalSteps = 0;
  let completedSteps = 0;
  let failedSteps = 0;
  let successfulDevices = 0;
  let failedDevices = 0;

  for (const deviceSummary of deviceMap.values()) {
    totalSteps += deviceSummary.total;
    completedSteps += deviceSummary.completed;
    failedSteps += deviceSummary.failed;
    const allTerminal = deviceSummary.completed + deviceSummary.failed === deviceSummary.total;
    if (allTerminal && deviceSummary.failed === 0) successfulDevices++;
    else if (deviceSummary.failed > 0) failedDevices++;
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
