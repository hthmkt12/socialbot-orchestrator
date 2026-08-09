/**
 * Phase 5 orchestrator for real controlled runtime execution of the
 * credential boundary proof.
 *
 * Usage:
 *   node scripts/run-credential-boundary-proof.mjs                  (preflight only, blocked)
 *   node scripts/run-credential-boundary-proof.mjs --run-real-proof  (requires CREDENTIAL_BOUNDARY_ALLOW_REAL_PROOF=true)
 *
 * This script:
 * 1. Validates all runtime prerequisites before any data mutation.
 * 2. Starts or verifies the execution worker and Mobile MCP bridge.
 * 3. Redirects each process stdout/stderr into unique ignored proof log directories.
 * 4. Sets CREDENTIAL_BOUNDARY_WORKER_LOG_DIR and CREDENTIAL_BOUNDARY_BRIDGE_LOG_DIR.
 * 5. Invokes:
 *      CREDENTIAL_BOUNDARY_PROOF_COMMAND="node scripts/credential-boundary-proof-harness.mjs"
 *      node scripts/verify-credential-boundary.mjs --runtime-proof
 * 6. Stops only the processes it started, even on failure.
 *
 * Security:
 *   NEVER prints tokens, passwords, canary, plaintext, raw request bodies,
 *   ciphertext, or raw logs. Reports contain only IDs, counts, statuses,
 *   hashes, prefixes, timestamps, and safe failure categories.
 */

import { spawn, spawnSync } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import {
  checkOptIn,
  runPreflight,
  redactReport,
  readinessReport,
} from './credential-boundary-preflight.mjs';

const rootDir = resolve(fileURLToPath(new URL('..', import.meta.url)));
const isWindows = process.platform === 'win32';
const npmCommand = isWindows ? 'npm.cmd' : 'npm';

// --- .env loader ---
function loadDotEnv(path) {
  try {
    return Object.fromEntries(
      readFileSync(path, 'utf8')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#') && line.includes('='))
        .map((line) => {
          const index = line.indexOf('=');
          let value = line.slice(index + 1);
          if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          return [line.slice(0, index), value];
        })
    );
  } catch {
    return {};
  }
}

// Contract tests must not inherit credentials from a developer-local .env.
// This does not bypass any runtime gate; it only disables the convenience loader.
const dotEnv = process.env.CREDENTIAL_BOUNDARY_SKIP_DOTENV === 'true'
  ? {}
  : loadDotEnv(join(rootDir, '.env'));
const env = { ...dotEnv, ...process.env };

const bridgeUrl = env.MOBILE_MCP_BRIDGE_URL ?? env.VITE_MOBILE_MCP_BRIDGE_URL ?? 'http://127.0.0.1:4321';
const workerUrl = env.WORKER_BASE_URL ?? env.VITE_WORKER_BASE_URL ?? 'http://127.0.0.1:4310';
const bridgeToken = env.MOBILE_MCP_BRIDGE_TOKEN;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseUrl = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL;
const allowInsecureBridge = env.MOBILE_MCP_ALLOW_INSECURE_DEV === 'true';

// Unique proof log directories
const proofTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
const proofLogBase = join(rootDir, 'logs', `credential-boundary-proof-${proofTimestamp}`);
let workerLogDir = join(proofLogBase, 'worker');
let bridgeLogDir = join(proofLogBase, 'bridge');

// Track only processes this orchestrator started
const startedProcesses = [];
let verifierProcess = null;

// --- Process cleanup ---
function cleanupStartedProcesses() {
  for (const child of startedProcesses) {
    if (child && !child.killed) {
      try {
        if (isWindows && child.pid) {
          // Terminate only the process tree rooted at the npm command we started.
          spawnSync('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true });
        } else {
          child.kill('SIGTERM');
          setTimeout(() => {
            if (!child.killed) child.kill('SIGKILL');
          }, 3000);
        }
      } catch {
        // Process may have already exited
      }
    }
  }
  startedProcesses.length = 0;
}

// Ensure cleanup on any exit path
process.on('SIGINT', () => {
  cleanupStartedProcesses();
  process.exit(130);
});
process.on('SIGTERM', () => {
  cleanupStartedProcesses();
  process.exit(143);
});
process.on('exit', () => {
  // Best-effort cleanup on normal exit
  for (const child of startedProcesses) {
    if (child && !child.killed) {
      try { child.kill('SIGTERM'); } catch { /* already exited */ }
    }
  }
});

// --- Helpers ---
function safePrint(msg) {
  process.stderr.write(`${msg}\n`);
}

function createSupabaseClient() {
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
}

function probeWritableLogDir(dir) {
  try {
    mkdirSync(dir, { recursive: true });
    const probe = join(dir, `.write-probe-${process.pid}`);
    writeFileSync(probe, 'ok', 'utf8');
    rmSync(probe, { force: true });
    return true;
  } catch {
    return false;
  }
}

async function fetchOk(url, timeoutMs = 5000) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    return response.ok;
  } catch {
    return false;
  }
}

