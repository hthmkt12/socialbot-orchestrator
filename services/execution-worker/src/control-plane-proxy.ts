import type { IncomingMessage, ServerResponse } from 'node:http';
import { createClient } from '@supabase/supabase-js';
import { executeDeviceRecovery, type DeviceRecoveryRequest } from './device-recovery-service.js';
import { globalDeviceActionGuardrail } from './device-action-guardrail.js';
import { globalDeviceQuarantineCircuitBreaker } from './device-quarantine-circuit-breaker.js';

const MAX_BODY_BYTES = 1024 * 1024;

export interface ControlPlaneProxyConfig {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  mobileMcpBridgeUrl: string;
  mobileMcpBridgeToken?: string;
  gatewayBaseUrl: string;
  gatewayHttpToken?: string;
  corsOrigin: string;
  authorizeRequest?: (req: IncomingMessage) => Promise<{ status: 200 | 401 | 403 }>;
}

export function isControlPlaneRole(role: unknown): role is 'ADMIN' | 'OPERATOR' {
  return role === 'ADMIN' || role === 'OPERATOR';
}

export function buildMobileMcpProxyRequest(
  baseUrl: string,
  path: string,
  token: string,
  init: RequestInit = {}
) {
  const url = new URL(path, `${baseUrl.replace(/\/$/, '')}/`);
  const headers = new Headers(init.headers);
  headers.set('x-bridge-token', token);
  headers.set('content-type', headers.get('content-type') ?? 'application/json');
  return { url: url.toString(), init: { ...init, headers } };
}

function writeJson(res: ServerResponse, status: number, body: unknown, corsOrigin: string) {
  res.writeHead(status, {
    'content-type': 'application/json',
    ...(corsOrigin ? { 'access-control-allow-origin': corsOrigin } : {}),
  });
  res.end(JSON.stringify(body));
}

function bearerToken(req: IncomingMessage) {
  const value = req.headers.authorization ?? '';
  return value.startsWith('Bearer ') ? value.slice(7).trim() : '';
}

async function readBody(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) throw new Error('payload_too_large');
    chunks.push(buffer);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

async function authorize(req: IncomingMessage, config: ControlPlaneProxyConfig) {
  const token = bearerToken(req);
  if (!token) return { status: 401 as const };
  const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey);
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return { status: 401 as const };
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', userData.user.id)
    .maybeSingle();
  if (profileError || !isControlPlaneRole(profile?.role)) return { status: 403 as const };
  return { status: 200 as const };
}

