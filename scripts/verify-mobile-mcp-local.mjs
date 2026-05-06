import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(fileURLToPath(new URL('..', import.meta.url)));
const reportDir = join(rootDir, 'plans', 'reports');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const reportPath = join(reportDir, `mobile-mcp-verify-${timestamp}.json`);
const args = new Set(process.argv.slice(2));
const skipUi = args.has('--skip-ui');
const skipWaitDevices = args.has('--skip-wait-devices') || process.env.MOBILE_MCP_SKIP_WAIT_DEVICES === 'true';
const recoverWaitAdb = args.has('--recover-adb') || process.env.MOBILE_MCP_WAIT_RECOVER_ADB === 'true';
const doctorWaitFail = args.has('--doctor-on-fail') || process.env.MOBILE_MCP_WAIT_DOCTOR_ON_FAIL === 'true';

const hasServiceRoleKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const operatorEnsureArgs = ['scripts/ensure-mobile-mcp-operator.mjs'];
if (!hasServiceRoleKey) operatorEnsureArgs.push('--dry-run');
const deviceSyncArgs = ['scripts/sync-mobile-mcp-adb-devices.mjs'];
if (!hasServiceRoleKey) deviceSyncArgs.push('--dry-run');

const steps = [
  {
    name: 'runtime.check',
    args: ['scripts/start-mobile-mcp-local-runtime.mjs', '--check'],
  },
];

if (!skipWaitDevices) {
  const waitArgs = ['scripts/wait-mobile-mcp-expected-devices.mjs'];
  if (recoverWaitAdb) waitArgs.push('--recover-adb');
  if (doctorWaitFail) waitArgs.push('--doctor-on-fail');
  steps.push({
    name: 'devices.wait',
    args: waitArgs,
  });
}

steps.push(
  {
    name: hasServiceRoleKey ? 'operator.ensure' : 'operator.ensure.preview',
    args: operatorEnsureArgs,
  },
  {
    name: hasServiceRoleKey ? 'devices.sync' : 'devices.sync.preview',
    args: deviceSyncArgs,
  },
  {
    name: 'preflight',
    args: ['scripts/preflight-mobile-mcp-local.mjs'],
  }
);

if (!skipUi) {
  steps.push({
    name: 'ui.smoke',
    args: ['scripts/smoke-mobile-mcp-ui-run.mjs'],
  });
}

function print(message) {
  process.stdout.write(`${message}\n`);
}

function runStep(step) {
  const startedAt = Date.now();
  print(`\n== ${step.name} ==`);
  print(`${process.execPath} ${step.args.join(' ')}`);

  const result = spawnSync(process.execPath, step.args, {
    cwd: rootDir,
    env: process.env,
    encoding: 'utf8',
    windowsHide: true,
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  const exitCode = result.status ?? (result.error ? 1 : 0);
  return {
    name: step.name,
    command: [process.execPath, ...step.args],
    exitCode,
    durationMs: Date.now() - startedAt,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    error: result.error?.message,
  };
}

function writeReport(report) {
  mkdirSync(reportDir, { recursive: true });
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  print(`\nreport: ${reportPath}`);
}

const startedAt = new Date().toISOString();
const results = [];
let failedStep = null;

for (const step of steps) {
  const result = runStep(step);
  results.push(result);
  if (result.exitCode !== 0) {
    failedStep = result.name;
    break;
  }
}

const report = {
  startedAt,
  finishedAt: new Date().toISOString(),
  ok: !failedStep,
  failedStep,
  mode: skipUi ? 'quick' : 'full',
  waitDevicesMode: skipWaitDevices ? 'skipped' : 'expected-serials',
  waitDevicesRecovery: recoverWaitAdb ? 'adb-restart-once' : 'none',
  waitDevicesDoctor: doctorWaitFail ? 'on-fail' : 'none',
  operatorEnsureMode: hasServiceRoleKey ? 'ensure' : 'dry-run',
  deviceSyncMode: hasServiceRoleKey ? 'upsert' : 'dry-run',
  results,
};

writeReport(report);

if (failedStep) {
  print(`verify failed at ${failedStep}`);
  process.exit(1);
}

print('verify passed');
