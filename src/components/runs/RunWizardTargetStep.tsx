import type { Device, DeviceGroup, TargetType } from '../../lib/database.types';
import type { DeviceLockSnapshot } from '../../lib/device-locks';
import {
  RunWizardAllDevicesSummary,
  RunWizardTargetContractNotice,
} from './run-wizard-target-notices';
import {
  RunWizardDevicePicker,
  RunWizardGroupPicker,
  RunWizardTargetModeGrid,
} from './run-wizard-target-sections';

interface FleetCounts {
  online: number;
  offline: number;
  busy: number;
  stale: number;
  locked: number;
}

export function RunWizardTargetStep({
  declaredTargetType,
  deviceLockSnapshot,
  deviceLocksError,
  devices,
  fleetCounts,
  groups,
  onGroupChange,
  onTargetTypeChange,
  onToggleDevice,
  selectedDeviceIds,
  selectedGroupId,
  targetType,
}: {
  declaredTargetType: TargetType | null;
  deviceLockSnapshot: DeviceLockSnapshot;
  deviceLocksError: Error | string | null | undefined;
  devices: Device[] | undefined;
  fleetCounts: FleetCounts;
  groups: DeviceGroup[] | undefined;
  onGroupChange: (groupId: string) => void;
  onTargetTypeChange: (targetType: TargetType) => void;
  onToggleDevice: (deviceId: string) => void;
  selectedDeviceIds: string[];
  selectedGroupId: string;
  targetType: TargetType;
}) {
  return (
    <div className="space-y-5">
      <RunWizardTargetModeGrid
        declaredTargetType={declaredTargetType}
        onTargetTypeChange={onTargetTypeChange}
        targetType={targetType}
      />
      <RunWizardTargetContractNotice declaredTargetType={declaredTargetType} />
      <RunWizardDevicePicker
        deviceLockSnapshot={deviceLockSnapshot}
        deviceLocksError={deviceLocksError}
        devices={devices}
        onToggleDevice={onToggleDevice}
        selectedDeviceIds={selectedDeviceIds}
        targetType={targetType}
      />
      <RunWizardGroupPicker
        groups={groups}
        onGroupChange={onGroupChange}
        selectedGroupId={selectedGroupId}
        targetType={targetType}
      />
      <RunWizardAllDevicesSummary
        devices={devices}
        fleetCounts={fleetCounts}
        targetType={targetType}
      />
    </div>
  );
}
