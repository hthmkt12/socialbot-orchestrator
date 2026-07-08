import { createClient } from '@supabase/supabase-js';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(fileURLToPath(new URL('..', import.meta.url)));
const reportDir = join(rootDir, 'plans', 'reports');
const isWindows = process.platform === 'win32';
const reportPath = join(reportDir, `mobile-mcp-preflight-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);

function loadDotEnv(path) {
  if (!existsSync(path)) return {};
  return Object.fromEntries(
    readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const index = line.indexOf('=');
        return [line.slice(0, index), line.slice(index + 1)];
      })
  );
}

const dotEnv = loadDotEnv(join(rootDir, '.env'));
const env = { ...dotEnv, ...process.env };
const bridgeUrl = env.MOBILE_MCP_BRIDGE_URL ?? env.VITE_MOBILE_MCP_BRIDGE_URL ?? 'http://127.0.0.1:4321';
const workerUrl = env.VITE_WORKER_BASE_URL ?? 'http://127.0.0.1:4310';
const uiUrl = env.UI_SMOKE_BASE_URL ?? 'http://127.0.0.1:5173';
const bridgeToken = env.MOBILE_MCP_BRIDGE_TOKEN;
const macroName = env.UI_SMOKE_MACRO_NAME ?? 'Mobile MCP DB Multi Smoke';
const expectedSerials = parseCsv(dotEnv.MOBILE_MCP_EXPECTED_SERIALS ?? process.env.MOBILE_MCP_EXPECTED_SERIALS);
const defaultDeviceMatches = expectedSerials.length ? expectedSerials.join(',') : '23106RN0DA,SM-A515F';
const deviceMatchSource = expectedSerials.length ? defaultDeviceMatches : (env.UI_SMOKE_DEVICE_MATCHES ?? defaultDeviceMatches);
const deviceMatches = deviceMatchSource
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const checks = [];

function parseCsv(value) {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function addCheck(name, ok, detail) {
  checks.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}: ${detail}`);
}

function findAdb() {
  if (env.ADB_PATH && existsSync(env.ADB_PATH)) return env.ADB_PATH;
  if (isWindows) {
    const result = spawnSync('where.exe', ['adb'], { encoding: 'utf8', windowsHide: true });
    const found = result.stdout?.split(/\r?\n/).find((line) => line.trim());
    if (found) return found.trim();
  }
  return 'adb';
}

function readAdbDevices() {
  const adb = findAdb();
  const result = spawnSync(adb, ['devices', '-l'], {
    cwd: rootDir,
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.error) return { ok: false, adb, devices: [], raw: result.error.message };
  const raw = (result.stdout || result.stderr || '').trim();
  const devices = raw
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({ serial: line.split(/\s+/)[0], raw: line, online: /\sdevice\s/.test(line) }));
  return { ok: result.status === 0, adb, devices, raw };
}

async function fetchJson(url, options = {}) {
  const headers = {
    ...(options.headers ?? {}),
    ...(bridgeToken && url.startsWith(bridgeUrl) ? { 'x-bridge-token': bridgeToken } : {}),
  };
  const response = await fetch(url, { ...options, headers, signal: AbortSignal.timeout(5000) });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { ok: response.ok, status: response.status, body };
}

