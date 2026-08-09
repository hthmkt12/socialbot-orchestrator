import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { pathToFileURL } from 'node:url';
import { WebSocketServer } from 'ws';
import {
  DEVICE_HEARTBEAT_INTERVAL_MS,
  GATEWAY_PROTOCOL_VERSION,
  type GatewayDispatchRequest,
} from '../../../packages/shared/src';
import { GatewayDeviceStateStore } from './gateway-device-state-store';
import { GatewaySessionManager } from './gateway-session-manager';
import { GatewaySecurityPolicy } from './gateway-security';

export interface GatewayConfig {
  port: number;
  protocolVersion: string;
  supabaseUrl?: string;
  supabaseServiceRoleKey?: string;
  healthSyncIntervalMs: number;
  enrollmentToken?: string;
  httpToken?: string;
  allowInsecureDev: boolean;
  rateLimitPerMinute: number;
  orchestratorCallbackUrl?: string;
}

export function readConfig(): GatewayConfig {
  return {
    port: Number(process.env.GATEWAY_PORT ?? 8080),
    protocolVersion: process.env.GATEWAY_PROTOCOL_VERSION ?? GATEWAY_PROTOCOL_VERSION,
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    healthSyncIntervalMs: Number(process.env.DEVICE_HEALTH_SYNC_INTERVAL_MS ?? DEVICE_HEARTBEAT_INTERVAL_MS),
    enrollmentToken: process.env.GATEWAY_DEVICE_ENROLLMENT_TOKEN,
    httpToken: process.env.GATEWAY_HTTP_TOKEN,
    allowInsecureDev: process.env.GATEWAY_ALLOW_INSECURE_DEV === 'true',
    rateLimitPerMinute: Number(process.env.GATEWAY_HTTP_RATE_LIMIT_PER_MINUTE ?? 120),
    orchestratorCallbackUrl: process.env.GATEWAY_ORCHESTRATOR_CALLBACK_URL,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDispatchRequest(value: unknown): value is GatewayDispatchRequest {
  return (
    isRecord(value) &&
    typeof value.runId === 'string' &&
    typeof value.stepId === 'string' &&
    typeof value.deviceId === 'string' &&
    isRecord(value.command)
  );
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let byteLength = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    byteLength += buffer.length;
    if (byteLength > 1024 * 1024) throw new PayloadTooLargeError();
    chunks.push(buffer);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

class PayloadTooLargeError extends Error {}

const ALLOWED_ORIGIN = process.env.GATEWAY_CORS_ORIGIN ?? 'http://localhost:5173';

function corsHeaders() {
  return {
    'access-control-allow-origin': ALLOWED_ORIGIN,
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type, authorization',
  };
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json', ...corsHeaders() });
  res.end(JSON.stringify(body));
}

export function createGatewayServer(config: GatewayConfig) {
  const security = new GatewaySecurityPolicy({
    httpToken: config.httpToken,
    enrollmentToken: config.enrollmentToken,
    allowInsecureDev: config.allowInsecureDev,
    rateLimitPerMinute: config.rateLimitPerMinute,
  });
  const deviceStateStore = new GatewayDeviceStateStore(config.supabaseUrl, config.supabaseServiceRoleKey);
  const sessions = new GatewaySessionManager(
    config.protocolVersion,
    deviceStateStore,
    config.enrollmentToken,
    config.orchestratorCallbackUrl && config.httpToken
      ? async (event) => {
          const response = await fetch(config.orchestratorCallbackUrl!, {
            method: 'POST',
            headers: {
              authorization: `Bearer ${config.httpToken}`,
              'content-type': 'application/json',
            },
            body: JSON.stringify(event),
          });
          return response.ok;
        }
      : undefined
  );
  sessions.startFreshnessLoop(config.healthSyncIntervalMs);

  if (!deviceStateStore.isEnabled()) {
    console.warn('[laixi-gateway] device health persistence disabled; missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  const server = createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, corsHeaders());
      res.end();
      return;
    }

    if (req.url === '/health') {
      json(res, 200, { service: 'laixi-gateway', status: 'ok', protocolVersion: config.protocolVersion });
      return;
    }

    if (req.url === '/sessions') {
      if (!security.consume(req.socket.remoteAddress ?? 'unknown')) {
        json(res, 429, { error: 'Too many requests' });
        return;
      }
      if (!security.hasHttpAccess(req.headers.authorization)) {
        json(res, 401, { error: 'Unauthorized' });
        return;
      }
      json(res, 200, { devices: sessions.getSessionSnapshots() });
      return;
    }

    if (req.url === '/dispatch-step' && req.method === 'POST') {
      if (!security.consume(req.socket.remoteAddress ?? 'unknown')) {
        json(res, 429, { success: false, outcome: 'rate_limited', error: 'Too many requests' });
        return;
      }
      if (!security.hasHttpAccess(req.headers.authorization)) {
        json(res, 401, { success: false, outcome: 'unauthorized', error: 'Unauthorized' });
        return;
      }
      try {
        const payload = await readJsonBody(req);
        if (!isDispatchRequest(payload)) {
          json(res, 400, { success: false, outcome: 'invalid_result', error: 'Invalid dispatch payload' });
          return;
        }

        const result = await sessions.dispatch(payload);
        const status =
          result.success ? 200 :
          result.outcome === 'device_offline' ? 409 :
          result.outcome === 'timed_out' ? 504 : 502;
        json(res, status, result);
      } catch (error) {
        const status = error instanceof PayloadTooLargeError ? 413 : error instanceof SyntaxError ? 400 : 500;
        json(res, status, {
          success: false,
          outcome: error instanceof PayloadTooLargeError ? 'payload_too_large' : error instanceof SyntaxError ? 'invalid_result' : 'dispatch_failed',
          error: error instanceof PayloadTooLargeError
            ? 'Dispatch payload exceeds 1 MiB'
            : error instanceof SyntaxError
              ? 'Invalid JSON payload'
              : 'Dispatch failed',
        });
      }
      return;
    }

    json(res, 404, { error: 'Not found' });
  });

  const wss = new WebSocketServer({ server, maxPayload: 256 * 1024 });
  wss.on('connection', (socket) => sessions.attachSocket(socket));

  return {
    server,
    sessions,
    async listen() {
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(config.port, () => {
          server.off('error', reject);
          resolve();
        });
      });
      return server.address() as AddressInfo;
    },
    async close() {
      sessions.stopFreshnessLoop();
      for (const client of wss.clients) client.terminate();
      await new Promise<void>((resolve, reject) => {
        wss.close(() => {
          server.close((error) => error ? reject(error) : resolve());
        });
      });
    },
  };
}

async function main() {
  const app = createGatewayServer(readConfig());
  const address = await app.listen();
  console.log(`[laixi-gateway] listening on :${address.port}`);
}

const entryPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (import.meta.url === entryPath) {
  void main();
}
