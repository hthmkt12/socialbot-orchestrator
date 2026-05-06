import type {
  BuildDeviceSetupDiagnosticsArgs,
  DeviceSetupDiagnostic,
} from './device-setup-diagnostic-types';

export function buildServiceDiagnostics({
  gateway,
  gatewayError,
  workerError,
}: Pick<BuildDeviceSetupDiagnosticsArgs, 'gateway' | 'gatewayError' | 'workerError'>) {
  const diagnostics: DeviceSetupDiagnostic[] = [];

  if (gatewayError) {
    diagnostics.push({
      id: 'gateway-unreachable',
      severity: 'critical',
      title: 'Gateway is unreachable',
      reason: gatewayError,
      recommendation: 'Start the gateway on the configured host and port, then verify browser reachability or same-origin proxying.',
      affected: 'Gateway /health',
    });
  }

  if (workerError) {
    diagnostics.push({
      id: 'worker-unreachable',
      severity: 'critical',
      title: 'Worker is unreachable',
      reason: workerError,
      recommendation: 'Start the execution worker, verify the worker base URL, and confirm the HTTP port is exposed to the browser.',
      affected: 'Worker /health',
    });
  }

  if (gateway && !gateway.deviceStatePersistenceEnabled) {
    diagnostics.push({
      id: 'gateway-persistence-disabled',
      severity: 'warning',
      title: 'Gateway persistence is disabled',
      reason: 'Gateway health reports that device state is not being persisted into Supabase.',
      recommendation: 'Restart the gateway with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY so freshness and device errors are durable.',
      affected: 'Gateway -> devices persistence',
    });
  }

  return diagnostics;
}

export function buildDeviceAvailabilityDiagnostics({
  deviceRows,
  devicesError,
}: Pick<BuildDeviceSetupDiagnosticsArgs, 'deviceRows' | 'devicesError'>) {
  const diagnostics: DeviceSetupDiagnostic[] = [];
  const runnableCount = deviceRows.filter(({ health }) => health.lifecycle.isRunnable).length;
  const staleCount = deviceRows.filter(({ health }) => health.lifecycle.isHeartbeatStale).length;
  const offlineCount = deviceRows.filter(({ health }) => health.lifecycle.freshness === 'offline').length;

  if (devicesError) {
    diagnostics.push({
      id: 'devices-query-failed',
      severity: 'critical',
      title: 'Device registry query failed',
      reason: devicesError,
      recommendation: 'Fix Supabase connectivity or RLS access first, otherwise operator checks cannot trust the device list.',
      affected: 'Supabase devices table',
    });
  } else if (deviceRows.length === 0) {
    diagnostics.push({
      id: 'no-devices',
      severity: 'warning',
      title: 'No registered devices found',
      reason: 'Verification can reach Supabase, but no device rows are currently visible to the app.',
      recommendation: 'Register a device through the gateway path first, then rerun verification to confirm persistence.',
      affected: 'Supabase devices table',
    });
  } else if (runnableCount === 0) {
    diagnostics.push({
      id: 'no-runnable-devices',
      severity: 'warning',
      title: 'No runnable devices are available',
      reason: `${staleCount} stale device(s) and ${offlineCount} offline device(s) are currently blocking dispatch readiness.`,
      recommendation: 'Reconnect the agent, remove battery restrictions, and wait for a fresh heartbeat before trusting run launch.',
      affected: `${deviceRows.length} registered device(s)`,
    });
  }

  return diagnostics;
}

export function buildProbeDiagnostics({
  probeResults,
  selectedDevice,
}: Pick<BuildDeviceSetupDiagnosticsArgs, 'probeResults' | 'selectedDevice'>) {
  const diagnostics: DeviceSetupDiagnostic[] = [];
  const selectedDeviceLabel = selectedDevice
    ? `${selectedDevice.device.name || selectedDevice.device.model} (${selectedDevice.device.laixi_device_id})`
    : 'Current selected device';

  if (probeResults['current-app'] && !probeResults['current-app'].success) {
    diagnostics.push({
      id: 'current-app-probe-failed',
      severity: 'critical',
      title: 'Current-app probe failed',
      reason: probeResults['current-app'].error ?? 'Gateway dispatch did not return a successful current-app response.',
      recommendation: 'Treat this as a live dispatch failure: verify the device websocket session, script version, and gateway protocol alignment.',
      affected: selectedDeviceLabel,
    });
  }

  if (probeResults.screenshot && !probeResults.screenshot.success) {
    diagnostics.push({
      id: 'screenshot-probe-failed',
      severity: 'warning',
      title: 'Screenshot probe failed',
      reason: probeResults.screenshot.error ?? 'Screen-capture validation did not complete successfully.',
      recommendation: 'Re-grant screenshot permission, keep AutoJS exempt from battery restrictions, and rerun the probe to confirm artifact transport.',
      affected: selectedDeviceLabel,
    });
  }

  return diagnostics;
}
