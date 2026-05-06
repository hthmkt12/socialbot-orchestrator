import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(fileURLToPath(new URL('..', import.meta.url)));
const reportDir = join(rootDir, 'plans', 'reports');
const reportPath = join(reportDir, `mobile-mcp-adb-recover-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
const isWindows = process.platform === 'win32';
const npmCommand = isWindows ? 'npm.cmd' : 'npm';

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
const expectedSerials = parseCsv(env.MOBILE_MCP_EXPECTED_SERIALS);

function parseCsv(value) {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function commandInvocation(command, args) {
  if (!isWindows) return { command, args };
  return { command: 'cmd.exe', args: ['/d', '/s', '/c', [command, ...args].join(' ')] };
}

function runStep(name, command, args) {
  const startedAt = Date.now();
  const invocation = commandInvocation(command, args);
  console.log(`\n== ${name} ==`);
  console.log(`${command} ${args.join(' ')}`);
  const result = spawnSync(invocation.command, invocation.args, {
    cwd: rootDir,
    env: process.env,
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return {
    name,
    command: [command, ...args],
    exitCode: result.status ?? (result.error ? 1 : 0),
    durationMs: Date.now() - startedAt,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    error: result.error?.message,
  };
}

function extractReportPath(output) {
  return output
    .split(/\r?\n/)
    .map((line) => line.match(/report:\s*(.+mobile-mcp-status-.+\.json)\s*$/)?.[1])
    .find(Boolean);
}

function readStatusReport(result) {
  const path = extractReportPath(`${result.stdout}\n${result.stderr}`);
  if (!path || !existsSync(path)) return { path, report: null };
  return { path, report: JSON.parse(readFileSync(path, 'utf8')) };
}

function bridgeSerials(statusReport) {
  const bridgeDevices = statusReport?.services?.find((service) => service.name === 'bridge.devices');
  return bridgeDevices?.body?.output?.devices?.map((device) => device.id).filter(Boolean) ?? [];
}

function buildExpectedSummary(statusReport) {
  const adbOnline = statusReport?.adb?.devices?.filter((device) => device.online).map((device) => device.serial) ?? [];
  const bridgeOnline = bridgeSerials(statusReport);
  const missingFromAdb = expectedSerials.filter((serial) => !adbOnline.includes(serial));
  const missingFromBridge = expectedSerials.filter((serial) => !bridgeOnline.includes(serial));
  return {
    expectedSerials,
    adbOnline,
    bridgeOnline,
    missingFromAdb,
    missingFromBridge,
    recommendations: buildRecommendations(missingFromAdb, missingFromBridge),
  };
}

function buildRecommendations(missingFromAdb, missingFromBridge) {
  const recommendations = [];
  if (missingFromAdb.length) {
    recommendations.push(`Missing from ADB: ${missingFromAdb.join(', ')}. Unlock phone, enable Developer options > USB debugging, switch USB mode to File transfer/MTP, then replug cable.`);
  }
  if (missingFromAdb.some((serial) => /^R/i.test(serial))) {
    recommendations.push('Samsung-specific: install/update Samsung USB Driver or Smart Switch, then reconnect and accept the RSA debugging prompt.');
  }
  if (missingFromBridge.length) {
    recommendations.push(`Missing from Mobile MCP bridge: ${missingFromBridge.join(', ')}. Restart the bridge after ADB shows the serial online.`);
  }
  return recommendations;
}

const startedAt = new Date().toISOString();
const results = [];

results.push(runStep('adb.doctor.recover', npmCommand, ['run', 'doctor:adb:recover']));
results.push(runStep('mobile-mcp.status', npmCommand, ['run', 'status:mobile-mcp']));

const failed = results.find((result) => result.exitCode !== 0);
const status = readStatusReport(results.at(-1));
const expectedSummary = buildExpectedSummary(status.report);
const unresolvedExpected = Boolean(expectedSerials.length && (expectedSummary.missingFromAdb.length || expectedSummary.missingFromBridge.length));
const report = {
  startedAt,
  finishedAt: new Date().toISOString(),
  ok: !failed && !unresolvedExpected,
  failedStep: failed?.name ?? null,
  statusReportPath: status.path ?? null,
  expected: expectedSummary,
  results,
};

mkdirSync(reportDir, { recursive: true });
writeFileSync(reportPath, JSON.stringify(report, null, 2));
for (const recommendation of expectedSummary.recommendations) {
  console.log(`recommendation: ${recommendation}`);
}
console.log(`\nreport: ${reportPath}`);

if (failed || unresolvedExpected) process.exit(1);
