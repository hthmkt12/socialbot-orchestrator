/**
 * Credential Boundary Verification Script (Phase 3 - Remediation).
 *
 * Runs static verification gates and produces a safe JSON evidence report.
 * The verdict logic ensures bridge health alone is never sufficient for
 * full_verified — a real credential login run, clean persistence scan, and
 * verified cleanup are all mandatory.
 *
 * Usage:
 *   node scripts/verify-credential-boundary.mjs
 *   node scripts/verify-credential-boundary.mjs --runtime-proof
 *
 * Runtime proof requires:
 *   - Deployed credential-vault Edge Function with SUPABASE_SERVICE_ROLE_KEY
 *     and CREDENTIAL_VAULT_WORKER_TOKEN secrets set
 *   - Worker runtime with CREDENTIAL_VAULT_WORKER_TOKEN env var
 *   - Mobile MCP bridge reachable at MOBILE_MCP_BRIDGE_URL
 *   - A connected Android device
 *   - A disposable account credential supplied at runtime (never in source)
 *
 * If any runtime prerequisite is missing, the verdict is "blocked" or
 * "static_verified" — never "full_verified".
 *
 * Security:
 *   NEVER prints plaintext passwords, keys, canary strings, or decrypted values.
 *   Reports contain only hashes, counts, IDs, payload prefixes, and pass/fail status.
 *   The canary string is hashed (SHA-256) before appearing in any report.
 */

import { execSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { computeCredentialBoundaryVerdict } from './credential-boundary-verdict.mjs';
import { runCredentialBoundaryRuntimeProof } from './credential-boundary-runtime-proof.mjs';

/**
 * Test mode short-circuit.
 *
 * Phase 11 — Credential-Boundary Audit Test-Mode Performance Hardening.
 *
 * When BOTH `CREDENTIAL_BOUNDARY_TEST_MODE=true` AND `NODE_ENV=test` are
 * present, the verifier replaces the expensive static scan/check operations
 * (lint, typecheck, vitest, build, source-canary scan, Edge Function source
 * scan, runtime availability probe, crypto/redaction unit-test spawns) with
 * deterministic safe fixture results that preserve the verifier JSON schema
 * and the verdict policy in `credential-boundary-verdict.mjs`.
 *
 * The production path is unchanged when either flag is absent: all real
 * static gates, scans, and runtime probes run exactly as before.
 *
 * Hard constraints honored by this mode:
 *   - Never requests runtime proof, contacts services, devices, or Supabase.
 *   - Never touches the filesystem reports directory when `--no-write-report`
 *     is present.
 *   - The fixture is `static_verified` by default and `failed` when
 *     `CREDENTIAL_BOUNDARY_TEST_VERIFIER_FAIL=true` is set; the verdict is
 *     never upgraded from `failed` to `static_verified`.
 *   - No canary plaintext or secret sentinel is introduced.
 */
function isTestModeActive(env) {
  return env.CREDENTIAL_BOUNDARY_TEST_MODE === 'true' && env.NODE_ENV === 'test';
}

const rootDir = resolve(fileURLToPath(new URL('..', import.meta.url)));
const CANARY = 'DO_NOT_PERSIST_PASSWORD_123';
const CANARY_HASH = createHash('sha256').update(CANARY).digest('hex').slice(0, 16);
const VERIFIER_VERSION = 'phase3-remediation-1';

// --- Minimal .env loader ---
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

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function runGate(command, options = {}) {
  try {
    const stdout = execSync(command, {
      cwd: rootDir,
      timeout: 300000,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      ...options,
    });
    return { exitCode: 0, stdout: stdout ?? '', stderr: '' };
  } catch (error) {
    return { exitCode: error.status ?? 1, stdout: error.stdout ?? '', stderr: error.stderr ?? error.message ?? '' };
  }
}

function runVitestFile(testFile) {
  const result = runGate(`npx vitest run "${testFile}" --reporter=json`, { timeout: 120000 });
  let testCount = 0;
  let passed = result.exitCode === 0;
  try {
    const report = JSON.parse(result.stdout);
    if (report.numTotalTests !== undefined) {
      testCount = report.numTotalTests;
      passed = report.numTotalTests > 0 && report.numFailedTests === 0;
    }
  } catch {
    const match = (result.stdout + result.stderr).match(/(\d+)\s+test/);
    if (match) testCount = parseInt(match[1], 10);
  }
  return { passed, exitCode: result.exitCode, testCount };
}

function stripAnsi(str) {
  if (!str) return '';
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

function extractTestCount(stdout, stderr) {
  const combined = stripAnsi((stdout || '') + (stderr || ''));
  const match = combined.match(/Tests\s+(\d+)\s+passed/);
  if (match) return parseInt(match[1], 10);
  return null;
}

/**
 * Search for the canary string across source directories AND plans/reports.
 * Returns { files: string[], violations: string[] }.
 * Canary is allowed only in test files and this verification script.
 */
function searchCanary() {
  // Scan all source-controlled evidence, including plans/reports and docs.
  const dirs = ['src', 'services', 'supabase', 'scripts', 'plans', 'docs'];
  const results = [];
  const ignoredDirectories = new Set(['node_modules', '.git', 'dist', 'build', '.venv', '__pycache__']);

  function visit(directory) {
    try {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
          if (!ignoredDirectories.has(entry.name)) visit(path);
        } else if (entry.isFile()) {
          try {
            if (readFileSync(path, 'utf8').includes(CANARY)) results.push(path.replace(/\\/g, '/'));
          } catch {
            // Skip unreadable/binary files; evidence files are text by contract.
          }
        }
      }
    } catch {
      // A missing optional source directory is not a scan failure.
    }
  }

  for (const dir of dirs) {
    const fullPath = join(rootDir, dir);
    if (existsSync(fullPath)) visit(fullPath);
  }
  return [...new Set(results)];
}

