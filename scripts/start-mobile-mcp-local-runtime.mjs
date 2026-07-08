import { spawn, spawnSync } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(fileURLToPath(new URL('..', import.meta.url)));
const isWindows = process.platform === 'win32';
const npmCommand = isWindows ? 'npm.cmd' : 'npm';
const checkOnly = process.argv.includes('--check');
const skipDeviceSync = process.argv.includes('--skip-device-sync');
const skipDeviceWait = process.argv.includes('--skip-device-wait');
const recoverWaitAdb = process.argv.includes('--recover-adb');
const doctorWaitFail = process.argv.includes('--doctor-on-fail');
const logDir = join(rootDir, 'plans', 'reports', 'mobile-mcp-runtime');

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

const envFile = loadDotEnv(join(rootDir, '.env'));
const mergedEnv = { ...envFile, ...process.env };

function localUrl(envName, fallback) {
  return mergedEnv[envName] ?? envFile[envName] ?? fallback;
}

const bridgeUrl = localUrl('MOBILE_MCP_BRIDGE_URL', 'http://127.0.0.1:4321');
const workerUrl = localUrl('VITE_WORKER_BASE_URL', 'http://127.0.0.1:4310');
const viteUrl = 'http://127.0.0.1:5173';
const serviceRoleKey = mergedEnv.SUPABASE_SERVICE_ROLE_KEY;
const supabaseUrl = mergedEnv.SUPABASE_URL ?? mergedEnv.VITE_SUPABASE_URL;
const bridgeToken = mergedEnv.MOBILE_MCP_BRIDGE_TOKEN;
const allowInsecureBridge = mergedEnv.MOBILE_MCP_ALLOW_INSECURE_DEV === 'true';
const children = [];

function print(message) {
  process.stdout.write(`${message}\n`);
}

async function fetchOk(url, method = 'GET') {
  try {
    const response = await fetch(url, {
      method,
      signal: AbortSignal.timeout(2500),
    });
    return response.ok;
  } catch {
    return false;
  }
}

function adbDevices() {
  const adb = findAdb();
  if (!adb) return 'adb unavailable: add Android platform-tools to PATH or set ADB_PATH';
  const result = spawnSync(adb, ['devices', '-l'], {
    cwd: rootDir,
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.error) return `adb unavailable: ${result.error.message}`;
  return (result.stdout || result.stderr || '').trim();
}

function findAdb() {
  const suffix = isWindows ? 'adb.exe' : 'adb';
  if (isWindows) {
    const result = spawnSync('where.exe', ['adb'], { encoding: 'utf8', windowsHide: true });
    const found = result.stdout?.split(/\r?\n/).find((line) => line.trim());
    if (found) return found.trim();
  }

  const candidates = [
    mergedEnv.ADB_PATH,
    mergedEnv.ANDROID_HOME && join(mergedEnv.ANDROID_HOME, 'platform-tools', suffix),
    mergedEnv.ANDROID_SDK_ROOT && join(mergedEnv.ANDROID_SDK_ROOT, 'platform-tools', suffix),
    mergedEnv.LOCALAPPDATA && join(mergedEnv.LOCALAPPDATA, 'Android', 'Sdk', 'platform-tools', suffix),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return 'adb';
}

function serviceDefinitions() {
  return [
    {
      name: 'mobile-mcp-bridge',
      health: () => fetchOk(`${bridgeUrl}/health`),
      command: [npmCommand, ['--prefix', 'services/mobile-mcp-bridge', 'run', 'dev']],
      env: {
        MOBILE_MCP_BRIDGE_PORT: new URL(bridgeUrl).port || '4321',
        MOBILE_MCP_BRIDGE_TOKEN: bridgeToken,
        MOBILE_MCP_ALLOW_INSECURE_DEV: allowInsecureBridge ? 'true' : 'false',
      },
      preflight() {
        const pythonPath = join(rootDir, 'services', 'mobile-mcp-bridge', '.venv', 'Scripts', 'python.exe');
        if (isWindows && !existsSync(pythonPath)) {
          throw new Error('Mobile MCP bridge venv missing. Run: npm run setup:mobile-mcp-bridge');
        }
        if (!bridgeToken && !allowInsecureBridge) {
          throw new Error('MOBILE_MCP_BRIDGE_TOKEN is required. For isolated local development only, set MOBILE_MCP_ALLOW_INSECURE_DEV=true explicitly.');
        }
      },
    },
    {
      name: 'execution-worker',
      health: () => fetchOk(`${workerUrl}/health`),
      command: [npmCommand, ['run', 'dev:worker']],
      env: {
        SUPABASE_URL: supabaseUrl,
        SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
        DEVICE_BACKEND: 'mobile-mcp',
        MOBILE_MCP_BRIDGE_URL: bridgeUrl,
        MOBILE_MCP_BRIDGE_TOKEN: bridgeToken,
        DEVICE_COMMAND_TIMEOUT_MS: mergedEnv.DEVICE_COMMAND_TIMEOUT_MS ?? '30000',
        RUN_POLL_INTERVAL_MS: mergedEnv.RUN_POLL_INTERVAL_MS ?? '2000',
      },
      preflight() {
        if (!supabaseUrl) throw new Error('SUPABASE_URL or VITE_SUPABASE_URL is required');
        if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required in shell env');
      },
    },
    {
      name: 'vite-ui',
      health: () => fetchOk(viteUrl, 'HEAD'),
      command: [npmCommand, ['run', 'dev', '--', '--host', '127.0.0.1']],
      env: {
        VITE_RUN_CONTROL_MODE: mergedEnv.VITE_RUN_CONTROL_MODE ?? 'browser',
      },
    },
  ];
}

async function waitFor(name, health, timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await health()) return true;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`${name} did not become healthy within ${timeoutMs}ms`);
}

