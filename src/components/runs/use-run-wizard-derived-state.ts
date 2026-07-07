import { useMemo } from 'react';
import type {
  Device,
  DeviceGroupMember,
  Macro,
  MacroVersion,
  TargetType,
  UserRole,
  Account,
} from '../../lib/database.types';
import type { DeviceLock } from '../../lib/database.types';
import {
  buildRunWizardFleetCounts,
  buildRunWizardInputFields,
  filterRunWizardMacros,
} from './run-wizard-derived-helpers';
import { useRunWizardTargetDerivations } from './use-run-wizard-target-derivations';

export function useRunWizardDerivedState({
  accounts,
  deviceLocks,
  deviceLocksError,
  devices,
  groupMembers,
  inputValues,
  macroSearch,
  macros,
  profileRole,
  selectedAccountId,
  selectedDeviceIds,
  selectedGroupId,
  selectedMacroId,
  selectedVersionId,
  targetType,
  versions,
}: {
  accounts: Account[] | undefined;
  deviceLocks: DeviceLock[] | undefined;
  deviceLocksError: unknown;
  devices: Device[] | undefined;
  groupMembers: DeviceGroupMember[] | undefined;
  inputValues: Record<string, string>;
  macroSearch: string;
  macros: Macro[] | undefined;
  profileRole: UserRole | undefined;
  selectedAccountId: string;
  selectedDeviceIds: string[];
  selectedGroupId: string;
  selectedMacroId: string;
  selectedVersionId: string;
  targetType: TargetType;
  versions: MacroVersion[] | undefined;
}) {
  const {
    declaredTargetType,
    definition,
    deviceLockSnapshot,
    preflightSummary,
    selectedMacro,
    selectedVersion,
    targetDevices,
    targetState,
  } = useRunWizardTargetDerivations({
    accounts,
    deviceLocks,
    deviceLocksError,
    devices,
    groupMembers,
    inputValues,
    macros,
    profileRole,
    selectedAccountId,
    selectedDeviceIds,
    selectedGroupId,
    selectedMacroId,
    selectedVersionId,
    targetType,
    versions,
  });
  const filteredMacros = useMemo(
    () => filterRunWizardMacros(macros, macroSearch),
    [macros, macroSearch]
  );
  const inputFields = useMemo(
    () => buildRunWizardInputFields(definition),
    [definition]
  );
  const {
    dispatchableDevices,
    onlineDeviceCount,
  } = targetState;
  const fleetCounts = useMemo(() => {
    return buildRunWizardFleetCounts(devices, deviceLockSnapshot);
  }, [deviceLockSnapshot, devices]);

  return {
    declaredTargetType,
    definition,
    deviceLockSnapshot,
    dispatchableDeviceCount: dispatchableDevices.length,
    dispatchableDevices,
    filteredMacros,
    fleetCounts,
    inputFields,
    onlineDeviceCount,
    preflightSummary,
    selectedMacro,
    selectedVersion,
    targetDevices,
  };
}
