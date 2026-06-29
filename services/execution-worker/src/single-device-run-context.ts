import type { SupabaseClient } from '@supabase/supabase-js';
import type { Device, MacroDefinition } from '../../../packages/shared/src';

interface SingleTargetRunContext {
  runId: string;
  claimToken: string;
  device: Device;
  macroDefinition: MacroDefinition;
}

export async function loadSingleDeviceRunContext(
  supabase: SupabaseClient,
  runId: string,
  claimToken: string
): Promise<SingleTargetRunContext> {
  const { data: run, error: runError } = await supabase
    .from('workflow_runs')
    .select('macro_version_id, target_selector_json')
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
    const selector = run.target_selector_json as any;
    targetDeviceId = selector?.target_ids?.[0];
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

  return {
    runId,
    claimToken,
    device: device as unknown as Device,
    macroDefinition: definition.definition_json as unknown as MacroDefinition,
  };
}
