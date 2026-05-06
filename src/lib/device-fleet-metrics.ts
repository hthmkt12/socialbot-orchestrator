import type { Device } from './database.types';
import { getDeviceHealthSummary } from './device-health';
import { getDeviceLockState, type DeviceLockSnapshot } from './device-locks';

export interface DeviceFleetMetrics {
  total: number;
  healthy: number;
  stale: number;
  busy: number;
  error: number;
  offline: number;
  locked: number;
}

export function buildDeviceFleetMetrics(devices: Device[], deviceLockSnapshot: DeviceLockSnapshot): DeviceFleetMetrics {
  return devices.reduce<DeviceFleetMetrics>(
    (acc, device) => {
      const health = getDeviceHealthSummary(device);
      const lockState = getDeviceLockState(device.id, deviceLockSnapshot);

      acc.total += 1;
      if (health.lifecycle.displayStatus === 'ONLINE' && !health.lifecycle.isHeartbeatStale) acc.healthy += 1;
      if (health.lifecycle.isHeartbeatStale) acc.stale += 1;
      if (health.lifecycle.displayStatus === 'BUSY') acc.busy += 1;
      if (health.lifecycle.displayStatus === 'ERROR') acc.error += 1;
      if (health.lifecycle.displayStatus === 'OFFLINE') acc.offline += 1;
      if (lockState.activeLock) acc.locked += 1;
      return acc;
    },
    { total: 0, healthy: 0, stale: 0, busy: 0, error: 0, offline: 0, locked: 0 }
  );
}