export async function handleControlPlaneProxy(
  req: IncomingMessage,
  res: ServerResponse,
  config: ControlPlaneProxyConfig,
  recoveryRunner = executeDeviceRecovery
) {
  const url = req.url ?? '';
  const isDevices = url === '/control/mobile-mcp/devices' && req.method === 'GET';
  const executeMatch = req.method === 'POST'
    ? url.match(/^\/control\/mobile-mcp\/devices\/([^/]+)\/execute-step$/)
    : null;
  const gatewaySessions = url === '/control/gateway/sessions' && req.method === 'GET';
  const gatewayDispatch = url === '/control/gateway/dispatch-step' && req.method === 'POST';
  const mobileHealth = url === '/control/mobile-mcp/health' && req.method === 'GET';
  const gatewayHealth = url === '/control/gateway/health' && req.method === 'GET';
  const isDeviceRecovery = url === '/control/devices/recovery' && req.method === 'POST';
  const isGuardrailUsage = url.startsWith('/control/devices/guardrail/') && req.method === 'GET';
  const isQuarantineState = url.startsWith('/control/devices/quarantine/') && req.method === 'GET';
  const isLiftQuarantine = url.startsWith('/control/devices/quarantine/') && url.endsWith('/lift') && req.method === 'POST';

  if (
    !isDevices &&
    !executeMatch &&
    !gatewaySessions &&
    !gatewayDispatch &&
    !mobileHealth &&
    !gatewayHealth &&
    !isDeviceRecovery &&
    !isGuardrailUsage &&
    !isQuarantineState &&
    !isLiftQuarantine
  )
    return false;

  const origin = typeof req.headers.origin === 'string' && req.headers.origin === config.corsOrigin
    ? config.corsOrigin
    : '';
  const auth = config.authorizeRequest ? await config.authorizeRequest(req) : await authorize(req, config);
  if (auth.status !== 200) {
    writeJson(res, auth.status, { error: auth.status === 401 ? 'Authentication required.' : 'Control-plane access denied.' }, origin);
    return true;
  }

  if (isDeviceRecovery) {
    try {
      const body = (await readBody(req)) as DeviceRecoveryRequest;
      if (!body || !body.action) {
        writeJson(res, 400, { error: 'Action is required for device recovery.' }, origin);
        return true;
      }
      const result = await recoveryRunner(body);
      writeJson(res, result.success ? 200 : 500, result, origin);
    } catch (err) {
      writeJson(res, 500, { error: err instanceof Error ? err.message : 'Recovery execution failed.' }, origin);
    }
    return true;
  }

  if (isGuardrailUsage) {
    const deviceId = decodeURIComponent(url.slice('/control/devices/guardrail/'.length));
    const usage = globalDeviceActionGuardrail.getUsage(deviceId);
    writeJson(res, 200, usage, origin);
    return true;
  }

  if (isLiftQuarantine) {
    const rawId = url.slice('/control/devices/quarantine/'.length);
    const deviceId = decodeURIComponent(rawId.replace(/\/lift$/, ''));
    globalDeviceQuarantineCircuitBreaker.liftQuarantine(deviceId);
    const state = globalDeviceQuarantineCircuitBreaker.getState(deviceId);
    writeJson(res, 200, { success: true, message: `Quarantine lifted for device ${deviceId}`, state }, origin);
    return true;
  }

  if (isQuarantineState) {
    const deviceId = decodeURIComponent(url.slice('/control/devices/quarantine/'.length));
    const state = globalDeviceQuarantineCircuitBreaker.getState(deviceId);
    writeJson(res, 200, state, origin);
    return true;
  }
  if ((isDevices || executeMatch || mobileHealth) && !config.mobileMcpBridgeToken) {
    writeJson(res, 503, { error: 'Mobile MCP proxy is not configured.' }, origin);
    return true;
  }

  try {
    const body = executeMatch || gatewayDispatch ? await readBody(req) : undefined;
    const targetBase = gatewaySessions || gatewayDispatch || gatewayHealth ? config.gatewayBaseUrl : config.mobileMcpBridgeUrl;
    const path = gatewaySessions ? '/sessions' : gatewayDispatch ? '/dispatch-step' : gatewayHealth ? '/health' : mobileHealth ? '/health' : isDevices ? '/devices' : `/devices/${encodeURIComponent(decodeURIComponent(executeMatch![1]))}/execute-step`;
    const targetToken = gatewaySessions || gatewayDispatch ? config.gatewayHttpToken : config.mobileMcpBridgeToken!;
    if (!targetToken && !gatewayHealth) {
      writeJson(res, 503, { error: 'Gateway proxy is not configured.' }, origin);
      return true;
    }
    const proxyRequest = targetToken
      ? buildMobileMcpProxyRequest(targetBase, path, targetToken, { method: req.method, body: body === undefined ? undefined : JSON.stringify(body) })
      : { url: new URL(path, `${targetBase.replace(/\/$/, '')}/`).toString(), init: { method: req.method } as RequestInit };
    if (gatewaySessions || gatewayDispatch) {
      const headers = new Headers(proxyRequest.init.headers);
      headers.delete('x-bridge-token');
      headers.set('authorization', `Bearer ${targetToken}`);
      proxyRequest.init.headers = headers;
    }
    const response = await fetch(proxyRequest.url, { ...proxyRequest.init, signal: AbortSignal.timeout(15_000) });
    const text = await response.text();
    let payload: unknown = text;
    try { payload = JSON.parse(text); } catch { /* forward opaque bridge error as text */ }
    writeJson(res, response.status, payload, origin);
  } catch (error) {
    const status = error instanceof Error && error.message === 'payload_too_large' ? 413
      : error instanceof SyntaxError ? 400
        : 502;
    writeJson(res, status, {
      error: status === 413 ? 'Payload too large.' : status === 400 ? 'Malformed JSON payload.' : 'Mobile MCP proxy failed.',
    }, origin);
  }
  return true;
}
