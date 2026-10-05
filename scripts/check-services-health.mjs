#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(fileURLToPath(new URL('..', import.meta.url)));

function loadDotEnv(path) {
  if (!existsSync(path)) return {};
  return Object.fromEntries(
    readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const index = line.indexOf('=');
        return [line.slice(0, index), line.slice(index + 1)];
      })
  );
}

const env = { ...loadDotEnv(resolve(rootDir, '.env')), ...process.env };

const workerUrl = env.WORKER_BASE_URL ?? env.VITE_WORKER_BASE_URL ?? 'http://127.0.0.1:4310';
const gatewayUrl = env.GATEWAY_BASE_URL ?? env.VITE_GATEWAY_BASE_URL ?? 'http://127.0.0.1:8080';
const bridgeUrl = env.MOBILE_MCP_BRIDGE_URL ?? env.VITE_MOBILE_MCP_BRIDGE_URL ?? 'http://127.0.0.1:4321';
const alertWebhookUrl = env.HEALTH_ALERT_WEBHOOK_URL;
const checkIntervalMs = Number(env.HEALTH_CHECK_INTERVAL_MS ?? 0);

const SERVICES = [
  { name: 'execution-worker', url: `${workerUrl}/health`, timeoutMs: 5000 },
  { name: 'laixi-gateway', url: `${gatewayUrl}/health`, timeoutMs: 5000 },
  { name: 'mobile-mcp-bridge', url: `${bridgeUrl}/health`, timeoutMs: 5000 },
];

async function checkService(svc) {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), svc.timeoutMs);
    const res = await fetch(svc.url, { signal: controller.signal });
    clearTimeout(timeout);
    const latencyMs = Date.now() - start;
    if (res.ok) {
      let data = {};
      try {
        data = await res.json();
      } catch {
        // non-json ok response
      }
      return { name: svc.name, status: 'HEALTHY', statusCode: res.status, latencyMs, data };
    }
    return { name: svc.name, status: 'UNHEALTHY', statusCode: res.status, latencyMs, error: `HTTP ${res.status}` };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const isTimeout = err.name === 'AbortError';
    return {
      name: svc.name,
      status: 'DOWN',
      statusCode: null,
      latencyMs,
      error: isTimeout ? `Timeout (${svc.timeoutMs}ms)` : err.message,
    };
  }
}

async function sendAlert(unhealthy) {
  if (!alertWebhookUrl) {
    return;
  }
  const payload = {
    event: 'SERVICES_UNHEALTHY',
    timestamp: new Date().toISOString(),
    failures: unhealthy.map((s) => ({
      service: s.name,
      status: s.status,
      error: s.error,
      latencyMs: s.latencyMs,
    })),
  };
  try {
    const res = await fetch(alertWebhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error(`[health-alert] Failed to post webhook: HTTP ${res.status}`);
    }
  } catch (err) {
    console.error(`[health-alert] Webhook delivery failed: ${err.message}`);
  }
}

async function runHealthCheck() {
  const results = await Promise.all(SERVICES.map(checkService));
  const timestamp = new Date().toISOString();
  let hasFailure = false;

  console.log(`\n=== Health Check at ${timestamp} ===`);
  for (const r of results) {
    const icon = r.status === 'HEALTHY' ? '[OK]' : '[FAIL]';
    const detail = r.status === 'HEALTHY' ? `${r.latencyMs}ms` : `${r.error} (${r.latencyMs}ms)`;
    console.log(`  ${icon} ${r.name.padEnd(20)} ${r.status.padEnd(10)} ${detail}`);
    if (r.status !== 'HEALTHY') hasFailure = true;
  }

  const unhealthy = results.filter((r) => r.status !== 'HEALTHY');
  if (unhealthy.length > 0) {
    await sendAlert(unhealthy);
  }

  return !hasFailure;
}

async function main() {
  if (checkIntervalMs > 0) {
    console.log(`[health-alert] Running daemon mode, polling every ${checkIntervalMs}ms`);
    void runHealthCheck();
    setInterval(runHealthCheck, checkIntervalMs);
  } else {
    const healthy = await runHealthCheck();
    process.exit(healthy ? 0 : 1);
  }
}

main().catch((err) => {
  console.error('[health-alert] Fatal error:', err);
  process.exit(1);
});
