import type { Device } from '../../lib/database.types';
import { getDeviceHealthSummary } from '../../lib/device-health';
import {
  buildDeviceSetupDiagnostics,
  summarizeDeviceLocks,
} from '../../lib/device-setup-diagnostics';
import type { SetupProbeKind, SetupProbeResult } from '../../lib/device-setup';
import {
  buildDeviceSetupChecklist,
  type DeviceSetupChecklistItem,
} from './device-setup-checklist';
import type { VerificationSnapshot } from './device-setup-verification-runtime';

type DeviceHealthSummary = ReturnType<typeof getDeviceHealthSummary>;

export interface DeviceSetupDeviceRow {
  device: Device;
  health: DeviceHealthSummary;
}

export const buildDeviceSetupDerivedState = ({
  probeResults,
  selectedDeviceId,
  verification,
}: {
  probeResults: Partial<Record<SetupProbeKind, SetupProbeResult>>;
  selectedDeviceId: string;
  verification: VerificationSnapshot;
}) => {
  const deviceRows: DeviceSetupDeviceRow[] = verification.devices.map((device) => ({
    device,
    health: getDeviceHealthSummary(device),
  }));
  const runnableDevices = deviceRows.filter(({ health }) => health.lifecycle.isRunnable);
  const staleDevices = deviceRows.filter(({ health }) => health.lifecycle.isHeartbeatStale);
  const selectedDevice = deviceRows.find(({ device }) => device.id === selectedDeviceId) ?? null;
  const deviceLockSnapshot = summarizeDeviceLocks(verification.deviceLocks, selectedDevice?.device.id ?? null);
  const operatorDiagnostics = buildDeviceSetupDiagnostics({
    gateway: verification.gateway,
    gatewayError: verification.gatewayError,
    workerError: verification.workerError,
    deviceRows,
    devicesError: verification.devicesError,
    deviceLocksError: verification.deviceLocksError,
    deviceLockSnapshot,
    selectedDevice,
    probeResults,
  });
  const checklist: DeviceSetupChecklistItem[] = buildDeviceSetupChecklist({
    gateway: verification.gateway,
    gatewayError: verification.gatewayError,
    worker: verification.worker,
    workerError: verification.workerError,
    mobileMcp: verification.mobileMcp,
    mobileMcpError: verification.mobileMcpError,
    mobileMcpDevices: verification.mobileMcpDevices,
    mobileMcpDevicesError: verification.mobileMcpDevicesError,
    devices: verification.devices,
    devicesError: verification.devicesError,
    probeResults,
    runnableDeviceCount: runnableDevices.length,
    staleDeviceCount: staleDevices.length,
  });

  return {
    checklist,
    deviceLockSnapshot,
    deviceRows,
    operatorDiagnostics,
    runnableDevices,
    selectedDevice,
    selectedDeviceActiveLock: deviceLockSnapshot.selectedDeviceActiveLocks[0] ?? null,
    selectedDeviceExpiredLock: deviceLockSnapshot.selectedDeviceExpiredLocks[0] ?? null,
    staleDevices,
  };
};
