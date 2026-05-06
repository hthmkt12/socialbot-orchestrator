import Badge from '../ui/Badge';
import type { Device, DeviceLock } from '../../lib/database.types';
import type { getDeviceHealthSummary } from '../../lib/device-health';
import { StatCard } from './device-setup-cards';
import { formatTimestamp } from './device-setup-formatters';

type DeviceHealthSummary = ReturnType<typeof getDeviceHealthSummary>;

interface DeviceSetupDeviceRow {
  device: Device;
  health: DeviceHealthSummary;
}

export function SelectedDeviceSummaryPanel({
  activeLock,
  deviceLocksError,
  expiredLock,
  selectedDevice,
}: {
  activeLock: DeviceLock | null;
  deviceLocksError: string | null;
  expiredLock: DeviceLock | null;
  selectedDevice: DeviceSetupDeviceRow | null;
}) {
  if (!selectedDevice) return null;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="text-base font-semibold text-gray-900">Selected device summary</h4>
          <p className="text-xs text-gray-500 mt-1">
            Use this to confirm whether device health is coming from persisted freshness or stale fallback.
          </p>
        </div>
        <Badge variant={selectedDevice.health.appearance.variant}>{selectedDevice.health.appearance.label}</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-4">
        <StatCard
          title="Last Seen"
          value={selectedDevice.health.lastSeenLabel}
          hint={selectedDevice.health.detail}
          tone={selectedDevice.health.lifecycle.isHeartbeatStale ? 'yellow' : 'gray'}
        />
        <StatCard
          title="Heartbeat"
          value={selectedDevice.health.freshnessLabel}
          hint={`Laixi ID: ${selectedDevice.device.laixi_device_id}`}
          tone={
            selectedDevice.health.lifecycle.freshness === 'fresh' ? 'green' :
            selectedDevice.health.lifecycle.freshness === 'stale' ? 'yellow' :
            'red'
          }
        />
        <StatCard
          title="Last Error"
          value={selectedDevice.health.lastErrorMessage ?? 'None'}
          hint={selectedDevice.health.lastErrorAtLabel ? `Error at ${selectedDevice.health.lastErrorAtLabel}` : 'No persisted device error'}
          tone={selectedDevice.health.lastErrorMessage ? 'red' : 'gray'}
        />
        <StatCard
          title="Lock State"
          value={activeLock ? 'Locked' : expiredLock ? 'Expired lock' : 'Clear'}
          hint={
            deviceLocksError
              ? 'device_locks query failed'
              : activeLock
                ? `Run ${activeLock.workflow_run_id} until ${formatTimestamp(activeLock.expires_at)}`
                : expiredLock
                  ? `Expired at ${formatTimestamp(expiredLock.expires_at)}`
                  : 'No visible lock rows for this device'
          }
          tone={deviceLocksError ? 'red' : activeLock ? 'red' : expiredLock ? 'yellow' : 'green'}
        />
      </div>
    </div>
  );
}
