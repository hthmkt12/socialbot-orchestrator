import { createClient } from '@supabase/supabase-js';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(fileURLToPath(new URL('..', import.meta.url)));
const reportDir = join(rootDir, 'plans', 'reports');

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
const env = { ...process.env, ...dotEnv };
const supabaseUrl = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
const bridgeUrl = env.MOBILE_MCP_BRIDGE_URL ?? env.VITE_MOBILE_MCP_BRIDGE_URL ?? 'http://127.0.0.1:4321';
const workerUrl = env.VITE_WORKER_BASE_URL ?? 'http://127.0.0.1:4310';
const bridgeToken = env.MOBILE_MCP_BRIDGE_TOKEN;
const pilotAppName = env.PILOT_APP_PACKAGE ?? env.UI_SMOKE_APP_NAME ?? 'com.android.settings';

const multiactionMacroDefinition = {
  version: 1,
  meta: {
    key: 'social_pilot_level4_warmup_flow',
    name: 'Social Pilot Level 4 Multi-action Warm-up Flow',
    description: 'Level 4 Social Pilot: multi-action warm-up combining navigation, natural gestures, budgeted interactions, and dual screenshot evidence.',
    tags: ['social-pilot', 'level-4', 'warmup-flow', 'multi-gesture', 'budgeted-action', 'mobile-mcp'],
  },
  inputs: {
    accountId: { type: 'string', required: true },
    appName: { type: 'string', required: true },
  },
  target: { mode: 'single_device' },
  execution: { defaultTimeoutMs: 60000, maxRetries: 0, onError: 'stop' },
  antiDetection: {
    randomDelayMs: [1500, 3000],
    scrollVariance: true,
    tapJitterPx: 5,
    cooldownBetweenActionsMs: [2000, 4000],
    deviceFingerprint: true,
  },
  steps: [
    { id: 'launch_target_app', type: 'launch_app', params: { appName: '{{appName}}' } },
    { id: 'wait_initial_render', type: 'wait', params: { ms: 2500 } },
    { id: 'verify_app_foreground_initial', type: 'get_current_app', params: {} },
    { id: 'capture_baseline_evidence', type: 'screenshot', params: { saveToArtifact: true, actionHistoryType: 'warmup_open' } },
    { id: 'scroll_feed_gesture_1', type: 'swipe', params: { fromX: 0.5, fromY: 0.72, toX: 0.5, toY: 0.35, durationMs: 680 } },
    { id: 'wait_content_inspection', type: 'wait', params: { ms: 2000 } },
    {
      id: 'interact_budgeted_like',
      type: 'tap',
      params: {
        x: 0.5,
        y: 0.45,
        actionBudgetType: 'like',
        actionHistoryType: 'like',
      },
    },
    { id: 'wait_post_interaction', type: 'wait', params: { ms: 1500 } },
    { id: 'scroll_feed_gesture_2', type: 'swipe', params: { fromX: 0.48, fromY: 0.68, toX: 0.52, toY: 0.32, durationMs: 710 } },
    { id: 'wait_final_stabilization', type: 'wait', params: { ms: 1500 } },
    { id: 'capture_post_warmup_evidence', type: 'screenshot', params: { saveToArtifact: true, actionHistoryType: 'warmup_complete' } },
    { id: 'verify_app_foreground_final', type: 'get_current_app', params: {} },
  ],
};

function parseCsv(value) {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

async function fetchJson(url) {
  const headers = bridgeToken && url.startsWith(bridgeUrl) ? { 'x-bridge-token': bridgeToken } : {};
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(5000) });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { ok: response.ok, status: response.status, body };
}

async function checkRuntimeHealth() {
  const bridge = await fetchJson(`${bridgeUrl}/health`);
  const worker = await fetchJson(`${workerUrl}/health`);
  return bridge.ok && worker.ok;
}

async function selectPilotDevice(supabase) {
  const preferredSerial = parseCsv(dotEnv.MOBILE_MCP_EXPECTED_SERIALS ?? process.env.MOBILE_MCP_EXPECTED_SERIALS)[0];
  let query = supabase.from('devices').select('id,laixi_device_id,model,status').eq('status', 'ONLINE');
  if (preferredSerial) {
    query = query.eq('laixi_device_id', preferredSerial);
  }
  const { data, error } = await query.limit(1).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('No online pilot device found');
  return data;
}

