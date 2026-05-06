import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SAMPLE_MACROS, type MacroDefinition } from '../../../../src/contracts/macro';
import type { Device, Profile } from '../../../../src/lib/database.types';
import { buildClaimSummary } from '../run-claim-summary';
import { adbGetProp, LOG_PREFIX } from './mobile-mcp-db-smoke-env';

const MACRO_KEY = 'mobile_mcp_db_multi_smoke';

export async function loadSmokeProfile(supabase: SupabaseClient) {
  const { data, error } = await supabase.from('profiles').select('id, email, role').order('created_at').limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return createSmokeProfile(supabase);
  return data as Pick<Profile, 'id' | 'email' | 'role'>;
}

async function createSmokeProfile(supabase: SupabaseClient) {
  const email = `mobile-mcp-smoke-${Date.now()}@example.invalid`;
  const { data: created, error } = await supabase.auth.admin.createUser({
    email,
    password: `${randomUUID()}${randomUUID()}`,
    email_confirm: true,
  });
  if (error) throw new Error(`Failed to create smoke auth user: ${error.message}`);
  const userId = created.user?.id;
  if (!userId) throw new Error('Smoke auth user was created without an id');

  for (let attempt = 0; attempt < 10; attempt++) {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, role')
      .eq('user_id', userId)
      .maybeSingle();
    if (profileError) throw new Error(profileError.message);
    if (profile) return profile as Pick<Profile, 'id' | 'email' | 'role'>;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  throw new Error('Smoke profile trigger did not create a profile row');
}

export async function upsertSmokeDevice(supabase: SupabaseClient, serial: string, index: number) {
  const [model, brand, androidVersion] = await Promise.all([
    adbGetProp(serial, 'ro.product.model'),
    adbGetProp(serial, 'ro.product.brand'),
    adbGetProp(serial, 'ro.build.version.release'),
  ]);
  const { data, error } = await supabase
    .from('devices')
    .upsert({
      laixi_device_id: serial,
      name: `Mobile MCP ${index + 1} ${model || serial}`,
      model: model || 'Android',
      brand: brand || 'Android',
      android_version: androidVersion || '',
      screen_width: Number(process.env.MOBILE_MCP_SCREEN_WIDTH ?? 720),
      screen_height: Number(process.env.MOBILE_MCP_SCREEN_HEIGHT ?? 1600),
      status: 'ONLINE',
      last_seen_at: new Date().toISOString(),
      heartbeat_freshness: 'fresh',
      last_error_message: null,
      last_error_at: null,
      metadata_json: { source: 'mobile-mcp-db-multi-smoke' },
    }, { onConflict: 'laixi_device_id' })
    .select('*')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`Failed to upsert device ${serial}`);
  return data as Device;
}

export async function ensureSmokeMacroVersion(supabase: SupabaseClient, profileId: string) {
  const existing = await supabase.from('macros').select('id, latest_version_id').eq('key', MACRO_KEY).maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data?.latest_version_id) return existing.data.latest_version_id as string;

  const definition = makeDefinition();
  const macroId = existing.data?.id ?? await insertMacro(supabase, profileId, definition);
  const { data: version, error: versionError } = await supabase
    .from('macro_versions')
    .insert({
      macro_id: macroId,
      version_number: 1,
      status: 'ACTIVE',
      definition_json: definition as unknown as Record<string, unknown>,
      input_schema_json: definition.inputs,
      tags_json: definition.meta.tags ?? [],
      created_by_user_id: profileId,
    })
    .select('id')
    .maybeSingle();
  if (versionError) throw new Error(versionError.message);
  if (!version?.id) throw new Error('Failed to insert smoke macro version');

  const { error: updateError } = await supabase.from('macros').update({ latest_version_id: version.id }).eq('id', macroId);
  if (updateError) throw new Error(updateError.message);
  return version.id as string;
}

