import type { SupabaseClient } from '@supabase/supabase-js';
import type { MacroDefinition } from '../../../src/contracts/macro';
import type { Device, TargetType } from '../../../src/lib/database.types';

type MultiTargetType = Exclude<TargetType, 'SINGLE_DEVICE'>;

export interface MultiTargetRunContext {
  runId: string;
  claimToken: string;
  targetType: MultiTargetType;
  triggeredByUserId: string;
  inputVariables: Record<string, unknown>;
  devices: Device[];
  definition: MacroDefinition;
  summaryJson: Record<string, unknown>;
  resolvedDeviceIdsPersisted: boolean;
}

interface WorkflowRunRow {
  id: string;
  target_type: TargetType;
  target_selector_json: unknown;
  input_variables_json: unknown;
  triggered_by_user_id: string;
  macro_version_id: string;
  execution_claim_token: string | null;
  summary_json: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function extractDeviceIds(selector: unknown) {
  if (!isRecord(selector)) return [];
  if (typeof selector.deviceId === 'string') return [selector.deviceId];
  if (Array.isArray(selector.deviceIds)) {
    return selector.deviceIds.filter((value): value is string => typeof value === 'string');
  }
  return [];
}

function extractGroupId(selector: unknown) {
  if (!isRecord(selector)) return null;
  return typeof selector.groupId === 'string' ? selector.groupId : null;
}

function readPersistedResolvedDeviceIds(summaryJson: unknown) {
  if (!isRecord(summaryJson)) return [];
  const execution = isRecord(summaryJson.execution) ? summaryJson.execution : null;
  if (!execution || !Array.isArray(execution.resolvedDeviceIds)) return [];
  return execution.resolvedDeviceIds.filter((value): value is string => typeof value === 'string');
}

async function loadDevicesByIds(supabase: SupabaseClient, deviceIds: string[]) {
  if (deviceIds.length === 0) return [];

  const { data, error } = await supabase.from('devices').select('*').in('id', deviceIds);
  if (error) throw new Error(error.message);

  const order = new Map(deviceIds.map((id, index) => [id, index]));
  return ((data ?? []) as Device[]).sort(
    (left, right) => (order.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(right.id) ?? Number.MAX_SAFE_INTEGER)
  );
}

async function loadOnlineGroupDevices(supabase: SupabaseClient, groupId: string) {
  const { data, error } = await supabase
    .from('device_group_members')
    .select('device:devices(*)')
    .eq('device_group_id', groupId);

  if (error) throw new Error(error.message);

  return (data ?? [])
    .flatMap((member) => {
      const device = member.device as unknown;
      return Array.isArray(device) ? device : [device];
    })
    .filter((device): device is Device => isRecord(device) && typeof device.id === 'string' && device.status === 'ONLINE')
    .sort((left, right) => left.name.localeCompare(right.name));
}

async function loadAllOnlineDevices(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('devices')
    .select('*')
    .eq('status', 'ONLINE')
    .order('name', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as Device[];
}

async function loadMacroDefinition(supabase: SupabaseClient, macroVersionId: string) {
  const { data, error } = await supabase
    .from('macro_versions')
    .select('definition_json')
    .eq('id', macroVersionId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error(`Macro version ${macroVersionId} not found`);
  return data.definition_json as unknown as MacroDefinition;
}

async function resolveMultiTargetDevices(
  supabase: SupabaseClient,
  run: WorkflowRunRow
) {
  const persistedIds = readPersistedResolvedDeviceIds(run.summary_json);
  if (persistedIds.length > 0) {
    return {
      devices: await loadDevicesByIds(supabase, persistedIds),
      resolvedDeviceIdsPersisted: true,
    };
  }

  if (run.target_type === 'MULTI_DEVICE') {
    const devices = await loadDevicesByIds(supabase, extractDeviceIds(run.target_selector_json));
    return {
      devices: devices.filter((device) => device.status === 'ONLINE'),
      resolvedDeviceIdsPersisted: false,
    };
  }

  if (run.target_type === 'ALL_DEVICES') {
    const selectedDeviceIds = extractDeviceIds(run.target_selector_json);
    const selectedDevices = selectedDeviceIds.length > 0
      ? await loadDevicesByIds(supabase, selectedDeviceIds)
      : await loadAllOnlineDevices(supabase);
    return {
      devices: selectedDevices.filter((device) => device.status === 'ONLINE'),
      resolvedDeviceIdsPersisted: false,
    };
  }

  if (run.target_type === 'DEVICE_GROUP') {
    const groupId = extractGroupId(run.target_selector_json);
    if (!groupId) throw new Error(`Run ${run.id} is missing a device group target`);
    return {
      devices: await loadOnlineGroupDevices(supabase, groupId),
      resolvedDeviceIdsPersisted: false,
    };
  }

  throw new Error(`Run ${run.id} target ${run.target_type} is not a multi-target execution`);
}

export async function loadMultiTargetRunContext(
  supabase: SupabaseClient,
  runId: string,
  claimToken: string
): Promise<MultiTargetRunContext> {
  const { data, error } = await supabase
    .from('workflow_runs')
    .select('id, target_type, target_selector_json, input_variables_json, triggered_by_user_id, macro_version_id, execution_claim_token, summary_json')
    .eq('id', runId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error(`Run ${runId} not found`);

  const run = data as WorkflowRunRow;
  if (run.target_type === 'SINGLE_DEVICE') throw new Error(`Run ${runId} is not a multi-target run`);
  if (run.execution_claim_token !== claimToken) throw new Error(`Run ${runId} is no longer owned by this worker`);

  const definition = await loadMacroDefinition(supabase, run.macro_version_id);
  const { devices, resolvedDeviceIdsPersisted } = await resolveMultiTargetDevices(supabase, run);
  if (devices.length === 0) throw new Error(`Run ${runId} resolved no online devices`);

  return {
    runId: run.id,
    claimToken,
    targetType: run.target_type,
    triggeredByUserId: run.triggered_by_user_id,
    inputVariables: isRecord(run.input_variables_json) ? run.input_variables_json : {},
    devices,
    definition,
    summaryJson: isRecord(run.summary_json) ? run.summary_json : {},
    resolvedDeviceIdsPersisted,
  };
}