function startService(name, command, args, serviceEnv, logDir) {
  mkdirSync(logDir, { recursive: true });
  const stdout = createWriteStream(join(logDir, `${name}.out.log`), { flags: 'a' });
  const stderr = createWriteStream(join(logDir, `${name}.err.log`), { flags: 'a' });
  const child = spawn(command, args, {
    cwd: rootDir,
    env: { ...process.env, ...dotEnv, ...serviceEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    shell: false,
  });
  child.stdout.pipe(stdout);
  child.stderr.pipe(stderr);
  child.on('exit', (code) => safePrint(`[${name}] exited with code ${code}`));
  startedProcesses.push(child);
  safePrint(`[${name}] starting, logs: ${join(logDir, `${name}.*.log`)}`);
  return child;
}

async function waitForHealthy(name, healthCheck, timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await healthCheck()) return true;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return false;
}

// --- Main ---
async function main() {
  const args = process.argv.slice(2);
  const optIn = checkOptIn(args, env);

  if (!optIn.allowed) {
    safePrint('[orchestrator] Opt-in required for destructive remote execution.');
    safePrint(`[orchestrator] Missing: ${optIn.missing.join(', ')}`);
    safePrint('[orchestrator] Running readiness check only (no mutation).');

    // Readiness report: list every missing prerequisite as a safe label
    const readiness = readinessReport(env);

    // Run preflight without opt-in — just validate and report
    const gitignore = existsSync(join(rootDir, '.gitignore')) ? readFileSync(join(rootDir, '.gitignore'), 'utf8') : '';
    const supabase = createSupabaseClient();

    const preflightResult = await runPreflight({
      env: { ...env, CREDENTIAL_BOUNDARY_WORKER_LOG_DIR: workerLogDir, CREDENTIAL_BOUNDARY_BRIDGE_LOG_DIR: bridgeLogDir },
      supabaseClient: supabase,
      fetchFn: fetch,
      gitignoreContent: gitignore,
      probeWritable: probeWritableLogDir,
      checkRuntimeHealth: false,
    });

    const result = {
      phase: 'phase6',
      timestamp: new Date().toISOString(),
      optIn: { allowed: false, missing: optIn.missing },
      readiness: {
        ready: readiness.ready,
        missing: readiness.missing,
        present: readiness.present,
      },
      preflight: {
        passed: preflightResult.passed,
        failures: preflightResult.failures,
        checks: redactReport(preflightResult.checks),
      },
      realProofExecuted: false,
      verdict: 'blocked',
      reason: 'opt-in required',
    };
    console.log(JSON.stringify(result, null, 2));
    rmSync(proofLogBase, { recursive: true, force: true });
    process.exit(1);
  }

  // === Opt-in confirmed ===
  safePrint('[orchestrator] Opt-in confirmed. Running full preflight...');

  const gitignore = existsSync(join(rootDir, '.gitignore')) ? readFileSync(join(rootDir, '.gitignore'), 'utf8') : '';
  const supabase = createSupabaseClient();

  const preflightResult = await runPreflight({
    env: { ...env, CREDENTIAL_BOUNDARY_WORKER_LOG_DIR: workerLogDir, CREDENTIAL_BOUNDARY_BRIDGE_LOG_DIR: bridgeLogDir },
    supabaseClient: supabase,
    fetchFn: fetch,
    gitignoreContent: gitignore,
    probeWritable: probeWritableLogDir,
    checkRuntimeHealth: false,
  });

  const preStartupFailures = preflightResult.failures.filter((failure) => !failure.startsWith('bridge_health:') && !failure.startsWith('worker_health:'));
  if (preStartupFailures.length > 0) {
    safePrint(`[orchestrator] Preflight failed: ${preflightResult.failures.join('; ')}`);
    const result = {
      phase: 'phase6',
      timestamp: new Date().toISOString(),
      optIn: { allowed: true, missing: [] },
      preflight: {
        passed: false,
        failures: preStartupFailures,
        checks: redactReport(preflightResult.checks),
      },
      realProofExecuted: false,
      verdict: 'blocked',
      reason: 'preflight_failed',
    };
    console.log(JSON.stringify(result, null, 2));
    cleanupStartedProcesses();
    rmSync(proofLogBase, { recursive: true, force: true });
    process.exit(1);
  }

  safePrint('[orchestrator] Preflight passed. Checking service health...');

  // === Service lifecycle ===
  const bridgeHealthy = await fetchOk(`${bridgeUrl}/health`);
  if (!bridgeHealthy) {
    safePrint('[orchestrator] Bridge not healthy. Starting bridge...');
    const bridgeEnv = {
      MOBILE_MCP_BRIDGE_PORT: new URL(bridgeUrl).port || '4321',
      MOBILE_MCP_BRIDGE_TOKEN: bridgeToken,
      MOBILE_MCP_ALLOW_INSECURE_DEV: allowInsecureBridge ? 'true' : 'false',
    };
    startService('mobile-mcp-bridge', npmCommand, ['--prefix', 'services/mobile-mcp-bridge', 'run', 'dev'], bridgeEnv, bridgeLogDir);
    const ok = await waitForHealthy('bridge', () => fetchOk(`${bridgeUrl}/health`), 30000);
    if (!ok) {
      safePrint('[orchestrator] Bridge did not become healthy.');
      const result = {
        phase: 'phase6',
        timestamp: new Date().toISOString(),
        preflight: { passed: true },
        serviceError: 'bridge_unhealthy',
        realProofExecuted: false,
        verdict: 'blocked',
      };
      console.log(JSON.stringify(result, null, 2));
      cleanupStartedProcesses();
      process.exit(1);
    }
    safePrint('[orchestrator] Bridge healthy.');
  } else {
    safePrint('[orchestrator] Bridge already healthy.');
    if (!env.CREDENTIAL_BOUNDARY_EXISTING_BRIDGE_LOG_DIR) {
      throw new Error('existing_bridge_log_dir_required');
    }
    bridgeLogDir = resolve(rootDir, env.CREDENTIAL_BOUNDARY_EXISTING_BRIDGE_LOG_DIR);
  }

  const workerHealthy = await fetchOk(`${workerUrl}/health`);
  if (!workerHealthy) {
    safePrint('[orchestrator] Worker not healthy. Starting worker...');
    const workerEnv = {
      SUPABASE_URL: supabaseUrl,
      SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
      DEVICE_BACKEND: 'mobile-mcp',
      MOBILE_MCP_BRIDGE_URL: bridgeUrl,
      MOBILE_MCP_BRIDGE_TOKEN: bridgeToken,
      CREDENTIAL_VAULT_WORKER_TOKEN: env.CREDENTIAL_VAULT_WORKER_TOKEN,
      DEVICE_COMMAND_TIMEOUT_MS: env.DEVICE_COMMAND_TIMEOUT_MS ?? '30000',
      RUN_POLL_INTERVAL_MS: env.RUN_POLL_INTERVAL_MS ?? '2000',
    };
    startService('execution-worker', npmCommand, ['run', 'dev:worker'], workerEnv, workerLogDir);
    const ok = await waitForHealthy('worker', () => fetchOk(`${workerUrl}/health`), 30000);
    if (!ok) {
      safePrint('[orchestrator] Worker did not become healthy.');
      const result = {
        phase: 'phase6',
        timestamp: new Date().toISOString(),
        preflight: { passed: true },
        serviceError: 'worker_unhealthy',
        realProofExecuted: false,
        verdict: 'blocked',
      };
      console.log(JSON.stringify(result, null, 2));
      cleanupStartedProcesses();
      process.exit(1);
    }
    safePrint('[orchestrator] Worker healthy.');
  } else {
    safePrint('[orchestrator] Worker already healthy.');
    if (!env.CREDENTIAL_BOUNDARY_EXISTING_WORKER_LOG_DIR) {
      throw new Error('existing_worker_log_dir_required');
    }
    workerLogDir = resolve(rootDir, env.CREDENTIAL_BOUNDARY_EXISTING_WORKER_LOG_DIR);
  }

  // Services are now available, so run the health/device/vault checks that
  // were intentionally deferred before the lifecycle start step.
  const runtimePreflight = await runPreflight({
    env: { ...env, CREDENTIAL_BOUNDARY_WORKER_LOG_DIR: workerLogDir, CREDENTIAL_BOUNDARY_BRIDGE_LOG_DIR: bridgeLogDir },
    supabaseClient: supabase,
    fetchFn: fetch,
    gitignoreContent: gitignore,
    probeWritable: probeWritableLogDir,
    checkRuntimeHealth: true,
  });
  if (!runtimePreflight.passed) {
    cleanupStartedProcesses();
    console.log(JSON.stringify({
      phase: 'phase6',
      realProofExecuted: false,
      verdict: 'blocked',
      reason: 'runtime_preflight_failed',
      preflight: { passed: false, failures: runtimePreflight.failures, checks: redactReport(runtimePreflight.checks) },
    }, null, 2));
    process.exit(1);
  }

  // === Invoke the verifier with runtime proof ===
  safePrint('[orchestrator] Invoking credential boundary verifier with --runtime-proof...');

  const verifierEnv = {
    ...env,
    CREDENTIAL_BOUNDARY_PROOF_COMMAND: 'node scripts/credential-boundary-proof-harness.mjs',
    CREDENTIAL_BOUNDARY_WORKER_LOG_DIR: workerLogDir,
    CREDENTIAL_BOUNDARY_BRIDGE_LOG_DIR: bridgeLogDir,
  };

  const verifierStdout = [];
  const verifierStderr = [];

  verifierProcess = spawn('node', ['scripts/verify-credential-boundary.mjs', '--runtime-proof'], {
    cwd: rootDir,
    env: verifierEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    shell: isWindows,
  });
  verifierProcess.stdout.on('data', (chunk) => verifierStdout.push(chunk));
  verifierProcess.stderr.on('data', (chunk) => verifierStderr.push(chunk));

  const verifierExitCode = await new Promise((resolve) => {
    verifierProcess.on('close', (code) => resolve(code ?? 1));
  });

  // Parse verifier output for the verdict
  let verifierReport = null;
  try {
    const stdoutText = Buffer.concat(verifierStdout).toString('utf8');
    verifierReport = JSON.parse(stdoutText);
  } catch {
    // Verifier output not parseable — report blocked
  }

  // === Cleanup: stop only processes we started ===
  safePrint('[orchestrator] Cleaning up started processes...');
  cleanupStartedProcesses();

  // === Scan proof log dirs for canary before deletion ===
  // The adapter (credential-boundary-runtime-proof.mjs) handles its own temp
  // dir cleanup. The orchestrator's proof log dirs are for the worker/bridge
  // processes we started. We scan them before deleting.
  const canary = env.CREDENTIAL_BOUNDARY_CANARY;
  let logsClean = true;
  let logsDeleted = false;

  if (existsSync(proofLogBase)) {
    try {
      // Recursively scan all files in proofLogBase for the canary
      function scanDir(dir) {
        const entries = readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = join(dir, entry.name);
          if (entry.isDirectory()) {
            scanDir(fullPath);
          } else if (entry.isFile()) {
            const content = readFileSync(fullPath, 'utf8');
            if (content.includes(canary)) logsClean = false;
          }
        }
      }
      scanDir(proofLogBase);
    } catch {
      logsClean = false;
    }

    // Delete proof log dirs
    try {
      rmSync(proofLogBase, { recursive: true, force: true });
      logsDeleted = !existsSync(proofLogBase);
    } catch {
      logsDeleted = false;
    }
  } else {
    logsClean = true;
    logsDeleted = true;
  }

  // === Assemble final report ===
  const result = {
    phase: 'phase6',
    timestamp: new Date().toISOString(),
    optIn: { allowed: true, missing: [] },
    preflight: { passed: true },
    realProofExecuted: true,
    verifierExitCode,
    verifierVerdict: verifierReport?.overallVerdict ?? 'unknown',
    logsClean,
    logsDeleted,
    proofPassed: verifierReport?.overallVerdict === 'full_verified' && logsClean && logsDeleted,
    verdict: verifierReport?.overallVerdict === 'full_verified' && logsClean && logsDeleted ? 'full_verified' : 'blocked',
    result: verifierReport ? redactReport({
      overallVerdict: verifierReport.overallVerdict,
      gates: verifierReport.gates,
      credentialBoundary: verifierReport.credentialBoundary,
      runtimeProof: verifierReport.runtimeProof,
    }) : null,
  };

  console.log(JSON.stringify(result, null, 2));

  if (verifierExitCode !== 0 || !result.proofPassed) {
    process.exit(1);
  }
}

main().catch((error) => {
  safePrint('[orchestrator] Fatal error');
  cleanupStartedProcesses();
  // Never expose error details that might contain secrets
  const result = {
    phase: 'phase6',
    timestamp: new Date().toISOString(),
    realProofExecuted: false,
    verdict: 'blocked',
    reason: 'orchestrator_error',
    errorName: error?.name ?? 'Unknown',
  };
  console.log(JSON.stringify(result, null, 2));
  process.exit(1);
});
