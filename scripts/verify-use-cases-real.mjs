import { createClient } from '@supabase/supabase-js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(fileURLToPath(new URL('..', import.meta.url)));
const reportDir = join(rootDir, 'plans', 'reports');
const reportPath = join(reportDir, `use-case-real-verify-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
const args = new Set(process.argv.slice(2));
const mutate = args.has('--mutate');

function loadDotEnv(path) {
  if (!existsSync(path)) return {};
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
}

const env = { ...loadDotEnv(join(rootDir, '.env')), ...process.env };
const supabaseUrl = env.VITE_SUPABASE_URL ?? env.SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY ?? env.SUPABASE_ANON_KEY;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
const bridgeUrl = env.MOBILE_MCP_BRIDGE_URL ?? env.VITE_MOBILE_MCP_BRIDGE_URL ?? 'http://127.0.0.1:4321';
const workerUrl = env.VITE_WORKER_BASE_URL ?? 'http://127.0.0.1:4310';
const uiUrl = env.UI_SMOKE_BASE_URL ?? 'http://127.0.0.1:5173';
const runPrefix = `real-verify-${Date.now()}`;

const report = {
  checkedAt: new Date().toISOString(),
  mode: mutate ? 'mutate' : 'read-only',
  sources: [
    'docs/use-cases.md',
    'docs/use-cases-next-pilot-readiness-safe-scale.md',
  ],
  env: {
    supabaseUrl: supabaseUrl ? redactUrl(supabaseUrl) : null,
    hasAnonKey: Boolean(supabaseAnonKey),
    hasServiceRoleKey: Boolean(serviceRoleKey),
    hasUiSmokeLogin: Boolean(env.UI_SMOKE_EMAIL && env.UI_SMOKE_PASSWORD),
    bridgeUrl,
    workerUrl,
    uiUrl,
  },
  cases: [],
};

function buildLevel1Evidence(evidence) {
  return {
    pilot_level: 'level_1',
    backend_mode: evidence.workerBackend ?? 'unknown',
    bridge_health: evidence.bridgeStatus && evidence.bridgeStatus < 500 ? 'ok' : 'failed',
    worker_health: evidence.workerStatus && evidence.workerStatus < 500 ? 'ok' : 'failed',
    supabase_health: evidence.latestRunError ? 'failed' : 'ok',
    expected_serials: env.MOBILE_MCP_EXPECTED_SERIALS?.split(',').map((serial) => serial.trim()).filter(Boolean) ?? [],
    observed_serials: evidence.bridgeDeviceIds ?? [],
    run_id: evidence.latestRunId,
    run_status: evidence.latestRunStatus,
    artifact_refs: evidence.artifactRefs ?? [],
    secret_scrub_status: containsSensitiveKey(evidence) ? 'blocked' : 'passed',
    claim_summary: 'Level 1 Mobile MCP Android readiness evidence snapshot from real use-case verifier.',
  };
}

function redactUrl(value) {
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}`;
  } catch {
    return value;
  }
}

function json(value) {
  return JSON.stringify(value, null, 2);
}

function printCase(result) {
  const icon = result.status.padEnd(4, ' ');
  console.log(`${icon} ${result.id} - ${result.title}`);
  for (const line of result.lines) {
    console.log(`     ${line}`);
  }
}

async function runCase(id, title, fn) {
  const startedAt = Date.now();
  try {
    const value = await fn();
    const result = {
      id,
      title,
      status: value.status ?? 'INFO',
      lines: value.lines ?? [],
      data: value.data ?? null,
      elapsedMs: Date.now() - startedAt,
    };
    report.cases.push(result);
    printCase(result);
  } catch (error) {
    const result = {
      id,
      title,
      status: 'FAIL',
      lines: [error instanceof Error ? error.message : String(error)],
      data: null,
      elapsedMs: Date.now() - startedAt,
    };
    report.cases.push(result);
    printCase(result);
  }
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(5000) });
  const text = await response.text();
  let body = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text.slice(0, 500);
  }
  return { ok: response.ok, status: response.status, body };
}

function requireSupabaseConfig() {
  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      status: 'SKIP',
      lines: ['Missing VITE_SUPABASE_URL/SUPABASE_URL or VITE_SUPABASE_ANON_KEY/SUPABASE_ANON_KEY.'],
    };
  }
  return null;
}

