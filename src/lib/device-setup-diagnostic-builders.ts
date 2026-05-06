import { formatDeviceLockTimestamp } from './device-locks';
export {
  buildDeviceAvailabilityDiagnostics,
  buildProbeDiagnostics,
  buildServiceDiagnostics,
} from './device-setup-diagnostic-cohorts';
import type {
  DeviceRowWithHealth,
  DeviceSetupDiagnostic,
  DeviceSetupDiagnosticSeverity,
  BuildDeviceSetupDiagnosticsArgs,
} from './device-setup-diagnostic-types';

export function severityRank(severity: DeviceSetupDiagnosticSeverity) {
  if (severity === 'critical') return 0;
  if (severity === 'warning') return 1;
  return 2;
}

export function buildDeviceLockDiagnostics({
  deviceLocksError,
  deviceLockSnapshot,
}: Pick<BuildDeviceSetupDiagnosticsArgs, 'deviceLocksError' | 'deviceLockSnapshot'>) {
  const diagnostics: DeviceSetupDiagnostic[] = [];

  if (deviceLocksError) {
    diagnostics.push({
      id: 'device-locks-query-failed',
      severity: 'critical',
      title: 'Device lock visibility failed',
      reason: deviceLocksError,
      recommendation: 'Restore access to the device_locks table so the operator can tell whether a device is blocked by another run.',
      affected: 'Supabase device_locks table',
    });
  } else if (deviceLockSnapshot.activeLocks.length > 0) {
    const selectedLock = deviceLockSnapshot.selectedDeviceActiveLocks[0];
    const fallbackLock = deviceLockSnapshot.activeLocks[0];
    const lock = selectedLock ?? fallbackLock;

    diagnostics.push({
      id: 'active-device-locks',
      severity: selectedLock ? 'critical' : 'warning',
      title: selectedLock ? 'Selected device is locked by another run' : 'Active device locks are present',
      reason: `${deviceLockSnapshot.activeLocks.length} active lock(s) remain in force.${selectedLock ? ` The selected device cannot run new work until ${formatDeviceLockTimestamp(selectedLock.expires_at)}.` : ''}`,
      recommendation: 'Wait for the owning run to finish, or add a safe stale-lock recovery action before clearing locks manually.',
      affected: `Run ${lock.workflow_run_id} until ${formatDeviceLockTimestamp(lock.expires_at)}`,
    });
  }

  if (!deviceLocksError && deviceLockSnapshot.expiredLocks.length > 0) {
    diagnostics.push({
      id: 'expired-device-locks',
      severity: 'info',
      title: 'Expired device locks still exist',
      reason: `${deviceLockSnapshot.expiredLocks.length} expired lock row(s) remain visible after their lease window elapsed.`,
      recommendation: 'Use the stale-lock cleanup action in the Verify tab to remove expired rows without touching active leases.',
      affected: 'Supabase device_locks table',
    });
  }

  return diagnostics;
}

export function buildSelectedDeviceDiagnostics(selectedDevice: DeviceRowWithHealth | null) {
  if (!selectedDevice?.health.lastErrorMessage) {
    return [];
  }

  return [{
    id: 'selected-device-error',
    severity: selectedDevice.health.lifecycle.displayStatus === 'ERROR' ? 'critical' : 'warning',
    title: 'Selected device reported a persisted error',
    reason: selectedDevice.health.lastErrorMessage,
    recommendation: 'Inspect the agent logs on the device, reconnect the session, and rerun verification before launching production work.',
    affected: `${selectedDevice.device.name || selectedDevice.device.model} (${selectedDevice.device.laixi_device_id})`,
  }] satisfies DeviceSetupDiagnostic[];
}
