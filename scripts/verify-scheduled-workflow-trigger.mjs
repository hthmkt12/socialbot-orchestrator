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

async function main() {
  mkdirSync(reportDir, { recursive: true });
  const healthy = await checkRuntimeHealth();
  if (!healthy) throw new Error('Local runtime (bridge/worker) is not healthy');

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data: profile } = await supabase.from('profiles').select('id,user_id').limit(1).single();
  const device = await selectPilotDevice(supabase);

  // Look up an active macro
  const { data: macro } = await supabase
    .from('macros')
    .select('id,latest_version_id,name')
    .not('latest_version_id', 'is', null)
    .limit(1)
    .single();

  if (!macro) throw new Error('No valid macro found with active version');

  const { data: account } = await supabase.from('accounts').select('id').limit(1).maybeSingle();

  const scheduleName = `pilot_schedule_${Date.now()}`;
  const dueTimeIso = new Date(Date.now() - 10000).toISOString(); // 10s in the past to trigger immediately

  console.log(`Creating scheduled trigger: ${scheduleName} for macro ${macro.name}`);
  const { data: schedule, error: createError } = await supabase
    .from('workflow_schedules')
    .insert({
      name: scheduleName,
      macro_id: macro.id,
      macro_version_id: macro.latest_version_id,
      target_type: 'SINGLE_DEVICE',
      target_device_id: device.id,
      input_variables: { appName: pilotAppName, accountId: account?.id },
      cron_expression: '*/15 * * * *',
      timezone: 'UTC',
      is_active: true,
      next_run_at: dueTimeIso,
      created_by: profile.user_id,
    })
    .select('*')
    .single();

  if (createError) throw createError;
  console.log(`Schedule created: ${schedule.id}, next_run_at: ${schedule.next_run_at}`);

  // Await schedule trigger processing (worker schedule loop polls every 30s)
  console.log('Awaiting worker schedule loop trigger...');
  const pollStart = Date.now();
  let triggeredRun = null;
  let updatedSchedule = null;

  while (Date.now() - pollStart < 45000) {
    const { data: currentSchedule } = await supabase
      .from('workflow_schedules')
      .select('*')
      .eq('id', schedule.id)
      .single();

    if (currentSchedule && currentSchedule.last_run_at) {
      updatedSchedule = currentSchedule;
      console.log(`Schedule triggered at: ${currentSchedule.last_run_at}, next run: ${currentSchedule.next_run_at}`);
      break;
    }
    await new Promise((res) => setTimeout(res, 2000));
  }

  // Deactivate schedule immediately to prevent repeat triggers during test teardown
  await supabase.from('workflow_schedules').update({ is_active: false }).eq('id', schedule.id);

  if (!updatedSchedule) {
    throw new Error('Worker schedule trigger timed out waiting for schedule execution');
  }

  // Find the dispatched workflow run by scheduleId in summary_json
  let pollRunStart = Date.now();
  while (Date.now() - pollRunStart < 15000) {
    const { data: runs } = await supabase
      .from('workflow_runs')
      .select('id,status,created_at,target_type,macro_version_id,summary_json')
      .contains('summary_json', { scheduleId: schedule.id })
      .order('created_at', { ascending: false })
      .limit(1);

    if (runs && runs.length > 0) {
      triggeredRun = runs[0];
      break;
    }
    await new Promise((res) => setTimeout(res, 1000));
  }
  console.log(`Dispatched workflow run ID: ${triggeredRun?.id}, status: ${triggeredRun?.status}`);

  const pass = Boolean(updatedSchedule.last_run_at && triggeredRun);

  const report = {
    verifiedAt: new Date().toISOString(),
    verdict: pass ? 'pass' : 'fail',
    device: { id: device.id, serial: device.laixi_device_id, model: device.model },
    schedule: {
      id: schedule.id,
      name: schedule.name,
      cronExpression: schedule.cron_expression,
      initialNextRunAt: schedule.next_run_at,
      triggeredAt: updatedSchedule.last_run_at,
      nextScheduledRun: updatedSchedule.next_run_at,
    },
    triggeredRun: {
      id: triggeredRun?.id,
      status: triggeredRun?.status,
      targetType: triggeredRun?.target_type,
    },
  };

  const reportPath = join(reportDir, `mobile-mcp-scheduled-trigger-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ reportPath, ...report }, null, 2));

  if (!pass) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
