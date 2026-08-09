/**
 * Deterministic credential-boundary readiness audit.
 *
 * Generates a readiness audit from current evidence by spawning the
 * orchestrator with safety overrides that prevent accidental opt-in.
 *
 * Usage:
 *   node scripts/audit-credential-boundary-readiness.mjs
 *   node scripts/audit-credential-boundary-readiness.mjs --write-report
 *
 * Safety:
 *   - Explicitly removes CREDENTIAL_BOUNDARY_ALLOW_REAL_PROOF from the child env.
 *   - Never passes --run-real-proof to the child.
 *   - Never prints secret values, URLs with credentials, raw stdout/stderr,
 *     canary, JWTs, tokens, or log contents.
 *   - Does not start services, invoke devices, contact Supabase, or mutate
 *     remote state.
 *   - Output contains only labels, booleans, status categories, timestamps,
 *     and exit codes.
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(fileURLToPath(new URL('..', import.meta.url)));
const isWindows = process.platform === 'win32';
const orchestratorScript = join(rootDir, 'scripts', 'run-credential-boundary-proof.mjs');
const verifierScript = join(rootDir, 'scripts', 'verify-credential-boundary.mjs');
const writeReport = process.argv.includes('--write-report');
const reportsDir = join(rootDir, 'plans', '260710-credential-boundary-remediation', 'reports');

/**
 * Spawn the orchestrator with safety overrides.
 * Removes CREDENTIAL_BOUNDARY_ALLOW_REAL_PROOF and never passes --run-real-proof.
 */
