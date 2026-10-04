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
const pilotUsername = env.PILOT_INSTAGRAM_USERNAME ?? 'pilot_instagram_level2_feed';
const bridgeUrl = env.MOBILE_MCP_BRIDGE_URL ?? env.VITE_MOBILE_MCP_BRIDGE_URL ?? 'http://127.0.0.1:4321';
const workerUrl = env.VITE_WORKER_BASE_URL ?? 'http://127.0.0.1:4310';
const bridgeToken = env.MOBILE_MCP_BRIDGE_TOKEN;
const pilotAppName = env.PILOT_APP_PACKAGE ?? env.UI_SMOKE_APP_NAME ?? 'com.android.settings';

const pilotDefinition = {
  version: 1,
  meta: {
    key: 'instagram_pilot_level2_feed_scroll',
    name: 'Instagram Pilot Level 2 Feed Scroll',
    description: 'Level 2 Social Pilot: launch app, verify foreground, perform natural feed swipes, capture multi-point screenshot evidence, and record action events.',
    tags: ['instagram', 'pilot', 'level-2', 'feed-scroll', 'evidence', 'mobile-mcp'],
  },
  inputs: {
    accountId: { type: 'string', required: true },
    appName: { type: 'string', required: true },
  },
  target: { mode: 'single_device' },
  execution: { defaultTimeoutMs: 60000, maxRetries: 1, onError: 'stop' },
  antiDetection: {
    randomDelayMs: [2000, 5000],
    scrollVariance: true,
    tapJitterPx: 6,
    cooldownBetweenActionsMs: [3000, 7000],
    deviceFingerprint: true,
  },
  steps: [
    { id: 'launch_app', type: 'launch_app', params: { appName: '{{appName}}' } },
    { id: 'wait_initial_load', type: 'wait', params: { ms: 3000 } },
    { id: 'verify_foreground_1', type: 'get_current_app', params: {} },
    {
      id: 'capture_initial_evidence',
      type: 'screenshot',
      params: { saveToArtifact: true, actionHistoryType: 'instagram_pilot_open' },
    },
    {
      id: 'swipe_feed_first',
      type: 'swipe',
      params: { fromX: 0.5, fromY: 0.75, toX: 0.5, toY: 0.3, durationMs: 650 },
    },
    { id: 'wait_after_scroll_1', type: 'wait', params: { ms: 2500 } },
    {
      id: 'swipe_feed_second',
      type: 'swipe',
      params: { fromX: 0.52, fromY: 0.7, toX: 0.48, toY: 0.35, durationMs: 700 },
    },
    { id: 'wait_after_scroll_2', type: 'wait', params: { ms: 2000 } },
    {
      id: 'capture_scrolled_evidence',
      type: 'screenshot',
      params: { saveToArtifact: true, actionHistoryType: 'instagram_pilot_open' },
    },
    { id: 'verify_foreground_2', type: 'get_current_app', params: {} },
  ],
};

function required(name, value) {
  if (!value) throw new Error(`${name} is required`);
  return value;
}

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

async function assertLocalRuntimeHealthy(expectedSerials) {
  const failures = [];

  try {
    const bridgeHealth = await fetchJson(`${bridgeUrl}/health`);
    if (!bridgeHealth.ok) {
      failures.push(`bridge unhealthy: status ${bridgeHealth.status}`);
    }
  } catch (error) {
    failures.push(`bridge unreachable at ${bridgeUrl}: ${error.message}`);
  }

  try {
    const workerHealth = await fetchJson(`${workerUrl}/health`);
    if (!workerHealth.ok) {
      failures.push(`worker unhealthy: status ${workerHealth.status}`);
    }
  } catch (error) {
    failures.push(`worker unreachable at ${workerUrl}: ${error.message}`);
  }

  if (expectedSerials.length > 0) {
    try {
      const bridgeDevices = await fetchJson(`${bridgeUrl}/devices`);
      if (bridgeDevices.ok && Array.isArray(bridgeDevices.body?.devices)) {
        const bridgeSerials = new Set(bridgeDevices.body.devices.map((device) => device.serial));
        const missingBridgeSerials = expectedSerials.filter((serial) => !bridgeSerials.has(serial));
        if (missingBridgeSerials.length > 0) {
          failures.push(`bridge missing expected serials: ${missingBridgeSerials.join(', ')}`);
        }
      }
    } catch (error) {
      failures.push(`bridge devices check failed: ${error.message}`);
    }
  }

  return { ok: failures.length === 0, failures };
}

