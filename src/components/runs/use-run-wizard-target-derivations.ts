import { useMemo } from 'react';
import type {
  Device,
  DeviceGroupMember,
  DeviceLock,
  Macro,
  MacroVersion,
  TargetType,
  UserRole,
} from '../../lib/database.types';
import {
  buildDeviceLockSnapshot,
  type DeviceLockSnapshot,
} from '../../lib/device-locks';
import {
  buildRunWizardTargetState,
  resolveRunWizardTargetDevices,
} from './run-wizard-derived-helpers';
import {
  buildRunWizardPreflight,
  resolveRunWizardSelection,
} from './run-wizard-preflight-helpers';

interface UseRunWizardTargetDerivationsArgs {
  deviceLocks: DeviceLock[] | undefined;
  deviceLocksError: unknown;
  devices: Device[] | undefined;
  groupMembers: DeviceGroupMember[] | undefined;
  inputValues: Record<string, string>;
  macros: Macro[] | undefined;
  profileRole: UserRole | undefined;
  selectedDeviceIds: string[];
  selectedGroupId: string;
  selectedMacroId: string;
  selectedVersionId: string;
  targetType: TargetType;
  versions: MacroVersion[] | undefined;
}

export function useRunWizardTargetDerivations({
  deviceLocks,
  deviceLocksError,
  devices,
  groupMembers,
  inputValues,
  macros,
  profileRole,
  selectedDeviceIds,
  selectedGroupId,
  selectedMacroId,
  selectedVersionId,
  targetType,
  versions,
}: UseRunWizardTargetDerivationsArgs) {
  const selection = useMemo(
    () => resolveRunWizardSelection({ macros, selectedMacroId, selectedVersionId, versions }),
    [macros, selectedMacroId, selectedVersionId, versions]
  );
  const { declaredTargetType, definition, selectedMacro, selectedVersion } = selection;

  const deviceLockSnapshot: DeviceLockSnapshot = useMemo(
    () => buildDeviceLockSnapshot(deviceLocks ?? []),
    [deviceLocks]
  );

  const targetDevices = useMemo(
    (): Device[] => resolveRunWizardTargetDevices({
      devices,
      groupMembers,
      selectedDeviceIds,
      selectedGroupId,
      targetType,
    }),
    [devices, groupMembers, selectedDeviceIds, selectedGroupId, targetType]
  );

  const targetState = useMemo(
    () => buildRunWizardTargetState(targetDevices, deviceLockSnapshot),
    [deviceLockSnapshot, targetDevices]
  );

  const preflightSummary = useMemo(() => buildRunWizardPreflight({
    definition,
    devices,
    deviceLocksError,
    dispatchableDeviceCount: targetState.dispatchableDevices.length,
    expiredLockedTargetDevicesCount: targetState.expiredLockedTargetDevices.length,
    groupMembers,
    inputValues,
    lockedTargetDevicesCount: targetState.lockedTargetDevices.length,
    profileRole,
    runnableDeviceCount: targetState.onlineDeviceCount,
    selectedDeviceIds,
    selectedGroupId,
    staleDeviceCount: targetState.staleDeviceCount,
    targetDevicesCount: targetDevices.length,
    targetType,
  }), [
    definition,
    devices,
    deviceLocksError,
    groupMembers,
    inputValues,
    profileRole,
    selectedDeviceIds,
    selectedGroupId,
    targetDevices.length,
    targetState.dispatchableDevices.length,
    targetState.expiredLockedTargetDevices.length,
    targetState.lockedTargetDevices.length,
    targetState.onlineDeviceCount,
    targetState.staleDeviceCount,
    targetType,
  ]);

  return {
    declaredTargetType,
    definition,
    deviceLockSnapshot,
    preflightSummary,
    selectedMacro,
    selectedVersion,
    targetDevices,
    targetState,
  };
}
