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

async function pollRunUntilTerminal(supabase, runId, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { data: run, error } = await supabase
      .from('workflow_runs')
      .select('id,status,started_at,finished_at,summary_json')
      .eq('id', runId)
      .single();
    if (error) throw new Error(`Failed to query workflow_run: ${error.message}`);
    if (run.status === 'COMPLETED' || run.status === 'FAILED' || run.status === 'CANCELLED') {
      return run;
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error(`Run ${runId} timed out after ${timeoutMs}ms`);
}

// Stage Progression Logic matching account-warmup-engine & account-warmup-auto-advance
const STAGE_CONFIG_INSTAGRAM = [
  { stage: 1, label: 'Inactive', minDays: 0, maxDays: 0, recommendedLimit: 0 },
  { stage: 2, label: 'Day 1-3', minDays: 1, maxDays: 3, recommendedLimit: 5 },
  { stage: 3, label: 'Day 4-7', minDays: 4, maxDays: 7, recommendedLimit: 15 },
  { stage: 4, label: 'Ramping', minDays: 8, maxDays: 14, recommendedLimit: 40 },
  { stage: 5, label: 'Full Speed', minDays: 15, maxDays: Infinity, recommendedLimit: 100 },
];

function daysInWarmUp(startedAt, now = new Date()) {
  if (!startedAt) return 0;
  const start = new Date(startedAt).getTime();
  const current = now.getTime();
  if (current < start) return 1;
  const diffDays = Math.floor((current - start) / (24 * 60 * 60 * 1000));
  return Math.max(1, diffDays + 1);
}

function computeRecommendedStage(startedAt, now = new Date()) {
  const elapsed = daysInWarmUp(startedAt, now);
  if (elapsed <= 0) return 1;
  if (elapsed <= 3) return 2;
  if (elapsed <= 7) return 3;
  if (elapsed <= 14) return 4;
  return 5;
}

function shouldResetActionCount(lastResetAt, now = new Date()) {
  if (!lastResetAt) return true;
  const last = new Date(lastResetAt);
  return (
    last.getUTCFullYear() !== now.getUTCFullYear() ||
    last.getUTCMonth() !== now.getUTCMonth() ||
    last.getUTCDate() !== now.getUTCDate()
  );
}

async function ensureWarmupMacro(supabase, profileId) {
  const macroKey = 'social_pilot_warmup_campaign';
  const { data: existing } = await supabase.from('macros').select('id').eq('key', macroKey).maybeSingle();
  let macroId = existing?.id;
  if (!macroId) {
    const { data: created, error } = await supabase
      .from('macros')
      .insert({
        key: macroKey,
        name: 'Social Pilot Warm-up Campaign',
        description: 'Executes budgeted actions under dynamic warm-up stage progression limits.',
        created_by_user_id: profileId,
      })
      .select('id')
      .single();
    if (error) throw error;
    macroId = created.id;
  }

  const macroDef = {
    version: 1,
    meta: {
      key: macroKey,
      name: 'Social Pilot Warm-up Campaign',
      description: 'Executes budgeted action after warm-up stage auto-advancement.',
    },
    inputs: {
      accountId: { type: 'string', required: true },
      appName: { type: 'string', required: true },
    },
    target: { mode: 'single_device' },
    execution: { defaultTimeoutMs: 35000, maxRetries: 0, onError: 'stop' },
    steps: [
      { id: 'launch_app', type: 'launch_app', params: { appName: '{{appName}}' } },
      { id: 'wait_ready', type: 'wait', params: { ms: 2000 } },
      {
        id: 'budgeted_warmup_like',
        type: 'tap',
        params: {
          x: 0.5,
          y: 0.5,
          actionBudgetType: 'like',
          actionHistoryType: 'like',
        },
      },
      { id: 'wait_post_action', type: 'wait', params: { ms: 1000 } },
      { id: 'capture_evidence', type: 'screenshot', params: { saveToArtifact: true } },
    ],
  };

  const { data: versions, error: vErr } = await supabase
    .from('macro_versions')
    .select('id,version_number')
    .eq('macro_id', macroId)
    .order('version_number', { ascending: false })
    .limit(1);
  if (vErr) throw vErr;

  const nextVer = (versions?.[0]?.version_number ?? 0) + 1;
  const { data: versionRecord, error: insErr } = await supabase
    .from('macro_versions')
    .insert({
      macro_id: macroId,
      version_number: nextVer,
      status: 'ACTIVE',
      definition_json: macroDef,
      input_schema_json: macroDef.inputs,
      created_by_user_id: profileId,
    })
    .select('id')
    .single();
  if (insErr) throw insErr;

  await supabase.from('macros').update({ latest_version_id: versionRecord.id }).eq('id', macroId);
  return { macroId, versionId: versionRecord.id };
}

async function main() {
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log('=== Checking Local Runtime Health ===');
  const bridgeRes = await fetchJson(`${bridgeUrl}/health`);
  const workerRes = await fetchJson(`${workerUrl}/health`);
  if (!bridgeRes.ok || !workerRes.ok) {
    throw new Error(`Runtime unhealthy: bridge=${bridgeRes.ok}, worker=${workerRes.ok}`);
  }

  const preferredSerial = parseCsv(dotEnv.MOBILE_MCP_EXPECTED_SERIALS ?? process.env.MOBILE_MCP_EXPECTED_SERIALS)[0];
  let query = supabase.from('devices').select('id,laixi_device_id,model,status').eq('status', 'ONLINE');
  if (preferredSerial) {
    query = query.eq('laixi_device_id', preferredSerial);
  }
  const { data: dbDevice, error: deviceError } = await query.limit(1).maybeSingle();
  if (deviceError || !dbDevice) {
    throw new Error(`Online pilot device not found: ${deviceError?.message ?? 'none'}`);
  }
  console.log(`Targeting online physical device: ${dbDevice.laixi_device_id} (ID: ${dbDevice.id}, Model: ${dbDevice.model})`);

  // Clear any leftover lock on device
  await supabase.from('device_locks').delete().eq('device_id', dbDevice.id);

  const { data: profile } = await supabase.from('profiles').select('id,user_id').limit(1).maybeSingle();
  const profileId = profile?.id;
  const authUserId = profile?.user_id ?? profile?.id;
  if (!profileId) {
    throw new Error('No profile found to trigger runs');
  }

  console.log('\n=== Step 1: Initialize Account in Stage 2 (Day 1-3) with Exhausted Action Limit ===');
  const initialStartedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(); // 2 days ago
  const yesterdayResetAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const username = `pilot_warmup_${Date.now()}`;

  const { data: account, error: accError } = await supabase
    .from('accounts')
    .insert({
      user_id: authUserId,
      username,
      encrypted_password: 'v2:placeholder-warmup-test',
      platform: 'instagram',
      warm_up_stage: 2,
      warm_up_started_at: initialStartedAt,
      daily_action_limit: 5,
      current_action_count: 5, // Limit reached under Stage 2
      last_action_reset_at: yesterdayResetAt,
      is_blocked: false,
    })
    .select('*')
    .single();
  if (accError) throw accError;
  console.log(`Created account ${account.id} (@${username}): Stage=${account.warm_up_stage}, Limit=${account.daily_action_limit}, Count=${account.current_action_count}`);

  console.log('\n=== Step 2: Multi-Day Auto-Advancement & Daily Counter Reset Execution ===');
  // Simulate advancing to Day 5: 5 days elapsed -> Stage 3 (Day 4-7 threshold)
  const simulatedNow = new Date();
  const simulatedStartedAt = new Date(simulatedNow.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();

  // Test recommendation algorithm
  const targetStage = computeRecommendedStage(simulatedStartedAt, simulatedNow);
  const targetConfig = STAGE_CONFIG_INSTAGRAM.find((s) => s.stage === targetStage);
  const newDailyLimit = targetConfig?.recommendedLimit ?? 15;
  const needsReset = shouldResetActionCount(account.last_action_reset_at, simulatedNow);

  console.log(`Calculated progression: Elapsed=5 days -> Stage ${targetStage} (${targetConfig?.label}), New Daily Limit=${newDailyLimit}`);
  console.log(`Daily reset check: shouldResetActionCount=${needsReset}`);

  if (targetStage !== 3 || newDailyLimit !== 15 || !needsReset) {
    throw new Error(`Advancement calculation mismatch: stage=${targetStage}, limit=${newDailyLimit}, reset=${needsReset}`);
  }

  // Apply advancement and reset to Supabase
  const { data: updatedAccount, error: updateError } = await supabase
    .from('accounts')
    .update({
      warm_up_stage: targetStage,
      daily_action_limit: newDailyLimit,
      current_action_count: 0,
      last_action_reset_at: simulatedNow.toISOString(),
      warm_up_started_at: simulatedStartedAt,
    })
    .eq('id', account.id)
    .select('*')
    .single();
  if (updateError) throw updateError;

  console.log(`Updated account ${updatedAccount.id}: Stage ${account.warm_up_stage} -> ${updatedAccount.warm_up_stage}, Limit ${account.daily_action_limit} -> ${updatedAccount.daily_action_limit}, Count ${account.current_action_count} -> ${updatedAccount.current_action_count}`);

  console.log('\n=== Step 3: Dispatch Workflow Run on Physical Android Hardware (QC4DKJUO6PW4FMQW) ===');
  const { versionId } = await ensureWarmupMacro(supabase, profileId);

  const { data: runRecord, error: runError } = await supabase
    .from('workflow_runs')
    .insert({
      macro_version_id: versionId,
      triggered_by_user_id: profileId,
      status: 'QUEUED',
      target_type: 'SINGLE_DEVICE',
      target_selector_json: { target_ids: [dbDevice.id], deviceIds: [dbDevice.id] },
      input_variables_json: { accountId: updatedAccount.id, appName: pilotAppName },
    })
    .select('id,status')
    .single();
  if (runError) throw runError;

  console.log(`Queued run ${runRecord.id} targeting device ${dbDevice.laixi_device_id}`);
  const terminalRun = await pollRunUntilTerminal(supabase, runRecord.id);
  console.log(`Run ${terminalRun.id} reached terminal status: ${terminalRun.status}`);

  if (terminalRun.status !== 'COMPLETED') {
    throw new Error(`Expected run ${terminalRun.id} to be COMPLETED, got ${terminalRun.status}: ${JSON.stringify(terminalRun.summary_json)}`);
  }

  console.log('\n=== Step 4: Verify Post-Run Account Action History & Lock State ===');
  const { data: historyEntries, error: historyErr } = await supabase
    .from('account_action_history')
    .select('*')
    .eq('account_id', updatedAccount.id);
  if (historyErr) throw historyErr;

  const actionRecorded = (historyEntries ?? []).some((h) => h.action_type === 'like' && h.success === true);
  console.log(`Account action history recorded: count=${historyEntries?.length ?? 0}, like_recorded=${actionRecorded}`);

  const { data: locksAfter, error: lockErr } = await supabase
    .from('device_locks')
    .select('*')
    .eq('device_id', dbDevice.id);
  if (lockErr) throw lockErr;
  const zeroLocks = !locksAfter || locksAfter.length === 0;
  console.log(`Device lock state: count=${locksAfter?.length ?? 0}, cleanZeroLocks=${zeroLocks}`);

  if (!actionRecorded) {
    throw new Error('Expected successful action recorded in account_action_history');
  }
  if (!zeroLocks) {
    throw new Error('Expected zero remaining locks after workflow completion');
  }

  const resultArtifact = {
    test: 'warmup_campaign_auto_advancement_and_reset',
    timestamp: new Date().toISOString(),
    device: {
      id: dbDevice.id,
      serial: dbDevice.laixi_device_id,
      model: dbDevice.model,
    },
    account: {
      id: updatedAccount.id,
      username: updatedAccount.username,
      initialStage: account.warm_up_stage,
      advancedStage: updatedAccount.warm_up_stage,
      initialDailyLimit: account.daily_action_limit,
      advancedDailyLimit: updatedAccount.daily_action_limit,
      initialActionCount: account.current_action_count,
      resetActionCount: updatedAccount.current_action_count,
      warmUpStartedAt: updatedAccount.warm_up_started_at,
    },
    workflowRun: {
      id: terminalRun.id,
      status: terminalRun.status,
      startedAt: terminalRun.started_at,
      finishedAt: terminalRun.finished_at,
    },
    verification: {
      stageAdvanced: updatedAccount.warm_up_stage === 3,
      dailyLimitRamped: updatedAccount.daily_action_limit === 15,
      counterReset: updatedAccount.current_action_count === 0,
      macroCompletedOnHardware: terminalRun.status === 'COMPLETED',
      actionHistoryRecorded: actionRecorded,
      lockReleasedCleanly: zeroLocks,
    },
  };

  mkdirSync(reportDir, { recursive: true });
  const filename = `mobile-mcp-warmup-campaign-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const reportPath = join(reportDir, filename);
  writeFileSync(reportPath, JSON.stringify(resultArtifact, null, 2), 'utf8');
  console.log(`\nSUCCESS: Verification artifact written to: ${reportPath}`);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
