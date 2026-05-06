export interface MobileMcpFleetDevice {
  id: string;
  status: string;
}

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

function trimTrailingSlash(value: string) {
  return value.replace(/\/$/, '');
}

export function normalizeMobileMcpBridgeUrl(value: string) {
  const trimmed = value.trim() || 'http://127.0.0.1:4321';
  return trimTrailingSlash(trimmed);
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
    fetchJson<{ success: boolean; output?: { devices?: Array<string | Partial<MobileMcpFleetDevice>> }; error?: string }>(`${normalized}/devices`),
  ]);

  if (!deviceResponse.success) throw new Error(deviceResponse.error ?? 'Mobile MCP device list failed');

  return {
    health,
    devices: (deviceResponse.output?.devices ?? []).map((device) => (
      typeof device === 'string'
        ? { id: device, status: 'device' }
        : { id: String(device.id ?? ''), status: String(device.status ?? 'unknown') }
    )).filter((device) => device.id),
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
