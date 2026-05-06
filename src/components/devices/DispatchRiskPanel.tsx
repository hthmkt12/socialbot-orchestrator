import { AlertTriangle } from 'lucide-react';
import Badge from '../ui/Badge';
import { describeDeviceLockState } from '../../lib/device-locks';
import type { Device } from '../../lib/database.types';
import type { DeviceCardModel, RiskFilter } from './devices-page-types';

interface DispatchRiskPanelProps {
  devices: DeviceCardModel[];
  onDrill: (filter: RiskFilter) => void;
  onSelect: (device: Device) => void;
}

export function DispatchRiskPanel({ devices, onDrill, onSelect }: DispatchRiskPanelProps) {
  const staleDevices = devices.filter(({ health }) => health.lifecycle.isHeartbeatStale);
  const lockedDevices = devices.filter(({ lockState }) => lockState.activeLock);

  return (
    <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50/70 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-amber-900">
            <AlertTriangle className="w-4 h-4" />
            <h2 className="text-sm font-semibold">Dispatch risk cohorts</h2>
          </div>
          <p className="mt-1 text-xs text-amber-700">
            Devices below are the current stale-heartbeat or locked-device blockers for safe dispatch.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <RiskButton label="Stale heartbeat" count={staleDevices.length} onClick={() => onDrill('STALE_HEARTBEAT')} />
          <RiskButton label="Locked device" count={lockedDevices.length} danger onClick={() => onDrill('LOCKED_DEVICE')} />
        </div>
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {devices.slice(0, 6).map(({ device, health, lockState }) => (
          <button
            key={device.id}
            type="button"
            onClick={() => onSelect(device)}
            className="rounded-lg border border-amber-100 bg-white p-3 text-left hover:border-sky-300 hover:shadow-sm transition-all"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-900">{device.name || device.model}</p>
                <p className="truncate text-[11px] text-gray-500">{device.brand} {device.model}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                {health.lifecycle.isHeartbeatStale && <Badge variant="yellow">Stale heartbeat</Badge>}
                {lockState.activeLock && <Badge variant="red">Locked device</Badge>}
              </div>
            </div>
            <p className="mt-2 text-[11px] text-amber-700">{health.detail}</p>
            {lockState.activeLock && (
              <p className="mt-1 text-[11px] text-red-600">{describeDeviceLockState(lockState)}</p>
            )}
            <p className="mt-2 font-mono text-[10px] text-gray-400">{device.laixi_device_id}</p>
          </button>
        ))}
      </div>
      {devices.length > 6 && (
        <p className="mt-3 text-xs text-amber-700">
          Showing first 6 dispatch-risk devices. Drill into a cohort to see all matching devices.
        </p>
      )}
    </div>
  );
}

function RiskButton({
  count,
  danger,
  label,
  onClick,
}: {
  count: number;
  danger?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg bg-white px-3 py-1.5 text-xs font-semibold border transition-colors ${
        danger
          ? 'text-red-700 border-red-200 hover:bg-red-50'
          : 'text-amber-700 border-amber-200 hover:bg-amber-100'
      }`}
    >
      {label}: {count}
    </button>
  );
}
