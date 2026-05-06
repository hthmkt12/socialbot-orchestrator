import type { Device, DeviceLock } from '../../lib/database.types';
import {
  fetchGatewayHealth,
  fetchMobileMcpBridgeHealth,
  fetchMobileMcpDevices,
  fetchWorkerHealth,
  type GatewayHealthView,
  type MobileMcpBridgeHealthView,
  type MobileMcpDeviceView,
  type WorkerHealthView,
} from '../../lib/device-setup';
import { supabase } from '../../lib/supabase';

export interface VerificationSnapshot {
  checkedAt: string | null;
  loading: boolean;
  gateway: GatewayHealthView | null;
  gatewayError: string | null;
  worker: WorkerHealthView | null;
  workerError: string | null;
  mobileMcp: MobileMcpBridgeHealthView | null;
  mobileMcpError: string | null;
  mobileMcpDevices: MobileMcpDeviceView[];
  mobileMcpDevicesError: string | null;
  devices: Device[];
  devicesError: string | null;
  deviceLocks: DeviceLock[];
  deviceLocksError: string | null;
}

export const EMPTY_VERIFICATION: VerificationSnapshot = {
  checkedAt: null,
  loading: false,
  gateway: null,
  gatewayError: null,
  worker: null,
  workerError: null,
  mobileMcp: null,
  mobileMcpError: null,
  mobileMcpDevices: [],
  mobileMcpDevicesError: null,
  devices: [],
  devicesError: null,
  deviceLocks: [],
  deviceLocksError: null,
};

function readSupabaseRows<T>(
  result: PromiseSettledResult<{ data: T[] | null; error: { message: string } | null }>
) {
  return result.status === 'fulfilled' && !result.value.error ? result.value.data ?? [] : [];
}

function readSupabaseError(
  result: PromiseSettledResult<{ data: unknown; error: { message: string } | null }>
) {
  return result.status === 'rejected' ? String(result.reason) : result.value.error?.message ?? null;
}

export async function fetchDeviceSetupVerificationSnapshot({
  gatewayBaseUrl,
  mobileMcpBridgeUrl,
  workerBaseUrl,
}: {
  gatewayBaseUrl: string;
  mobileMcpBridgeUrl: string;
  workerBaseUrl: string;
}): Promise<VerificationSnapshot> {
  const [gatewayResult, workerResult, mobileMcpResult, mobileMcpDevicesResult, devicesResult, deviceLocksResult] = await Promise.allSettled([
    fetchGatewayHealth(gatewayBaseUrl),
    fetchWorkerHealth(workerBaseUrl),
    fetchMobileMcpBridgeHealth(mobileMcpBridgeUrl),
    fetchMobileMcpDevices(mobileMcpBridgeUrl),
    supabase.from('devices').select('*').order('updated_at', { ascending: false }),
    supabase.from('device_locks').select('*').order('expires_at', { ascending: false }),
  ]);

  return {
    checkedAt: new Date().toISOString(),
    loading: false,
    gateway: gatewayResult.status === 'fulfilled' ? gatewayResult.value : null,
    gatewayError: gatewayResult.status === 'rejected' ? String(gatewayResult.reason) : null,
    worker: workerResult.status === 'fulfilled' ? workerResult.value : null,
    workerError: workerResult.status === 'rejected' ? String(workerResult.reason) : null,
    mobileMcp: mobileMcpResult.status === 'fulfilled' ? mobileMcpResult.value : null,
    mobileMcpError: mobileMcpResult.status === 'rejected' ? String(mobileMcpResult.reason) : null,
    mobileMcpDevices: mobileMcpDevicesResult.status === 'fulfilled' ? mobileMcpDevicesResult.value : [],
    mobileMcpDevicesError: mobileMcpDevicesResult.status === 'rejected' ? String(mobileMcpDevicesResult.reason) : null,
    devices: readSupabaseRows<Device>(devicesResult),
    devicesError: readSupabaseError(devicesResult),
    deviceLocks: readSupabaseRows<DeviceLock>(deviceLocksResult),
    deviceLocksError: readSupabaseError(deviceLocksResult),
  };
}