async function ensurePilotMacro(supabase, profileId) {
  const { data: existingMacro } = await supabase
    .from('macros')
    .select('id,key,name,latest_version_id')
    .eq('key', pilotDefinition.meta.key)
    .maybeSingle();

  let macroId = existingMacro?.id;
  if (!macroId) {
    const { data: createdMacro, error } = await supabase
      .from('macros')
      .insert({
        key: pilotDefinition.meta.key,
        name: pilotDefinition.meta.name,
        description: pilotDefinition.meta.description,
        created_by_user_id: profileId,
      })
      .select('id,key,name,latest_version_id')
      .single();
    if (error) throw new Error(`macro insert failed: ${error.message}`);
    macroId = createdMacro.id;
  }

  const { data: versions, error: versionsError } = await supabase
    .from('macro_versions')
    .select('id,version_number')
    .eq('macro_id', macroId)
    .order('version_number', { ascending: false })
    .limit(1);
  if (versionsError) throw new Error(`macro_versions lookup failed: ${versionsError.message}`);

  const nextVersionNumber = (versions?.[0]?.version_number ?? 0) + 1;
  const { data: createdVersion, error: versionError } = await supabase
    .from('macro_versions')
    .insert({
      macro_id: macroId,
      version_number: nextVersionNumber,
      status: 'ACTIVE',
      definition_json: pilotDefinition,
      input_schema_json: pilotDefinition.inputs,
      tags_json: pilotDefinition.meta.tags,
      created_by_user_id: profileId,
    })
    .select('id,macro_id,version_number,status')
    .single();
  if (versionError) throw new Error(`macro_version insert failed: ${versionError.message}`);

  const { error: updateMacroError } = await supabase
    .from('macros')
    .update({ latest_version_id: createdVersion.id, updated_at: new Date().toISOString() })
    .eq('id', macroId);
  if (updateMacroError) throw new Error(`macro update latest version failed: ${updateMacroError.message}`);

  return { macroId, versionId: createdVersion.id, versionNumber: nextVersionNumber };
}

async function ensurePilotAccount(supabase, userId) {
  const { data: existing, error: existingError } = await supabase
    .from('accounts')
    .select('id,username,platform,warm_up_stage,daily_action_limit,current_action_count,is_blocked')
    .eq('username', pilotUsername)
    .maybeSingle();

  if (existingError) throw new Error(`pilot account lookup failed: ${existingError.message}`);
  if (existing) {
    if (existing.is_blocked) {
      await supabase.from('accounts').update({ is_blocked: false }).eq('id', existing.id);
    }
    return { action: 'existing', account: existing };
  }

  const { data, error } = await supabase
    .from('accounts')
    .insert({
      user_id: userId,
      username: pilotUsername,
      encrypted_password: 'v2:pilot-level2-placeholder-not-a-real-password',
      platform: 'instagram',
      warm_up_stage: 3,
      daily_action_limit: 25,
      current_action_count: 0,
      is_blocked: false,
    })
    .select('id,username,platform,warm_up_stage,daily_action_limit,current_action_count,is_blocked')
    .maybeSingle();
  if (error) throw new Error(`pilot account insert failed: ${error.message}`);
  if (!data) throw new Error('pilot account insert returned no row');
  return { action: 'created', account: data };
}

async function selectPilotDevice(supabase) {
  const preferredSerial = parseCsv(dotEnv.MOBILE_MCP_EXPECTED_SERIALS ?? process.env.MOBILE_MCP_EXPECTED_SERIALS)[0];

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
  return { device, preferredSerial };
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
        appName: pilotAppName,
      },
      status: 'QUEUED',
      summary_json: {
        pilot: {
          level: 2,
          type: 'social_feed_scroll_verification',
          username: pilotUsername,
          appName: pilotAppName,
          serial: args.serial,
        },
      },
    })
    .select('id,status,created_at')
    .single();

  if (error) throw new Error(`pilot workflow run insert failed: ${error.message}`);
  return data;
}

async function waitForRunCompletion(supabase, runId, timeoutMs = 90000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const { data: run, error } = await supabase
      .from('workflow_runs')
      .select('id,status,execution_owner,execution_claim_token,summary_json,started_at,finished_at')
      .eq('id', runId)
      .single();

    if (error) throw new Error(`run polling failed: ${error.message}`);
    if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(run.status)) {
      return run;
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  throw new Error(`Timed out waiting for run ${runId} to finish`);
}

