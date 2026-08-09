import { supabase } from './supabase';

export interface MobileMcpFleetDevice {
  id: string;
  status: string;
  platform?: string;
}

type MobileMcpRawFleetDevice = Partial<MobileMcpFleetDevice> & {
  serial?: string;
  state?: string;
};

export interface MobileMcpFleetHealth {
  service: string;
  status: string;
  platform: string;
  sessionCount: number;
}

export interface MobileMcpFleetSnapshot {
  health: MobileMcpFleetHealth;
  devices: MobileMcpFleetDevice[];
  checkedAt: string;
}

export interface MobileMcpStepResult {
  serial: string;
  stepType: string;
  success: boolean;
  checkedAt: string;
  output?: Record<string, unknown>;
  error?: string;
  screenshotBase64?: string;
}

const MOBILE_MCP_V1_UNSUPPORTED_STEPS = new Set(['run_autox']);
const DEFAULT_WORKER_URL = import.meta.env.VITE_WORKER_BASE_URL ?? 'http://127.0.0.1:4310';

function trimTrailingSlash(value: string) {
  return value.replace(/\/$/, '');
}

export function normalizeMobileMcpBridgeUrl(value: string) {
  const trimmed = value.trim() || 'http://127.0.0.1:4321';
  return trimTrailingSlash(trimmed);
}

export function mobileMcpProxyUrl(workerUrl = DEFAULT_WORKER_URL) {
  return `${trimTrailingSlash(workerUrl.trim() || DEFAULT_WORKER_URL)}/control/mobile-mcp`;
}

async function authenticatedRequest<T>(url: string, init: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Authentication required.');
  const headers = new Headers(init.headers);
  headers.set('authorization', `Bearer ${token}`);
  headers.set('content-type', headers.get('content-type') ?? 'application/json');
  return fetchJson<T>(url, { ...init, headers });
}

export async function loadMobileMcpFleetViaProxy(workerUrl = DEFAULT_WORKER_URL): Promise<MobileMcpFleetSnapshot> {
  const raw = await authenticatedRequest<{ health?: MobileMcpFleetHealth; devices?: Array<string | MobileMcpRawFleetDevice>; output?: { devices?: Array<string | MobileMcpRawFleetDevice> } }>(`${mobileMcpProxyUrl(workerUrl)}/devices`);
  const devices = raw.devices ?? raw.output?.devices ?? [];
  return {
    health: raw.health ?? { service: 'mobile-mcp-bridge', status: 'ok', platform: 'android', sessionCount: 0 },
    devices: devices.map((device) => typeof device === 'string'
      ? { id: device, status: 'device' }
      : { id: String(device.id ?? device.serial ?? ''), status: String(device.status ?? device.state ?? 'unknown'), platform: String(device.platform ?? 'android') })
      .filter((device) => device.id),
    checkedAt: new Date().toISOString(),
  };
}

export async function executeMobileMcpStepViaProxy(workerUrl: string, serial: string, stepType: string, params: Record<string, unknown> = {}, screenWidth = 720, screenHeight = 1600): Promise<MobileMcpStepResult> {
  if (MOBILE_MCP_V1_UNSUPPORTED_STEPS.has(stepType)) throw new Error(`${stepType} is not supported by Mobile MCP V1`);
  const raw = await authenticatedRequest<{ success: boolean; output?: Record<string, unknown>; error?: string }>(`${mobileMcpProxyUrl(workerUrl)}/devices/${encodeURIComponent(serial)}/execute-step`, {
    method: 'POST',
    body: JSON.stringify({ runId: `mobile_mcp_orchestrator_${Date.now()}`, stepId: `${stepType}_${Date.now()}`, stepType, params, device: { id: serial, serial, screenWidth, screenHeight } }),
  });
  const output = raw.output ?? {};
  const screenshotBase64 = extractScreenshotBase64(output);
  const safeOutput = { ...output };
  delete safeOutput.artifacts;
  return { serial, stepType, success: raw.success, checkedAt: new Date().toISOString(), output: safeOutput, error: raw.error, screenshotBase64 };
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) throw new Error(await response.text() || `${response.status} ${response.statusText}`);
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function loadMobileMcpFleet(baseUrl: string): Promise<MobileMcpFleetSnapshot> {
  const normalized = normalizeMobileMcpBridgeUrl(baseUrl);
  const [health, deviceResponse] = await Promise.all([
    fetchJson<MobileMcpFleetHealth>(`${normalized}/health`),
    fetchJson<{ success: boolean; output?: { devices?: Array<string | MobileMcpRawFleetDevice> }; error?: string }>(`${normalized}/devices`),
  ]);

  if (!deviceResponse.success) throw new Error(deviceResponse.error ?? 'Mobile MCP device list failed');

  return {
    health,
    devices: (deviceResponse.output?.devices ?? []).map((device) => {
      if (typeof device === 'string') return { id: device, status: 'device' };
      const id = device.id ?? device.serial;
      return {
        id: String(id ?? ''),
        status: String(device.status ?? device.state ?? 'unknown'),
        platform: String(device.platform ?? 'android'),
      };
    }).filter((device) => device.id),
    checkedAt: new Date().toISOString(),
  };
}

export async function executeMobileMcpStep(
  baseUrl: string,
  serial: string,
  stepType: string,
  params: Record<string, unknown> = {},
  screenWidth = 720,
  screenHeight = 1600
): Promise<MobileMcpStepResult> {
  if (MOBILE_MCP_V1_UNSUPPORTED_STEPS.has(stepType)) {
    throw new Error(`${stepType} is not supported by Mobile MCP V1`);
  }

  const normalized = normalizeMobileMcpBridgeUrl(baseUrl);
  const raw = await fetchJson<{ success: boolean; output?: Record<string, unknown>; error?: string }>(
    `${normalized}/devices/${encodeURIComponent(serial)}/execute-step`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        runId: `mobile_mcp_orchestrator_${Date.now()}`,
        stepId: `${stepType}_${Date.now()}`,
        stepType,
        params,
        device: { id: serial, serial, screenWidth, screenHeight },
      }),
    }
  );

  const output = raw.output ?? {};
  const screenshotBase64 = extractScreenshotBase64(output);
  const safeOutput = { ...output };
  delete safeOutput.artifacts;

  return {
    serial,
    stepType,
    success: raw.success,
    checkedAt: new Date().toISOString(),
    output: safeOutput,
    error: raw.error,
    screenshotBase64,
  };
}

function extractScreenshotBase64(output: Record<string, unknown>) {
  const artifacts = Array.isArray(output.artifacts) ? output.artifacts : [];
  for (const artifact of artifacts) {
    if (typeof artifact !== 'object' || artifact === null) continue;
    const record = artifact as Record<string, unknown>;
    if (record.type === 'SCREENSHOT' && typeof record.base64 === 'string') return record.base64;
  }
  return undefined;
}
