import type { SupabaseClient } from '@supabase/supabase-js';
import type { MacroDefinition } from '../../../src/contracts/macro';
import type { Device } from '../../../src/lib/database.types';

export interface SingleDeviceRunContext {
  runId: string;
  claimToken: string;
  triggeredByUserId: string;
  inputVariables: Record<string, unknown>;
  device: Device;
  definition: MacroDefinition;
  summaryJson: Record<string, unknown>;
}

export interface StepApprovalRecord {
  id: string;
  status: string;
  reviewerNotes: string | null;
}

interface ArtifactRecordInput {
  workflow_run_id: string;
  device_id: string;
  type: 'SCREENSHOT' | 'LOG_BLOB' | 'SCRIPT_FILE' | 'JSON_RESULT';
  storage_key: string;
  content_type: string;
  size: number;
  metadata_json: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function extractTargetDeviceId(targetSelector: unknown) {
  if (!isRecord(targetSelector)) return null;
  if (typeof targetSelector.deviceId === 'string') return targetSelector.deviceId;
  if (Array.isArray(targetSelector.deviceIds) && typeof targetSelector.deviceIds[0] === 'string') {
    return targetSelector.deviceIds[0];
  }
  return null;
}

function mergeSummary(summaryJson: unknown, patch: Record<string, unknown>) {
  const summary = isRecord(summaryJson) ? summaryJson : {};
  return { ...summary, ...patch };
}

async function createArtifactRecord(
  supabase: SupabaseClient,
  artifact: ArtifactRecordInput
) {
  const { data, error } = await supabase
    .from('artifacts')
    .insert(artifact)
    .select('id')
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id ?? null;
}

export async function loadSingleDeviceRunContext(
  supabase: SupabaseClient,
  runId: string,
  claimToken: string
): Promise<SingleDeviceRunContext> {
  const { data: run, error } = await supabase
    .from('workflow_runs')
    .select('id, target_type, target_selector_json, input_variables_json, triggered_by_user_id, macro_version_id, execution_claim_token, summary_json')
    .eq('id', runId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!run) throw new Error(`Run ${runId} not found`);
  if (run.target_type !== 'SINGLE_DEVICE') throw new Error(`Run ${runId} target ${run.target_type} is not supported yet`);
  if (run.execution_claim_token !== claimToken) throw new Error(`Run ${runId} is no longer owned by this worker`);

  const deviceId = extractTargetDeviceId(run.target_selector_json);
  if (!deviceId) throw new Error(`Run ${runId} is missing a single-device target`);

  const { data: device, error: deviceError } = await supabase.from('devices').select('*').eq('id', deviceId).maybeSingle();
  if (deviceError) throw new Error(deviceError.message);
  if (!device) throw new Error(`Device ${deviceId} not found`);

  const { data: macroVersion, error: macroError } = await supabase
    .from('macro_versions')
    .select('definition_json')
    .eq('id', run.macro_version_id)
    .maybeSingle();
  if (macroError) throw new Error(macroError.message);
  if (!macroVersion) throw new Error(`Macro version ${run.macro_version_id} not found`);

  return {
    runId: run.id,
    claimToken,
    triggeredByUserId: run.triggered_by_user_id,
    inputVariables: isRecord(run.input_variables_json) ? run.input_variables_json : {},
    device: device as Device,
    definition: macroVersion.definition_json as unknown as MacroDefinition,
    summaryJson: isRecord(run.summary_json) ? run.summary_json : {},
  };
}

export async function markOwnedRunStatus(
  supabase: SupabaseClient,
  runId: string,
  claimToken: string,
  status: string
) {
  const updates: Record<string, unknown> = { status };
  if (status === 'RUNNING') {
    const { data, error } = await supabase.from('workflow_runs').select('started_at').eq('id', runId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data?.started_at) updates.started_at = new Date().toISOString();
  }
  const { error } = await supabase
    .from('workflow_runs')
    .update(updates)
    .eq('id', runId)
    .eq('execution_claim_token', claimToken);
  if (error) throw new Error(error.message);
}

export async function isRunCancelled(
  supabase: SupabaseClient,
  runId: string,
  claimToken: string
) {
  const { data, error } = await supabase
    .from('workflow_runs')
    .select('status, execution_claim_token')
    .eq('id', runId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return true;
  return data.status === 'CANCELLED' || data.execution_claim_token !== claimToken;
}

export async function createApprovalRequest(
  supabase: SupabaseClient,
  runId: string,
  requestedByUserId: string,
  stepId: string,
  stepType: string,
  reason: string
) {
  const { data, error } = await supabase
    .from('approvals')
    .insert({
      workflow_run_id: runId,
      requested_by_user_id: requestedByUserId,
      step_id: stepId,
      step_type: stepType,
      reason,
      status: 'PENDING',
      metadata: {},
    })
    .select('id')
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id ?? null;
}

export async function readApprovalStatus(supabase: SupabaseClient, approvalId: string) {
  const { data, error } = await supabase.from('approvals').select('status').eq('id', approvalId).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.status ?? null;
}

export async function loadLatestApprovalForStep(
  supabase: SupabaseClient,
  runId: string,
  stepId: string
): Promise<StepApprovalRecord | null> {
  const { data, error } = await supabase
    .from('approvals')
    .select('id, status, reviewer_notes, created_at')
    .eq('workflow_run_id', runId)
    .eq('step_id', stepId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    id: data.id,
    status: data.status,
    reviewerNotes: data.reviewer_notes ?? null,
  };
}

export async function createScreenshotArtifact(
  supabase: SupabaseClient,
  runId: string,
  deviceId: string,
  stepId: string,
  base64: string
) {
  return createArtifactRecord(supabase, {
    workflow_run_id: runId,
    device_id: deviceId,
    type: 'SCREENSHOT',
    storage_key: `screenshots/${runId}/${deviceId}/${stepId}_${Date.now()}.png`,
    content_type: 'image/png',
    size: base64.length,
    metadata_json: {
      stepId,
      encoding: 'base64',
      base64,
      timestamp: new Date().toISOString(),
    },
  });
}

export async function createLogArtifact(
  supabase: SupabaseClient,
  runId: string,
  deviceId: string,
  stepId: string,
  text: string,
  metadata: Record<string, unknown> = {}
) {
  return createArtifactRecord(supabase, {
    workflow_run_id: runId,
    device_id: deviceId,
    type: 'LOG_BLOB',
    storage_key: `logs/${runId}/${deviceId}/${stepId}_${Date.now()}.txt`,
    content_type: 'text/plain',
    size: text.length,
    metadata_json: {
      stepId,
      text,
      timestamp: new Date().toISOString(),
      ...metadata,
    },
  });
}

export async function finalizeOwnedRun(
  supabase: SupabaseClient,
  runId: string,
  claimToken: string,
  status: 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'WAITING_APPROVAL' | 'PARTIAL_SUCCESS',
  summaryPatch: Record<string, unknown>
) {
  const { data: current, error: fetchError } = await supabase
    .from('workflow_runs')
    .select('summary_json')
    .eq('id', runId)
    .maybeSingle();
  if (fetchError) throw new Error(fetchError.message);

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = {
    status,
    summary_json: mergeSummary(current?.summary_json, summaryPatch),
  };

  if (status === 'WAITING_APPROVAL') {
    updates.execution_owner = null;
    updates.execution_claim_token = null;
    updates.execution_lease_expires_at = null;
    updates.execution_heartbeat_at = null;
  } else {
    updates.finished_at = now;
    updates.execution_owner = null;
    updates.execution_claim_token = null;
    updates.execution_lease_expires_at = null;
    updates.execution_heartbeat_at = null;
    if (status === 'CANCELLED') updates.cancelled_at = now;
  }

  const { error } = await supabase
    .from('workflow_runs')
    .update(updates)
    .eq('id', runId)
    .eq('execution_claim_token', claimToken);
  if (error) throw new Error(error.message);
}
