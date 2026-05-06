import type { MacroDefinition } from '../../contracts/macro';
import { getDeviceHealthSummary, isRunnableDevice } from '../../lib/device-health';
import {
  getDeviceLockState,
  type DeviceLockSnapshot,
} from '../../lib/device-locks';
import type {
  Device,
  DeviceGroupMember,
  Macro,
  TargetType,
} from '../../lib/database.types';

export function filterRunWizardMacros(macros: Macro[] | undefined, macroSearch: string) {
  if (!macros) return [];
  if (!macroSearch) return macros;

  const query = macroSearch.toLowerCase();
  return macros.filter(
    (macro) =>
      macro.name.toLowerCase().includes(query) ||
      macro.key.toLowerCase().includes(query)
  );
}

export function buildRunWizardInputFields(definition: MacroDefinition | undefined) {
  if (!definition?.inputs) return [];
  return Object.entries(definition.inputs).map(([key, field]) => ({ key, ...field }));
}

export function resolveRunWizardTargetDevices(args: {
  devices: Device[] | undefined;
  groupMembers: DeviceGroupMember[] | undefined;
  selectedDeviceIds: string[];
  selectedGroupId: string;
  targetType: TargetType;
}): Device[] {
  const { devices, groupMembers, selectedDeviceIds, selectedGroupId, targetType } = args;

  if (!devices) return [];
  if (targetType === 'ALL_DEVICES') return devices;
  if (targetType === 'SINGLE_DEVICE' || targetType === 'MULTI_DEVICE') {
    return devices.filter((device) => selectedDeviceIds.includes(device.id));
  }
  if (targetType === 'DEVICE_GROUP' && selectedGroupId && groupMembers) {
    const memberIds = new Set(groupMembers.map((member) => member.device_id));
    return devices.filter((device) => memberIds.has(device.id));
  }
  return [];
}

export function countRunnableTargetDevices(targetDevices: Device[]) {
  return targetDevices.filter((device) => isRunnableDevice(device)).length;
}

export function countStaleTargetDevices(targetDevices: Device[]) {
  return targetDevices.filter(
    (device) => getDeviceHealthSummary(device).lifecycle.isHeartbeatStale
  ).length;
}

export function getLockedTargetDevices(targetDevices: Device[], snapshot: DeviceLockSnapshot) {
  return targetDevices.filter(
    (device) => getDeviceLockState(device.id, snapshot).activeLock
  );
}

export function getExpiredLockedTargetDevices(
  targetDevices: Device[],
  snapshot: DeviceLockSnapshot
) {
  return targetDevices.filter((device) => {
    const lockState = getDeviceLockState(device.id, snapshot);
    return !lockState.activeLock && lockState.latestExpiredLock;
  });
}

export function getDispatchableRunWizardDevices(
  targetDevices: Device[],
  snapshot: DeviceLockSnapshot
) {
  return targetDevices.filter((device) => {
    const lockState = getDeviceLockState(device.id, snapshot);
    return isRunnableDevice(device) && !lockState.activeLock;
  });
}

export function buildRunWizardTargetState(
  targetDevices: Device[],
  snapshot: DeviceLockSnapshot
) {
  const onlineDeviceCount = countRunnableTargetDevices(targetDevices);
  const staleDeviceCount = countStaleTargetDevices(targetDevices);
  const lockedTargetDevices = getLockedTargetDevices(targetDevices, snapshot);
  const expiredLockedTargetDevices = getExpiredLockedTargetDevices(targetDevices, snapshot);
  const dispatchableDevices = getDispatchableRunWizardDevices(targetDevices, snapshot);

  return {
    dispatchableDevices,
    expiredLockedTargetDevices,
    lockedTargetDevices,
    onlineDeviceCount,
    staleDeviceCount,
  };
}

export function buildRunWizardFleetCounts(
  devices: Device[] | undefined,
  snapshot: DeviceLockSnapshot
) {
  return (devices ?? []).reduce(
    (acc, device) => {
      const health = getDeviceHealthSummary(device);
      if (health.lifecycle.displayStatus === 'ONLINE') acc.online += 1;
      if (health.lifecycle.displayStatus === 'OFFLINE') acc.offline += 1;
      if (health.lifecycle.displayStatus === 'BUSY') acc.busy += 1;
      if (health.lifecycle.isHeartbeatStale) acc.stale += 1;
      if (getDeviceLockState(device.id, snapshot).activeLock) acc.locked += 1;
      return acc;
    },
    { online: 0, offline: 0, busy: 0, stale: 0, locked: 0 }
  );
}