function startService(service) {
  service.preflight?.();
  mkdirSync(logDir, { recursive: true });
  const stdout = createWriteStream(join(logDir, `${service.name}.out.log`), { flags: 'a' });
  const stderr = createWriteStream(join(logDir, `${service.name}.err.log`), { flags: 'a' });
  const [command, args] = service.command;
  const child = spawn(command, args, {
    cwd: rootDir,
    env: { ...process.env, ...envFile, ...service.env },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    shell: isWindows,
  });
  child.stdout.pipe(stdout);
  child.stderr.pipe(stderr);
  child.on('exit', (code) => print(`[${service.name}] exited with code ${code}`));
  children.push(child);
  print(`[${service.name}] starting, logs: ${join(logDir, `${service.name}.*.log`)}`);
}

function syncAdbDevices() {
  if (skipDeviceSync || mergedEnv.MOBILE_MCP_SKIP_DEVICE_SYNC === 'true') {
    print('device-sync: skipped');
    return;
  }

  const args = ['scripts/sync-mobile-mcp-adb-devices.mjs'];
  const mode = serviceRoleKey ? 'upsert' : 'dry-run';
  if (!serviceRoleKey) args.push('--dry-run');
  if (serviceRoleKey && mergedEnv.MOBILE_MCP_OFFLINE_MISSING_DEVICES === 'true') {
    args.push('--offline-missing');
  }

  print(`device-sync: ${mode}`);
  const result = spawnSync(process.execPath, args, {
    cwd: rootDir,
    env: {
      ...process.env,
      ...envFile,
      SUPABASE_URL: supabaseUrl ?? '',
      SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey ?? '',
    },
    encoding: 'utf8',
    windowsHide: true,
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0 || result.error) {
    const message = result.error?.message ?? `exit code ${result.status}`;
    print(`device-sync warning: ${message}`);
  }
}

function waitForExpectedDevices() {
  if (skipDeviceWait || mergedEnv.MOBILE_MCP_SKIP_DEVICE_WAIT === 'true') {
    print('device-wait: skipped');
    return;
  }
  if (!mergedEnv.MOBILE_MCP_EXPECTED_SERIALS) {
    print('device-wait: skipped; MOBILE_MCP_EXPECTED_SERIALS empty');
    return;
  }

  const args = ['scripts/wait-mobile-mcp-expected-devices.mjs'];
  if (recoverWaitAdb || mergedEnv.MOBILE_MCP_WAIT_RECOVER_ADB === 'true') {
    args.push('--recover-adb');
  }
  if (doctorWaitFail || mergedEnv.MOBILE_MCP_WAIT_DOCTOR_ON_FAIL === 'true') {
    args.push('--doctor-on-fail');
  }
  print('device-wait: expected serials');
  const result = spawnSync(process.execPath, args, {
    cwd: rootDir,
    env: { ...process.env, ...envFile },
    encoding: 'utf8',
    windowsHide: true,
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0 || result.error) {
    throw new Error(result.error?.message ?? `device-wait failed with exit code ${result.status}`);
  }
}

async function main() {
  print('ADB devices:');
  print(adbDevices());

  for (const service of serviceDefinitions()) {
    const healthy = await service.health();
    print(`${service.name}: ${healthy ? 'healthy' : 'not running'}`);
    if (checkOnly || healthy) continue;
    startService(service);
    await waitFor(service.name, service.health);
    print(`${service.name}: healthy`);
  }

  if (checkOnly) return;
  waitForExpectedDevices();
  syncAdbDevices();
  print(`UI: ${viteUrl}`);
  print(`Worker: ${workerUrl}/health`);
  print(`Bridge: ${bridgeUrl}/health`);
  if (!children.length) return;
  print('Runtime started. Press Ctrl+C to stop processes started by this command.');
  setInterval(() => undefined, 60000);
}

process.on('SIGINT', () => {
  for (const child of children) child.kill();
  process.exit(0);
});

main().catch((error) => {
  print(`runtime error: ${error instanceof Error ? error.message : String(error)}`);
  for (const child of children) child.kill();
  process.exit(1);
});
