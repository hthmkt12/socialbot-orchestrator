import { createServer } from 'node:http';
import { GATEWAY_PROTOCOL_VERSION } from '../../../packages/shared/src';
import { MultiTargetRunExecutor } from './multi-target-run-executor';
import { RunClaimCoordinator, type WorkerConfig } from './run-claim-coordinator';
import { SingleDeviceRunExecutor } from './single-device-run-executor';

function readRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function readConfig(): WorkerConfig {
  const deviceBackend = process.env.DEVICE_BACKEND === 'mobile-mcp' ? 'mobile-mcp' : 'laixi';
  return {
    port: Number(process.env.WORKER_PORT ?? 4310),
    pollIntervalMs: Number(process.env.RUN_POLL_INTERVAL_MS ?? 2000),
    leaseTtlMs: Number(process.env.RUN_LEASE_TTL_MS ?? 15000),
    maxActiveClaims: Number(process.env.WORKER_MAX_ACTIVE_CLAIMS ?? 5),
    instanceId: process.env.WORKER_INSTANCE_ID ?? `execution-worker-${process.pid}`,
    supabaseUrl: readRequiredEnv('SUPABASE_URL'),
    supabaseServiceRoleKey: readRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    gatewayBaseUrl: process.env.GATEWAY_BASE_URL ?? 'http://127.0.0.1:8080',
    mobileMcpBridgeUrl: process.env.MOBILE_MCP_BRIDGE_URL ?? 'http://127.0.0.1:4321',
    deviceBackend,
    commandTimeoutMs: Number(process.env.DEVICE_COMMAND_TIMEOUT_MS ?? process.env.GATEWAY_COMMAND_TIMEOUT_MS ?? 15000),
  };
}

function corsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,OPTIONS',
    'access-control-allow-headers': 'content-type',
  };
}

function startHealthServer(config: WorkerConfig, coordinator: RunClaimCoordinator) {
  const server = createServer((req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, corsHeaders());
      res.end();
      return;
    }

    if (req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json', ...corsHeaders() });
      res.end(
        JSON.stringify({
          service: 'execution-worker',
          status: 'ok',
          pollIntervalMs: config.pollIntervalMs,
          deviceBackend: config.deviceBackend,
          gatewayBaseUrl: config.gatewayBaseUrl,
          mobileMcpBridgeUrl: config.mobileMcpBridgeUrl,
          gatewayProtocolVersion: GATEWAY_PROTOCOL_VERSION,
          commandTimeoutMs: config.commandTimeoutMs,
          leaseTtlMs: config.leaseTtlMs,
          ...coordinator.getHealthSnapshot(),
        })
      );
      return;
    }

    res.writeHead(404, { 'content-type': 'application/json', ...corsHeaders() });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  server.listen(config.port, () => {
    console.log(`[execution-worker] health server listening on :${config.port}`);
  });
}

function main() {
  const config = readConfig();
  const singleTargetExecutor = new SingleDeviceRunExecutor(config, (runId, claimToken) => {
    coordinator.releaseClaim(runId, claimToken);
  });
  const multiTargetExecutor = new MultiTargetRunExecutor(config, (runId, claimToken) => {
    coordinator.releaseClaim(runId, claimToken);
  });
  const coordinator = new RunClaimCoordinator(config, ({ runId, claimToken, targetType }) =>
    targetType === 'SINGLE_DEVICE'
      ? singleTargetExecutor.executeClaimedRun(runId, claimToken)
      : multiTargetExecutor.executeClaimedRun(runId, claimToken)
  );
  startHealthServer(config, coordinator);
  coordinator.start();
}

main();
