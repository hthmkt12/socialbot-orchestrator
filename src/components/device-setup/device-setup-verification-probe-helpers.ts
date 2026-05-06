import type { Device } from '../../lib/database.types';
import { getDeviceHealthSummary } from '../../lib/device-health';
import {
  runMobileMcpSetupProbe,
  runSetupProbe,
  type SetupProbeKind,
  type SetupProbeResult,
} from '../../lib/device-setup';

export function selectAvailableDeviceId(devices: Device[], currentDeviceId: string): string {
  if (devices.some((device) => device.id === currentDeviceId)) return currentDeviceId;

  const nextRunnable = devices.find((device) => getDeviceHealthSummary(device).lifecycle.isRunnable);
  return nextRunnable?.id ?? devices[0]?.id ?? '';
}

export async function runDeviceSetupProbe(args: {
  activeProbeBackend: 'mobile-mcp' | 'laixi';
  gatewayBaseUrl: string;
  kind: SetupProbeKind;
  mobileMcpBridgeUrl: string;
  selectedDevice: Device;
}): Promise<SetupProbeResult> {
  const {
    activeProbeBackend,
    gatewayBaseUrl,
    kind,
    mobileMcpBridgeUrl,
    selectedDevice,
  } = args;

  return activeProbeBackend === 'mobile-mcp'
    ? runMobileMcpSetupProbe(
      mobileMcpBridgeUrl,
      selectedDevice.laixi_device_id,
      kind,
      selectedDevice.screen_width,
      selectedDevice.screen_height
    )
    : runSetupProbe(gatewayBaseUrl, selectedDevice.laixi_device_id, kind);
}
