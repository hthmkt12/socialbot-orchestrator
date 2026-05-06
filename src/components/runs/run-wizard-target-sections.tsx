import { Check, Users } from 'lucide-react';
import type { Device, DeviceGroup, TargetType } from '../../lib/database.types';
import type { DeviceLockSnapshot } from '../../lib/device-locks';
import { RunWizardDeviceTargetOption } from './RunWizardDeviceTargetOption';
import { targetOptions } from './run-wizard-types';
import { RunWizardTargetModeCard } from './run-wizard-target-mode-card';

export function RunWizardTargetModeGrid({
  declaredTargetType,
  onTargetTypeChange,
  targetType,
}: {
  declaredTargetType: TargetType | null;
  onTargetTypeChange: (targetType: TargetType) => void;
  targetType: TargetType;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {targetOptions.map((option) => (
        <RunWizardTargetModeCard
          key={option.type}
          declaredTargetType={declaredTargetType}
          onTargetTypeChange={onTargetTypeChange}
          targetType={targetType}
          type={option.type}
        />
      ))}
    </div>
  );
}

export function RunWizardDevicePicker({
  deviceLockSnapshot,
  deviceLocksError,
  devices,
  onToggleDevice,
  selectedDeviceIds,
  targetType,
}: {
  deviceLockSnapshot: DeviceLockSnapshot;
  deviceLocksError: Error | string | null | undefined;
  devices: Device[] | undefined;
  onToggleDevice: (deviceId: string) => void;
  selectedDeviceIds: string[];
  targetType: TargetType;
}) {
  if (targetType !== 'SINGLE_DEVICE' && targetType !== 'MULTI_DEVICE') {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          {targetType === 'SINGLE_DEVICE' ? 'Select Device' : 'Select Devices'}
        </h4>
        {selectedDeviceIds.length > 0 && (
          <span className="text-xs text-sky-600 font-medium">{selectedDeviceIds.length} selected</span>
        )}
      </div>
      {deviceLocksError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-medium text-amber-800">Lock visibility unavailable</p>
          <p className="text-xs text-amber-700 mt-1">
            {deviceLocksError instanceof Error ? deviceLocksError.message : 'Failed to load device locks'}
          </p>
        </div>
      )}
      <div className="space-y-1.5 max-h-[30vh] overflow-y-auto">
        {devices?.map((device) => (
          <RunWizardDeviceTargetOption
            key={device.id}
            device={device}
            deviceLockSnapshot={deviceLockSnapshot}
            isSelected={selectedDeviceIds.includes(device.id)}
            onToggleDevice={onToggleDevice}
          />
        ))}
      </div>
    </div>
  );
}

export function RunWizardGroupPicker({
  groups,
  onGroupChange,
  selectedGroupId,
  targetType,
}: {
  groups: DeviceGroup[] | undefined;
  onGroupChange: (groupId: string) => void;
  selectedGroupId: string;
  targetType: TargetType;
}) {
  if (targetType !== 'DEVICE_GROUP') {
    return null;
  }

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Select Group</h4>
      <div className="space-y-1.5">
        {groups?.map((group) => {
          const isSelected = selectedGroupId === group.id;
          return (
            <button
              key={group.id}
              onClick={() => onGroupChange(group.id)}
              className={`w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center gap-3 ${
                isSelected ? 'border-sky-500 bg-sky-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                isSelected ? 'bg-sky-100' : 'bg-gray-100'
              }`}>
                <Users className={`w-4 h-4 ${isSelected ? 'text-sky-500' : 'text-gray-500'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{group.name}</p>
                {group.description && <p className="text-xs text-gray-500">{group.description}</p>}
              </div>
              {isSelected && <Check className="w-4 h-4 text-sky-500 flex-shrink-0" />}
            </button>
          );
        })}
        {!groups?.length && (
          <p className="text-sm text-gray-500 text-center py-6">No device groups configured</p>
        )}
      </div>
    </div>
  );
}
