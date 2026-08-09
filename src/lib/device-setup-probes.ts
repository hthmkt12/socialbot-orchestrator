import { GATEWAY_PROTOCOL_VERSION } from '../../packages/shared/src';
import { fetchJson } from './device-setup-http';
import { trimTrailingSlash } from './device-setup-url';
import type { SetupProbeKind, SetupProbeResult } from './device-setup-types';
import { supabase } from './supabase';

const WORKER_URL = import.meta.env.VITE_WORKER_BASE_URL ?? 'http://127.0.0.1:4310';

async function proxyFetch<T>(path: string, init: RequestInit): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Authentication required.');
  const headers = new Headers(init.headers);
  headers.set('authorization', `Bearer ${token}`);
  headers.set('content-type', 'application/json');
  const response = await fetch(`${WORKER_URL.replace(/\/$/, '')}${path}`, { ...init, headers });
  if (!response.ok) throw new Error(await response.text() || `${response.status} ${response.statusText}`);
  return response.json() as Promise<T>;
}

function readRecord(value: unknown) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function runSetupProbe(
  gatewayBaseUrl: string,
  laixiDeviceId: string,
  kind: SetupProbeKind,
  gatewayHttpToken?: string
): Promise<SetupProbeResult> {
  const command =
    kind === 'screenshot'
      ? { action: 'screen', deviceIds: laixiDeviceId, params: {}, protocolVersion: GATEWAY_PROTOCOL_VERSION }
      : { action: 'CurrentAppInfo', deviceIds: laixiDeviceId, params: {}, protocolVersion: GATEWAY_PROTOCOL_VERSION };

  const raw = await fetchJson<{
    success: boolean;
    error?: string;
    result?: {
      data?: unknown;
      error?: string;
      artifacts?: Array<{ type: string; base64?: string }>;
    };
  }>(`${trimTrailingSlash(gatewayBaseUrl)}/dispatch-step`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(gatewayHttpToken ? { authorization: `Bearer ${gatewayHttpToken}` } : {}),
    },
    body: JSON.stringify({
      runId: `setup_probe_${Date.now()}`,
      stepId: kind === 'screenshot' ? 'setup_probe_screen' : 'setup_probe_current_app',
      deviceId: laixiDeviceId,
      command,
      timeoutMs: kind === 'screenshot' ? 20_000 : 10_000,
    }),
  });

  const checkedAt = new Date().toISOString();
  if (!raw.success || !raw.result) {
    return { kind, success: false, checkedAt, error: raw.error ?? 'Probe failed' };
  }

  const output = readRecord(raw.result.data);
  const artifactBase64 = raw.result.artifacts?.find((artifact) => artifact.type === 'SCREENSHOT')?.base64;
  const screenshotBase64 =
    typeof output.base64 === 'string' ? output.base64 :
    typeof artifactBase64 === 'string' ? artifactBase64 :
    undefined;

  return { kind, success: true, checkedAt, output, screenshotBase64 };
}

export async function runMobileMcpSetupProbe(
  mobileMcpBridgeUrl: string,
  androidSerial: string,
  kind: SetupProbeKind,
  screenWidth: number,
  screenHeight: number
): Promise<SetupProbeResult> {
  const stepType = kind === 'screenshot' ? 'screenshot' : 'get_current_app';
  const raw = await fetchJson<{
    success: boolean;
    output?: Record<string, unknown>;
    error?: string;
  }>(`${trimTrailingSlash(mobileMcpBridgeUrl)}/devices/${encodeURIComponent(androidSerial)}/execute-step`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      stepType,
      params: kind === 'screenshot' ? { description: 'setup_probe' } : {},
      device: { serial: androidSerial, screenWidth, screenHeight },
    }),
  });

  const checkedAt = new Date().toISOString();
  if (!raw.success) {
    return { kind, success: false, checkedAt, error: raw.error ?? 'Mobile MCP probe failed' };
  }

  const output = readRecord(raw.output);
  const artifacts = Array.isArray(output.artifacts) ? output.artifacts : [];
  const screenshotArtifact = artifacts.find((artifact) => {
    const record = readRecord(artifact);
    return record.type === 'SCREENSHOT' && typeof record.base64 === 'string';
  });
  const screenshotBase64 = typeof readRecord(screenshotArtifact).base64 === 'string'
    ? String(readRecord(screenshotArtifact).base64)
    : undefined;
  const safeOutput = { ...output };
  delete safeOutput.artifacts;

  return { kind, success: true, checkedAt, output: safeOutput, screenshotBase64 };
}

export async function runMobileMcpSetupProbeViaProxy(deviceId: string, kind: SetupProbeKind, screenWidth: number, screenHeight: number): Promise<SetupProbeResult> {
  const stepType = kind === 'screenshot' ? 'screenshot' : 'get_current_app';
  const raw = await proxyFetch<{ success: boolean; output?: Record<string, unknown>; error?: string }>(`/control/mobile-mcp/devices/${encodeURIComponent(deviceId)}/execute-step`, {
    method: 'POST',
    body: JSON.stringify({ stepType, params: kind === 'screenshot' ? { description: 'setup_probe' } : {}, device: { serial: deviceId, screenWidth, screenHeight } }),
  });
  const output = readRecord(raw.output);
  const artifacts = Array.isArray(output.artifacts) ? output.artifacts : [];
  const screenshot = artifacts.map(readRecord).find((item) => item.type === 'SCREENSHOT' && typeof item.base64 === 'string');
  const safeOutput = { ...output };
  delete safeOutput.artifacts;
  return { kind, success: raw.success, checkedAt: new Date().toISOString(), output: safeOutput, screenshotBase64: typeof screenshot?.base64 === 'string' ? screenshot.base64 : undefined, error: raw.error };
}

export async function runSetupProbeViaProxy(deviceId: string, kind: SetupProbeKind): Promise<SetupProbeResult> {
  const command = kind === 'screenshot'
    ? { action: 'screen', deviceIds: deviceId, params: {}, protocolVersion: GATEWAY_PROTOCOL_VERSION }
    : { action: 'CurrentAppInfo', deviceIds: deviceId, params: {}, protocolVersion: GATEWAY_PROTOCOL_VERSION };
  const raw = await proxyFetch<{ success: boolean; error?: string; result?: { data?: unknown; artifacts?: Array<{ type: string; base64?: string }> } }>('/control/gateway/dispatch-step', {
    method: 'POST',
    body: JSON.stringify({ runId: `setup_probe_${Date.now()}`, stepId: `setup_probe_${kind}`, deviceId, command, timeoutMs: kind === 'screenshot' ? 20_000 : 10_000 }),
  });
  const output = readRecord(raw.result?.data);
  const artifact = raw.result?.artifacts?.find((item) => item.type === 'SCREENSHOT')?.base64;
  return { kind, success: raw.success, checkedAt: new Date().toISOString(), output, screenshotBase64: typeof output.base64 === 'string' ? output.base64 : artifact, error: raw.error };
}
