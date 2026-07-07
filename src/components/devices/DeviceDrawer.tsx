import { Smartphone, Trash2, X } from 'lucide-react';
import Badge from '../ui/Badge';
import Spinner from '../ui/Spinner';
import { getDeviceHealthSummary } from '../../lib/device-health';
import { describeDeviceLockState, type DeviceLockState } from '../../lib/device-locks';
import type { Device } from '../../lib/database.types';
import DeviceLockBadge from './DeviceLockBadge';
import { DeviceBatteryIcon } from './DeviceBatteryIcon';
import { DeviceDrawerFacts, DeviceDrawerRawMetadata } from './device-drawer-detail-sections';

interface DeviceDrawerProps {
  canDelete: boolean;
  deletePending: boolean;
  device: Device;
  lockState: DeviceLockState;
  onClose: () => void;
  onDelete: () => void;
}

export function DeviceDrawer({ canDelete, deletePending, device, lockState, onClose, onDelete }: DeviceDrawerProps) {
  const meta = device.metadata_json ?? {};
  const batteryLevel = meta.batteryLevel as number | undefined;
  const isCharging = meta.isCharging as boolean | undefined;
  const health = getDeviceHealthSummary(device);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white shadow-2xl overflow-y-auto animate-in">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
          <h3 className="text-lg font-semibold text-gray-900">Device Details</h3>
          <div className="flex items-center gap-2">
            {canDelete && (
              <button
                onClick={onDelete}
                disabled={deletePending}
                className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 disabled:opacity-50 transition-colors"
                title="Delete device"
              >
                {deletePending ? <Spinner size="sm" /> : <Trash2 className="w-5 h-5" />}
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="p-6 space-y-6">
          <DeviceDrawerIdentity device={device} health={health} lockState={lockState} />
          {batteryLevel != null && (
            <DeviceDrawerBattery batteryLevel={batteryLevel} isCharging={isCharging} />
          )}
          <DeviceDrawerFacts device={device} health={health} lockState={lockState} />
          <DeviceDrawerRawMetadata metadata={meta} />
        </div>
      </div>
    </div>
  );
}

function DeviceDrawerIdentity({
  device,
  health,
  lockState,
}: Pick<DeviceDrawerProps, 'device' | 'lockState'> & { health: ReturnType<typeof getDeviceHealthSummary> }) {
  const sc = health.appearance;

  return (
    <div className="flex items-center gap-4">
      <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center">
        <Smartphone className="w-8 h-8 text-gray-500" />
      </div>
      <div>
        <h4 className="text-base font-semibold text-gray-900">{device.name || device.model}</h4>
        <p className="text-sm text-gray-500">{device.brand}</p>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          <Badge variant={sc.variant as 'green'}>{sc.label}</Badge>
          <DeviceLockBadge lockState={lockState} />
        </div>
        <p className={`mt-2 text-xs ${health.lifecycle.isHeartbeatStale ? 'text-amber-600' : 'text-gray-500'}`}>
          {health.detail}
        </p>
        {(lockState.activeLock || lockState.latestExpiredLock) && (
          <p className={`mt-1 text-xs ${lockState.activeLock ? 'text-red-600' : 'text-amber-600'}`}>
            {describeDeviceLockState(lockState)}
          </p>
        )}
      </div>
    </div>
  );
}

function DeviceDrawerBattery({
  batteryLevel,
  isCharging,
}: {
  batteryLevel: number;
  isCharging?: boolean;
}) {
  return (
    <div className="bg-gray-50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-600">Battery</span>
        <div className="flex items-center gap-1.5 text-xs font-medium text-gray-700">
          <DeviceBatteryIcon level={batteryLevel} charging={isCharging} />
          {batteryLevel}%{isCharging ? ' (Charging)' : ''}
        </div>
      </div>
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            batteryLevel < 20 ? 'bg-red-500' : batteryLevel < 60 ? 'bg-amber-500' : 'bg-emerald-500'
          }`}
          style={{ width: `${batteryLevel}%` }}
        />
      </div>
    </div>
  );
}
