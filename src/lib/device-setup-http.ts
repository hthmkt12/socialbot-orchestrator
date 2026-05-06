import { trimTrailingSlash } from './device-setup-url';
import type {
  GatewayHealthView,
  MobileMcpBridgeHealthView,
  MobileMcpDeviceView,
  WorkerHealthView,
} from './device-setup-types';

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || `${response.status} ${response.statusText}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchGatewayHealth(baseUrl: string) {
  return fetchJson<GatewayHealthView>(`${trimTrailingSlash(baseUrl)}/health`);
}

export async function fetchWorkerHealth(baseUrl: string) {
  return fetchJson<WorkerHealthView>(`${trimTrailingSlash(baseUrl)}/health`);
}

export async function fetchMobileMcpBridgeHealth(baseUrl: string) {
  return fetchJson<MobileMcpBridgeHealthView>(`${trimTrailingSlash(baseUrl)}/health`);
}

export async function fetchMobileMcpDevices(baseUrl: string) {
  const raw = await fetchJson<{
    success: boolean;
    output?: { devices?: Array<MobileMcpDeviceView | string> };
    error?: string;
  }>(`${trimTrailingSlash(baseUrl)}/devices`);

  if (!raw.success) throw new Error(raw.error ?? 'Mobile MCP devices check failed');

  return (raw.output?.devices ?? []).map((device) => {
    if (typeof device === 'string') return { id: device, status: 'device' };
    return {
      id: String(device.id ?? ''),
      status: String(device.status ?? 'unknown'),
    };
  });
}