export async function createQueuedRun(supabase: SupabaseClient, macroVersionId: string, profileId: string, devices: Device[]) {
  const targetType = devices.length === 1 ? 'SINGLE_DEVICE' : 'MULTI_DEVICE';
  const { data, error } = await supabase
    .from('workflow_runs')
    .insert({
      macro_version_id: macroVersionId,
      triggered_by_user_id: profileId,
      target_type: targetType,
      target_selector_json: { deviceIds: devices.map((device) => device.id) },
      input_variables_json: { appName: 'com.android.settings' },
      status: 'QUEUED',
      summary_json: { source: 'mobile-mcp-db-multi-smoke', targetType, serials: devices.map((device) => device.laixi_device_id) },
    })
    .select('id')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error('Failed to create workflow run');
  return data.id as string;
}

export async function claimRun(supabase: SupabaseClient, instanceId: string, runId: string) {
  const claimToken = randomUUID();
  const claimedAt = new Date().toISOString();
  const leaseExpiresAt = new Date(Date.now() + 30_000).toISOString();
  const { data, error } = await supabase
    .from('workflow_runs')
    .update({
      execution_owner: instanceId,
      execution_claim_token: claimToken,
      execution_lease_expires_at: leaseExpiresAt,
      execution_heartbeat_at: claimedAt,
      summary_json: buildClaimSummary(null, instanceId, claimToken, claimedAt, claimedAt, leaseExpiresAt, 'QUEUED', false),
    })
    .eq('id', runId)
    .eq('status', 'QUEUED')
    .select('id')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`Failed to claim run ${runId}`);
  return claimToken;
}

export async function assertRunCompleted(supabase: SupabaseClient, runId: string, devices: Device[]) {
  const [runResult, stepsResult, artifactsResult] = await Promise.all([
    supabase.from('workflow_runs').select('status, summary_json').eq('id', runId).maybeSingle(),
    supabase.from('run_steps').select('device_id, step_id, status, screenshot_artifact_id').eq('workflow_run_id', runId),
    supabase.from('artifacts').select('id, device_id, type').eq('workflow_run_id', runId),
  ]);
  if (runResult.error) throw new Error(runResult.error.message);
  if (stepsResult.error) throw new Error(stepsResult.error.message);
  if (artifactsResult.error) throw new Error(artifactsResult.error.message);
  if (runResult.data?.status !== 'COMPLETED') throw new Error(`Run ${runId} ended as ${runResult.data?.status}`);

  const steps = stepsResult.data ?? [];
  const artifacts = artifactsResult.data ?? [];
  const failed = steps.filter((step) => step.status !== 'SUCCESS');
  const screenshotArtifacts = artifacts.filter((artifact) => artifact.type === 'SCREENSHOT');
  if (failed.length > 0) throw new Error(`Run ${runId} has non-success steps: ${JSON.stringify(failed)}`);
  if (screenshotArtifacts.length < devices.length) throw new Error(`Expected screenshots for ${devices.length} devices, got ${screenshotArtifacts.length}`);

  console.log(`${LOG_PREFIX} PASS run=${runId} status=COMPLETED steps=${steps.length} screenshots=${screenshotArtifacts.length}`);
}

async function insertMacro(supabase: SupabaseClient, profileId: string, definition: MacroDefinition) {
  const { data, error } = await supabase
    .from('macros')
    .insert({
      key: MACRO_KEY,
      name: definition.meta.name,
      description: definition.meta.description ?? '',
      created_by_user_id: profileId,
    })
    .select('id')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error('Failed to insert smoke macro');
  return data.id as string;
}

function makeDefinition(): MacroDefinition {
  const sample = SAMPLE_MACROS.find((macro) => macro.meta.key === 'multi_device_launch_check');
  if (!sample) throw new Error('Sample multi_device_launch_check macro not found');
  return { ...sample, meta: { ...sample.meta, key: MACRO_KEY, name: 'Mobile MCP DB Multi Smoke' } };
}
