import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(fileURLToPath(new URL('..', import.meta.url)));

function loadDotEnv(path) {
  try {
    return Object.fromEntries(
      readFileSync(path, 'utf8')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#') && line.includes('='))
        .map((line) => {
          const index = line.indexOf('=');
          let value = line.slice(index + 1);
          if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          return [line.slice(0, index), value];
        })
    );
  } catch {
    return {};
  }
}

const dotEnv = loadDotEnv(join(rootDir, '.env'));
const env = { ...dotEnv, ...process.env };
const supabaseUrl = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
const pilotUsername = env.PILOT_INSTAGRAM_USERNAME ?? 'pilot_instagram_open_capture';

const pilotDefinition = {
  version: 1,
  meta: {
    key: 'instagram_pilot_open_capture',
    name: 'Instagram Pilot Open Capture',
    description: 'Open Instagram, verify the foreground app, capture screenshot evidence, and record a pilot-safe action event.',
    tags: ['instagram', 'pilot', 'evidence', 'mobile-mcp'],
  },
  inputs: {},
  target: { mode: 'single_device' },
  execution: { defaultTimeoutMs: 30000, maxRetries: 1, onError: 'stop' },
  antiDetection: {
    randomDelayMs: [3000, 8000],
    scrollVariance: true,
    tapJitterPx: 6,
    cooldownBetweenActionsMs: [5000, 12000],
    deviceFingerprint: true,
  },
  steps: [
    { id: 'launch_instagram', type: 'launch_app', params: { appName: 'com.instagram.android' } },
    { id: 'wait_loaded', type: 'wait', params: { ms: 4000 } },
    { id: 'current_app', type: 'get_current_app', params: {} },
    {
      id: 'capture_pilot_evidence',
      type: 'screenshot',
      params: { saveToArtifact: true, actionHistoryType: 'instagram_pilot_open' },
    },
  ],
};

