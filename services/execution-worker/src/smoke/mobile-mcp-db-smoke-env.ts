import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import type { WorkerConfig } from '../run-claim-coordinator';

const execFileAsync = promisify(execFile);

export const REPO_ROOT = resolve(fileURLToPath(new URL('../../../../', import.meta.url)));
export const LOG_PREFIX = '[mobile-mcp-db-multi-smoke]';

export function loadRootEnv() {
  loadEnvFile(resolve(REPO_ROOT, '.env'));
}

export function readWorkerConfig(): WorkerConfig {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) throw new Error('Missing SUPABASE_URL or VITE_SUPABASE_URL');

  return {
    port: Number(process.env.WORKER_PORT ?? 4310),
    pollIntervalMs: 500,
    leaseTtlMs: 30_000,
    maxActiveClaims: 1,
    instanceId: `mobile-mcp-db-smoke-${process.pid}`,
    supabaseUrl,
    supabaseServiceRoleKey: readRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    gatewayBaseUrl: process.env.GATEWAY_BASE_URL ?? 'http://127.0.0.1:8080',
    mobileMcpBridgeUrl: process.env.MOBILE_MCP_BRIDGE_URL ?? 'http://127.0.0.1:4321',
    deviceBackend: 'mobile-mcp',
    commandTimeoutMs: Number(process.env.DEVICE_COMMAND_TIMEOUT_MS ?? 20_000),
  };
}

export async function getTargetSerials() {
  const fromEnv = process.env.MOBILE_MCP_DEVICE_SERIALS
    ?.split(',')
    .map((serial) => serial.trim())
    .filter(Boolean) ?? [];
  if (fromEnv.length > 0) return fromEnv;

  const { stdout } = await execFileAsync('adb', ['devices', '-l'], { timeout: 15_000, windowsHide: true });
  return stdout
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter((line) => /\sdevice\s/.test(line))
    .map((line) => line.split(/\s+/)[0])
    .filter(Boolean);
}

export async function adbGetProp(serial: string, prop: string) {
  try {
    const { stdout } = await execFileAsync('adb', ['-s', serial, 'shell', 'getprop', prop], {
      timeout: 10_000,
      windowsHide: true,
    });
    return stdout.trim();
  } catch {
    return '';
  }
}

function loadEnvFile(path: string) {
  try {
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  } catch {
    return;
  }
}

function readRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}. Set it in the shell; do not commit service keys.`);
  return value;
}
