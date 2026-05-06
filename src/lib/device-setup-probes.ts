import { GATEWAY_PROTOCOL_VERSION } from '../../packages/shared/src';
import { fetchJson } from './device-setup-http';
import { trimTrailingSlash } from './device-setup-url';
import type { SetupProbeKind, SetupProbeResult } from './device-setup-types';

function readRecord(value: unknown) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function runSetupProbe(
  gatewayBaseUrl: string,
  laixiDeviceId: string,
  kind: SetupProbeKind
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
    headers: { 'content-type': 'application/json' },
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
