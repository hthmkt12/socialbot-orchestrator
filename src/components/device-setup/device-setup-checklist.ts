import type { Device } from '../../lib/database.types';
import type {
  GatewayHealthView,
  MobileMcpBridgeHealthView,
  MobileMcpDeviceView,
  SetupProbeKind,
  SetupProbeResult,
  WorkerHealthView,
} from '../../lib/device-setup';
import {
  buildDeviceSetupProbeChecklistItems,
  buildDeviceSetupRuntimeChecklistItems,
  type DeviceSetupChecklistItem,
} from './device-setup-checklist-items';
export type { DeviceSetupChecklistItem } from './device-setup-checklist-items';

interface DeviceSetupChecklistInput {
  gateway: GatewayHealthView | null;
  gatewayError: string | null;
  worker: WorkerHealthView | null;
  workerError: string | null;
  mobileMcp: MobileMcpBridgeHealthView | null;
  mobileMcpError: string | null;
  mobileMcpDevices: MobileMcpDeviceView[];
  mobileMcpDevicesError: string | null;
  devices: Device[];
  devicesError: string | null;
  probeResults: Partial<Record<SetupProbeKind, SetupProbeResult>>;
  runnableDeviceCount: number;
  staleDeviceCount: number;
}

export const buildDeviceSetupChecklist = ({
  gateway,
  gatewayError,
  worker,
  workerError,
  mobileMcp,
  mobileMcpError,
  mobileMcpDevices,
  mobileMcpDevicesError,
  devices,
  devicesError,
  probeResults,
  runnableDeviceCount,
  staleDeviceCount,
}: DeviceSetupChecklistInput): DeviceSetupChecklistItem[] => {
  return [
    ...buildDeviceSetupRuntimeChecklistItems({
      devices,
      devicesError,
      gateway,
      gatewayError,
      mobileMcp,
      mobileMcpDevices,
      mobileMcpDevicesError,
      mobileMcpError,
      runnableDeviceCount,
      staleDeviceCount,
      worker,
      workerError,
    }),
    ...buildDeviceSetupProbeChecklistItems(probeResults),
  ];
};