const anonClient = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;
const serviceClient = supabaseUrl && serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;
let authClient = null;
let signedInProfile = null;

async function signInSmokeUser() {
  if (!anonClient) return { error: 'Supabase anon client unavailable' };
  if (!env.UI_SMOKE_EMAIL || !env.UI_SMOKE_PASSWORD) return { error: 'UI_SMOKE_EMAIL/UI_SMOKE_PASSWORD missing' };

  authClient = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await authClient.auth.signInWithPassword({
    email: env.UI_SMOKE_EMAIL,
    password: env.UI_SMOKE_PASSWORD,
  });
  if (error) return { error: error.message };

  const { data: profile, error: profileError } = await authClient
    .from('profiles')
    .select('id,user_id,email,role,created_at')
    .eq('user_id', data.user.id)
    .maybeSingle();

  if (profileError) return { error: profileError.message };
  signedInProfile = profile;
  return { user: data.user, profile };
}

async function countRows(client, table, select = 'id') {
  const { count, error } = await client
    .from(table)
    .select(select, { count: 'exact' })
    .limit(1);
  return { count, error };
}

async function sampleRows(client, table, columns, limit = 3) {
  const { data, error } = await client
    .from(table)
    .select(columns)
    .limit(limit);
  return { data: data ?? [], error };
}

function summarizeRows(rows, fields) {
  return rows.map((row) => Object.fromEntries(fields.map((field) => [field, row[field] ?? null])));
}

function sourceStats(path) {
  if (!existsSync(path)) return { exists: false, useCaseLines: 0, antiUseCaseLines: 0, errorLines: 0 };
  const text = readFileSync(path, 'utf8');
  return {
    exists: true,
    useCaseLines: (text.match(/- La .* toi co the /g) ?? []).length,
    antiUseCaseLines: (text.match(/KHONG THE/g) ?? []).length,
    errorLines: (text.match(/- La .* khi /g) ?? []).length,
  };
}

function containsSensitiveKey(value) {
  const text = typeof value === 'string' ? value : json(value);
  return /(secret|token|password|service[_-]?role|api[_-]?key)/i.test(text);
}

