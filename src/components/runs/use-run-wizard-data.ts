import { useMacroVersions, useMacros } from '../../hooks/useMacros';
import { useDeviceLocks, useDevices } from '../../hooks/useDevices';
import { useDeviceGroups, useDeviceGroupMembers } from '../../hooks/useDeviceGroups';
import { useAccounts } from '../../hooks/use-accounts';
import { useRunWizardDerivedState } from './use-run-wizard-derived-state';
import type { TargetType, UserRole } from '../../lib/database.types';

interface UseRunWizardDataArgs {
  inputValues: Record<string, string>;
  macroSearch: string;
  profileRole: UserRole | undefined;
  selectedAccountId: string;
  selectedDeviceIds: string[];
  selectedGroupId: string;
  selectedMacroId: string;
  selectedVersionId: string;
  targetType: TargetType;
}

export function useRunWizardData({
  inputValues,
  macroSearch,
  profileRole,
  selectedAccountId,
  selectedDeviceIds,
  selectedGroupId,
  selectedMacroId,
  selectedVersionId,
  targetType,
}: UseRunWizardDataArgs) {
  const { data: macros } = useMacros();
  const { data: versions } = useMacroVersions(selectedMacroId);
  const { data: devices } = useDevices();
  const { data: deviceLocks, error: deviceLocksError } = useDeviceLocks();
  const { data: groups } = useDeviceGroups();
  const { data: groupMembers } = useDeviceGroupMembers(selectedGroupId);
  const { data: accounts } = useAccounts();

  const derived = useRunWizardDerivedState({
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
  });

  return {
    deviceLocksError,
    devices,
    groups,
    versions,
    ...derived,
  };
}
