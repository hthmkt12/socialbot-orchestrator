import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(fileURLToPath(new URL('..', import.meta.url)));
const reportDir = join(rootDir, 'plans', 'reports');
const reportPath = join(reportDir, `mobile-mcp-status-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
const isWindows = process.platform === 'win32';

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

const env = { ...loadDotEnv(join(rootDir, '.env')), ...process.env };
const bridgeUrl = env.MOBILE_MCP_BRIDGE_URL ?? env.VITE_MOBILE_MCP_BRIDGE_URL ?? 'http://127.0.0.1:4321';
const workerUrl = env.VITE_WORKER_BASE_URL ?? 'http://127.0.0.1:4310';
const uiUrl = env.UI_SMOKE_BASE_URL ?? 'http://127.0.0.1:5173';
const expectedSerials = parseCsv(env.MOBILE_MCP_EXPECTED_SERIALS);

function parseCsv(value) {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
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

function readAdb() {
  const adbPath = findAdb();
  const result = spawnSync(adbPath, ['devices', '-l'], { cwd: rootDir, encoding: 'utf8', windowsHide: true });
  if (result.error) return { ok: false, adbPath, raw: result.error.message, devices: [] };
  const raw = (result.stdout || result.stderr || '').trim();
  const devices = raw
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [serial, state] = line.split(/\s+/);
      return { serial, state, online: state === 'device', raw: line };
    });
  return { ok: result.status === 0, adbPath, raw, devices };
}

async function fetchStatus(name, url, method = 'GET') {
  try {
    const response = await fetch(url, { method, signal: AbortSignal.timeout(3000) });
    let body = null;
    const text = await response.text();
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text.slice(0, 500);
    }
    return { name, ok: response.ok, status: response.status, url, body };
  } catch (error) {
    return { name, ok: false, status: null, url, error: error instanceof Error ? error.message : String(error) };
  }
}

function readLatestReport(prefix) {
  if (!existsSync(reportDir)) return null;
  const files = readdirSync(reportDir)
    .filter((name) => name.startsWith(prefix) && name.endsWith('.json'))
    .map((name) => {
      const path = join(reportDir, name);
      return { name, path, modifiedAt: statSync(path).mtime.toISOString() };
    })
    .sort((left, right) => right.modifiedAt.localeCompare(left.modifiedAt));
  if (!files.length) return null;
  const latest = files[0];
  try {
    const parsed = JSON.parse(readFileSync(latest.path, 'utf8'));
    return { ...latest, summary: summarizeReport(parsed) };
  } catch (error) {
    return { ...latest, parseError: error instanceof Error ? error.message : String(error) };
  }
}

function summarizeReport(report) {
  if (report.run) return { ok: report.run.status === 'COMPLETED', runId: report.run.id, status: report.run.status, stepCount: report.stepCount, screenshotCount: report.screenshotCount };
  if (Array.isArray(report.checks)) return { ok: report.checks.every((check) => check.ok), failedChecks: report.checks.filter((check) => !check.ok).map((check) => check.name) };
  if (Array.isArray(report.results)) return { ok: report.ok, mode: report.mode, failedStep: report.failedStep, steps: report.results.map((step) => ({ name: step.name, exitCode: step.exitCode })) };
  if (Array.isArray(report.onlineSerials)) return { ok: true, dryRun: report.dryRun, onlineSerials: report.onlineSerials };
  if (Array.isArray(report.expectedSerials) && Array.isArray(report.samples)) {
    return {
      ok: report.ok,
      expectedSerials: report.expectedSerials,
      missing: [...new Set([...(report.last?.adbMissing ?? []), ...(report.last?.bridgeMissing ?? [])])],
      recommendations: report.recommendations ?? [],
    };
  }
  if (report.login) return { ok: report.login.ok, email: report.email, profileRole: report.profileRole, authAction: report.authAction };
  return { ok: report.ok ?? null };
}

function bridgeSerials(report) {
  const bridgeDevices = report.services.find((service) => service.name === 'bridge.devices');
  return bridgeDevices?.body?.output?.devices?.map((device) => device.id).filter(Boolean) ?? [];
}

function latestAdbSyncSerials(report) {
  const adbSync = report.latestReports.find((latest) => latest.kind === 'adb-sync');
  return adbSync?.report?.summary?.onlineSerials ?? [];
}

function buildWarnings(report) {
  const warnings = [];
  const adbOnline = report.adb.devices.filter((device) => device.online).map((device) => device.serial);
  const bridgeOnline = bridgeSerials(report);
  const adbSyncOnline = latestAdbSyncSerials(report);

  if (!report.env.hasServiceRoleKey) {
    warnings.push('SUPABASE_SERVICE_ROLE_KEY is not loaded; write operations will use dry-run/preview modes.');
  }
  if (!report.env.hasUiSmokeLogin) {
    warnings.push('UI_SMOKE_EMAIL/UI_SMOKE_PASSWORD are not loaded; full UI smoke cannot run from this shell.');
  }
  for (const serial of adbOnline.filter((serial) => !bridgeOnline.includes(serial))) {
    warnings.push(`ADB serial ${serial} is online but missing from bridge /devices.`);
  }
  for (const serial of bridgeOnline.filter((serial) => !adbOnline.includes(serial))) {
    warnings.push(`Bridge serial ${serial} is visible but not online in adb devices.`);
  }
  for (const serial of report.env.expectedSerials.filter((serial) => !adbOnline.includes(serial))) {
    warnings.push(`Expected serial ${serial} is not online in adb devices.`);
  }
  for (const serial of report.env.expectedSerials.filter((serial) => !bridgeOnline.includes(serial))) {
    warnings.push(`Expected serial ${serial} is not visible from bridge /devices.`);
  }
  for (const serial of adbSyncOnline.filter((serial) => !adbOnline.includes(serial))) {
    warnings.push(`Latest adb-sync report included ${serial}, but it is not online now.`);
  }
  return warnings;
}

function printStatus(report) {
  const online = report.adb.devices.filter((device) => device.online).map((device) => device.serial);
  console.log(`ADB online: ${online.length ? online.join(', ') : 'none'}`);
  console.log(`Expected serials: ${report.env.expectedSerials.length ? report.env.expectedSerials.join(', ') : 'none'}`);
  for (const service of report.services) {
    const detail = service.body?.deviceBackend ? ` (${service.body.deviceBackend})` : '';
    console.log(`${service.name}: ${service.ok ? 'healthy' : 'down'} ${service.status ?? ''}${detail}`.trim());
  }
  for (const latest of report.latestReports) {
    console.log(`${latest.kind}: ${latest.report?.name ?? 'none'} ${latest.report?.summary ? JSON.stringify(latest.report.summary) : ''}`.trim());
  }
  for (const warning of report.warnings) {
    console.log(`warning: ${warning}`);
  }
  console.log(`report: ${reportPath}`);
}

async function main() {
  mkdirSync(reportDir, { recursive: true });
  const report = {
    checkedAt: new Date().toISOString(),
    env: {
      bridgeUrl,
      workerUrl,
      uiUrl,
      expectedSerials,
      hasServiceRoleKey: Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
      hasUiSmokeLogin: Boolean(env.UI_SMOKE_EMAIL && env.UI_SMOKE_PASSWORD),
    },
    adb: readAdb(),
    services: [
      await fetchStatus('bridge.health', `${bridgeUrl}/health`),
      await fetchStatus('bridge.devices', `${bridgeUrl}/devices`),
      await fetchStatus('worker.health', `${workerUrl}/health`),
      await fetchStatus('ui.health', uiUrl, 'HEAD'),
    ],
    latestReports: [
      { kind: 'verify', report: readLatestReport('mobile-mcp-verify-') },
      { kind: 'expected-wait', report: readLatestReport('mobile-mcp-wait-devices-') },
      { kind: 'preflight', report: readLatestReport('mobile-mcp-preflight-') },
      { kind: 'adb-sync', report: readLatestReport('mobile-mcp-adb-sync-') },
      { kind: 'operator', report: readLatestReport('mobile-mcp-operator-') },
      { kind: 'ui-smoke', report: readLatestReport('ui-mobile-mcp-smoke-db-') },
    ],
  };
  report.warnings = buildWarnings(report);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  printStatus(report);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