function verifyCanaryPlacement(canaryFiles) {
  const allowedPatterns = [
    /\.test\.ts$/,
    /\.test\.tsx$/,
    /\.spec\.ts$/,
    /\/tests\/test_.*\.py$/,
    /verify-credential-boundary\.mjs$/,
  ];
  const violations = canaryFiles.filter(
    (filePath) => !allowedPatterns.some((pattern) => pattern.test(filePath))
  );
  return { canaryOnlyInTestFiles: violations.length === 0, filesFound: canaryFiles, violations };
}

function verifyEdgeFunctionNoPlaintextLogging() {
  const edgeFunctionPath = join(rootDir, 'supabase', 'functions', 'credential-vault', 'index.ts');
  if (!existsSync(edgeFunctionPath)) {
    return { ok: false, reason: 'Edge Function file not found', details: [] };
  }
  const source = readFileSync(edgeFunctionPath, 'utf8');
  const lines = source.split(/\r?\n/);
  const issues = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/console\.(log|warn|error|info|debug)\s*\(/.test(line)) {
      if (/body|plaintext|password|key|secret|ciphertext|token|encrypted/i.test(line)) {
        issues.push(`Line ${i + 1}: ${line.trim()}`);
      }
    }
    if (/Deno\.(stdout|stderr)\.write/.test(line) && /body|plaintext|password|key|secret/i.test(line)) {
      issues.push(`Line ${i + 1}: ${line.trim()}`);
    }
  }
  return { ok: issues.length === 0, details: issues };
}

async function checkRuntimeAvailability(env) {
  const bridgeUrl = env.MOBILE_MCP_BRIDGE_URL ?? env.VITE_MOBILE_MCP_BRIDGE_URL;
  if (!bridgeUrl) {
    return { available: false, reason: 'MOBILE_MCP_BRIDGE_URL not set' };
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(`${bridgeUrl}/health`, { signal: controller.signal });
    clearTimeout(timeout);
    if (response.ok) {
      return { available: true, bridgeUrl, healthStatus: response.status };
    }
    return { available: false, reason: `Bridge health check returned ${response.status}` };
  } catch (error) {
    return { available: false, reason: `Bridge unreachable: ${error instanceof Error ? error.message : String(error)}` };
  }
}