async function main() {
  mkdirSync(reportDir, { recursive: true });

  const requiredEnv = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];
  for (const name of requiredEnv) {
    addCheck(`env.${name}`, Boolean(env[name]), env[name] ? 'set' : 'missing');
  }
  addCheck('env.SUPABASE_SERVICE_ROLE_KEY', true, env.SUPABASE_SERVICE_ROLE_KEY ? 'set in shell/env' : 'missing; needed only when starting a new worker');

  const adb = readAdbDevices();
  addCheck('adb.available', adb.ok, adb.ok ? adb.adb : adb.raw);
  const onlineSerials = adb.devices.filter((device) => device.online).map((device) => device.serial);
  addCheck('adb.onlineDevices', onlineSerials.length >= deviceMatches.length, onlineSerials.join(', ') || 'none');
  if (expectedSerials.length) {
    const missing = expectedSerials.filter((serial) => !onlineSerials.includes(serial));
    addCheck('adb.expectedSerials', missing.length === 0, missing.length ? `missing ${missing.join(', ')}` : expectedSerials.join(', '));
  }

  try {
    const bridgeHealth = await fetchJson(`${bridgeUrl}/health`);
    addCheck('bridge.health', bridgeHealth.ok, `${bridgeUrl}/health -> ${bridgeHealth.status}`);
    addCheck('bridge.auth', bridgeHealth.body?.authRequired === true || bridgeHealth.body?.insecureDevMode === true, bridgeHealth.body?.authRequired === true ? 'token-required' : bridgeHealth.body?.insecureDevMode === true ? 'explicit insecure local mode' : 'not configured');
    const bridgeDevices = await fetchJson(`${bridgeUrl}/devices`);
    const ids = bridgeDevices.body?.output?.devices?.map((device) => device.id ?? device.serial) ?? [];
    addCheck('bridge.devices', ids.length >= deviceMatches.length, ids.join(', ') || 'none');
    if (expectedSerials.length) {
      const missing = expectedSerials.filter((serial) => !ids.includes(serial));
      addCheck('bridge.expectedSerials', missing.length === 0, missing.length ? `missing ${missing.join(', ')}` : expectedSerials.join(', '));
    }
  } catch (error) {
    addCheck('bridge', false, error instanceof Error ? error.message : String(error));
  }

  try {
    const workerHealth = await fetchJson(`${workerUrl}/health`);
    addCheck('worker.health', workerHealth.ok, `${workerUrl}/health -> ${workerHealth.status}`);
    addCheck('worker.mobileMcpBackend', workerHealth.body?.deviceBackend === 'mobile-mcp', workerHealth.body?.deviceBackend ?? 'unknown');
  } catch (error) {
    addCheck('worker', false, error instanceof Error ? error.message : String(error));
  }

  try {
    const uiHealth = await fetch(uiUrl, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
    addCheck('ui.health', uiHealth.ok, `${uiUrl} -> ${uiHealth.status}`);
  } catch (error) {
    addCheck('ui', false, error instanceof Error ? error.message : String(error));
  }

  if (env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY) {
    const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
    if (env.UI_SMOKE_EMAIL && env.UI_SMOKE_PASSWORD) {
      const { error } = await supabase.auth.signInWithPassword({
        email: env.UI_SMOKE_EMAIL,
        password: env.UI_SMOKE_PASSWORD,
      });
      addCheck('auth.operatorLogin', !error, error?.message ?? env.UI_SMOKE_EMAIL);
    } else {
      addCheck('auth.operatorLogin', false, 'UI_SMOKE_EMAIL/UI_SMOKE_PASSWORD missing; UI smoke will fail');
    }

    const macroResult = await supabase
      .from('macros')
      .select('id,key,name,latest_version_id')
      .or(`name.eq.${macroName},key.eq.mobile_mcp_db_multi_smoke`)
      .limit(1);
    addCheck('db.macro', !macroResult.error && Boolean(macroResult.data?.[0]?.latest_version_id), macroResult.error?.message ?? macroResult.data?.[0]?.name ?? 'missing');

    const deviceResult = await supabase
      .from('devices')
      .select('laixi_device_id,name,model,status')
      .in('laixi_device_id', onlineSerials);
    const dbDevices = deviceResult.data ?? [];
    const matched = deviceMatches.filter((match) =>
      dbDevices.some((device) => [device.laixi_device_id, device.name, device.model].some((value) => String(value ?? '').includes(match)))
    );
    addCheck('db.devices', !deviceResult.error && matched.length === deviceMatches.length, deviceResult.error?.message ?? `${matched.length}/${deviceMatches.length} matched`);

    if (expectedSerials.length) {
      const expectedDeviceResult = await supabase
        .from('devices')
        .select('laixi_device_id,name,model,status')
        .in('laixi_device_id', expectedSerials);
      const expectedDbSerials = expectedDeviceResult.data?.map((device) => device.laixi_device_id).filter(Boolean) ?? [];
      const missing = expectedSerials.filter((serial) => !expectedDbSerials.includes(serial));
      addCheck('db.expectedSerials', !expectedDeviceResult.error && missing.length === 0, expectedDeviceResult.error?.message ?? (missing.length ? `missing ${missing.join(', ')}` : expectedSerials.join(', ')));
    }
  }

  const report = { checkedAt: new Date().toISOString(), bridgeUrl, workerUrl, uiUrl, macroName, deviceMatches, expectedSerials, adb, checks };
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  const ok = checks.every((check) => check.ok);
  console.log(`report: ${reportPath}`);
  if (!ok) process.exit(1);
}

main().catch((error) => {
  addCheck('preflight.error', false, error instanceof Error ? error.message : String(error));
  mkdirSync(reportDir, { recursive: true });
  writeFileSync(reportPath, JSON.stringify({ checkedAt: new Date().toISOString(), checks }, null, 2));
  process.exit(1);
});
