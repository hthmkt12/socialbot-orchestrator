import { createClient } from '@supabase/supabase-js';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(fileURLToPath(new URL('..', import.meta.url)));
const reportDir = join(rootDir, 'plans', 'reports');
const reportPath = join(reportDir, `mobile-mcp-adb-sync-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
const isWindows = process.platform === 'win32';
const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const offlineMissing = args.has('--offline-missing');

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
const supabaseUrl = process.env.SUPABASE_URL ?? dotEnv.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const serialFilter = (process.env.MOBILE_MCP_DEVICE_SERIALS ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

function findAdb() {
  if (process.env.ADB_PATH && existsSync(process.env.ADB_PATH)) return process.env.ADB_PATH;
  if (isWindows) {
    const result = spawnSync('where.exe', ['adb'], { encoding: 'utf8', windowsHide: true });
    const found = result.stdout?.split(/\r?\n/).find((line) => line.trim());
    if (found) return found.trim();
  }
  return 'adb';
}

const adbPath = findAdb();

function runAdb(adbArgs) {
  const result = spawnSync(adbPath, adbArgs, { cwd: rootDir, encoding: 'utf8', windowsHide: true });
  if (result.error) return { ok: false, text: result.error.message };
  return { ok: result.status === 0, text: (result.stdout || result.stderr || '').trim() };
}

function parseAdbLine(line) {
  const parts = line.trim().split(/\s+/);
  const serial = parts[0];
  const transport = parts[1];
  const details = Object.fromEntries(
    parts.slice(2).map((part) => {
      const index = part.indexOf(':');
      return index > -1 ? [part.slice(0, index), part.slice(index + 1)] : [part, true];
    })
  );
  return { serial, transport, details, raw: line.trim(), online: transport === 'device' };
}

function adbDevices() {
  const result = runAdb(['devices', '-l']);
  if (!result.ok) throw new Error(`adb devices failed: ${result.text}`);
  return result.text
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseAdbLine)
    .filter((device) => device.online)
    .filter((device) => !serialFilter.length || serialFilter.includes(device.serial));
}

function getProp(serial, propName) {
  const result = runAdb(['-s', serial, 'shell', 'getprop', propName]);
  return result.ok ? result.text : '';
}

function getScreenSize(serial) {
  const result = runAdb(['-s', serial, 'shell', 'wm', 'size']);
  const match = result.text.match(/(\d+)x(\d+)/);
  return match ? { width: Number(match[1]), height: Number(match[2]) } : { width: 720, height: 1600 };
}

function buildPayload(device, index) {
  const model = getProp(device.serial, 'ro.product.model') || String(device.details.model ?? '').replaceAll('_', ' ') || 'Android';
  const brand = getProp(device.serial, 'ro.product.brand') || String(device.details.product ?? '') || 'Android';
  const androidVersion = getProp(device.serial, 'ro.build.version.release');
  const screen = getScreenSize(device.serial);
  return {
    laixi_device_id: device.serial,
    name: `Mobile MCP ${index + 1} ${model}`,
    model,
    brand,
    android_version: androidVersion,
    screen_width: screen.width,
    screen_height: screen.height,
    status: 'ONLINE',
    last_seen_at: new Date().toISOString(),
    heartbeat_freshness: 'fresh',
    last_error_message: null,
    last_error_at: null,
    metadata_json: {
      source: 'mobile-mcp-adb-sync',
      adb: device.details,
      raw: device.raw,
      synced_at: new Date().toISOString(),
    },
  };
}

async function markMissingOffline(supabase, onlineSerials) {
  if (!offlineMissing) return [];
  const { data, error } = await supabase
    .from('devices')
    .select('laixi_device_id,metadata_json')
    .eq('metadata_json->>source', 'mobile-mcp-adb-sync');
  if (error) throw new Error(error.message);
  const missing = (data ?? [])
    .map((device) => device.laixi_device_id)
    .filter((serial) => !onlineSerials.includes(serial));
  if (!missing.length) return [];
  const { error: updateError } = await supabase
    .from('devices')
    .update({ status: 'OFFLINE', heartbeat_freshness: 'offline', last_seen_at: new Date().toISOString() })
    .in('laixi_device_id', missing);
  if (updateError) throw new Error(updateError.message);
  return missing;
}

async function main() {
  mkdirSync(reportDir, { recursive: true });
  const adbOnlineDevices = adbDevices();
  const payloads = adbOnlineDevices.map(buildPayload);
  const report = { checkedAt: new Date().toISOString(), dryRun, adbPath, onlineSerials: adbOnlineDevices.map((device) => device.serial), payloads };

  if (dryRun) {
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ reportPath, dryRun, onlineSerials: report.onlineSerials }, null, 2));
    return;
  }

  if (!supabaseUrl) throw new Error('SUPABASE_URL or VITE_SUPABASE_URL is required');
  if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required in shell env');
  if (!payloads.length) throw new Error('No online adb devices found');

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data, error } = await supabase
    .from('devices')
    .upsert(payloads, { onConflict: 'laixi_device_id' })
    .select('id,laixi_device_id,name,model,status,last_seen_at');
  if (error) throw new Error(error.message);

  report.upserted = data ?? [];
  report.offlineSerials = await markMissingOffline(supabase, report.onlineSerials);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ reportPath, upserted: report.upserted.length, offlineSerials: report.offlineSerials }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
