import { Smartphone } from 'lucide-react';
import type { Device } from '../../lib/database.types';
import { getDeviceHealthSummary } from '../../lib/device-health';
import { getDeviceLockState, type DeviceLockSnapshot } from '../../lib/device-locks';
import DeviceLockBadge from '../devices/DeviceLockBadge';
import Badge from '../ui/Badge';
import { ReviewMetric } from './run-wizard-review-primitives';

export function RunWizardReviewDeviceList({
  deviceLockSnapshot,
  targetDevices,
}: {
  deviceLockSnapshot: DeviceLockSnapshot;
  targetDevices: Device[];
}) {
  if (targetDevices.length === 0 || targetDevices.length > 6) {
    return null;
  }

  return (
    <div className="pt-2 border-t border-gray-200">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Devices</p>
      <div className="flex flex-wrap gap-2">
        {targetDevices.map((device) => {
          const health = getDeviceHealthSummary(device);
          const lockState = getDeviceLockState(device.id, deviceLockSnapshot);
          return (
            <div key={device.id} className="flex items-center gap-1.5 px-2.5 py-1 bg-white rounded-lg border border-gray-200 text-xs">
              <Smartphone className="w-3 h-3 text-gray-400" />
              <span className="text-gray-700 font-medium">{device.name || device.model}</span>
              <Badge variant={health.appearance.variant}>{health.appearance.label}</Badge>
              <DeviceLockBadge lockState={lockState} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function RunWizardReviewInputVariables({
  inputValues,
}: {
  inputValues: Record<string, string>;
}) {
  const populatedInputs = Object.entries(inputValues).filter(([, value]) => value);

  if (populatedInputs.length === 0) {
    return null;
  }

  return (
    <div className="pt-2 border-t border-gray-200">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Input Variables</p>
      <div className="space-y-1.5">
        {populatedInputs.map(([key, value]) => (
          <ReviewMetric key={key} label={key} value={value} labelClassName="font-mono text-xs" valueClassName="text-xs" />
        ))}
      </div>
    </div>
  );
}
