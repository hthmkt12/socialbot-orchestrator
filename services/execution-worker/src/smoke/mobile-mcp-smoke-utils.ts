import type { MacroStep } from '../../../../src/contracts/macro';
import type { Device } from '../../../../src/lib/database.types';
import { MobileMcpStepBackend } from '../mobile-mcp-step-backend';

export function makeSmokeDevice(serial: string, index = 0): Device {
  return {
    id: `mobile-mcp-smoke-device-${index}`,
    laixi_device_id: serial,
    name: `Mobile MCP ${serial}`,
    model: 'Android',
    brand: 'Android',
    android_version: '',
    screen_width: Number(process.env.MOBILE_MCP_SCREEN_WIDTH ?? 720),
    screen_height: Number(process.env.MOBILE_MCP_SCREEN_HEIGHT ?? 1600),
    status: 'ONLINE',
    last_seen_at: new Date().toISOString(),
    heartbeat_freshness: 'fresh',
    last_error_message: null,
    last_error_at: null,
    metadata_json: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function step(id: string, type: MacroStep['type'], params: Record<string, unknown> = {}): MacroStep {
  return { id, type, params };
}

export async function executeSmokeStep(
  backend: MobileMcpStepBackend,
  device: Device,
  macroStep: MacroStep,
  runId: string,
  logPrefix: string
) {
  const result = await backend.executeStep({
    step: macroStep,
    runId,
    device,
    resolvedParams: macroStep.params,
    isCancelled: async () => false,
  });
  if (!result.success) {
    throw new Error(`${device.laixi_device_id} ${macroStep.type} failed: ${result.error ?? JSON.stringify(result.output)}`);
  }
  console.log(`${logPrefix} PASS ${device.laixi_device_id} ${macroStep.type}`, JSON.stringify(result.output));
  return result;
}
