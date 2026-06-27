import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(fileURLToPath(new URL('..', import.meta.url)));
const reportDir = join(rootDir, 'plans', 'reports');
const reportPath = join(reportDir, `mobile-mcp-wait-devices-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
const isWindows = process.platform === 'win32';
const args = process.argv.slice(2);

function argValue(name, fallback) {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  return args[index + 1] ?? fallback;
}

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
const expectedSerials = parseCsv(env.MOBILE_MCP_EXPECTED_SERIALS);
const timeoutMs = Number(argValue('--timeout-ms', env.MOBILE_MCP_WAIT_TIMEOUT_MS ?? 60_000));
const intervalMs = Number(argValue('--interval-ms', env.MOBILE_MCP_WAIT_INTERVAL_MS ?? 2_000));
const recoverAdb = args.includes('--recover-adb') || env.MOBILE_MCP_WAIT_RECOVER_ADB === 'true';
const doctorOnFail = args.includes('--doctor-on-fail') || env.MOBILE_MCP_WAIT_DOCTOR_ON_FAIL === 'true';
const samples = [];
const recoveryAttempts = [];

function parseCsv(value) {
  if (!value) return [];
  return value.split(',').map((item) => item.trim()).filter(Boolean);
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

function readAdbOnline() {
  const adbPath = findAdb();
  const result = spawnSync(adbPath, ['devices', '-l'], { cwd: rootDir, encoding: 'utf8', windowsHide: true });
  if (result.error) return { ok: false, adbPath, online: [], raw: result.error.message };
  const raw = (result.stdout || result.stderr || '').trim();
  const online = raw.split(/\r?\n/).slice(1).map((line) => line.trim()).filter((line) => /\sdevice\s/.test(line)).map((line) => line.split(/\s+/)[0]).filter(Boolean);
  return { ok: result.status === 0, adbPath, online, raw };
}

async function readBridgeOnline() {
  try {
    const response = await fetch(`${bridgeUrl}/devices`, { signal: AbortSignal.timeout(3000) });
    const body = await response.json();
    const online = body?.output?.devices?.map((device) => device.id ?? device.serial).filter(Boolean) ?? [];
    return { ok: response.ok, online, status: response.status };
  } catch (error) {
    return { ok: false, online: [], error: error instanceof Error ? error.message : String(error) };
  }
}

function missing(expected, online) {
  return expected.filter((serial) => !online.includes(serial));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function restartAdbServer() {
  const adbPath = findAdb();
  console.log('recovery: adb kill-server && adb start-server');
  const kill = spawnSync(adbPath, ['kill-server'], { cwd: rootDir, encoding: 'utf8', windowsHide: true });
  const start = spawnSync(adbPath, ['start-server'], { cwd: rootDir, encoding: 'utf8', windowsHide: true });
  const attempt = { at: new Date().toISOString(), adbPath, killExitCode: kill.status ?? (kill.error ? 1 : 0), startExitCode: start.status ?? (start.error ? 1 : 0), killError: kill.error?.message, startError: start.error?.message, stdout: `${kill.stdout ?? ''}${start.stdout ?? ''}`.trim(), stderr: `${kill.stderr ?? ''}${start.stderr ?? ''}`.trim() };
  recoveryAttempts.push(attempt);
  if (attempt.stderr) console.error(attempt.stderr);
  if (attempt.killError || attempt.startError) {
    console.error(attempt.killError ?? attempt.startError);
  }
}

function runDoctorOnFail() {
  if (!doctorOnFail) return null;
  const command = isWindows ? 'cmd.exe' : 'npm';
  const commandArgs = isWindows ? ['/d', '/s', '/c', 'npm.cmd run doctor:adb'] : ['run', 'doctor:adb'];
  console.log('doctor-on-fail: npm run doctor:adb');
  const result = spawnSync(command, commandArgs, {
    cwd: rootDir,
    env: process.env,
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return { exitCode: result.status ?? (result.error ? 1 : 0), summary: summarizeDoctorOutput(result.stdout ?? ''), stdout: result.stdout ?? '', stderr: result.stderr ?? '', error: result.error?.message };
}

function summarizeDoctorOutput(stdout) {
  const adbDevices = [...stdout.matchAll(/\[doctor:adb\] - ([^\s]+) ([^\s]+) (.*)/g)].map((match) => ({
    serial: match[1],
    state: match[2],
    detail: match[3].trim(),
  }));
  const usbRows = [...stdout.matchAll(/\[doctor:adb\] - ([^\r\n]*(?:Redmi|Xiaomi|Samsung|SAMSUNG|ADB|Android)[^\r\n]*)/gi)].map((match) => match[1]);
  const diagnosis = stdout.match(/\[doctor:adb\] diagnosis: ([^\r\n]+)/)?.[1] ?? null;
  const samsungVisible = /Samsung|SAMSUNG|VID_04E8/i.test(stdout);
  const redmiVisible = /Redmi|Xiaomi|VID_2717/i.test(stdout);
  return { diagnosis, adbDevices, usbRows, samsungVisible, redmiVisible, likelyIssue: samsungVisible ? null : 'Samsung is not visible to Windows USB/PnP in doctor output; check cable, USB mode, phone unlock, driver, or port.' };
}

function buildRecommendations(last, doctor) {
  const missingSerials = [...new Set([...(last?.adbMissing ?? []), ...(last?.bridgeMissing ?? [])])];
  return missingSerials.map((serial) => {
    const isLikelySamsung = /^R/i.test(serial);
    const visible = isLikelySamsung ? doctor?.summary?.samsungVisible : doctor?.summary?.adbDevices?.some((device) => device.serial === serial);
    if (visible) return { serial, action: 'Device is visible to Windows/ADB doctor but not ready in wait gate; accept RSA prompt, keep screen unlocked, then retry wait.' };
    if (isLikelySamsung) return { serial, action: 'Samsung not visible to Windows USB/PnP; replug cable/port, set USB mode to File transfer, unlock phone, reinstall Samsung USB Driver or Smart Switch.' };
    return { serial, action: 'Device not visible to expected ADB/bridge checks; replug cable, unlock phone, enable USB debugging, then retry wait.' };
  });
}

function writeReport(report) {
  mkdirSync(reportDir, { recursive: true });
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`report: ${reportPath}`);
}

async function sample() {
  const adb = readAdbOnline();
  const bridge = await readBridgeOnline();
  const adbMissing = missing(expectedSerials, adb.online);
  const bridgeMissing = missing(expectedSerials, bridge.online);
  const ok = adbMissing.length === 0 && bridgeMissing.length === 0;
  const current = { checkedAt: new Date().toISOString(), ok, adb, bridge, adbMissing, bridgeMissing };
  samples.push(current);
  console.log(`ADB: ${adb.online.join(', ') || 'none'} | bridge: ${bridge.online.join(', ') || 'none'} | missing: ${[...new Set([...adbMissing, ...bridgeMissing])].join(', ') || 'none'}`);
  return current;
}

async function main() {
  if (!expectedSerials.length) {
    writeReport({ ok: false, reason: 'MOBILE_MCP_EXPECTED_SERIALS is empty', expectedSerials, samples });
    process.exit(1);
  }

  const startedAt = Date.now();
  let last = null;
  let recovered = false;
  while (Date.now() - startedAt <= timeoutMs) {
    last = await sample();
    if (last.ok) {
      writeReport({ ok: true, expectedSerials, timeoutMs, intervalMs, recoverAdb, doctorOnFail, recoveryAttempts, samples });
      return;
    }
    if (recoverAdb && !recovered) {
      recovered = true;
      restartAdbServer();
      await sleep(2000);
    }
    await sleep(intervalMs);
  }

  const doctor = runDoctorOnFail();
  const recommendations = buildRecommendations(last, doctor);
  writeReport({ ok: false, expectedSerials, timeoutMs, intervalMs, recoverAdb, doctorOnFail, recoveryAttempts, doctor, recommendations, last, samples });
  process.exit(1);
}

main().catch((error) => {
  writeReport({ ok: false, error: error instanceof Error ? error.message : String(error), expectedSerials, recoverAdb, doctorOnFail, recoveryAttempts, samples });
  process.exit(1);
});