function required(name, value) {
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function getOperatorProfile(supabase) {
  const email = env.UI_SMOKE_EMAIL;
  let query = supabase.from('profiles').select('id,user_id,email,role').in('role', ['OPERATOR', 'ADMIN']).limit(1);
  if (email) query = supabase.from('profiles').select('id,user_id,email,role').eq('email', email).limit(1);
  const { data, error } = await query;
  if (error) throw new Error(`profile lookup failed: ${error.message}`);
  const profile = data?.[0];
  if (!profile) throw new Error('No operator/admin profile found for pilot seeding');
  return profile;
}

async function ensurePilotMacro(supabase, profileId) {
  const existing = await supabase
    .from('macros')
    .select('id,key,name,latest_version_id')
    .eq('key', pilotDefinition.meta.key)
    .maybeSingle();
  if (existing.error) throw new Error(`macro lookup failed: ${existing.error.message}`);
  if (existing.data?.latest_version_id) return { action: 'existing', macro: existing.data };

  const macro = existing.data ?? (await supabase
    .from('macros')
    .insert({
      key: pilotDefinition.meta.key,
      name: pilotDefinition.meta.name,
      description: pilotDefinition.meta.description,
      created_by_user_id: profileId,
    })
    .select('id,key,name,latest_version_id')
    .maybeSingle()).data;

  if (!macro) throw new Error('pilot macro insert returned no row');

  const { data: version, error: versionError } = await supabase
    .from('macro_versions')
    .insert({
      macro_id: macro.id,
      version_number: 1,
      status: 'ACTIVE',
      definition_json: pilotDefinition,
      input_schema_json: pilotDefinition.inputs,
      tags_json: pilotDefinition.meta.tags,
      created_by_user_id: profileId,
    })
    .select('id')
    .maybeSingle();
  if (versionError) throw new Error(`pilot macro version insert failed: ${versionError.message}`);
  if (!version) throw new Error('pilot macro version insert returned no row');

  const { error: updateError } = await supabase
    .from('macros')
    .update({ latest_version_id: version.id })
    .eq('id', macro.id);
  if (updateError) throw new Error(`pilot macro latest version update failed: ${updateError.message}`);

  return { action: existing.data ? 'version-created' : 'created', macro: { ...macro, latest_version_id: version.id } };
}

async function ensurePilotAccount(supabase, userId) {
  const existing = await supabase
    .from('accounts')
    .select('id,username,platform,warm_up_stage,daily_action_limit,current_action_count,is_blocked')
    .eq('username', pilotUsername)
    .eq('platform', 'instagram')
    .maybeSingle();
  if (existing.error) throw new Error(`pilot account lookup failed: ${existing.error.message}`);
  if (existing.data) return { action: 'existing', account: existing.data };

  const { data, error } = await supabase
    .from('accounts')
    .insert({
      user_id: userId,
      username: pilotUsername,
      encrypted_password: 'v2:pilot-placeholder-not-a-real-password',
      platform: 'instagram',
      warm_up_stage: 3,
      daily_action_limit: 10,
      current_action_count: 0,
      is_blocked: false,
    })
    .select('id,username,platform,warm_up_stage,daily_action_limit,current_action_count,is_blocked')
    .maybeSingle();
  if (error) throw new Error(`pilot account insert failed: ${error.message}`);
  if (!data) throw new Error('pilot account insert returned no row');
  return { action: 'created', account: data };
}

async function verifyPilotHistorySchema(supabase, accountId) {
  const { data, error } = await supabase
    .from('account_action_history')
    .insert({
      account_id: accountId,
      action_type: 'instagram_pilot_open',
      source_run_id: null,
      source_step_id: 'schema_probe',
      step_id: null,
      success: true,
    })
    .select('id,account_id,action_type,source_run_id,source_step_id,success')
    .maybeSingle();
  if (error) throw new Error(`pilot history schema probe failed: ${error.message}`);
  if (!data) throw new Error('pilot history schema probe returned no row');

  const cleanup = await supabase.from('account_action_history').delete().eq('id', data.id);
  if (cleanup.error) throw new Error(`pilot history schema probe cleanup failed: ${cleanup.error.message}`);
  return data;
}

async function selectPilotDevice(supabase) {
  const preferredSerial = (dotEnv.MOBILE_MCP_EXPECTED_SERIALS ?? process.env.MOBILE_MCP_EXPECTED_SERIALS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)[0];

  let query = supabase
    .from('devices')
    .select('id,laixi_device_id,name,model,status,heartbeat_freshness')
    .eq('status', 'ONLINE')
    .limit(1);

  if (preferredSerial) {
    query = supabase
      .from('devices')
      .select('id,laixi_device_id,name,model,status,heartbeat_freshness')
      .eq('laixi_device_id', preferredSerial)
      .limit(1);
  }

  const { data, error } = await query;
  if (error) throw new Error(`pilot device lookup failed: ${error.message}`);
  const device = data?.[0];
  if (!device) throw new Error(`No pilot device found${preferredSerial ? ` for serial ${preferredSerial}` : ''}`);
  if (device.status !== 'ONLINE') throw new Error(`Pilot device ${device.laixi_device_id} is ${device.status}`);
  return device;
}

async function createPilotRun(supabase, args) {
  const { data, error } = await supabase
    .from('workflow_runs')
    .insert({
      macro_version_id: args.macroVersionId,
      triggered_by_user_id: args.profileId,
      target_type: 'SINGLE_DEVICE',
      target_selector_json: { target_ids: [args.deviceId] },
      input_variables_json: {
        accountId: args.accountId,
        accountUsername: args.accountUsername,
        accountPlatform: 'instagram',
      },
      status: 'QUEUED',
    })
    .select('id,status,target_type,target_selector_json,input_variables_json')
    .maybeSingle();
  if (error) throw new Error(`pilot run insert failed: ${error.message}`);
  if (!data) throw new Error('pilot run insert returned no row');
  return data;
}

async function waitForTerminalRun(supabase, runId) {
  const terminal = new Set(['COMPLETED', 'FAILED', 'CANCELLED', 'PARTIAL_SUCCESS', 'WAITING_APPROVAL']);
  let latest = null;
  for (let index = 0; index < Number(env.PILOT_RUN_POLLS ?? 90); index++) {
    const { data, error } = await supabase
      .from('workflow_runs')
      .select('id,status,summary_json,started_at,finished_at,updated_at')
      .eq('id', runId)
      .maybeSingle();
    if (error) throw new Error(`pilot run poll failed: ${error.message}`);
    latest = data;
    if (latest && terminal.has(latest.status)) break;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  if (!latest) throw new Error(`pilot run ${runId} disappeared`);
  return latest;
}

async function collectRunEvidence(supabase, runId, accountId) {
  const [stepsResult, artifactsResult, historyResult] = await Promise.all([
    supabase
      .from('run_steps')
      .select('id,step_id,step_type,status,screenshot_artifact_id,error_json,output_json')
      .eq('workflow_run_id', runId)
      .order('step_index', { ascending: true }),
    supabase
      .from('artifacts')
      .select('id,type,storage_key,content_type,size,metadata_json')
      .eq('workflow_run_id', runId),
    supabase
      .from('account_action_history')
      .select('id,account_id,action_type,source_run_id,source_step_id,success,error_message,created_at')
      .eq('account_id', accountId)
      .eq('source_run_id', runId)
      .order('created_at', { ascending: false }),
  ]);

  if (stepsResult.error) throw new Error(`pilot run steps read failed: ${stepsResult.error.message}`);
  if (artifactsResult.error) throw new Error(`pilot run artifacts read failed: ${artifactsResult.error.message}`);
  if (historyResult.error) throw new Error(`pilot run history read failed: ${historyResult.error.message}`);

  return {
    steps: stepsResult.data ?? [],
    artifacts: artifactsResult.data ?? [],
    actionHistory: historyResult.data ?? [],
  };
}

async function main() {
  required('SUPABASE_URL or VITE_SUPABASE_URL', supabaseUrl);
  required('SUPABASE_SERVICE_ROLE_KEY', serviceRoleKey);

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const profile = await getOperatorProfile(supabase);
  const macro = await ensurePilotMacro(supabase, profile.id);
  const account = await ensurePilotAccount(supabase, profile.user_id);
  const schemaProbe = await verifyPilotHistorySchema(supabase, account.account.id);
  const device = await selectPilotDevice(supabase);
  const createdRun = await createPilotRun(supabase, {
    macroVersionId: macro.macro.latest_version_id,
    profileId: profile.id,
    deviceId: device.id,
    accountId: account.account.id,
    accountUsername: account.account.username,
  });
  const terminalRun = await waitForTerminalRun(supabase, createdRun.id);
  const evidence = await collectRunEvidence(supabase, createdRun.id, account.account.id);
  if (terminalRun.status !== 'COMPLETED') {
    throw new Error(`pilot run ${createdRun.id} finished with ${terminalRun.status}: ${JSON.stringify(evidence.steps)}`);
  }
  if (evidence.actionHistory.length === 0) {
    throw new Error(`pilot run ${createdRun.id} completed without instagram_pilot_open action history`);
  }

  console.log(JSON.stringify({
    ok: true,
    operator: { email: profile.email, role: profile.role, userId: profile.user_id },
    macro: { action: macro.action, key: macro.macro.key, id: macro.macro.id, latestVersionId: macro.macro.latest_version_id },
    account: { action: account.action, ...account.account },
    historySchemaProbe: schemaProbe,
    device,
    run: terminalRun,
    evidence: {
      stepCount: evidence.steps.length,
      terminalSteps: evidence.steps.map((step) => ({ id: step.step_id, type: step.step_type, status: step.status })),
      artifactCount: evidence.artifacts.length,
      artifacts: evidence.artifacts.map((artifact) => ({ id: artifact.id, type: artifact.type, size: artifact.size })),
      actionHistoryCount: evidence.actionHistory.length,
      actionHistory: evidence.actionHistory,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
