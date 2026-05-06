import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { WebSocketServer } from 'ws';
import {
  DEVICE_HEARTBEAT_INTERVAL_MS,
  GATEWAY_PROTOCOL_VERSION,
  type GatewayDispatchRequest,
} from '../../../packages/shared/src';
import { GatewayDeviceStateStore } from './gateway-device-state-store';
import { GatewaySessionManager } from './gateway-session-manager';

interface GatewayConfig {
  port: number;
  protocolVersion: string;
  supabaseUrl?: string;
  supabaseServiceRoleKey?: string;
  healthSyncIntervalMs: number;
}

function readConfig(): GatewayConfig {
  return {
    port: Number(process.env.GATEWAY_PORT ?? 8080),
    protocolVersion: process.env.GATEWAY_PROTOCOL_VERSION ?? GATEWAY_PROTOCOL_VERSION,
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    healthSyncIntervalMs: Number(process.env.DEVICE_HEALTH_SYNC_INTERVAL_MS ?? DEVICE_HEARTBEAT_INTERVAL_MS),
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
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function corsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type',
  };
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json', ...corsHeaders() });
  res.end(JSON.stringify(body));
}

function main() {
  const config = readConfig();
  const deviceStateStore = new GatewayDeviceStateStore(config.supabaseUrl, config.supabaseServiceRoleKey);
  const sessions = new GatewaySessionManager(config.protocolVersion, deviceStateStore);
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
      json(res, 200, { service: 'laixi-gateway', status: 'ok', protocolVersion: config.protocolVersion, ...sessions.getHealthSnapshot() });
      return;
    }

    if (req.url === '/sessions') {
      json(res, 200, { devices: sessions.getSessionSnapshots() });
      return;
    }

    if (req.url === '/dispatch-step' && req.method === 'POST') {
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
        json(res, 500, {
          success: false,
          outcome: 'dispatch_failed',
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    json(res, 404, { error: 'Not found' });
  });

  const wss = new WebSocketServer({ server });
  wss.on('connection', (socket) => sessions.attachSocket(socket));

  server.listen(config.port, () => {
    console.log(`[laixi-gateway] listening on :${config.port}`);
  });
}

main();
