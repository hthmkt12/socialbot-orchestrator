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

const BLOCK_KEYWORDS = [
  'action blocked',
  'try again later',
  'we restrict certain activity',
  'suspicious activity',
  'unusual activity',
  'account compromised',
  'temporarily blocked',
  'community guidelines',
];

export function detectAccountBlock(errorMessage) {
  if (!errorMessage) return null;
  const lower = errorMessage.toLowerCase();

  for (const keyword of BLOCK_KEYWORDS) {
    if (lower.includes(keyword)) {
      return keyword;
    }
  }

  return null;
}

export async function handlePotentialBlock(supabase, accountId, errorMessage) {
  if (!accountId) return false;

  const detectedReason = detectAccountBlock(errorMessage);
  if (!detectedReason) return false;

  try {
    const { error } = await supabase
      .from('accounts')
      .update({
        is_blocked: true,
        detected_block_reason: `Detected keyword: "${detectedReason}"`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', accountId);

    if (error) return false;
    return true;
  } catch {
    return false;
  }
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

async function ensureConcreteSocialMacro(supabase, profileId) {
  const macroKey = `concrete_social_engage_${Date.now()}`;
  const macroDef = {
    version: 1,
    meta: {
      key: macroKey,
      name: 'Concrete Social Engagement Bot',
      description: 'Executes app launch, feed swipe, anti-detection human reading pauses, budgeted like, and screenshot capture.',
    },
    inputs: {
      accountId: { type: 'string', required: true },
      appName: { type: 'string', required: true },
    },
    target: { mode: 'single_device' },
    execution: { defaultTimeoutMs: 45000, maxRetries: 0, onError: 'stop' },
    steps: [
      { id: 's1_launch', type: 'launch_app', params: { appName: '{{appName}}' } },
      { id: 's2_pause', type: 'wait', params: { ms: 2000 } },
      { id: 's3_swipe', type: 'swipe', params: { fromX: 0.5, fromY: 0.75, toX: 0.5, toY: 0.35, durationMs: 700 } },
      { id: 's4_read', type: 'wait', params: { ms: 2000 } },
      {
        id: 's5_like',
        type: 'tap',
        params: {
          x: 0.5,
          y: 0.45,
          actionBudgetType: 'like',
          actionHistoryType: 'like',
        },
      },
      { id: 's6_proof', type: 'screenshot', params: { saveToArtifact: true } },
    ],
  };

  const { data: macroRecord, error: macroErr } = await supabase
    .from('macros')
    .insert({
      key: macroKey,
      name: macroDef.meta.name,
      description: macroDef.meta.description,
      created_by_user_id: profileId,
    })
    .select('id')
    .single();

  if (macroErr) throw macroErr;

  const { data: versionRecord, error: verErr } = await supabase
    .from('macro_versions')
    .insert({
      macro_id: macroRecord.id,
      version_number: 1,
      status: 'ACTIVE',
      definition_json: macroDef,
      input_schema_json: macroDef.inputs,
      created_by_user_id: profileId,
    })
    .select('id')
    .single();

  if (verErr) throw verErr;

  await supabase.from('macros').update({ latest_version_id: versionRecord.id }).eq('id', macroRecord.id);
  return { macroId: macroRecord.id, versionId: versionRecord.id };
}

async function main() {
  console.log('================================================================');
  console.log('Concrete Social Bot & Checkpoint Block Isolation Verification');
  console.log('Timestamp:', new Date().toISOString());
  console.log('================================================================');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Preflight checks
  console.log('\n[1/5] Checking runtime bridge and worker status...');
  const bridgeHealth = await fetchJson(`${bridgeUrl}/health`);
  console.log(`Bridge Health: HTTP ${bridgeHealth.status} - OK: ${bridgeHealth.ok}`);
  if (!bridgeHealth.ok) {
    throw new Error(`Mobile MCP bridge is not healthy at ${bridgeUrl}`);
  }

  const workerHealth = await fetchJson(`${workerUrl}/health`);
  console.log(`Worker Health: HTTP ${workerHealth.status} - OK: ${workerHealth.ok}`);
  if (!workerHealth.ok) {
    throw new Error(`Execution worker is not healthy at ${workerUrl}`);
  }

  // 2. Discover physical device
  console.log('\n[2/5] Locating physical Android target...');
  const preferredSerial = parseCsv(env.EXPECTED_DEVICE_SERIALS ?? 'QC4DKJUO6PW4FMQW')[0];
  let deviceQuery = supabase.from('devices').select('id,laixi_device_id,model,status').eq('status', 'ONLINE');
  if (preferredSerial) {
    deviceQuery = deviceQuery.eq('laixi_device_id', preferredSerial);
  }

  const { data: dbDevice, error: devErr } = await deviceQuery.limit(1).maybeSingle();
  if (devErr || !dbDevice) {
    throw new Error(`Target physical device not found or offline: ${devErr?.message ?? 'none'}`);
  }
  console.log(`Target Physical Device: ${dbDevice.laixi_device_id} (${dbDevice.model}) [${dbDevice.id}]`);

  // Clear any leftover lock on device
  await supabase.from('device_locks').delete().eq('device_id', dbDevice.id);

  // Query operator profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id,user_id,role')
    .limit(1)
    .single();

  const authUserId = profile?.user_id ?? profile?.id;
  const operatorProfileId = profile?.id;

  // 3. Scenario 1: Execute concrete social engagement macro on physical device
  console.log('\n[3/5] Scenario 1: Executing concrete social engagement bot on physical hardware...');
  const accountUsername = `concrete_pilot_${Date.now().toString(36)}`;
  const { data: testAccount, error: accErr } = await supabase
    .from('accounts')
    .insert({
      user_id: authUserId,
      username: accountUsername,
      encrypted_password: 'v2:synthetic-enc-pw',
      platform: 'instagram',
      warm_up_stage: 3,
      warm_up_started_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      daily_action_limit: 15,
      current_action_count: 0,
      is_blocked: false,
    })
    .select()
    .single();

  if (accErr) throw new Error(`Failed to insert test account: ${accErr.message}`);
  console.log(`Test Account Initialized: @${testAccount.username} (Stage 3, Limit: 15, Actions: 0)`);

  const { macroId, versionId } = await ensureConcreteSocialMacro(supabase, operatorProfileId);

  // Dispatch execution run
  const { data: runRecord, error: runErr } = await supabase
    .from('workflow_runs')
    .insert({
      macro_version_id: versionId,
      triggered_by_user_id: operatorProfileId,
      status: 'QUEUED',
      target_type: 'SINGLE_DEVICE',
      target_selector_json: { target_ids: [dbDevice.id], deviceIds: [dbDevice.id] },
      input_variables_json: {
        accountId: testAccount.id,
        appName: pilotAppName,
      },
    })
    .select()
    .single();

  if (runErr) throw new Error(`Failed to queue run: ${runErr.message}`);
  console.log(`Dispatched Run: ${runRecord.id} -> Polling execution completion...`);

  const finishedRun = await pollRunUntilTerminal(supabase, runRecord.id, 90000);
  console.log(`Run ${finishedRun.id} status: ${finishedRun.status}`);
  if (finishedRun.status !== 'COMPLETED') {
    throw new Error(`Concrete engagement run failed with status: ${finishedRun.status}: ${JSON.stringify(finishedRun.summary_json)}`);
  }

  // Verify action budget increment
  const { data: reloadedAccount } = await supabase
    .from('accounts')
    .select('current_action_count,daily_action_limit')
    .eq('id', testAccount.id)
    .single();

  console.log(`Account Action Count updated: ${testAccount.current_action_count} -> ${reloadedAccount.current_action_count}`);
  if (reloadedAccount.current_action_count !== 1) {
    throw new Error(`Expected current_action_count to be 1, found ${reloadedAccount.current_action_count}`);
  }

  // Verify action history record
  const { data: actionHistory } = await supabase
    .from('account_action_history')
    .select('*')
    .eq('account_id', testAccount.id);

  console.log(`Recorded action history count: ${actionHistory?.length ?? 0}`);

  // 4. Scenario 2: Checkpoint Block Detection & Auto-Isolation
  console.log('\n[4/5] Scenario 2: Testing Checkpoint Block Detection and Automated Isolation...');
  const simulatedCheckpointError = 'Action Blocked: Please try again later. We restrict certain activity to protect our community.';
  console.log(`Simulating platform error: "${simulatedCheckpointError}"`);

  const blockDetected = await handlePotentialBlock(supabase, testAccount.id, simulatedCheckpointError);
  console.log(`handlePotentialBlock result: ${blockDetected}`);
  if (!blockDetected) {
    throw new Error('Expected handlePotentialBlock to detect block and return true');
  }

  const { data: blockedAccount } = await supabase
    .from('accounts')
    .select('is_blocked,detected_block_reason')
    .eq('id', testAccount.id)
    .single();

  console.log(`Account Block State: is_blocked=${blockedAccount.is_blocked}, reason="${blockedAccount.detected_block_reason}"`);
  if (!blockedAccount.is_blocked) {
    throw new Error('Account was not marked as is_blocked = true in database');
  }

  // Attempt a second run on the blocked account to verify fail-closed enforcement
  console.log('Attempting follow-up run on blocked account to verify fail-closed budget check...');
  const { data: blockedRunRecord, error: bRunErr } = await supabase
    .from('workflow_runs')
    .insert({
      macro_version_id: versionId,
      triggered_by_user_id: operatorProfileId,
      status: 'QUEUED',
      target_type: 'SINGLE_DEVICE',
      target_selector_json: { target_ids: [dbDevice.id], deviceIds: [dbDevice.id] },
      input_variables_json: {
        accountId: testAccount.id,
        appName: pilotAppName,
      },
    })
    .select()
    .single();

  if (bRunErr) throw new Error(`Failed to queue blocked run: ${bRunErr.message}`);

  const finishedBlockedRun = await pollRunUntilTerminal(supabase, blockedRunRecord.id, 60000);
  console.log(`Blocked Run status: ${finishedBlockedRun.status}`);
  if (finishedBlockedRun.status !== 'FAILED') {
    throw new Error(`Expected run on blocked account to fail, got ${finishedBlockedRun.status}`);
  }

  // Check error message in step execution or summary
  console.log('Blocked Run summary:', JSON.stringify(finishedBlockedRun.summary_json));

  // 5. Scenario 3: Verify hardware mutex cleanliness
  console.log('\n[5/5] Scenario 3: Checking device lock mutex cleanliness...');
  const { data: locks, error: lockErr } = await supabase
    .from('device_locks')
    .select('*')
    .eq('device_id', dbDevice.id);

  if (lockErr) throw new Error(`Device locks query failed: ${lockErr.message}`);
  console.log(`Active locks for device ${dbDevice.laixi_device_id}: ${locks.length}`);
  if (locks.length > 0) {
    throw new Error(`Expected 0 residual device locks, found ${locks.length}`);
  }

  // Clean up test data
  console.log('\nCleaning up verification records...');
  await supabase.from('workflow_runs').delete().in('id', [finishedRun.id, finishedBlockedRun.id]);
  await supabase.from('macro_versions').delete().eq('id', versionId);
  await supabase.from('macros').delete().eq('id', macroId);
  await supabase.from('accounts').delete().eq('id', testAccount.id);

  // Write verification report
  mkdirSync(reportDir, { recursive: true });
  const reportPath = join(reportDir, `concrete-social-bots-verify-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  const evidenceReport = {
    verifiedAt: new Date().toISOString(),
    hardwareTarget: {
      deviceId: dbDevice.laixi_device_id,
      model: dbDevice.model,
      id: dbDevice.id,
    },
    scenario1_engagementRun: {
      runId: finishedRun.id,
      status: finishedRun.status,
      actionsIncremented: 1,
      actionHistoryRecorded: (actionHistory?.length ?? 0) > 0,
    },
    scenario2_checkpointBlock: {
      simulatedError: simulatedCheckpointError,
      detected: blockDetected,
      blockedState: blockedAccount,
      blockedRunId: finishedBlockedRun.id,
      blockedRunStatus: finishedBlockedRun.status,
      summary: finishedBlockedRun.summary_json,
    },
    scenario3_deviceLocks: {
      residualLocks: 0,
    },
  };

  writeFileSync(reportPath, JSON.stringify(evidenceReport, null, 2), 'utf8');
  console.log(`\nEvidence saved to: ${reportPath}`);
  console.log('\nALL CONCRETE SOCIAL BOT VERIFICATION CHECKS PASSED SUCCESSFULLY!');
}

main().catch((err) => {
  console.error('\nVerification failed:', err);
  process.exit(1);
});
