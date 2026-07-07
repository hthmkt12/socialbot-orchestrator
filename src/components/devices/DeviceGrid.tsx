import { Search, Signal, Smartphone } from 'lucide-react';
import Badge from '../ui/Badge';
import EmptyState from '../ui/EmptyState';
import Spinner from '../ui/Spinner';
import { describeDeviceLockState } from '../../lib/device-locks';
import type { Device } from '../../lib/database.types';
import DeviceLockBadge from './DeviceLockBadge';
import { DeviceBatteryIcon } from './DeviceBatteryIcon';
import type { DeviceCardModel } from './devices-page-types';

function devicePlatform(device: Device): string {
  const p = device.metadata_json?.platform;
  return p === 'ios' ? 'iOS' : 'Android';
}

interface DeviceGridProps {
  canSync: boolean;
  devices: Device[] | undefined;
  filtered: DeviceCardModel[];
  isLoading: boolean;
  onSelectDevice: (device: Device) => void;
  onSync: () => void;
}

export function DeviceGrid({
  canSync,
  devices,
  filtered,
  isLoading,
  onSelectDevice,
  onSync,
}: DeviceGridProps) {
  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>;
  }

  if (!devices?.length) {
    return (
      <EmptyState
        icon={<Smartphone className="w-6 h-6" />}
        title="No devices found"
        description="Start the configured device bridge and sync to discover your devices."
        action={
          <button
            onClick={onSync}
            disabled={!canSync}
            className="px-4 py-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            Sync Devices
          </button>
        }
      />
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="text-center py-16">
        <Search className="w-8 h-8 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500">No devices match your filters</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {filtered.map((deviceCard) => (
        <DeviceCard key={deviceCard.device.id} {...deviceCard} onSelectDevice={onSelectDevice} />
      ))}
    </div>
  );
}

function DeviceCard({
  device,
  health,
  lockState,
  onSelectDevice,
}: DeviceCardModel & { onSelectDevice: (device: Device) => void }) {
  const sc = health.appearance;
  const StatusIcon = sc.icon;
  const meta = device.metadata_json ?? {};
  const batteryLevel = meta.batteryLevel as number | undefined;
  const isCharging = meta.isCharging as boolean | undefined;
  const lockDetail = describeDeviceLockState(lockState);

  return (
    <button
      onClick={() => onSelectDevice(device)}
      className="bg-white rounded-xl border border-gray-200 p-5 text-left hover:border-sky-300 hover:shadow-md transition-all group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-sky-50 transition-colors">
            <Smartphone className="w-5 h-5 text-gray-500 group-hover:text-sky-500 transition-colors" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{device.name || device.model}</h3>
            <p className="text-xs text-gray-500">{device.brand} {device.model}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant={sc.variant as 'green'}>
            <StatusIcon className="w-3 h-3 mr-1" />
            {sc.label}
          </Badge>
          <DeviceLockBadge lockState={lockState} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs mb-3">
        <div className="text-gray-500">{devicePlatform(device)} <span className="text-gray-700 font-medium">{device.android_version || '--'}</span></div>
        <div className="text-gray-500">Screen <span className="text-gray-700 font-medium">{device.screen_width}x{device.screen_height}</span></div>
      </div>
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <DeviceBatteryIcon level={batteryLevel} charging={isCharging} />
          <span>{batteryLevel != null ? `${batteryLevel}%` : '--'}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <Signal className="w-3 h-3" />
          <span className="font-mono text-[10px]">{device.laixi_device_id.slice(0, 12)}</span>
        </div>
      </div>
      <p className={`mt-2 text-[11px] ${health.lifecycle.isHeartbeatStale ? 'text-amber-600' : 'text-gray-400'}`}>
        {health.detail}
      </p>
      {(lockState.activeLock || lockState.latestExpiredLock) && (
        <p className={`mt-1 text-[11px] ${lockState.activeLock ? 'text-red-600' : 'text-amber-600'}`}>
          {lockDetail}
        </p>
      )}
    </button>
  );
}
