import { getDeviceHealthSummary } from '../../lib/device-health';
import type { DeviceLockState } from '../../lib/device-locks';
import type { Device } from '../../lib/database.types';

interface DeviceDrawerFactsProps {
  device: Device;
  health: ReturnType<typeof getDeviceHealthSummary>;
  lockState: DeviceLockState;
}

export function DeviceDrawerFacts({
  device,
  health,
  lockState,
}: DeviceDrawerFactsProps) {
  const sc = health.appearance;
  const facts = [
    ['Status', sc.label],
    ['Heartbeat', health.freshnessLabel],
    ['Laixi ID', device.laixi_device_id],
    ['Model', device.model],
    ['Brand', device.brand],
    ['Android Version', device.android_version || '--'],
    ['Screen Resolution', `${device.screen_width} x ${device.screen_height}`],
    ['Last Seen', health.lastSeenLabel],
    ['Lock State', lockState.activeLock ? 'Locked' : lockState.latestExpiredLock ? 'Expired lock' : 'Clear'],
    ...(lockState.activeLock
      ? [
          ['Lock Run', lockState.activeLock.workflow_run_id],
          ['Lock Expires', new Date(lockState.activeLock.expires_at).toLocaleString()],
        ]
      : []),
    ...(!lockState.activeLock && lockState.latestExpiredLock
      ? [
          ['Expired Lock Run', lockState.latestExpiredLock.workflow_run_id],
          ['Expired At', new Date(lockState.latestExpiredLock.expires_at).toLocaleString()],
        ]
      : []),
    ...(health.lastErrorMessage ? [['Last Error', health.lastErrorMessage]] : []),
    ...(health.lastErrorAtLabel ? [['Error At', health.lastErrorAtLabel]] : []),
    ['Registered', new Date(device.created_at).toLocaleDateString()],
  ];

  return (
    <div className="space-y-0">
      {facts.map(([label, value]) => (
        <div key={label} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
          <span className="text-xs text-gray-500">{label}</span>
          <span className="text-sm font-medium text-gray-900 text-right max-w-[60%] truncate">{value}</span>
        </div>
      ))}
    </div>
  );
}

export function DeviceDrawerRawMetadata({ metadata }: { metadata: Record<string, unknown> }) {
  if (Object.keys(metadata).length === 0) {
    return null;
  }

  return (
    <div>
      <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Raw Metadata</h5>
      <pre className="bg-gray-50 rounded-xl p-4 text-xs text-gray-700 overflow-x-auto font-mono leading-relaxed">
        {JSON.stringify(metadata, null, 2)}
      </pre>
    </div>
  );
}
