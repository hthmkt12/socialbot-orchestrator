import type { SupabaseClient } from '@supabase/supabase-js';
import type { Device, MacroDefinition } from '../../../packages/shared/src';
import { normalizeRetryBackoffPolicy, type RetryBackoffPolicy } from './retry-backoff-policy.js';

interface SingleTargetRunContext {
  runId: string;
  claimToken: string;
  triggeredByUserId: string;
  inputVariables: Record<string, unknown>;
  device: Device;
  macroDefinition: MacroDefinition;
  retryBackoffPolicy: RetryBackoffPolicy;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function loadSingleDeviceRunContext(
  supabase: SupabaseClient,
  runId: string,
  claimToken: string
): Promise<SingleTargetRunContext> {
  const { data: run, error: runError } = await supabase
    .from('workflow_runs')
    .select('macro_version_id, target_selector_json, triggered_by_user_id, input_variables_json, execution_profile_id')
    .eq('id', runId)
    .eq('execution_claim_token', claimToken)
    .maybeSingle();

  if (runError || !run) {
    throw new Error(`Failed to load run ${runId}: ${runError?.message ?? 'Not found'}`);
  }

  const { data: definition, error: defError } = await supabase
    .from('macro_versions')
    .select('definition_json')
    .eq('id', run.macro_version_id)
    .maybeSingle();

  if (defError || !definition) {
    throw new Error(`Failed to load macro definition for run ${runId}`);
  }

  let targetDeviceId: string;
  try {
    const selector = run.target_selector_json as Record<string, unknown> | null;
    targetDeviceId = (selector as { target_ids?: string[] } | null)?.target_ids?.[0];
    if (!targetDeviceId) throw new Error();
  } catch {
    throw new Error(`Run ${runId} has invalid or missing single device selector`);
  }

  const { data: device, error: devError } = await supabase
    .from('devices')
    .select('*')
    .eq('id', targetDeviceId)
    .maybeSingle();

  if (devError || !device) {
    throw new Error(`Device ${targetDeviceId} not found for run ${runId}`);
  }

  let macroDefinition = definition.definition_json as unknown as MacroDefinition;
  let retryBackoffPolicy = normalizeRetryBackoffPolicy({
    maxRetries: macroDefinition.execution.maxRetries,
  });

  if (run.execution_profile_id) {
    const { data: executionProfile, error: profileError } = await supabase
      .from('execution_profiles')
      .select('default_timeout_ms, max_retries, retry_base_delay_ms, retry_max_delay_ms, retry_max_elapsed_ms')
      .eq('id', run.execution_profile_id)
      .maybeSingle();

    if (profileError) {
      throw new Error(`Failed to load execution profile for run ${runId}: ${profileError.message}`);
    }

    if (executionProfile) {
      macroDefinition = {
        ...macroDefinition,
        execution: {
          ...macroDefinition.execution,
          defaultTimeoutMs: executionProfile.default_timeout_ms ?? macroDefinition.execution.defaultTimeoutMs,
          maxRetries: executionProfile.max_retries ?? macroDefinition.execution.maxRetries,
        },
      };
      retryBackoffPolicy = normalizeRetryBackoffPolicy({
        maxRetries: executionProfile.max_retries ?? macroDefinition.execution.maxRetries,
        baseDelayMs: executionProfile.retry_base_delay_ms ?? 1000,
        maxDelayMs: executionProfile.retry_max_delay_ms ?? 30000,
        maxElapsedMs: executionProfile.retry_max_elapsed_ms ?? 120000,
      });
    }
  }

  return {
    runId,
    claimToken,
    triggeredByUserId: run.triggered_by_user_id,
    inputVariables: isRecord(run.input_variables_json) ? run.input_variables_json : {},
    device: device as unknown as Device,
    macroDefinition,
    retryBackoffPolicy,
  };
}