async function main() {
  mkdirSync(reportDir, { recursive: true });
  required('SUPABASE_URL or VITE_SUPABASE_URL', supabaseUrl);
  required('SUPABASE_SERVICE_ROLE_KEY', serviceRoleKey);

  const expectedSerials = parseCsv(dotEnv.MOBILE_MCP_EXPECTED_SERIALS ?? process.env.MOBILE_MCP_EXPECTED_SERIALS);
  const runtimeHealth = await assertLocalRuntimeHealthy(expectedSerials);
  if (!runtimeHealth.ok) {
    throw new Error(`Runtime unhealthy: ${runtimeHealth.failures.join('; ')}`);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id,user_id,role')
    .limit(1)
    .maybeSingle();
  if (profileError) throw new Error(`profile lookup failed: ${profileError.message}`);
  if (!profile) throw new Error('No profile available');

  const { device, preferredSerial } = await selectPilotDevice(supabase);
  const accountResult = await ensurePilotAccount(supabase, profile.user_id);
  const macroResult = await ensurePilotMacro(supabase, profile.id);

  const run = await createPilotRun(supabase, {
    macroVersionId: macroResult.versionId,
    profileId: profile.id,
    deviceId: device.id,
    serial: device.laixi_device_id,
    accountId: accountResult.account.id,
  });

  console.log(`Created Level 2 Pilot run ${run.id} for device ${device.laixi_device_id}`);

  const finishedRun = await waitForRunCompletion(supabase, run.id, 90000);

  const { data: runSteps, error: stepsError } = await supabase
    .from('run_steps')
    .select('id,step_id,step_type,status,screenshot_artifact_id,error_json,output_json,step_index')
    .eq('workflow_run_id', run.id)
    .order('step_index', { ascending: true });
  if (stepsError) throw new Error(`run_steps lookup failed: ${stepsError.message}`);

  const { data: artifacts, error: artifactsError } = await supabase
    .from('artifacts')
    .select('id,type,storage_key,content_type,size,metadata_json')
    .eq('workflow_run_id', run.id);
  if (artifactsError) throw new Error(`artifacts lookup failed: ${artifactsError.message}`);

  const { data: actionHistory, error: historyError } = await supabase
    .from('account_action_history')
    .select('id,account_id,action_type,source_run_id,source_step_id,success,created_at')
    .eq('source_run_id', run.id);
  if (historyError) throw new Error(`account_action_history lookup failed: ${historyError.message}`);

  const summary = {
    verifiedAt: new Date().toISOString(),
    verdict: finishedRun.status === 'COMPLETED' ? 'pass' : 'fail',
    level: 2,
    run: {
      id: finishedRun.id,
      status: finishedRun.status,
      executionOwner: finishedRun.execution_owner,
      startedAt: finishedRun.started_at,
      finishedAt: finishedRun.finished_at,
    },
    device: {
      id: device.id,
      serial: device.laixi_device_id,
      model: device.model,
    },
    account: {
      id: accountResult.account.id,
      username: accountResult.account.username,
      dailyLimit: accountResult.account.daily_action_limit,
    },
    macro: {
      id: macroResult.macroId,
      versionId: macroResult.versionId,
      key: pilotDefinition.meta.key,
      stepCount: pilotDefinition.steps.length,
    },
    steps: {
      total: runSteps.length,
      successCount: runSteps.filter((s) => s.status === 'SUCCESS').length,
      failedCount: runSteps.filter((s) => s.status === 'FAILED').length,
      details: runSteps.map((s) => ({
        stepId: s.step_id,
        type: s.step_type,
        status: s.status,
        screenshotArtifactId: s.screenshot_artifact_id,
      })),
    },
    artifacts: {
      count: artifacts.length,
      items: artifacts.map((a) => ({
        type: a.type,
        storageKey: a.storage_key,
        size: a.size,
      })),
    },
    actionHistory: {
      count: actionHistory.length,
      records: actionHistory.map((h) => ({
        id: h.id,
        actionType: h.action_type,
        stepId: h.source_step_id,
        success: h.success,
      })),
    },
  };

  const reportPath = join(reportDir, `mobile-mcp-social-pilot-level2-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(reportPath, JSON.stringify(summary, null, 2));

  console.log(JSON.stringify({ reportPath, ...summary }, null, 2));

  if (summary.verdict !== 'pass') {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