async function main() {
  mkdirSync(reportDir, { recursive: true });
  console.log(`Real use-case verification`);
  console.log(`mode: ${report.mode}`);
  console.log(`report: ${reportPath}`);
  console.log('');

  await runCase('ENV-001', 'Runtime configuration loaded', async () => ({
    status: supabaseUrl && supabaseAnonKey ? 'PASS' : 'FAIL',
    lines: [
      `Supabase URL: ${supabaseUrl ? redactUrl(supabaseUrl) : 'missing'}`,
      `Anon key: ${supabaseAnonKey ? 'present' : 'missing'}`,
      `Service role key: ${serviceRoleKey ? 'present' : 'missing'}`,
      `UI smoke login: ${env.UI_SMOKE_EMAIL ? env.UI_SMOKE_EMAIL : 'missing'}`,
      `Mutation mode: ${mutate ? 'enabled' : 'disabled'}`,
    ],
  }));

  await runCase('SOURCES-001', 'Old and new use-case source files loaded', async () => {
    const files = report.sources.map((source) => ({
      source,
      ...sourceStats(join(rootDir, source)),
    }));
    return {
      status: files.every((file) => file.exists) ? 'PASS' : 'WARN',
      lines: files.map((file) => (
        `${file.source}: exists=${file.exists}, can=${file.useCaseLines}, cannot=${file.antiUseCaseLines}, error=${file.errorLines}`
      )),
      data: files,
    };
  });

  await runCase('VIS-AUTH-001', 'Visitor can reach Supabase auth API', async () => {
    const missing = requireSupabaseConfig();
    if (missing) return missing;
    const { data, error } = await anonClient.auth.getSession();
    return {
      status: error ? 'FAIL' : 'PASS',
      lines: [
        error ? `auth.getSession error: ${error.message}` : 'auth.getSession returned successfully',
        `current anon session: ${data.session ? 'present' : 'none'}`,
      ],
      data: { hasSession: Boolean(data.session) },
    };
  });

  await runCase('AUTH-LOGIN-001', 'Real smoke user login and profile read', async () => {
    const missing = requireSupabaseConfig();
    if (missing) return missing;
    const result = await signInSmokeUser();
    if (result.error) {
      return {
        status: 'SKIP',
        lines: [result.error],
      };
    }
    return {
      status: result.profile ? 'PASS' : 'WARN',
      lines: [
        `email: ${result.user.email}`,
        `user id: ${result.user.id}`,
        `profile role: ${result.profile?.role ?? 'missing profile'}`,
        `profile id: ${result.profile?.id ?? 'missing'}`,
      ],
      data: { userId: result.user.id, profile: result.profile },
    };
  });

  const readClient = serviceClient ?? authClient ?? anonClient;

  await runCase('DATA-READ-001', 'Core table counts from real Supabase', async () => {
    if (!readClient) return requireSupabaseConfig();
    const tables = ['profiles', 'devices', 'macros', 'workflow_runs', 'accounts', 'execution_profiles', 'pilot_readiness_reports'];
    const lines = [];
    const data = {};
    for (const table of tables) {
      const { count, error } = await countRows(readClient, table);
      data[table] = error ? { error: error.message } : { count };
      lines.push(`${table}: ${error ? `ERROR ${error.message}` : `${count ?? 0} rows`}`);
    }
    return { status: lines.some((line) => line.includes('ERROR')) ? 'WARN' : 'PASS', lines, data };
  });

  await runCase('AUTH-RLS-READ-001', 'Signed-in smoke user can read allowed real data through RLS', async () => {
    if (!authClient) return { status: 'SKIP', lines: ['Smoke user is not signed in; RLS read check skipped.'] };
    const tables = ['profiles', 'devices', 'macros', 'workflow_runs'];
    const lines = [`signed-in role: ${signedInProfile?.role ?? 'unknown'}`];
    const data = {};
    for (const table of tables) {
      const { count, error } = await countRows(authClient, table);
      data[table] = error ? { error: error.message } : { count };
      lines.push(`${table}: ${error ? `ERROR ${error.message}` : `${count ?? 0} rows visible`}`);
    }
    return { status: lines.some((line) => line.includes('ERROR')) ? 'WARN' : 'PASS', lines, data };
  });

  await runCase('VIEW-RUNS-001', 'Run list/detail evidence uses real runs and steps', async () => {
    if (!readClient) return requireSupabaseConfig();
    const { data: runs, error } = await readClient
      .from('workflow_runs')
      .select('id,status,target_type,created_at,summary_json')
      .order('created_at', { ascending: false })
      .limit(3);
    if (error) return { status: 'FAIL', lines: [error.message] };
    if (!runs?.length) return { status: 'WARN', lines: ['No workflow_runs rows found.'] };
    const run = runs[0];
    const { data: steps, error: stepError } = await readClient
      .from('run_steps')
      .select('id,step_id,status,retry_count,error_json,output_json')
      .eq('workflow_run_id', run.id)
      .order('step_index', { ascending: true })
      .limit(5);
    return {
      status: stepError ? 'WARN' : 'PASS',
      lines: [
        `latest run: ${run.id}`,
        `status: ${run.status}, target: ${run.target_type}, created: ${run.created_at}`,
        `sample steps: ${stepError ? `ERROR ${stepError.message}` : `${steps?.length ?? 0}`}`,
        `summary keys: ${Object.keys(run.summary_json ?? {}).join(', ') || 'none'}`,
      ],
      data: { run, steps },
    };
  });

  await runCase('DEVICES-001', 'Real devices and lock visibility', async () => {
    if (!readClient) return requireSupabaseConfig();
    const devices = await sampleRows(readClient, 'devices', 'id,laixi_device_id,name,model,status,heartbeat_freshness,last_seen_at', 5);
    const locks = await sampleRows(readClient, 'device_locks', 'id,device_id,workflow_run_id,expires_at', 5);
    return {
      status: devices.error ? 'FAIL' : 'PASS',
      lines: [
        devices.error ? devices.error.message : `devices sampled: ${devices.data.length}`,
        locks.error ? `device_locks error: ${locks.error.message}` : `visible locks sampled: ${locks.data.length}`,
        `devices: ${json(summarizeRows(devices.data, ['laixi_device_id', 'name', 'status', 'heartbeat_freshness']))}`,
      ],
      data: { devices: devices.data, locks: locks.data },
    };
  });

  await runCase('MACROS-001', 'Real macros and active versions', async () => {
    if (!readClient) return requireSupabaseConfig();
    const { data, error } = await readClient
      .from('macros')
      .select('id,key,name,latest_version_id')
      .limit(5);
    if (error) return { status: 'FAIL', lines: [error.message] };
    const active = (data ?? []).filter((macro) => macro.latest_version_id);
    return {
      status: active.length > 0 ? 'PASS' : 'WARN',
      lines: [
        `macros sampled: ${data?.length ?? 0}`,
        `with latest_version_id: ${active.length}`,
        `sample: ${json(summarizeRows(data ?? [], ['key', 'name', 'latest_version_id']))}`,
      ],
      data,
    };
  });

  await runCase('OPS-GOVERNANCE-001', 'Real schedule, approval, and audit-log surfaces', async () => {
    if (!readClient) return requireSupabaseConfig();
    const tables = ['workflow_schedules', 'approvals', 'audit_logs'];
    const lines = [];
    const data = {};
    for (const table of tables) {
      const { count, error } = await countRows(readClient, table);
      data[table] = error ? { error: error.message } : { count };
      lines.push(`${table}: ${error ? `ERROR ${error.message}` : `${count ?? 0} rows`}`);
    }
    return { status: lines.some((line) => line.includes('ERROR')) ? 'WARN' : 'PASS', lines, data };
  });

  await runCase('ACCOUNTS-001', 'Real accounts, blocked flags, and action history', async () => {
    if (!readClient) return requireSupabaseConfig();
    const accounts = await sampleRows(readClient, 'accounts', 'id,username,platform,is_blocked,daily_action_limit,current_action_count,warm_up_stage', 5);
    const history = await sampleRows(readClient, 'account_action_history', 'id,account_id,action_type,success,created_at', 5);
    return {
      status: accounts.error ? 'FAIL' : 'PASS',
      lines: [
        accounts.error ? accounts.error.message : `accounts sampled: ${accounts.data.length}`,
        history.error ? `history error: ${history.error.message}` : `action history sampled: ${history.data.length}`,
        `accounts: ${json(summarizeRows(accounts.data, ['username', 'platform', 'is_blocked', 'current_action_count', 'daily_action_limit']))}`,
      ],
      data: { accounts: accounts.data, history: history.data },
    };
  });

  await runCase('CREDENTIALS-001', 'Real credential boundary and plaintext exposure guardrail', async () => {
    if (!readClient) return requireSupabaseConfig();
    const { data, error } = await readClient
      .from('accounts')
      .select('id,username,platform,encrypted_password')
      .limit(5);
    if (error) return { status: 'FAIL', lines: [error.message] };
    const rows = data ?? [];
    const plaintextLike = rows.filter((row) => {
      const value = String(row.encrypted_password ?? '');
      return value && !value.startsWith('v2:');
    });
    return {
      status: plaintextLike.length ? 'FAIL' : rows.length ? 'PASS' : 'WARN',
      lines: [
        `accounts inspected: ${rows.length}`,
        `plaintext-like credential rows: ${plaintextLike.length}`,
        `sample credential prefixes: ${rows.map((row) => `${row.username}:${String(row.encrypted_password ?? '').slice(0, 3) || 'empty'}`).join(', ') || 'none'}`,
      ],
      data: { inspected: summarizeRows(rows, ['username', 'platform']), plaintextLike },
    };
  });

  await runCase('ANALYTICS-001', 'Real analytics rows and account growth RPC', async () => {
    if (!readClient) return requireSupabaseConfig();
    const { data: analytics, error } = await readClient
      .from('account_analytics')
      .select('id,account_id,snapshot_date,followers_count,engagement_rate')
      .order('snapshot_date', { ascending: false })
      .limit(5);
    if (error) return { status: 'FAIL', lines: [error.message] };
    if (!analytics?.length) {
      return { status: 'WARN', lines: ['No account_analytics rows found; analytics UI should show Insufficient data.'] };
    }
    const accountId = analytics[0].account_id;
    const { data: growth, error: rpcError } = await readClient.rpc('get_account_growth', {
      p_account_id: accountId,
      p_days: 30,
    });
    return {
      status: rpcError ? 'WARN' : 'PASS',
      lines: [
        `analytics rows sampled: ${analytics.length}`,
        `sample account_id: ${accountId}`,
        rpcError ? `get_account_growth error: ${rpcError.message}` : `get_account_growth: ${json(growth?.[0] ?? null)}`,
      ],
      data: { analytics, growth },
    };
  });

  await runCase('READINESS-001', 'Real pilot readiness reports', async () => {
    if (!readClient) return requireSupabaseConfig();
    const { data, error } = await readClient
      .from('pilot_readiness_reports')
      .select('id,backend,status,report_path,reviewed_at,created_at,evidence_json')
      .order('created_at', { ascending: false })
      .limit(5);
    if (error) return { status: 'FAIL', lines: [error.message] };
    return {
      status: data?.length ? 'PASS' : 'WARN',
      lines: [
        `readiness reports sampled: ${data?.length ?? 0}`,
        `reports: ${json(summarizeRows(data ?? [], ['id', 'backend', 'status', 'report_path', 'reviewed_at']))}`,
      ],
      data,
    };
  });

  await runCase('READINESS-EVIDENCE-001', 'Real go/no-go evidence currently available for pilot readiness', async () => {
    if (!readClient) return requireSupabaseConfig();
    const { data: runs, error: runError } = await readClient
      .from('workflow_runs')
      .select('id,status,target_type,created_at,summary_json')
      .order('created_at', { ascending: false })
      .limit(1);
    const bridge = await fetchJson(`${bridgeUrl}/health`);
    const worker = await fetchJson(`${workerUrl}/health`);
    const ui = await fetch(uiUrl, { method: 'HEAD', signal: AbortSignal.timeout(5000) }).then((response) => response.status).catch((error) => String(error));
    const latestRun = runs?.[0] ?? null;
    const bridgeDeviceIds = bridge.body?.output?.devices?.map((device) => device.id ?? device.serial).filter(Boolean) ?? [];
    const evidence = {
      bridgeStatus: bridge.status,
      bridgeAuthConfigured: bridge.body?.authConfigured ?? null,
      bridgeSessionCount: bridge.body?.sessionCount ?? null,
      bridgeDeviceIds,
      workerStatus: worker.status,
      workerBackend: worker.body?.deviceBackend ?? null,
      uiStatus: ui,
      latestRunError: runError?.message ?? null,
      latestRunId: latestRun?.id ?? null,
      latestRunStatus: latestRun?.status ?? null,
      latestRunTarget: latestRun?.target_type ?? null,
      artifactRefs: latestRun?.summary_json?.artifactRefs ?? latestRun?.summary_json?.artifacts ?? [],
    };
    const level1Evidence = buildLevel1Evidence(evidence);
    report.readinessEvidence = level1Evidence;
    return {
      status: runError ? 'WARN' : 'PASS',
      lines: [
        `bridge: ${bridge.status}, authConfigured=${evidence.bridgeAuthConfigured}, sessionCount=${evidence.bridgeSessionCount}`,
        `observed serials: ${bridgeDeviceIds.join(', ') || 'none'}`,
        `worker: ${worker.status}, backend=${evidence.workerBackend}`,
        `ui: ${ui}`,
        `latest run: ${evidence.latestRunId ?? 'none'} ${evidence.latestRunStatus ?? ''} ${evidence.latestRunTarget ?? ''}`.trim(),
        `level1 evidence: pilot_level=${level1Evidence.pilot_level}, backend_mode=${level1Evidence.backend_mode}, secret_scrub_status=${level1Evidence.secret_scrub_status}`,
      ],
      data: { evidence, level1Evidence },
    };
  });

  await runCase('READINESS-MUTATE-001', 'Optional real readiness create/update cleanup', async () => {
    if (!mutate) return { status: 'SKIP', lines: ['Run with --mutate to create a temporary real readiness report and clean it up.'] };
    if (!serviceClient) return { status: 'SKIP', lines: ['SUPABASE_SERVICE_ROLE_KEY missing; mutation check not run.'] };
    const payload = {
      backend: 'mobile_mcp',
      status: 'submitted',
      report_path: `plans/reports/${runPrefix}.md`,
      evidence_json: {
        runtimeStatus: 'verification-script',
        reportStatus: 'temporary',
        runId: runPrefix,
        smokeResult: 'not-a-claim',
      },
    };
    const { data: inserted, error: insertError } = await serviceClient
      .from('pilot_readiness_reports')
      .insert(payload)
      .select('id,backend,status,report_path,evidence_json')
      .maybeSingle();
    if (insertError) return { status: 'FAIL', lines: [`insert error: ${insertError.message}`] };
    const { data: updated, error: updateError } = await serviceClient
      .from('pilot_readiness_reports')
      .update({ status: 'needs_rerun', review_notes: 'Temporary verification script cleanup path.' })
      .eq('id', inserted.id)
      .select('id,status,review_notes')
      .maybeSingle();
    const { error: deleteError } = await serviceClient
      .from('pilot_readiness_reports')
      .delete()
      .eq('id', inserted.id);
    return {
      status: updateError || deleteError ? 'WARN' : 'PASS',
      lines: [
        `inserted temp report id: ${inserted.id}`,
        updateError ? `update error: ${updateError.message}` : `updated status: ${updated.status}`,
        deleteError ? `cleanup delete error: ${deleteError.message}` : 'cleanup delete: ok',
      ],
      data: { inserted, updated },
    };
  });

  await runCase('EXEC-PROFILES-001', 'Real execution profiles retry and target failure policy', async () => {
    if (!readClient) return requireSupabaseConfig();
    const { data, error } = await readClient
      .from('execution_profiles')
      .select('id,name,max_retries,retry_base_delay_ms,retry_max_delay_ms,retry_max_elapsed_ms,target_failure_policy')
      .limit(10);
    if (error) return { status: 'FAIL', lines: [error.message] };
    const invalid = (data ?? []).filter((profile) => !['fail_fast', 'skip_failed_target'].includes(profile.target_failure_policy));
    return {
      status: invalid.length ? 'FAIL' : data?.length ? 'PASS' : 'WARN',
      lines: [
        `execution profiles sampled: ${data?.length ?? 0}`,
        `invalid target_failure_policy rows: ${invalid.length}`,
        `profiles: ${json(summarizeRows(data ?? [], ['name', 'max_retries', 'retry_base_delay_ms', 'retry_max_delay_ms', 'retry_max_elapsed_ms', 'target_failure_policy']))}`,
      ],
      data,
    };
  });

  await runCase('FAILOVER-RETRY-001', 'Real retry/backoff and dispatchable target guardrail facts', async () => {
    if (!readClient) return requireSupabaseConfig();
    const devices = await sampleRows(readClient, 'devices', 'id,laixi_device_id,name,status,heartbeat_freshness', 20);
    const profiles = await sampleRows(readClient, 'execution_profiles', 'id,name,max_retries,retry_base_delay_ms,retry_max_delay_ms,retry_max_elapsed_ms,target_failure_policy', 10);
    if (devices.error || profiles.error) {
      return { status: 'FAIL', lines: [devices.error?.message, profiles.error?.message].filter(Boolean) };
    }
    const nonDispatchable = devices.data.filter((device) => (
      device.status !== 'ONLINE' || device.heartbeat_freshness !== 'fresh'
    ));
    const invalidProfiles = profiles.data.filter((profile) => (
      profile.max_retries > 10 ||
      profile.retry_max_delay_ms < profile.retry_base_delay_ms ||
      !['fail_fast', 'skip_failed_target'].includes(profile.target_failure_policy)
    ));
    return {
      status: invalidProfiles.length ? 'FAIL' : 'PASS',
      lines: [
        `devices inspected: ${devices.data.length}`,
        `non-dispatchable devices: ${nonDispatchable.length}`,
        `execution profiles inspected: ${profiles.data.length}`,
        `invalid retry/failure policies: ${invalidProfiles.length}`,
        `profiles: ${json(summarizeRows(profiles.data, ['name', 'max_retries', 'retry_base_delay_ms', 'retry_max_delay_ms', 'retry_max_elapsed_ms', 'target_failure_policy']))}`,
      ],
      data: { devices: devices.data, nonDispatchable, profiles: profiles.data, invalidProfiles },
    };
  });

  await runCase('ARTIFACTS-001', 'Real run artifacts and inline payload size evidence', async () => {
    if (!readClient) return requireSupabaseConfig();
    const { data, error } = await readClient
      .from('run_steps')
      .select('id,workflow_run_id,step_id,status,output_json,error_json,screenshot_artifact_id')
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) return { status: 'FAIL', lines: [error.message] };
    const rows = data ?? [];
    const withScreenshotPath = rows.filter((row) => JSON.stringify(row.output_json ?? {}).includes('screenshot'));
    const oversizedInline = rows.filter((row) => JSON.stringify(row.output_json ?? {}).length > 50_000 || JSON.stringify(row.error_json ?? {}).length > 50_000);
    return {
      status: oversizedInline.length ? 'WARN' : 'PASS',
      lines: [
        `run steps inspected: ${rows.length}`,
        `steps with screenshot evidence/path: ${withScreenshotPath.length}`,
        `oversized inline output/error payloads >50KB: ${oversizedInline.length}`,
      ],
      data: {
        samples: summarizeRows(rows.slice(0, 5), ['workflow_run_id', 'step_id', 'status', 'screenshot_artifact_id']),
        oversizedInline: summarizeRows(oversizedInline, ['workflow_run_id', 'step_id', 'status']),
      },
    };
  });

  await runCase('BRIDGE-001', 'Real Mobile MCP bridge health/devices API', async () => {
    const health = await fetchJson(`${bridgeUrl}/health`);
    let devices = null;
    try {
      devices = await fetchJson(`${bridgeUrl}/devices`);
    } catch (error) {
      return {
        status: health.ok ? 'WARN' : 'FAIL',
        lines: [
          `/health -> ${health.status}`,
          `/devices error: ${error instanceof Error ? error.message : String(error)}`,
        ],
        data: { health },
      };
    }
    const ids = devices.body?.output?.devices?.map((device) => device.id ?? device.serial) ?? [];
    return {
      status: health.ok && devices.ok ? 'PASS' : 'WARN',
      lines: [
        `/health -> ${health.status}`,
        `/devices -> ${devices.status}`,
        `device ids: ${ids.join(', ') || 'none'}`,
        `auth mode: ${health.body?.authRequired === false ? 'insecure/no-token' : health.body?.authRequired === true ? 'token-required' : 'unknown'}`,
        `authConfigured: ${health.body?.authConfigured ?? 'unknown'}`,
        `protectedEndpointsAvailable: ${health.body?.protectedEndpointsAvailable ?? 'unknown'}`,
        `health leaks sensitive keys: ${containsSensitiveKey(health.body) ? 'yes' : 'no'}`,
      ],
      data: { health: health.body, devices: devices.body },
    };
  });

  await runCase('WORKER-001', 'Real execution worker health API', async () => {
    const health = await fetchJson(`${workerUrl}/health`);
    return {
      status: health.ok ? 'PASS' : 'WARN',
      lines: [
        `/health -> ${health.status}`,
        `deviceBackend: ${health.body?.deviceBackend ?? 'unknown'}`,
        `activeClaims: ${health.body?.activeClaims ?? 'unknown'}`,
        `instanceId: ${health.body?.instanceId ?? 'unknown'}`,
      ],
      data: health.body,
    };
  });

  await runCase('UI-001', 'Real UI endpoint responds', async () => {
    try {
      const response = await fetch(uiUrl, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
      return {
        status: response.ok ? 'PASS' : 'WARN',
        lines: [`${uiUrl} -> ${response.status}`],
      };
    } catch (error) {
      return {
        status: 'WARN',
        lines: [error instanceof Error ? error.message : String(error)],
      };
    }
  });

  const totals = report.cases.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] ?? 0) + 1;
    return acc;
  }, {});
  report.totals = totals;
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log('');
  console.log(`Totals: ${json(totals)}`);
  console.log(`Saved report: ${reportPath}`);
}

main().catch((error) => {
  report.fatal = error instanceof Error ? error.message : String(error);
  mkdirSync(reportDir, { recursive: true });
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.error(report.fatal);
  console.error(`Saved report: ${reportPath}`);
  process.exit(1);
});
