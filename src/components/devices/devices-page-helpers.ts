import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Lock,
} from 'lucide-react';
import { getDeviceHealthSummary } from '../../lib/device-health';
import type { DeviceFleetMetrics } from '../../lib/device-fleet-metrics';
import {
  getDeviceLockState,
  type DeviceLockSnapshot,
} from '../../lib/device-locks';
import type { Device } from '../../lib/database.types';
import type {
  DeviceCardModel,
  FilterStatus,
  RiskFilter,
  SummaryCohort,
} from './devices-page-types';

export function buildDeviceCards(
  devices: Device[] | undefined,
  deviceLockSnapshot: DeviceLockSnapshot
): DeviceCardModel[] {
  return (devices ?? []).map((device) => ({
    device,
    health: getDeviceHealthSummary(device),
    lockState: getDeviceLockState(device.id, deviceLockSnapshot),
  }));
}

export function filterDeviceCards(args: {
  deviceCards: DeviceCardModel[];
  riskFilter: RiskFilter;
  search: string;
  statusFilter: FilterStatus;
}): DeviceCardModel[] {
  const { deviceCards, riskFilter, search, statusFilter } = args;

  return deviceCards.filter(({ device, health, lockState }) => {
    if (statusFilter !== 'ALL' && health.lifecycle.displayStatus !== statusFilter) return false;
    if (riskFilter === 'STALE_HEARTBEAT' && !health.lifecycle.isHeartbeatStale) return false;
    if (riskFilter === 'LOCKED_DEVICE' && !lockState.activeLock) return false;
    if (!search) return true;

    const q = search.toLowerCase();
    return (
      (device.name ?? '').toLowerCase().includes(q) ||
      (device.model ?? '').toLowerCase().includes(q) ||
      (device.brand ?? '').toLowerCase().includes(q) ||
      (device.laixi_device_id ?? '').toLowerCase().includes(q)
    );
  });
}

export function buildDeviceSummaryCohorts(stats: DeviceFleetMetrics): SummaryCohort[] {
  return [
    { label: 'Healthy', value: stats.healthy, color: 'text-emerald-600', bg: 'bg-emerald-50', icon: CheckCircle2, riskFilter: 'ALL' },
    { label: 'Stale heartbeat', value: stats.stale, color: 'text-amber-600', bg: 'bg-amber-50', icon: Clock3, riskFilter: 'STALE_HEARTBEAT' },
    { label: 'Busy', value: stats.busy, color: 'text-orange-600', bg: 'bg-orange-50', icon: Activity, riskFilter: 'ALL' },
    { label: 'Error', value: stats.error, color: 'text-rose-600', bg: 'bg-rose-50', icon: AlertTriangle, riskFilter: 'ALL' },
    { label: 'Locked device', value: stats.locked, color: 'text-red-600', bg: 'bg-red-50', icon: Lock, riskFilter: 'LOCKED_DEVICE' },
  ];
}

export function getDispatchRiskDevices(deviceCards: DeviceCardModel[]): DeviceCardModel[] {
  return deviceCards.filter(
    ({ health, lockState }) => health.lifecycle.isHeartbeatStale || lockState.activeLock
  );
}
