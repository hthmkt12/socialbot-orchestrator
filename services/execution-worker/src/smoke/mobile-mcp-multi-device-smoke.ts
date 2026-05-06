import assert from 'node:assert/strict';
import { MobileMcpStepBackend } from '../mobile-mcp-step-backend';
import { executeSmokeStep, makeSmokeDevice, step } from './mobile-mcp-smoke-utils';

const bridgeUrl = process.env.MOBILE_MCP_BRIDGE_URL ?? 'http://127.0.0.1:4321';
const timeoutMs = Number(process.env.DEVICE_COMMAND_TIMEOUT_MS ?? 30000);
const serials = parseSerials();

if (serials.length === 0) {
  console.error('[mobile-mcp-multi-smoke] Missing serials. Set MOBILE_MCP_DEVICE_SERIALS=serial1,serial2 or pass serials as argv.');
  process.exit(1);
}

if (new Set(serials).size !== serials.length) {
  console.error('[mobile-mcp-multi-smoke] Duplicate serials are not allowed.');
  process.exit(1);
}

if (serials.length === 1) {
  console.warn('[mobile-mcp-multi-smoke] SINGLE_SERIAL_ONLY: pass multiple serials to verify parallel device isolation.');
}

function parseSerials() {
  const raw = process.env.MOBILE_MCP_DEVICE_SERIALS ?? process.env.MOBILE_MCP_DEVICE_SERIAL ?? process.argv.slice(2).join(',');
  return raw
    .split(',')
    .map((serial) => serial.trim())
    .filter(Boolean);
}

async function runSerial(serial: string, index: number) {
  const backend = new MobileMcpStepBackend(bridgeUrl, timeoutMs);
  const device = makeSmokeDevice(serial, index);
  const runId = `mobile-mcp-multi-smoke-run-${index}`;
  await backend.connect();
  try {
    await executeSmokeStep(backend, device, step('launch_settings', 'launch_app', { appName: 'com.android.settings' }), runId, '[mobile-mcp-multi-smoke]');
    await executeSmokeStep(backend, device, step('wait_after_launch', 'wait', { ms: 500 }), runId, '[mobile-mcp-multi-smoke]');
    const current = await executeSmokeStep(backend, device, step('current_app', 'get_current_app'), runId, '[mobile-mcp-multi-smoke]');
    assert.equal(current.output.appPackage, 'com.android.settings');

    const adb = await executeSmokeStep(backend, device, step('adb_model', 'adb', { command: 'getprop ro.product.model' }), runId, '[mobile-mcp-multi-smoke]');
    assert.equal(adb.output.code, 0);
    assert(String(adb.output.result ?? '').trim().length > 0);
    console.log(`[mobile-mcp-multi-smoke] PASS serial ${serial}`);
  } finally {
    await backend.disconnect();
  }
}

void Promise.all(serials.map((serial, index) => runSerial(serial, index)))
  .then(() => {
    console.log(`[mobile-mcp-multi-smoke] PASS ${serials.length} serial(s)`);
  })
  .catch((error) => {
    console.error('[mobile-mcp-multi-smoke] FAIL', error);
    process.exit(1);
  });
