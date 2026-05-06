import assert from 'node:assert/strict';
import { MobileMcpStepBackend } from '../mobile-mcp-step-backend';
import { executeSmokeStep, makeSmokeDevice, step } from './mobile-mcp-smoke-utils';

const serial = process.env.MOBILE_MCP_DEVICE_SERIAL ?? process.argv[2];
const bridgeUrl = process.env.MOBILE_MCP_BRIDGE_URL ?? 'http://127.0.0.1:4321';
const timeoutMs = Number(process.env.DEVICE_COMMAND_TIMEOUT_MS ?? 30000);

if (!serial) {
  console.error('[mobile-mcp-smoke] Missing serial. Set MOBILE_MCP_DEVICE_SERIAL or pass it as argv[2].');
  process.exit(1);
}

const device = makeSmokeDevice(serial);

async function main() {
  const backend = new MobileMcpStepBackend(bridgeUrl, timeoutMs);
  await backend.connect();
  try {
    await executeSmokeStep(backend, device, step('launch_settings', 'launch_app', { appName: 'com.android.settings' }), 'mobile-mcp-smoke-run', '[mobile-mcp-smoke]');
    await executeSmokeStep(backend, device, step('wait_after_launch', 'wait', { ms: 800 }), 'mobile-mcp-smoke-run', '[mobile-mcp-smoke]');
    const current = await executeSmokeStep(backend, device, step('current_app', 'get_current_app'), 'mobile-mcp-smoke-run', '[mobile-mcp-smoke]');
    assert.equal(current.output.appPackage, 'com.android.settings');
    await executeSmokeStep(backend, device, step('settings_swipe', 'swipe', { fromX: 0.5, fromY: 0.72, toX: 0.5, toY: 0.38 }), 'mobile-mcp-smoke-run', '[mobile-mcp-smoke]');
    await executeSmokeStep(backend, device, step('status_bar_tap', 'tap', { x: 0.5, y: 0.03 }), 'mobile-mcp-smoke-run', '[mobile-mcp-smoke]');

    const adb = await executeSmokeStep(backend, device, step('adb_model', 'adb', { command: 'getprop ro.product.model' }), 'mobile-mcp-smoke-run', '[mobile-mcp-smoke]');
    assert.equal(adb.output.code, 0);
    assert.equal(typeof adb.output.result, 'string');
    assert(String(adb.output.result).trim().length > 0);

    const screenshot = await executeSmokeStep(backend, device, step('screenshot', 'screenshot', { description: 'worker_mobile_mcp_smoke' }), 'mobile-mcp-smoke-run', '[mobile-mcp-smoke]');
    assert.equal(typeof screenshot.screenshotBase64, 'string');
    assert((screenshot.screenshotBase64 ?? '').length > 1000);
    console.log(`[mobile-mcp-smoke] PASS serial ${serial}`);
  } finally {
    await backend.disconnect();
  }
}

void main().catch((error) => {
  console.error('[mobile-mcp-smoke] FAIL', error);
  process.exit(1);
});