async function main() {
  const dotEnv = loadDotEnv(join(rootDir, '.env'));
  const env = { ...dotEnv, ...process.env };
  const noWriteReport = process.argv.includes('--no-write-report');

  const isTestMode = isTestModeActive(env);
  const shouldFail = isTestMode && env.CREDENTIAL_BOUNDARY_TEST_VERIFIER_FAIL === 'true';

  // ===== Part A: Non-device gates =====
  console.error('[verifier] Running non-device verification gates...');

  const lintResult = isTestMode ? { exitCode: shouldFail ? 1 : 0, stdout: '', stderr: '' } : runGate('npm.cmd run lint');
  const typecheckResult = isTestMode ? { exitCode: shouldFail ? 1 : 0, stdout: '', stderr: '' } : runGate('npm.cmd run typecheck');
  const testResult = isTestMode ? { exitCode: shouldFail ? 1 : 0, stdout: 'Tests 10 passed', stderr: '' } : runGate('npx vitest run src supabase/functions/credential-vault --exclude "src/lib/*-contract.test.ts"');
  const buildResult = isTestMode ? { exitCode: shouldFail ? 1 : 0, stdout: '', stderr: '' } : runGate('npm.cmd run build');
  const buildWorkerResult = isTestMode ? { exitCode: shouldFail ? 1 : 0, stdout: '', stderr: '' } : runGate('npm.cmd run build:worker');

  const testCount = extractTestCount(testResult.stdout, testResult.stderr) ?? (isTestMode ? 10 : 0);

  const gates = {
    lint: { passed: lintResult.exitCode === 0, exitCode: lintResult.exitCode },
    typecheck: { passed: typecheckResult.exitCode === 0, exitCode: typecheckResult.exitCode },
    test: { passed: testResult.exitCode === 0, exitCode: testResult.exitCode, testCount },
    build: { passed: buildResult.exitCode === 0, exitCode: buildResult.exitCode },
    build_worker: { passed: buildWorkerResult.exitCode === 0, exitCode: buildWorkerResult.exitCode },
  };

  // ===== Part B: Credential boundary static proof =====
  console.error('[verifier] Running credential boundary static proof gates...');

  const cryptoTestResult = isTestMode
    ? { passed: !shouldFail, exitCode: shouldFail ? 1 : 0, testCount: 5 }
    : runVitestFile('supabase/functions/credential-vault/crypto-helper.test.ts');
  const redactionTestResult = isTestMode
    ? { passed: !shouldFail, exitCode: shouldFail ? 1 : 0, testCount: 5 }
    : runVitestFile('services/execution-worker/src/credential-redaction.test.ts');

  // Test-mode skips all source/Edge-Function scanning and runtime probes.
  // The fixture preserves the JSON schema and verdict policy while keeping the
  // audit contract suite hermetic and fast.
  let canaryVerification;
  let edgeFunctionCheck;
  let runtimeCheck;
  let runtimeProof;

  if (isTestMode) {
    console.error('[verifier] Test mode active: using deterministic safe fixture evidence.');
    canaryVerification = {
      canaryOnlyInTestFiles: !shouldFail,
      filesFound: shouldFail ? ['plans/fixture-canary-violation.json'] : [],
      violations: shouldFail ? ['plans/fixture-canary-violation.json'] : [],
    };
    edgeFunctionCheck = {
      ok: !shouldFail,
      details: shouldFail ? ['Line 1: console.log(plaintext) // fixture violation'] : [],
    };
    // No network, device, or service contact in test mode.
    runtimeCheck = { available: false, reason: 'test_mode_runtime_probe_disabled' };
    // Runtime proof is never requested in test mode; the audit must still
    // never pass --runtime-proof through to a child verifier.
    runtimeProof = { attempted: false, prerequisitesReady: false, reason: 'runtime proof not requested' };
  } else {
    console.error('[verifier] Searching for canary string across source and plans...');
    canaryVerification = verifyCanaryPlacement(searchCanary());

    edgeFunctionCheck = verifyEdgeFunctionNoPlaintextLogging();

    console.error('[verifier] Checking runtime availability...');
    runtimeCheck = await checkRuntimeAvailability(env);
    const runtimeRequested = process.argv.includes('--runtime-proof');
    runtimeProof = runtimeRequested
      ? await runCredentialBoundaryRuntimeProof({
        rootDir,
        env,
        canary: CANARY,
        // Intentionally process-env only: the proof command may configure privileged runtime setup.
        proofCommand: process.env.CREDENTIAL_BOUNDARY_PROOF_COMMAND,
      })
      : { attempted: false, prerequisitesReady: false, reason: 'runtime proof not requested' };
  }

  const runtimeRequested = !isTestMode && process.argv.includes('--runtime-proof');

  // ===== Compute verdict =====
  const verdictInput = {
    lintPassed: gates.lint.passed,
    typecheckPassed: gates.typecheck.passed,
    testPassed: gates.test.passed,
    buildPassed: gates.build.passed,
    buildWorkerPassed: gates.build_worker.passed,
    // Requesting a runtime proof without its harness is a blocked release gate,
    // not a static-only verification run.
    runtimeAttempted: runtimeRequested,
    runtimePrerequisitesReady: runtimeProof.prerequisitesReady,
    authMatrixPassed: runtimeProof.authMatrixPassed === true,
    cryptoTestsPassed: cryptoTestResult.passed,
    redactionTestsPassed: redactionTestResult.passed,
    canaryScanClean: canaryVerification.canaryOnlyInTestFiles,
    edgeFunctionNoPlaintextLogging: edgeFunctionCheck.ok,
    loginRunCompleted: runtimeProof.loginRunCompleted === true,
    persistenceScanClean: runtimeProof.persistenceScanClean === true,
    cleanupVerified: runtimeProof.cleanupVerified === true,
    capturedLogsClean: runtimeProof.capturedLogsClean === true,
    tempLogsDeleted: runtimeProof.tempLogsDeleted === true,
  };

  const overallVerdict = computeCredentialBoundaryVerdict(verdictInput);

  // ===== Assemble report (safe: no canary plaintext, only hash) =====
  const report = {
    verificationDate: new Date().toISOString(),
    verifierVersion: VERIFIER_VERSION,
    staticVerifierTestMode: isTestMode,
    gates,
    credentialBoundary: {
      cryptoTestsPassed: cryptoTestResult.passed,
      cryptoTestCount: cryptoTestResult.testCount,
      redactionTestsPassed: redactionTestResult.passed,
      redactionTestCount: redactionTestResult.testCount,
      canaryHash: CANARY_HASH, // Non-reversible hash, not the plaintext canary
      canaryOnlyInTestFiles: canaryVerification.canaryOnlyInTestFiles,
      canaryFilesFound: canaryVerification.filesFound.map((f) => f.replace(rootDir.replace(/\\/g, '/') + '/', '')),
      canaryViolations: canaryVerification.violations.map((f) => f.replace(rootDir.replace(/\\/g, '/') + '/', '')),
      edgeFunctionNoPlaintextLogging: edgeFunctionCheck.ok,
      edgeFunctionLoggingIssues: edgeFunctionCheck.details,
      s3PayloadPrefix: 's3',
    },
    runtimeProof: {
      bridgeAvailable: runtimeCheck.available,
      bridgeHealthOnly: runtimeCheck.available,
      runtimeRequested,
      loginRunCompleted: runtimeProof.loginRunCompleted === true,
      persistenceScanClean: runtimeProof.persistenceScanClean === true,
      cleanupVerified: runtimeProof.cleanupVerified === true,
      authMatrixPassed: runtimeProof.authMatrixPassed === true,
      capturedLogsClean: runtimeProof.capturedLogsClean ?? null,
      tempLogsDeleted: runtimeProof.tempLogsDeleted ?? null,
      ...(runtimeProof.safeEvidence ? { evidence: runtimeProof.safeEvidence } : {}),
      ...(runtimeCheck.bridgeUrl ? { bridgeUrl: runtimeCheck.bridgeUrl } : {}),
      ...(runtimeProof.reason ?? runtimeCheck.reason ? { reason: runtimeProof.reason ?? runtimeCheck.reason } : {}),
      ...(runtimeCheck.healthStatus ? { healthStatus: runtimeCheck.healthStatus } : {}),
      // Runtime proof requires all of the following to be true for full_verified:
      runtimePrerequisites: [
        'Deployed credential-vault Edge Function with SUPABASE_SERVICE_ROLE_KEY and CREDENTIAL_VAULT_WORKER_TOKEN',
        'Worker runtime with CREDENTIAL_VAULT_WORKER_TOKEN env var',
        'Mobile MCP bridge reachable at MOBILE_MCP_BRIDGE_URL',
        'Connected Android device',
        'Disposable account credential supplied at runtime (never in source)',
        'Remote negative auth matrix executed',
        'Credential login macro executed through worker -> vault -> bridge',
        'Persistence scan clean (DB, artifacts, logs, reports)',
        'Disposable account cleanup verified',
      ],
    },
    overallVerdict,
    documentationClaims: 'remediation_pending',
    note: 'full_verified requires a completed credential login run, clean persistence scan, and verified cleanup. Bridge health alone is not proof.',
  };

  const reportJson = JSON.stringify(report, null, 2);
  console.log(reportJson);

  // Save report (unless --no-write-report is set)
  if (!noWriteReport) {
    const reportsDir = join(rootDir, 'plans', '260710-credential-boundary-remediation', 'reports');
    if (!existsSync(reportsDir)) {
      mkdirSync(reportsDir, { recursive: true });
    }
    const reportPath = join(reportsDir, `credential-boundary-verification-${timestamp()}.json`);
    writeFileSync(reportPath, reportJson, 'utf8');
    console.error(`Report saved to ${reportPath}`);
  }

  if (overallVerdict === 'failed') {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(JSON.stringify({ error: 'Verification script failed', name: err?.name ?? 'Unknown' }));
  process.exit(1);
});
