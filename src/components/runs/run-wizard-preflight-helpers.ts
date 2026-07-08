import type { MacroDefinition } from '../../contracts/macro';
import { buildRunPreflightSummary, targetModeToTargetType } from '../../lib/run-preflight';
import type {
  Device,
  DeviceGroupMember,
  Macro,
  MacroVersion,
  Account,
  TargetType,
  UserRole,
} from '../../lib/database.types';

export function resolveRunWizardSelection(args: {
  macros: Macro[] | undefined;
  selectedMacroId: string;
  selectedVersionId: string;
  versions: MacroVersion[] | undefined;
}) {
  const { macros, selectedMacroId, selectedVersionId, versions } = args;
  const selectedVersion = versions?.find((version) => version.id === selectedVersionId);
  const definition = selectedVersion?.definition_json as unknown as MacroDefinition | undefined;

  return {
    declaredTargetType: definition ? targetModeToTargetType(definition.target.mode) : null,
    definition,
    selectedMacro: macros?.find((macro) => macro.id === selectedMacroId),
    selectedVersion,
  };
}

export function normalizeRunWizardDeviceLocksError(deviceLocksError: unknown) {
  if (deviceLocksError instanceof Error) return deviceLocksError.message;
  return deviceLocksError ? String(deviceLocksError) : null;
}

export function buildRunWizardPreflight(args: {
  definition: MacroDefinition | undefined;
  devices: Device[] | undefined;
  deviceLocksError: unknown;
  dispatchableDeviceCount: number;
  expiredLockedTargetDevicesCount: number;
  groupMembers: DeviceGroupMember[] | undefined;
  inputValues: Record<string, string>;
  lockedTargetDevicesCount: number;
  profileRole: UserRole | undefined;
  requiresAccount?: boolean;
  runnableDeviceCount: number;
  selectedAccount?: Pick<Account, 'id' | 'username' | 'platform' | 'is_blocked' | 'daily_action_limit' | 'current_action_count' | 'warm_up_stage'> | null;
  selectedDeviceIds: string[];
  selectedGroupId: string;
  staleDeviceCount: number;
  targetDevicesCount: number;
  targetType: TargetType;
}) {
  const {
    definition,
    devices,
    deviceLocksError,
    dispatchableDeviceCount,
    expiredLockedTargetDevicesCount,
    groupMembers,
    inputValues,
    lockedTargetDevicesCount,
    profileRole,
    requiresAccount,
    runnableDeviceCount,
    selectedAccount,
    selectedDeviceIds,
    selectedGroupId,
    staleDeviceCount,
    targetDevicesCount,
    targetType,
  } = args;

  return buildRunPreflightSummary({
    definition,
    targetType,
    profileRole,
    requiresAccount,
    selectedAccount,
    selectedDeviceIds,
    selectedGroupId,
    targetDevicesCount,
    totalDevicesCount: devices?.length ?? 0,
    groupMemberCount: groupMembers?.length ?? 0,
    runnableDeviceCount,
    dispatchableDeviceCount,
    staleDeviceCount,
    lockedTargetDevicesCount,
    expiredLockedTargetDevicesCount,
    inputValues,
    deviceLocksError: normalizeRunWizardDeviceLocksError(deviceLocksError),
  });
}
