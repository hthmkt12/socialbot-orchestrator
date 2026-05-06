import type { DeviceLock } from './database.types';

export interface DeviceLockSnapshot {
  activeLocks: DeviceLock[];
  expiredLocks: DeviceLock[];
  activeByDeviceId: Map<string, DeviceLock>;
  expiredByDeviceId: Map<string, DeviceLock[]>;
}

export interface DeviceLockState {
  activeLock: DeviceLock | null;
  expiredLocks: DeviceLock[];
  latestExpiredLock: DeviceLock | null;
}

export function isDeviceLockActive(lock: DeviceLock, now: Date = new Date()) {
  return new Date(lock.expires_at).getTime() > now.getTime();
}

export function buildDeviceLockSnapshot(deviceLocks: DeviceLock[], now: Date = new Date()): DeviceLockSnapshot {
  const activeLocks: DeviceLock[] = [];
  const expiredLocks: DeviceLock[] = [];
  const activeByDeviceId = new Map<string, DeviceLock>();
  const expiredByDeviceId = new Map<string, DeviceLock[]>();

  for (const lock of deviceLocks) {
    if (isDeviceLockActive(lock, now)) {
      activeLocks.push(lock);
      if (!activeByDeviceId.has(lock.device_id)) {
        activeByDeviceId.set(lock.device_id, lock);
      }
      continue;
    }

    expiredLocks.push(lock);
    const existing = expiredByDeviceId.get(lock.device_id) ?? [];
    existing.push(lock);
    expiredByDeviceId.set(lock.device_id, existing);
  }

  return {
    activeLocks,
    expiredLocks,
    activeByDeviceId,
    expiredByDeviceId,
  };
}

export function getDeviceLockState(deviceId: string, snapshot: DeviceLockSnapshot): DeviceLockState {
  const expiredLocks = snapshot.expiredByDeviceId.get(deviceId) ?? [];

  return {
    activeLock: snapshot.activeByDeviceId.get(deviceId) ?? null,
    expiredLocks,
    latestExpiredLock: expiredLocks[0] ?? null,
  };
}

export function formatDeviceLockTimestamp(value: string) {
  return new Date(value).toLocaleString();
}

export function describeDeviceLockState(state: DeviceLockState) {
  if (state.activeLock) {
    return `Locked by run ${state.activeLock.workflow_run_id} until ${formatDeviceLockTimestamp(state.activeLock.expires_at)}`;
  }

  if (state.latestExpiredLock) {
    return `Expired lock from run ${state.latestExpiredLock.workflow_run_id} at ${formatDeviceLockTimestamp(state.latestExpiredLock.expires_at)}`;
  }

  return 'No visible device lock';
}
