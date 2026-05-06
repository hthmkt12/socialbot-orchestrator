import type { Device } from './database.types';
import type { DeviceHealthSummary } from './device-health';
import type { DeviceLockSnapshot } from './device-setup-lock-summary';
import type { GatewayHealthView, SetupProbeResult } from './device-setup';

export type ProbeResults = Partial<Record<'current-app' | 'screenshot', SetupProbeResult>>;

export type DeviceSetupDiagnosticSeverity = 'critical' | 'warning' | 'info';

export interface DeviceRowWithHealth {
  device: Device;
  health: DeviceHealthSummary;
}

export interface DeviceSetupDiagnostic {
  id: string;
  severity: DeviceSetupDiagnosticSeverity;
  title: string;
  reason: string;
  recommendation: string;
  affected?: string;
}

export interface BuildDeviceSetupDiagnosticsArgs {
  gateway: GatewayHealthView | null;
  gatewayError: string | null;
  workerError: string | null;
  deviceRows: DeviceRowWithHealth[];
  devicesError: string | null;
  deviceLocksError: string | null;
  deviceLockSnapshot: DeviceLockSnapshot;
  selectedDevice: DeviceRowWithHealth | null;
  probeResults: ProbeResults;
}
