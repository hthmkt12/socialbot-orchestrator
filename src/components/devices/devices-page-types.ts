import type { LucideIcon } from 'lucide-react';
import type { Device, DeviceStatus } from '../../lib/database.types';
import type { getDeviceHealthSummary } from '../../lib/device-health';
import type { DeviceLockState } from '../../lib/device-locks';

export type FilterStatus = 'ALL' | DeviceStatus;
export type RiskFilter = 'ALL' | 'STALE_HEARTBEAT' | 'LOCKED_DEVICE';

export interface DeviceCardModel {
  device: Device;
  health: ReturnType<typeof getDeviceHealthSummary>;
  lockState: DeviceLockState;
}

export interface SummaryCohort {
  label: string;
  value: number;
  color: string;
  bg: string;
  icon: LucideIcon;
  riskFilter: RiskFilter;
}
