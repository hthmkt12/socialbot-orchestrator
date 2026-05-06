export const DEVICE_HEARTBEAT_INTERVAL_MS = 15_000;
export const DEVICE_HEARTBEAT_STALE_AFTER_MS = DEVICE_HEARTBEAT_INTERVAL_MS * 3;
export const DEVICE_HEARTBEAT_OFFLINE_AFTER_MS = DEVICE_HEARTBEAT_INTERVAL_MS * 8;

export type DeviceLifecycleStatus = 'ONLINE' | 'OFFLINE' | 'BUSY' | 'ERROR';
export type DeviceFreshness = 'fresh' | 'stale' | 'offline';

export interface DeviceLifecycleInput {
  status?: string | null;
  lastSeenAt?: string | null;
  freshnessOverride?: string | null;
  lastErrorMessage?: string | null;
  now?: string | number | Date;
}

export interface DeviceLifecycleState {
  rawStatus: DeviceLifecycleStatus;
  displayStatus: DeviceLifecycleStatus;
  freshness: DeviceFreshness;
  heartbeatAgeMs: number | null;
  isHeartbeatStale: boolean;
  isHeartbeatOffline: boolean;
  isRunnable: boolean;
  label: string;
  reason: string;
}

const KNOWN_DEVICE_STATUSES = new Set<DeviceLifecycleStatus>(['ONLINE', 'OFFLINE', 'BUSY', 'ERROR']);
const KNOWN_DEVICE_FRESHNESS = new Set<DeviceFreshness>(['fresh', 'stale', 'offline']);

function normalizeStatus(status?: string | null): DeviceLifecycleStatus {
  return status && KNOWN_DEVICE_STATUSES.has(status as DeviceLifecycleStatus)
    ? (status as DeviceLifecycleStatus)
    : 'OFFLINE';
}

function toTimeMs(value?: string | number | Date | null): number | null {
  if (value == null) return null;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function normalizeFreshness(freshness?: string | null): DeviceFreshness | null {
  return freshness && KNOWN_DEVICE_FRESHNESS.has(freshness as DeviceFreshness)
    ? (freshness as DeviceFreshness)
    : null;
}

function resolveFreshness(
  rawStatus: DeviceLifecycleStatus,
  heartbeatAgeMs: number | null,
  freshnessOverride?: string | null
): DeviceFreshness {
  const normalizedOverride = normalizeFreshness(freshnessOverride);
  if (normalizedOverride) return normalizedOverride;
  if (rawStatus === 'OFFLINE' || heartbeatAgeMs == null) return 'offline';
  if (heartbeatAgeMs >= DEVICE_HEARTBEAT_OFFLINE_AFTER_MS) return 'offline';
  if (heartbeatAgeMs >= DEVICE_HEARTBEAT_STALE_AFTER_MS) return 'stale';
  return 'fresh';
}

function buildReason(
  rawStatus: DeviceLifecycleStatus,
  freshness: DeviceFreshness,
  heartbeatAgeMs: number | null,
  lastErrorMessage?: string | null
) {
  if (heartbeatAgeMs == null) return 'No heartbeat recorded yet';
  if (rawStatus === 'ERROR' && lastErrorMessage) return lastErrorMessage;
  if (freshness === 'offline' && rawStatus !== 'OFFLINE') return 'Heartbeat expired beyond offline threshold';
  if (freshness === 'stale') return 'Heartbeat is stale';
  if (rawStatus === 'BUSY') return 'Device is executing a run';
  if (rawStatus === 'ERROR') return 'Device reported an error';
  if (rawStatus === 'OFFLINE') return 'Device is marked offline';
  return 'Heartbeat is fresh';
}

function buildLabel(status: DeviceLifecycleStatus) {
  if (status === 'ONLINE') return 'Online';
  if (status === 'BUSY') return 'Busy';
  if (status === 'ERROR') return 'Error';
  return 'Offline';
}

export function resolveDeviceLifecycle(input: DeviceLifecycleInput): DeviceLifecycleState {
  const rawStatus = normalizeStatus(input.status);
  const nowMs = toTimeMs(input.now ?? new Date()) ?? Date.now();
  const lastSeenMs = toTimeMs(input.lastSeenAt);
  const heartbeatAgeMs = lastSeenMs == null ? null : Math.max(0, nowMs - lastSeenMs);
  const freshness = resolveFreshness(rawStatus, heartbeatAgeMs, input.freshnessOverride);
  const displayStatus = freshness === 'offline' ? 'OFFLINE' : rawStatus;

  return {
    rawStatus,
    displayStatus,
    freshness,
    heartbeatAgeMs,
    isHeartbeatStale: freshness === 'stale',
    isHeartbeatOffline: freshness === 'offline',
    isRunnable: displayStatus === 'ONLINE',
    label: buildLabel(displayStatus),
    reason: buildReason(rawStatus, freshness, heartbeatAgeMs, input.lastErrorMessage),
  };
}
