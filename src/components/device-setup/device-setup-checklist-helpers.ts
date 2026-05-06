import type {
  GatewayHealthView,
  MobileMcpBridgeHealthView,
  MobileMcpDeviceView,
  SetupProbeResult,
  WorkerHealthView,
} from '../../lib/device-setup';
import { formatTimestamp, type CheckTone } from './device-setup-formatters';

export function getReachabilityTone(value: unknown, error: string | null): CheckTone {
  return value ? 'pass' : error ? 'fail' : 'idle';
}

export function getMobileMcpDevicesTone(args: {
  mobileMcp: MobileMcpBridgeHealthView | null;
  mobileMcpDevices: MobileMcpDeviceView[];
  mobileMcpDevicesError: string | null;
}): CheckTone {
  const { mobileMcp, mobileMcpDevices, mobileMcpDevicesError } = args;

  return mobileMcpDevicesError ? 'fail' :
    mobileMcpDevices.length > 0 ? 'pass' :
    mobileMcp ? 'warn' :
    'idle';
}

export function getPersistenceTone(gateway: GatewayHealthView | null): CheckTone {
  return gateway?.deviceStatePersistenceEnabled ? 'pass' :
    gateway ? 'warn' :
    'idle';
}

export function getRegistrationTone(devicesCount: number, devicesError: string | null): CheckTone {
  return devicesError ? 'fail' :
    devicesCount > 0 ? 'pass' :
    'warn';
}

export function getFreshnessTone(runnableDeviceCount: number, staleDeviceCount: number, devicesCount: number): CheckTone {
  return runnableDeviceCount > 0 ? 'pass' :
    staleDeviceCount > 0 ? 'warn' :
    devicesCount > 0 ? 'fail' :
    'idle';
}

export function getProbeTone(result: SetupProbeResult | undefined): CheckTone {
  return result?.success ? 'pass' :
    result ? 'fail' :
    'idle';
}

export function describeGateway(gateway: GatewayHealthView | null, gatewayError: string | null) {
  return gateway
    ? `${gateway.connectedDevices} connected session(s), ${gateway.pendingDispatches} pending dispatch(es).`
    : (gatewayError ?? 'Run verification to confirm gateway reachability.');
}

export function describeWorker(worker: WorkerHealthView | null, workerError: string | null) {
  return worker
    ? `Backend ${worker.deviceBackend ?? 'laixi'}, lease TTL ${worker.leaseTtlMs}ms, active claims ${worker.activeClaimCount}.`
    : (workerError ?? 'Run verification to confirm worker reachability.');
}

export function describeMobileMcpBridge(mobileMcp: MobileMcpBridgeHealthView | null, mobileMcpError: string | null) {
  return mobileMcp
    ? `${mobileMcp.service} ${mobileMcp.status}, ${mobileMcp.sessionCount} active session(s).`
    : (mobileMcpError ?? 'Run verification to confirm Mobile MCP bridge reachability.');
}

export function describeMobileMcpDevices(mobileMcpDevices: MobileMcpDeviceView[], mobileMcpDevicesError: string | null) {
  return mobileMcpDevicesError
    ? mobileMcpDevicesError
    : mobileMcpDevices.length > 0
      ? mobileMcpDevices.map((device) => `${device.id} (${device.status})`).join(', ')
      : 'No Android serials returned by the Mobile MCP bridge.';
}

export function describeProbe(result: SetupProbeResult | undefined, emptyDetail: string, successLabel: string, failureDetail: string) {
  return result
    ? (result.success
      ? `${successLabel} at ${formatTimestamp(result.checkedAt)}.`
      : result.error ?? failureDetail)
    : emptyDetail;
}
