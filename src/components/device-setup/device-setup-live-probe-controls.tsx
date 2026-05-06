import { Play, Zap } from 'lucide-react';
import Spinner from '../ui/Spinner';
import type { Device } from '../../lib/database.types';
import type { getDeviceHealthSummary } from '../../lib/device-health';
import type { SetupProbeKind } from '../../lib/device-setup';

type DeviceHealthSummary = ReturnType<typeof getDeviceHealthSummary>;

interface DeviceSetupDeviceRow {
  device: Device;
  health: DeviceHealthSummary;
}

export function DeviceLiveProbeSelector({
  deviceRows,
  onSelectedDeviceChange,
  selectedDevice,
  selectedDeviceId,
}: {
  deviceRows: DeviceSetupDeviceRow[];
  onSelectedDeviceChange: (deviceId: string) => void;
  selectedDevice: DeviceSetupDeviceRow | null;
  selectedDeviceId: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Selected device</label>
      <select
        value={selectedDeviceId}
        onChange={(event) => onSelectedDeviceChange(event.target.value)}
        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
      >
        {deviceRows.length === 0 && <option value="">No registered devices</option>}
        {deviceRows.map(({ device, health }) => (
          <option key={device.id} value={device.id}>
            {device.name || device.model} - {health.appearance.label} - {device.laixi_device_id}
          </option>
        ))}
      </select>
      {selectedDevice && (
        <p className={`text-[11px] mt-2 ${selectedDevice.health.lifecycle.isHeartbeatStale ? 'text-amber-600' : 'text-gray-500'}`}>
          {selectedDevice.health.detail}
        </p>
      )}
    </div>
  );
}

export function DeviceLiveProbeActions({
  onRunProbe,
  probeLoadingKind,
  selectedDevice,
}: {
  onRunProbe: (kind: SetupProbeKind) => void;
  probeLoadingKind: SetupProbeKind | null;
  selectedDevice: DeviceSetupDeviceRow | null;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <button
        onClick={() => onRunProbe('current-app')}
        disabled={!selectedDevice || probeLoadingKind !== null}
        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
      >
        {probeLoadingKind === 'current-app' ? <Spinner size="sm" /> : <Zap className="w-4 h-4" />}
        Current-App Probe
      </button>
      <button
        onClick={() => onRunProbe('screenshot')}
        disabled={!selectedDevice || probeLoadingKind !== null}
        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
      >
        {probeLoadingKind === 'screenshot' ? <Spinner size="sm" /> : <Play className="w-4 h-4" />}
        Screenshot Probe
      </button>
    </div>
  );
}