function spawnReadinessCheck() {
  return new Promise((resolvePromise) => {
    // Build child env: copy current env but force-remove opt-in env var.
    const childEnv = { ...process.env };
    delete childEnv.CREDENTIAL_BOUNDARY_ALLOW_REAL_PROOF;
    // Belt-and-suspenders: set it to false so .env loading cannot override.
    childEnv.CREDENTIAL_BOUNDARY_ALLOW_REAL_PROOF = 'false';

    const child = spawn('node', [orchestratorScript], {
      cwd: rootDir,
      env: childEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    const stdoutChunks = [];
    const stderrChunks = [];

    child.stdout.on('data', (chunk) => stdoutChunks.push(chunk));
    child.stderr.on('data', (chunk) => stderrChunks.push(chunk));

    child.on('close', (code) => {
      const stdout = Buffer.concat(stdoutChunks).toString('utf8');
      const stderr = Buffer.concat(stderrChunks).toString('utf8');
      resolvePromise({
        exitCode: code ?? 1,
        stdout,
        stderr,
      });
    });
  });
}

/**
 * Perform a read-only health check against a URL.
 * Returns { checked: true, status: number, ok: boolean } or
 *         { checked: true, error: string } on failure.
 * Returns { checked: false, reason: 'url_not_configured' } if URL is falsy.
 */
async function healthCheck(url) {
  if (!url) return { checked: false, reason: 'url_not_configured' };
  try {
    const response = await fetch(`${url}/health`, { signal: AbortSignal.timeout(5000) });
    return {
      checked: true,
      status: response.status,
      ok: response.ok,
    };
  } catch (error) {
    return {
      checked: true,
      error: error instanceof Error ? error.name : 'fetch_error',
    };
  }
}

/**
 * Extract the orchestrator's JSON output safely.
 * Parses only the last JSON object from stdout.
 */
function extractOrchestratorResult(stdout) {
  try {
    // The orchestrator prints one JSON object to stdout.
    const trimmed = stdout.trim();
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

/**
 * Spawn the static verifier with --no-write-report.
 * Never passes --runtime-proof. Captures safe JSON only.
 */
function spawnStaticVerifier() {
  return new Promise((resolvePromise) => {
    const childEnv = { ...process.env };
    delete childEnv.CREDENTIAL_BOUNDARY_ALLOW_REAL_PROOF;
    childEnv.CREDENTIAL_BOUNDARY_ALLOW_REAL_PROOF = 'false';

    // Never inherit verifier test hooks from an operator shell. Contract tests
    // must opt in twice and identify themselves as a Node test environment.
    const allowAuditTestMode = process.env.CREDENTIAL_BOUNDARY_AUDIT_TEST_MODE === 'true'
      && process.env.NODE_ENV === 'test';
    delete childEnv.CREDENTIAL_BOUNDARY_TEST_MODE;
    delete childEnv.CREDENTIAL_BOUNDARY_TEST_VERIFIER_FAIL;
    delete childEnv.CREDENTIAL_BOUNDARY_AUDIT_TEST_MODE;
    if (allowAuditTestMode) {
      childEnv.CREDENTIAL_BOUNDARY_TEST_MODE = 'true';
      if (process.env.CREDENTIAL_BOUNDARY_TEST_VERIFIER_FAIL === 'true') {
        childEnv.CREDENTIAL_BOUNDARY_TEST_VERIFIER_FAIL = 'true';
      }
    }

    const child = spawn('node', [verifierScript, '--no-write-report'], {
      cwd: rootDir,
      env: childEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    const stdoutChunks = [];
    const stderrChunks = [];

    child.stdout.on('data', (chunk) => stdoutChunks.push(chunk));
    child.stderr.on('data', (chunk) => stderrChunks.push(chunk));

    child.on('close', (code) => {
      const stdout = Buffer.concat(stdoutChunks).toString('utf8');
      const stderr = Buffer.concat(stderrChunks).toString('utf8');
      resolvePromise({
        exitCode: code ?? 1,
        stdout,
        stderr,
      });
    });
  });
}

/**
 * Extract the static verifier's JSON output safely.
 */
function extractVerifierResult(stdout) {
  try {
    const trimmed = stdout.trim();
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

/**
 * Generate a safe timestamp for the report filename.
 */
function timestampForFilename() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

/**
 * Verify the child result meets the safety contract.
 */
function verifySafetyContract(result) {
  const violations = [];
  if (!result) {
    violations.push('orchestrator produced no parseable JSON');
    return violations;
  }
  if (result.verdict !== 'blocked') {
    violations.push(`expected verdict "blocked", got "${result.verdict}"`);
  }
  if (result.realProofExecuted !== false) {
    violations.push('realProofExecuted was not false');
  }
  if (result.exitCode === 0) {
    violations.push('expected non-zero exit code');
  }
  return violations;
}

// --- Main ---
async function main() {
  // Spawn the readiness check with safety overrides
  const childResult = await spawnReadinessCheck();

  const orchestratorResult = extractOrchestratorResult(childResult.stdout);

  // Verify safety contract
  const contractViolations = verifySafetyContract({
    ...orchestratorResult,
    exitCode: childResult.exitCode,
  });

  // Spawn the static verifier with --no-write-report (never --runtime-proof)
  const verifierChildResult = await spawnStaticVerifier();
  const verifierResult = extractVerifierResult(verifierChildResult.stdout);

  // Derive the static verifier verdict from the verifier's output
  let staticVerifierVerdict = 'unknown';
  let staticVerifierExitCode = verifierChildResult.exitCode;
  let staticVerifierReason = undefined;

  if (!verifierResult) {
    staticVerifierVerdict = 'unknown';
    staticVerifierReason = 'verifier_output_unparseable';
  } else if (typeof verifierResult.overallVerdict === 'string') {
    staticVerifierVerdict = verifierResult.overallVerdict;
    // If the verifier failed (not static_verified), record the category.
    if (verifierResult.overallVerdict === 'failed') {
      staticVerifierReason = 'static_gates_failed';
    } else if (verifierResult.overallVerdict === 'blocked') {
      staticVerifierReason = 'runtime_prerequisites_missing';
    } else if (verifierResult.overallVerdict === 'static_verified') {
      staticVerifierReason = 'static_gates_passed';
    }
  } else {
    staticVerifierVerdict = 'unknown';
    staticVerifierReason = 'verdict_field_missing';
  }

  // Perform health checks only when explicit URLs are configured
  const bridgeUrl = process.env.MOBILE_MCP_BRIDGE_URL;
  const workerUrl = process.env.WORKER_BASE_URL;

  const bridgeHealth = await healthCheck(bridgeUrl);
  const workerHealth = await healthCheck(workerUrl);

  // Build the audit report — safe fields only
  const audit = {
    auditType: 'credential-boundary-readiness-audit',
    auditDate: new Date().toISOString(),
    auditorPhase: 'phase10',
    command: 'npm.cmd run audit:credential-boundary',
    realProofExecuted: false,
    readinessCommandVerdict: orchestratorResult?.verdict ?? 'unknown',
    readinessCommandExitCode: childResult.exitCode,
    staticVerifierVerdict,
    staticVerifierExitCode,
    staticVerifierReason,
    staticVerifierChildTestMode: typeof verifierResult?.staticVerifierTestMode === 'boolean'
      ? verifierResult.staticVerifierTestMode
      : null,
    documentationClaims: 'remediation_pending',
    planStatus: 'in-progress',
    phase3Status: 'blocked',
    safetyContract: {
      optInSuppressed: true,
      runRealProofFlagUsed: false,
      allowRealProofEnvSet: false,
      runtimeProofRequested: false,
      staticVerifierTestMode: process.env.CREDENTIAL_BOUNDARY_AUDIT_TEST_MODE === 'true'
        && process.env.NODE_ENV === 'test',
      contractViolations,
      contractPassed: contractViolations.length === 0,
    },
    readiness: orchestratorResult ? {
      ready: orchestratorResult.readiness?.ready ?? false,
      missing: orchestratorResult.readiness?.missing ?? [],
      present: orchestratorResult.readiness?.present ?? [],
    } : { ready: false, missing: [], present: [] },
    preflight: orchestratorResult ? {
      passed: orchestratorResult.preflight?.passed ?? false,
      failures: orchestratorResult.preflight?.failures ?? [],
    } : { passed: false, failures: [] },
    healthChecks: {
      bridge: bridgeHealth,
      worker: workerHealth,
    },
    blockers: deriveBlockers(orchestratorResult, bridgeHealth, workerHealth),
  };

  const auditJson = JSON.stringify(audit, null, 2);

  if (writeReport) {
    if (!existsSync(reportsDir)) {
      mkdirSync(reportsDir, { recursive: true });
    }
    const filename = `credential-boundary-readiness-audit-${timestampForFilename()}.json`;
    const reportPath = join(reportsDir, filename);
    if (existsSync(reportPath)) {
      // Should never happen with ISO timestamp, but guard anyway.
      console.error(`[audit] Report file already exists: ${reportPath}`);
      process.exit(1);
    }
    writeFileSync(reportPath, auditJson, 'utf8');
    console.error(`[audit] Report written to ${reportPath}`);
  }

  // Print safe JSON to stdout
  console.log(auditJson);

  // Exit non-zero if safety contract was violated
  if (contractViolations.length > 0) {
    process.exit(1);
  }
}

function deriveBlockers(orchestratorResult, bridgeHealth, workerHealth) {
  const blockers = [];

  if (!orchestratorResult) {
    blockers.push({ label: 'orchestrator_output', category: 'unparseable', description: 'Orchestrator did not produce parseable JSON' });
    return blockers;
  }

  // Env var blockers
  const missing = orchestratorResult.readiness?.missing ?? [];
  for (const name of missing) {
    blockers.push({
      label: name,
      category: 'env_missing',
      description: `${name} not set in environment`,
    });
  }

  // Health check blockers
  if (bridgeHealth.checked && !bridgeHealth.ok) {
    blockers.push({
      label: 'bridge_health',
      category: bridgeHealth.error ? 'service_error' : 'service_unhealthy',
      description: bridgeHealth.error ?? `Bridge health returned ${bridgeHealth.status}`,
    });
  }
  if (!bridgeHealth.checked) {
    blockers.push({
      label: 'bridge_health',
      category: 'not_checked',
      description: 'MOBILE_MCP_BRIDGE_URL not configured',
    });
  }

  if (workerHealth.checked && !workerHealth.ok) {
    blockers.push({
      label: 'worker_health',
      category: workerHealth.error ? 'service_error' : 'service_unhealthy',
      description: workerHealth.error ?? `Worker health returned ${workerHealth.status}`,
    });
  }
  if (!workerHealth.checked) {
    blockers.push({
      label: 'worker_health',
      category: 'not_checked',
      description: 'WORKER_BASE_URL not configured',
    });
  }

  // Opt-in gate
  blockers.push({
    label: 'opt_in_gate',
    category: 'not_satisfied',
    description: 'Neither --run-real-proof nor CREDENTIAL_BOUNDARY_ALLOW_REAL_PROOF=true set (by design)',
  });

  return blockers;
}

main().catch((error) => {
  // Never expose error details that might contain secrets
  console.log(JSON.stringify({
    auditType: 'credential-boundary-readiness-audit',
    auditDate: new Date().toISOString(),
    auditorPhase: 'phase10',
    realProofExecuted: false,
    readinessCommandVerdict: 'unknown',
    staticVerifierVerdict: 'unknown',
    staticVerifierReason: 'audit_script_fatal_error',
    documentationClaims: 'remediation_pending',
    planStatus: 'in-progress',
    phase3Status: 'blocked',
    safetyContract: {
      contractViolations: ['audit_script_fatal_error'],
      contractPassed: false,
    },
    errorName: error?.name ?? 'Unknown',
  }, null, 2));
  process.exit(1);
});