async function ensureMultiactionMacro(supabase, profileId) {
  const { data: existingMacro } = await supabase
    .from('macros')
    .select('id,latest_version_id')
    .eq('key', multiactionMacroDefinition.meta.key)
    .maybeSingle();

  let macroId = existingMacro?.id;
  if (!macroId) {
    const { data: createdMacro, error } = await supabase
      .from('macros')
      .insert({
        key: multiactionMacroDefinition.meta.key,
        name: multiactionMacroDefinition.meta.name,
        description: multiactionMacroDefinition.meta.description,
        created_by_user_id: profileId,
      })
      .select('id')
      .single();
    if (error) throw error;
    macroId = createdMacro.id;
  }

  const { data: versions, error: vError } = await supabase
    .from('macro_versions')
    .select('id,version_number')
    .eq('macro_id', macroId)
    .order('version_number', { ascending: false })
    .limit(1);
  if (vError) throw vError;

  const nextVersionNumber = (versions?.[0]?.version_number ?? 0) + 1;
  const { data: createdVersion, error: versionError } = await supabase
    .from('macro_versions')
    .insert({
      macro_id: macroId,
      version_number: nextVersionNumber,
      status: 'ACTIVE',
      definition_json: multiactionMacroDefinition,
      input_schema_json: multiactionMacroDefinition.inputs,
      tags_json: multiactionMacroDefinition.meta.tags,
      created_by_user_id: profileId,
    })
    .select('id')
    .single();
  if (versionError) throw versionError;

  await supabase.from('macros').update({ latest_version_id: createdVersion.id }).eq('id', macroId);
  return { macroId, versionId: createdVersion.id };
}

async function ensurePilotAccount(supabase, userId, dailyLimit = 5) {
  const username = `pilot_warmup_${Date.now()}`;
  const { data: account, error } = await supabase
    .from('accounts')
    .insert({
      user_id: userId,
      username,
      encrypted_password: 'v2:placeholder-warmup-flow',
      platform: 'instagram',
      warm_up_stage: 1,
      daily_action_limit: dailyLimit,
      current_action_count: 0,
      is_blocked: false,
    })
    .select('*')
    .single();
  if (error) throw error;
  return account;
}

