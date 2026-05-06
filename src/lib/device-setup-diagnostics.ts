import {
  buildDeviceAvailabilityDiagnostics,
  buildDeviceLockDiagnostics,
  buildProbeDiagnostics,
  buildSelectedDeviceDiagnostics,
  buildServiceDiagnostics,
  severityRank,
} from './device-setup-diagnostic-builders';
import type { BuildDeviceSetupDiagnosticsArgs, DeviceSetupDiagnostic } from './device-setup-diagnostic-types';

export { summarizeDeviceLocks, type DeviceLockSnapshot } from './device-setup-lock-summary';
export type {
  BuildDeviceSetupDiagnosticsArgs,
  DeviceRowWithHealth,
  DeviceSetupDiagnostic,
  DeviceSetupDiagnosticSeverity,
} from './device-setup-diagnostic-types';

export function buildDeviceSetupDiagnostics({
  gateway,
  gatewayError,
  workerError,
  deviceRows,
  devicesError,
  deviceLocksError,
  deviceLockSnapshot,
  selectedDevice,
  probeResults,
}: BuildDeviceSetupDiagnosticsArgs) {
  const diagnostics: DeviceSetupDiagnostic[] = [
    ...buildServiceDiagnostics({ gateway, gatewayError, workerError }),
    ...buildDeviceAvailabilityDiagnostics({ deviceRows, devicesError }),
    ...buildDeviceLockDiagnostics({ deviceLocksError, deviceLockSnapshot }),
    ...buildSelectedDeviceDiagnostics(selectedDevice),
    ...buildProbeDiagnostics({ probeResults, selectedDevice }),
  ];

  return diagnostics.sort((left, right) => severityRank(left.severity) - severityRank(right.severity));
}
