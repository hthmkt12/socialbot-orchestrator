import { formatDistanceToNow } from 'date-fns';
import {
  Activity,
  AlertTriangle,
  Wifi,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';
import {
  resolveDeviceLifecycle,
  type DeviceFreshness,
  type DeviceLifecycleState,
  type DeviceLifecycleStatus,
} from '../../packages/shared/src';
import type { Device } from './database.types';

type DeviceBadgeVariant = 'green' | 'yellow' | 'red' | 'gray';

interface DeviceStatusAppearance {
  variant: DeviceBadgeVariant;
  icon: LucideIcon;
  label: string;
}

const STATUS_APPEARANCE: Record<DeviceLifecycleStatus, DeviceStatusAppearance> = {
  ONLINE: { variant: 'green', icon: Wifi, label: 'Online' },
  OFFLINE: { variant: 'gray', icon: WifiOff, label: 'Offline' },
  BUSY: { variant: 'yellow', icon: Activity, label: 'Busy' },
  ERROR: { variant: 'red', icon: AlertTriangle, label: 'Error' },
};

export interface DeviceHealthSummary {
  lifecycle: DeviceLifecycleState;
  appearance: DeviceStatusAppearance;
  detail: string;
  freshnessLabel: string;
  lastSeenLabel: string;
  lastErrorMessage: string | null;
  lastErrorAtLabel: string | null;
}

function buildRelativeHeartbeat(lastSeenAt: string) {
  return formatDistanceToNow(new Date(lastSeenAt), { addSuffix: true });
}

function buildDetail(lastSeenAt: string | null, lifecycle: DeviceLifecycleState) {
  if (!lastSeenAt) return lifecycle.reason;

  const relative = buildRelativeHeartbeat(lastSeenAt);
  if (lifecycle.freshness === 'stale') return `Stale heartbeat from ${relative}`;
  if (lifecycle.displayStatus === 'OFFLINE' && lifecycle.rawStatus !== 'OFFLINE') {
    return `Offline after heartbeat drifted ${relative}`;
  }
  if (lifecycle.displayStatus === 'ERROR') return `Last heartbeat ${relative}`;
  if (lifecycle.displayStatus === 'BUSY') return `Busy and seen ${relative}`;
  return `Heartbeat ${relative}`;
}

function buildFreshnessLabel(freshness: DeviceFreshness) {
  if (freshness === 'fresh') return 'Fresh heartbeat';
  if (freshness === 'stale') return 'Stale heartbeat';
  return 'Offline heartbeat';
}

export function getDeviceHealthSummary(
  device: Pick<Device, 'status' | 'last_seen_at' | 'heartbeat_freshness' | 'last_error_message' | 'last_error_at'>,
  now: Date = new Date()
): DeviceHealthSummary {
  const lifecycle = resolveDeviceLifecycle({
    status: device.status,
    lastSeenAt: device.last_seen_at,
    freshnessOverride: device.heartbeat_freshness,
    lastErrorMessage: device.last_error_message,
    now,
  });

  return {
    lifecycle,
    appearance: STATUS_APPEARANCE[lifecycle.displayStatus],
    detail: buildDetail(device.last_seen_at, lifecycle),
    freshnessLabel: buildFreshnessLabel(lifecycle.freshness),
    lastSeenLabel: device.last_seen_at ? new Date(device.last_seen_at).toLocaleString() : 'Never',
    lastErrorMessage: device.last_error_message ?? null,
    lastErrorAtLabel: device.last_error_at ? new Date(device.last_error_at).toLocaleString() : null,
  };
}

export function isRunnableDevice(
  device: Pick<Device, 'status' | 'last_seen_at' | 'heartbeat_freshness' | 'last_error_message' | 'last_error_at'>,
  now?: Date
) {
  return getDeviceHealthSummary(device, now).lifecycle.isRunnable;
}
