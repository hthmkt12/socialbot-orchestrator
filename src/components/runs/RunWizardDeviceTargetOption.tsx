import { Check, Smartphone } from 'lucide-react';
import DeviceLockBadge from '../devices/DeviceLockBadge';
import Badge from '../ui/Badge';
import type { Device } from '../../lib/database.types';
import { getDeviceHealthSummary } from '../../lib/device-health';
import {
  describeDeviceLockState,
  getDeviceLockState,
  type DeviceLockSnapshot,
} from '../../lib/device-locks';
import { DeviceBatteryIcon } from './DeviceBatteryIcon';

export function RunWizardDeviceTargetOption({
  device,
  deviceLockSnapshot,
  isSelected,
  onToggleDevice,
}: {
  device: Device;
  deviceLockSnapshot: DeviceLockSnapshot;
  isSelected: boolean;
  onToggleDevice: (deviceId: string) => void;
}) {
  const health = getDeviceHealthSummary(device);
  const lockState = getDeviceLockState(device.id, deviceLockSnapshot);
  const lockDetail = describeDeviceLockState(lockState);
  const meta = device.metadata_json ?? {};
  const batteryLevel = meta.batteryLevel as number | undefined;
  const isCharging = meta.isCharging as boolean | undefined;

  return (
    <button
      onClick={() => onToggleDevice(device.id)}
      className={`w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center gap-3 ${
        isSelected ? 'border-sky-500 bg-sky-50' : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
        isSelected ? 'bg-sky-100' : 'bg-gray-100'
      }`}>
        <Smartphone className={`w-4 h-4 ${isSelected ? 'text-sky-500' : 'text-gray-500'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{device.name || device.model}</p>
        <p className="text-xs text-gray-500">{device.brand} {device.model}</p>
        <p className={`text-[11px] ${health.lifecycle.isHeartbeatStale ? 'text-amber-600' : 'text-gray-400'}`}>
          {health.detail}
        </p>
        {(lockState.activeLock || lockState.latestExpiredLock) && (
          <p className={`text-[11px] mt-0.5 ${lockState.activeLock ? 'text-red-600' : 'text-amber-600'}`}>
            {lockDetail}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <DeviceLockBadge lockState={lockState} />
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <DeviceBatteryIcon level={batteryLevel} charging={isCharging} />
          <span>{batteryLevel != null ? `${batteryLevel}%` : ''}</span>
        </div>
        <Badge variant={health.appearance.variant as 'green'}>
          {health.appearance.label}
        </Badge>
      </div>
      {isSelected && <Check className="w-4 h-4 text-sky-500 flex-shrink-0" />}
    </button>
  );
}
