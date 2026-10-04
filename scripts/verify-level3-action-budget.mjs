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

const budgetMacroDefinition = {
  version: 1,
  meta: {
    key: 'social_pilot_level3_budget',
    name: 'Social Pilot Level 3 Action Budget',
    description: 'Level 3 Social Pilot: executes budgeted actions and tests strict daily limit cutoff enforcement.',
    tags: ['social-pilot', 'level-3', 'budget-enforcement', 'rate-limit'],
  },
  inputs: {
    accountId: { type: 'string', required: true },
    appName: { type: 'string', required: true },
  },
  target: { mode: 'single_device' },
  execution: { defaultTimeoutMs: 30000, maxRetries: 0, onError: 'stop' },
  steps: [
    { id: 'launch_app', type: 'launch_app', params: { appName: '{{appName}}' } },
    { id: 'wait_ready', type: 'wait', params: { ms: 2000 } },
    {
      id: 'budgeted_action_like',
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

async function ensureBudgetMacro(supabase, profileId) {
  const { data: existing } = await supabase.from('macros').select('id').eq('key', budgetMacroDefinition.meta.key).maybeSingle();
  let macroId = existing?.id;
  if (!macroId) {
    const { data: created, error } = await supabase
      .from('macros')
      .insert({
        key: budgetMacroDefinition.meta.key,
        name: budgetMacroDefinition.meta.name,
        description: budgetMacroDefinition.meta.description,
        created_by_user_id: profileId,
      })
      .select('id')
      .single();
    if (error) throw error;
    macroId = created.id;
  }

  const { data: versions, error: versionsError } = await supabase
    .from('macro_versions')
    .select('id,version_number')
    .eq('macro_id', macroId)
    .order('version_number', { ascending: false })
    .limit(1);
  if (versionsError) throw versionsError;

  const nextVersionNumber = (versions?.[0]?.version_number ?? 0) + 1;
  const { data: version, error: vError } = await supabase
    .from('macro_versions')
    .insert({
      macro_id: macroId,
      version_number: nextVersionNumber,
      status: 'ACTIVE',
      definition_json: budgetMacroDefinition,
      input_schema_json: budgetMacroDefinition.inputs,
      tags_json: budgetMacroDefinition.meta.tags,
      created_by_user_id: profileId,
    })
    .select('id')
    .single();
  if (vError) throw vError;

  await supabase.from('macros').update({ latest_version_id: version.id }).eq('id', macroId);
  return { macroId, versionId: version.id };
}

async function ensureBudgetAccount(supabase, userId, dailyLimit = 1) {
  const username = `pilot_budget_${Date.now()}`;
  const { data: account, error } = await supabase
    .from('accounts')
    .insert({
      user_id: userId,
      username,
      encrypted_password: 'v2:placeholder-budget-test',
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

async function createRun(supabase, { macroVersionId, profileId, deviceId, accountId }) {
  const { data, error } = await supabase
    .from('workflow_runs')
    .insert({
      macro_version_id: macroVersionId,
      triggered_by_user_id: profileId,
      target_type: 'SINGLE_DEVICE',
      target_selector_json: { target_ids: [deviceId] },
      input_variables_json: { accountId, appName: pilotAppName },
      status: 'QUEUED',
    })
    .select('id,status')
    .single();
  if (error) throw error;
  return data.id;
}

async function waitForRun(supabase, runId, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { data: run } = await supabase
      .from('workflow_runs')
      .select('id,status,started_at,finished_at,summary_json')
      .eq('id', runId)
      .single();
    if (run && ['COMPLETED', 'FAILED', 'CANCELLED'].includes(run.status)) {
      return run;
    }
    await new Promise((res) => setTimeout(res, 1500));
  }
  throw new Error(`Run ${runId} timed out`);
}

async function main() {
  mkdirSync(reportDir, { recursive: true });
  const healthy = await checkRuntimeHealth();
  if (!healthy) throw new Error('Local runtime (bridge/worker) is not healthy');

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data: profile } = await supabase.from('profiles').select('id,user_id').limit(1).single();
  const device = await selectPilotDevice(supabase);
  const macro = await ensureBudgetMacro(supabase, profile.id);

  // Setup test account with daily_action_limit = 1
  const account = await ensureBudgetAccount(supabase, profile.user_id, 1);
  console.log(`Created test account ${account.username} (id: ${account.id}) with dailyLimit: 1`);

  // --- Phase 1: Run within budget (should SUCCEED) ---
  console.log('Dispatching Phase 1: Within-budget run...');
  const run1Id = await createRun(supabase, {
    macroVersionId: macro.versionId,
    profileId: profile.id,
    deviceId: device.id,
    accountId: account.id,
  });
  const run1 = await waitForRun(supabase, run1Id);
  console.log(`Phase 1 run ${run1Id} completed with status: ${run1.status}`);

  const { data: run1Steps } = await supabase.from('run_steps').select('*').eq('workflow_run_id', run1Id).order('step_index', { ascending: true });
  const { data: history1 } = await supabase.from('account_action_history').select('*').eq('source_run_id', run1Id);
  const { data: accountAfter1 } = await supabase.from('accounts').select('current_action_count').eq('id', account.id).single();

  const phase1Pass = run1.status === 'COMPLETED' && run1Steps.every((s) => s.status === 'SUCCESS') && history1.length >= 1;

  // --- Phase 2: Run with budget exceeded (should be BLOCKED by policy) ---
  console.log('Dispatching Phase 2: Over-budget run (expecting BUDGET_EXCEEDED)...');
  const run2Id = await createRun(supabase, {
    macroVersionId: macro.versionId,
    profileId: profile.id,
    deviceId: device.id,
    accountId: account.id,
  });
  const run2 = await waitForRun(supabase, run2Id);
  console.log(`Phase 2 run ${run2Id} completed with status: ${run2.status}`);

  const { data: run2Steps } = await supabase.from('run_steps').select('*').eq('workflow_run_id', run2Id).order('step_index', { ascending: true });
  const blockedStep = run2Steps?.find((s) => s.step_id === 'budgeted_action_like');
  const phase2Pass = run2.status === 'FAILED' && blockedStep?.status === 'FAILED' && blockedStep?.error_json?.code === 'BUDGET_EXCEEDED';

  const verdict = phase1Pass && phase2Pass ? 'pass' : 'fail';

  const report = {
    verifiedAt: new Date().toISOString(),
    verdict,
    device: { id: device.id, serial: device.laixi_device_id, model: device.model },
    account: { id: account.id, username: account.username, dailyLimit: 1, currentActionCount: accountAfter1?.current_action_count },
    phase1_within_budget: {
      runId: run1Id,
      status: run1.status,
      pass: phase1Pass,
      stepCount: run1Steps?.length,
      historyCount: history1?.length,
    },
    phase2_over_budget: {
      runId: run2Id,
      status: run2.status,
      pass: phase2Pass,
      blockedStepId: blockedStep?.step_id,
      errorCode: blockedStep?.error_json?.code,
      errorMessage: blockedStep?.error_json?.message,
    },
  };

  const reportPath = join(reportDir, `mobile-mcp-social-pilot-level3-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ reportPath, ...report }, null, 2));

  if (verdict !== 'pass') {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
