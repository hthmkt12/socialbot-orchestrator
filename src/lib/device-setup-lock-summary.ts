import {
  buildDeviceLockSnapshot,
  getDeviceLockState,
  type DeviceLockSnapshot as BaseDeviceLockSnapshot,
} from './device-locks';

export interface DeviceLockSnapshot extends BaseDeviceLockSnapshot {
  selectedDeviceActiveLocks: BaseDeviceLockSnapshot['activeLocks'];
  selectedDeviceExpiredLocks: BaseDeviceLockSnapshot['expiredLocks'];
}

export function summarizeDeviceLocks(
  deviceLocks: Parameters<typeof buildDeviceLockSnapshot>[0],
  selectedDeviceId: string | null,
  now: Date = new Date()
): DeviceLockSnapshot {
  const snapshot = buildDeviceLockSnapshot(deviceLocks, now);
  const selectedLockState = selectedDeviceId ? getDeviceLockState(selectedDeviceId, snapshot) : null;

  return {
    ...snapshot,
    selectedDeviceActiveLocks: selectedLockState?.activeLock ? [selectedLockState.activeLock] : [],
    selectedDeviceExpiredLocks: selectedLockState?.expiredLocks ?? [],
  };
}
