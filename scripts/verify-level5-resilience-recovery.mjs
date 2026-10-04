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

async function pollRunUntilTerminal(supabase, runId, timeoutMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { data: run, error } = await supabase
      .from('workflow_runs')
      .select('id, status, summary_json, execution_owner, execution_lease_expires_at')
      .eq('id', runId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to query workflow_run: ${error.message}`);
    }

    if (run && ['COMPLETED', 'FAILED', 'CANCELLED'].includes(run.status)) {
      return run;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Timeout waiting for run ${runId} to reach terminal state after ${timeoutMs}ms`);
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

  // Clear any existing stale locks before test begins
  await supabase.from('device_locks').delete().eq('device_id', dbDevice.id);

  // Look up admin profile for run dispatch
  const { data: profile } = await supabase.from('profiles').select('id').limit(1).maybeSingle();
  const userId = profile?.id;
  if (!userId) {
    throw new Error('No profile found to trigger runs');
  }

  // Define failure macro: stops intentionally at step 2
  const failureMacroDefinition = {
    version: 1,
    meta: {
      key: 'resilience_test_step_failure',
      name: 'Resilience Test Step Failure',
      description: 'Tests clean failure handling and automatic lock release.',
    },
    inputs: {},
    target: { mode: 'single_device' },
    execution: { defaultTimeoutMs: 15000, maxRetries: 0, onError: 'stop' },
    steps: [
      { id: 'valid_pre_step', type: 'wait', params: { ms: 500 } },
      { id: 'intentional_stop_step', type: 'stop', params: { reason: 'Intentional fault injection for resilience verification' } },
      { id: 'unreachable_step', type: 'wait', params: { ms: 1000 } },
    ],
  };

  // Define recovery macro: normal healthy 3-step flow
  const recoveryMacroDefinition = {
    version: 1,
    meta: {
      key: 'resilience_test_recovery',
      name: 'Resilience Test Recovery Flow',
      description: 'Tests successful execution and lock release after recovery.',
    },
    inputs: { appName: { type: 'string', required: true } },
    target: { mode: 'single_device' },
    execution: { defaultTimeoutMs: 20000, maxRetries: 0, onError: 'stop' },
    steps: [
      { id: 'launch_app', type: 'launch_app', params: { appName: '{{appName}}' } },
      { id: 'wait_rendered', type: 'wait', params: { ms: 1200 } },
      { id: 'verify_foreground', type: 'get_current_app', params: {} },
    ],
  };

  // Seed or fetch macro 1 (failure macro)
  let { data: macroRecord1 } = await supabase
    .from('macros')
    .select('id')
    .eq('key', failureMacroDefinition.meta.key)
    .maybeSingle();

  if (!macroRecord1) {
    const { data: created, error: createErr1 } = await supabase
      .from('macros')
      .insert({
        key: failureMacroDefinition.meta.key,
        name: failureMacroDefinition.meta.name,
        description: failureMacroDefinition.meta.description,
        created_by_user_id: userId,
      })
      .select('id')
      .single();
    if (createErr1) throw createErr1;
    macroRecord1 = created;
  }

  const { data: versions1 } = await supabase
    .from('macro_versions')
    .select('version_number')
    .eq('macro_id', macroRecord1.id)
    .order('version_number', { ascending: false })
    .limit(1);

  const nextVer1 = (versions1?.[0]?.version_number ?? 0) + 1;
  const { data: versionRecord1, error: verErr1 } = await supabase
    .from('macro_versions')
    .insert({
      macro_id: macroRecord1.id,
      version_number: nextVer1,
      definition_json: failureMacroDefinition,
      created_by_user_id: userId,
    })
    .select('id')
    .single();
  if (verErr1) throw verErr1;

  // Seed or fetch macro 2 (recovery macro)
  let { data: macroRecord2 } = await supabase
    .from('macros')
    .select('id')
    .eq('key', recoveryMacroDefinition.meta.key)
    .maybeSingle();

  if (!macroRecord2) {
    const { data: created, error: createErr2 } = await supabase
      .from('macros')
      .insert({
        key: recoveryMacroDefinition.meta.key,
        name: recoveryMacroDefinition.meta.name,
        description: recoveryMacroDefinition.meta.description,
        created_by_user_id: userId,
      })
      .select('id')
      .single();
    if (createErr2) throw createErr2;
    macroRecord2 = created;
  }

  const { data: versions2 } = await supabase
    .from('macro_versions')
    .select('version_number')
    .eq('macro_id', macroRecord2.id)
    .order('version_number', { ascending: false })
    .limit(1);

  const nextVer2 = (versions2?.[0]?.version_number ?? 0) + 1;
  const { data: versionRecord2, error: verErr2 } = await supabase
    .from('macro_versions')
    .insert({
      macro_id: macroRecord2.id,
      version_number: nextVer2,
      definition_json: recoveryMacroDefinition,
      created_by_user_id: userId,
    })
    .select('id')
    .single();
  if (verErr2) throw verErr2;

  // =========================================================================
  // TEST SCENARIO 1: Step Failure & Clean Device Lock Release
  // =========================================================================
  console.log('\n--- Scenario 1: Step Failure & Automatic Device Lock Release ---');
  const { data: run1, error: err1 } = await supabase
    .from('workflow_runs')
    .insert({
      macro_version_id: versionRecord1.id,
      triggered_by_user_id: userId,
      status: 'QUEUED',
      target_type: 'SINGLE_DEVICE',
      target_selector_json: { target_ids: [dbDevice.id], deviceIds: [dbDevice.id] },
      input_variables_json: {},
    })
    .select('id')
    .single();

  if (err1) throw new Error(`Failed to queue run 1: ${err1.message}`);
  console.log(`Queued failure test run: ${run1.id}`);

  const terminalRun1 = await pollRunUntilTerminal(supabase, run1.id);
  console.log(`Run 1 reached terminal status: ${terminalRun1.status}`);

  if (terminalRun1.status !== 'FAILED') {
    throw new Error(`Scenario 1 Expected status FAILED but got ${terminalRun1.status}`);
  }

  // Check device lock is released
  const { data: locksAfter1 } = await supabase
    .from('device_locks')
    .select('id, workflow_run_id, expires_at')
    .eq('device_id', dbDevice.id);

  const lockReleasedAfterFailure = !locksAfter1 || locksAfter1.length === 0;
  console.log(`Device lock released cleanly after failure: ${lockReleasedAfterFailure}`);
  if (!lockReleasedAfterFailure) {
    throw new Error(`Device lock still held after failure: ${JSON.stringify(locksAfter1)}`);
  }

  // =========================================================================
  // TEST SCENARIO 2: Concurrent Hardware Lock Enforcement (DEVICE_LOCKED)
  // =========================================================================
  console.log('\n--- Scenario 2: Concurrent Hardware Lock Enforcement ---');
  // Create a synthetic holder run in workflow_runs to satisfy foreign key
  const { data: holderRun, error: holderErr } = await supabase
    .from('workflow_runs')
    .insert({
      macro_version_id: versionRecord1.id,
      triggered_by_user_id: userId,
      status: 'RUNNING',
      target_type: 'SINGLE_DEVICE',
      target_selector_json: { target_ids: [dbDevice.id] },
      input_variables_json: {},
    })
    .select('id')
    .single();
  if (holderErr) throw new Error(`Failed to insert synthetic holder run: ${holderErr.message}`);

  const lockExpiresInFuture = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  // Manually acquire lock on device simulating another active run
  const { error: lockInsertErr } = await supabase.from('device_locks').insert({
    device_id: dbDevice.id,
    workflow_run_id: holderRun.id,
    expires_at: lockExpiresInFuture,
  });
  if (lockInsertErr) throw new Error(`Failed to insert synthetic lock: ${lockInsertErr.message}`);
  console.log(`Acquired synthetic lock on device ${dbDevice.id} by run ${holderRun.id}`);

  // Queue a normal run targeting the locked device
  const { data: run2, error: err2 } = await supabase
    .from('workflow_runs')
    .insert({
      macro_version_id: versionRecord2.id,
      triggered_by_user_id: userId,
      status: 'QUEUED',
      target_type: 'SINGLE_DEVICE',
      target_selector_json: { target_ids: [dbDevice.id], deviceIds: [dbDevice.id] },
      input_variables_json: { appName: pilotAppName },
    })
    .select('id')
    .single();

  if (err2) throw new Error(`Failed to queue run 2: ${err2.message}`);
  console.log(`Queued run 2 on locked device: ${run2.id}`);

  const terminalRun2 = await pollRunUntilTerminal(supabase, run2.id);
  console.log(`Run 2 reached terminal status: ${terminalRun2.status}`);

  if (terminalRun2.status !== 'FAILED') {
    throw new Error(`Scenario 2 Expected status FAILED but got ${terminalRun2.status}`);
  }

  const summary2 = terminalRun2.summary_json || {};
  const errorCode2 = summary2.error?.code ?? '';
  const errorMessage2 = summary2.error?.message ?? '';
  console.log(`Run 2 error code: ${errorCode2}, message: "${errorMessage2}"`);

  const lockEnforced = errorCode2 === 'DEVICE_LOCKED' || errorMessage2.includes('Device is locked');
  console.log(`Hardware lock mutex enforced: ${lockEnforced}`);
  if (!lockEnforced) {
    throw new Error(`Expected DEVICE_LOCKED error, got: ${errorCode2} ${errorMessage2}`);
  }

  // Release the synthetic lock & mark holder run CANCELLED
  await supabase.from('device_locks').delete().eq('device_id', dbDevice.id);
  await supabase.from('workflow_runs').update({ status: 'CANCELLED' }).eq('id', holderRun.id);
  console.log('Cleaned up synthetic lock.');

  // =========================================================================
  // TEST SCENARIO 3: Expired Stale Lock Auto-Cleanup & Recovery Flow
  // =========================================================================
  console.log('\n--- Scenario 3: Expired Stale Lock Auto-Cleanup & Recovery ---');
  // Create an expired holder run
  const { data: expiredHolderRun, error: expiredHolderErr } = await supabase
    .from('workflow_runs')
    .insert({
      macro_version_id: versionRecord1.id,
      triggered_by_user_id: userId,
      status: 'CANCELLED',
      target_type: 'SINGLE_DEVICE',
      target_selector_json: { target_ids: [dbDevice.id] },
      input_variables_json: {},
    })
    .select('id')
    .single();
  if (expiredHolderErr) throw new Error(`Failed to insert expired holder run: ${expiredHolderErr.message}`);

  const expiredLockTime = new Date(Date.now() - 30 * 1000).toISOString();

  // Insert expired lock (expired 30s ago)
  const { error: expiredLockErr } = await supabase.from('device_locks').insert({
    device_id: dbDevice.id,
    workflow_run_id: expiredHolderRun.id,
    expires_at: expiredLockTime,
  });
  if (expiredLockErr) throw new Error(`Failed to insert expired lock: ${expiredLockErr.message}`);
  console.log(`Inserted expired lock on device ${dbDevice.id}`);

  // Queue recovery run
  const { data: run3, error: err3 } = await supabase
    .from('workflow_runs')
    .insert({
      macro_version_id: versionRecord2.id,
      triggered_by_user_id: userId,
      status: 'QUEUED',
      target_type: 'SINGLE_DEVICE',
      target_selector_json: { target_ids: [dbDevice.id], deviceIds: [dbDevice.id] },
      input_variables_json: { appName: pilotAppName },
    })
    .select('id')
    .single();

  if (err3) throw new Error(`Failed to queue run 3: ${err3.message}`);
  console.log(`Queued recovery run 3: ${run3.id}`);

  const terminalRun3 = await pollRunUntilTerminal(supabase, run3.id);
  console.log(`Run 3 reached terminal status: ${terminalRun3.status}`);

  if (terminalRun3.status !== 'COMPLETED') {
    throw new Error(`Scenario 3 Expected status COMPLETED but got ${terminalRun3.status}`);
  }

  // Verify final locks: 0 remaining
  const { data: locksAfter3 } = await supabase
    .from('device_locks')
    .select('id')
    .eq('device_id', dbDevice.id);

  const cleanLockFinal = !locksAfter3 || locksAfter3.length === 0;
  console.log(`Final clean lock state verified: ${cleanLockFinal}`);
  if (!cleanLockFinal) {
    throw new Error(`Stale lock still present after recovery run: ${JSON.stringify(locksAfter3)}`);
  }

  // Build report artifact
  const timestamp = new Date().toISOString();
  const report = {
    reportPath: join(reportDir, `mobile-mcp-social-pilot-level5-${timestamp.replace(/[:.]/g, '-')}.json`),
    verifiedAt: timestamp,
    verdict: 'pass',
    device: {
      id: dbDevice.id,
      serial: dbDevice.laixi_device_id,
      model: dbDevice.model,
    },
    scenario1_step_failure_lock_release: {
      runId: run1.id,
      status: terminalRun1.status,
      lockReleasedCleanly: lockReleasedAfterFailure,
      pass: terminalRun1.status === 'FAILED' && lockReleasedAfterFailure,
    },
    scenario2_concurrent_lock_mutex: {
      runId: run2.id,
      status: terminalRun2.status,
      errorCode: errorCode2,
      errorMessage: errorMessage2,
      lockEnforced,
      pass: terminalRun2.status === 'FAILED' && lockEnforced,
    },
    scenario3_stale_lock_recovery: {
      runId: run3.id,
      status: terminalRun3.status,
      cleanLockFinal,
      pass: terminalRun3.status === 'COMPLETED' && cleanLockFinal,
    },
  };

  mkdirSync(reportDir, { recursive: true });
  writeFileSync(report.reportPath, JSON.stringify(report, null, 2), 'utf8');

  console.log('\n=== LEVEL 5 RESILIENCE & FAULT RECOVERY VERIFICATION PASSED ===');
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error('Level 5 Verification failed:', err);
  process.exit(1);
});
