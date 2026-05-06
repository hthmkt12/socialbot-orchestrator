import type { Device } from '../../lib/database.types';
import type {
  GatewayHealthView,
  MobileMcpBridgeHealthView,
  MobileMcpDeviceView,
  WorkerHealthView,
} from '../../lib/device-setup';
import { type CheckTone } from './device-setup-formatters';
export { buildDeviceSetupProbeChecklistItems } from './device-setup-probe-checklist-items';
import {
  describeGateway,
  describeMobileMcpBridge,
  describeMobileMcpDevices,
  describeWorker,
  getFreshnessTone,
  getMobileMcpDevicesTone,
  getPersistenceTone,
  getReachabilityTone,
  getRegistrationTone,
} from './device-setup-checklist-helpers';

export interface DeviceSetupChecklistItem {
  title: string;
  tone: CheckTone;
  detail: string;
}

export function buildDeviceSetupRuntimeChecklistItems({
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
}: {
  devices: Device[];
  devicesError: string | null;
  gateway: GatewayHealthView | null;
  gatewayError: string | null;
  mobileMcp: MobileMcpBridgeHealthView | null;
  mobileMcpDevices: MobileMcpDeviceView[];
  mobileMcpDevicesError: string | null;
  mobileMcpError: string | null;
  runnableDeviceCount: number;
  staleDeviceCount: number;
  worker: WorkerHealthView | null;
  workerError: string | null;
}): DeviceSetupChecklistItem[] {
  const gatewayTone = getReachabilityTone(gateway, gatewayError);
  const workerTone = getReachabilityTone(worker, workerError);
  const mobileMcpTone = getReachabilityTone(mobileMcp, mobileMcpError);
  const mobileMcpDevicesTone = getMobileMcpDevicesTone({
    mobileMcp,
    mobileMcpDevices,
    mobileMcpDevicesError,
  });
  const persistenceTone = getPersistenceTone(gateway);
  const registrationTone = getRegistrationTone(devices.length, devicesError);
  const freshnessTone = getFreshnessTone(runnableDeviceCount, staleDeviceCount, devices.length);

  return [
    {
      title: 'Gateway reachable',
      tone: gatewayTone,
      detail: describeGateway(gateway, gatewayError),
    },
    {
      title: 'Worker reachable',
      tone: workerTone,
      detail: describeWorker(worker, workerError),
    },
    {
      title: 'Mobile MCP bridge reachable',
      tone: mobileMcpTone,
      detail: describeMobileMcpBridge(mobileMcp, mobileMcpError),
    },
    {
      title: 'Mobile MCP Android serials',
      tone: mobileMcpDevicesTone,
      detail: describeMobileMcpDevices(mobileMcpDevices, mobileMcpDevicesError),
    },
    {
      title: 'Gateway persistence configured',
      tone: persistenceTone,
      detail: gateway
        ? (gateway.deviceStatePersistenceEnabled
          ? 'Gateway reports device health persistence is enabled.'
          : 'Gateway is running without Supabase service-role env, so device-health persistence is disabled.')
        : 'Requires a reachable gateway health endpoint.',
    },
    {
      title: 'Device registration present',
      tone: registrationTone,
      detail: devicesError ? devicesError : `${devices.length} device row(s) visible in Supabase.`,
    },
    {
      title: 'Fresh heartbeat available',
      tone: freshnessTone,
      detail:
        runnableDeviceCount > 0
          ? `${runnableDeviceCount} runnable device(s); ${staleDeviceCount} stale device(s).`
          : staleDeviceCount > 0
            ? `No runnable device yet. ${staleDeviceCount} device(s) are stale and should be rechecked.`
            : 'No fresh device heartbeat is currently available.',
    },
  ];
}