async function main() {
  mkdirSync(reportDir, { recursive: true });
  const healthy = await checkRuntimeHealth();
  if (!healthy) throw new Error('Local runtime (bridge/worker) is not healthy');

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data: profile } = await supabase.from('profiles').select('id,user_id').limit(1).single();
  const device = await selectPilotDevice(supabase);
  const macro = await ensureMultiactionMacro(supabase, profile.id);
  const account = await ensurePilotAccount(supabase, profile.user_id, 5);

  console.log(`Setting up Level 4 Warm-up for account: ${account.username} on device: ${device.laixi_device_id}`);

  // Create an automated schedule for this macro
  const scheduleName = `warmup_schedule_${Date.now()}`;
  const dueTimeIso = new Date(Date.now() - 10000).toISOString();

  console.log(`Creating scheduled trigger: ${scheduleName}`);
  const { data: schedule, error: schedError } = await supabase
    .from('workflow_schedules')
    .insert({
      name: scheduleName,
      macro_id: macro.macroId,
      macro_version_id: macro.versionId,
      target_type: 'SINGLE_DEVICE',
      target_device_id: device.id,
      input_variables: { appName: pilotAppName, accountId: account.id },
      cron_expression: '*/30 * * * *',
      timezone: 'UTC',
      is_active: true,
      next_run_at: dueTimeIso,
      created_by: profile.user_id,
    })
    .select('*')
    .single();
  if (schedError) throw schedError;

  // Await schedule trigger processing
  console.log('Awaiting worker schedule loop trigger...');
  const pollStart = Date.now();
  let updatedSchedule = null;

  while (Date.now() - pollStart < 45000) {
    const { data: currentSchedule } = await supabase
      .from('workflow_schedules')
      .select('*')
      .eq('id', schedule.id)
      .single();

    if (currentSchedule && currentSchedule.last_run_at) {
      updatedSchedule = currentSchedule;
      console.log(`Schedule triggered at: ${currentSchedule.last_run_at}`);
      break;
    }
    await new Promise((res) => setTimeout(res, 2000));
  }

  // Deactivate schedule
  await supabase.from('workflow_schedules').update({ is_active: false }).eq('id', schedule.id);

  if (!updatedSchedule) {
    throw new Error('Schedule loop did not trigger schedule within timeout');
  }

  // Locate dispatched run
  console.log('Locating dispatched workflow run...');
  let triggeredRun = null;
  const pollRunStart = Date.now();
  while (Date.now() - pollRunStart < 15000) {
    const { data: runs } = await supabase
      .from('workflow_runs')
      .select('id,status,created_at')
      .contains('summary_json', { scheduleId: schedule.id })
      .order('created_at', { ascending: false })
      .limit(1);

    if (runs && runs.length > 0) {
      triggeredRun = runs[0];
      break;
    }
    await new Promise((res) => setTimeout(res, 1000));
  }

  if (!triggeredRun) {
    throw new Error('Dispatched workflow run not found');
  }

  console.log(`Dispatched run ID: ${triggeredRun.id}, waiting for physical device execution...`);

  // Await full macro completion
  const execStart = Date.now();
  let finishedRun = null;
  while (Date.now() - execStart < 90000) {
    const { data: run } = await supabase
      .from('workflow_runs')
      .select('id,status,started_at,finished_at,summary_json')
      .eq('id', triggeredRun.id)
      .single();

    if (run && ['COMPLETED', 'FAILED', 'CANCELLED'].includes(run.status)) {
      finishedRun = run;
      break;
    }
    await new Promise((res) => setTimeout(res, 2000));
  }

  console.log(`Run ${triggeredRun.id} finished with status: ${finishedRun?.status}`);

  // Fetch execution steps
  const { data: steps } = await supabase
    .from('run_steps')
    .select('id,step_id,step_type,status,screenshot_artifact_id,output_json')
    .eq('workflow_run_id', triggeredRun.id)
    .order('step_index', { ascending: true });

  // Fetch created artifacts
  const { data: artifacts } = await supabase
    .from('artifacts')
    .select('id,type,storage_key,size')
    .eq('workflow_run_id', triggeredRun.id);

  // Fetch account action history
  const { data: actionHistory } = await supabase
    .from('account_action_history')
    .select('id,action_type,created_at')
    .eq('source_run_id', triggeredRun.id);

  // Fetch account action quota
  const { data: accountAfter } = await supabase
    .from('accounts')
    .select('current_action_count,daily_action_limit')
    .eq('id', account.id)
    .single();

  const allStepsSuccess = steps?.length === 12 && steps.every((s) => s.status === 'SUCCESS');
  const artifactsValid = (artifacts?.length ?? 0) >= 2;
  const actionHistoryValid = (actionHistory?.length ?? 0) >= 1;
  const quotaIncremented = accountAfter?.current_action_count === 1;

  const pass = finishedRun?.status === 'COMPLETED' && allStepsSuccess && artifactsValid && actionHistoryValid && quotaIncremented;
  const verdict = pass ? 'pass' : 'fail';

  const report = {
    verifiedAt: new Date().toISOString(),
    verdict,
    device: { id: device.id, serial: device.laixi_device_id, model: device.model },
    account: {
      id: account.id,
      username: account.username,
      initialQuota: 0,
      finalQuota: accountAfter?.current_action_count,
      dailyLimit: accountAfter?.daily_action_limit,
    },
    schedule: {
      id: schedule.id,
      name: schedule.name,
      triggeredAt: updatedSchedule.last_run_at,
    },
    run: {
      id: triggeredRun.id,
      status: finishedRun?.status,
      startedAt: finishedRun?.started_at,
      finishedAt: finishedRun?.finished_at,
    },
    stepSummary: {
      totalSteps: steps?.length,
      successfulSteps: steps?.filter((s) => s.status === 'SUCCESS').length,
      allSuccess: allStepsSuccess,
    },
    artifacts: {
      count: artifacts?.length,
      details: artifacts?.map((a) => ({ id: a.id, size: a.size, key: a.storage_key })),
    },
    actionHistory: {
      count: actionHistory?.length,
      records: actionHistory?.map((h) => ({ id: h.id, type: h.action_type })),
    },
  };

  const reportPath = join(reportDir, `mobile-mcp-social-pilot-level4-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ reportPath, ...report }, null, 2));

  if (!pass) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
