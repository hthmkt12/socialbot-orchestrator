/**
 * Controlled runtime-proof adapter.
 *
 * The environment-specific harness creates and removes the disposable account,
 * runs the credential macro, and prints one safe JSON manifest to stdout. This
 * adapter captures its output, scans it before deletion, and refuses to turn
 * incomplete evidence into a passing result.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const REQUIRED_SURFACES = ['database', 'artifactMetadata', 'artifactObjects', 'workerLogs', 'bridgeLogs', 'reports'];

export function validateProofManifest(value) {
  if (!value || typeof value !== 'object') return { ok: false, reason: 'proof harness did not emit a JSON object' };
  const manifest = value;
  const authCases = Array.isArray(manifest.authMatrix) ? manifest.authMatrix : [];
  const scanSurfaces = manifest.persistenceScan?.surfaces ?? {};
  const authMatrixPassed = authCases.length > 0 && authCases.every((item) => item?.status === 'pass');
  const scansComplete = REQUIRED_SURFACES.every((name) => scanSurfaces[name]?.scanned === true && scanSurfaces[name]?.clean === true);
  const loginRunCompleted = manifest.loginRun?.completed === true && typeof manifest.loginRun?.id === 'string';
  const cleanupVerified = manifest.cleanup?.verified === true;
  return {
    ok: authMatrixPassed && scansComplete && loginRunCompleted && cleanupVerified,
    authMatrixPassed,
    loginRunCompleted,
    persistenceScanClean: scansComplete,
    cleanupVerified,
    safeEvidence: {
      authCaseCount: authCases.length,
      authCases: authCases.map((item) => ({ name: String(item?.name ?? 'unknown'), status: item?.status === 'pass' ? 'pass' : 'fail' })),
      loginRunId: loginRunCompleted ? manifest.loginRun.id : null,
      scanCounts: Object.fromEntries(REQUIRED_SURFACES.map((name) => [name, Number(scanSurfaces[name]?.count ?? 0)])),
      cleanupAccountId: cleanupVerified && typeof manifest.cleanup?.accountId === 'string' ? manifest.cleanup.accountId : null,
    },
  };
}

export async function runCredentialBoundaryRuntimeProof({ rootDir, env, canary, proofCommand }) {
  if (!proofCommand) {
    return { attempted: false, prerequisitesReady: false, reason: 'CREDENTIAL_BOUNDARY_PROOF_COMMAND is required for a controlled runtime proof' };
  }

  const tempDir = join(rootDir, 'logs', `credential-boundary-proof-${Date.now()}`);
  mkdirSync(tempDir, { recursive: true });
  const stdoutPath = join(tempDir, 'proof.stdout.log');
  const stderrPath = join(tempDir, 'proof.stderr.log');
  const child = spawn(proofCommand, [], {
    cwd: rootDir,
    env: { ...env, CREDENTIAL_BOUNDARY_CANARY: canary },
    shell: true,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const stdout = [];
  const stderr = [];
  child.stdout.on('data', (chunk) => stdout.push(chunk));
  child.stderr.on('data', (chunk) => stderr.push(chunk));
  const exitCode = await new Promise((resolve) => child.on('close', (code) => resolve(code ?? 1)));
  writeFileSync(stdoutPath, Buffer.concat(stdout));
  writeFileSync(stderrPath, Buffer.concat(stderr));

  const combined = `${readFileSync(stdoutPath, 'utf8')}\n${readFileSync(stderrPath, 'utf8')}`;
  const canaryFoundInCapturedLogs = combined.includes(canary);
  let manifest = null;
  try {
    manifest = JSON.parse(readFileSync(stdoutPath, 'utf8').trim());
  } catch {
    // The result below remains failed/blocked without exposing child output.
  }
  const validated = validateProofManifest(manifest);
  rmSync(tempDir, { recursive: true, force: true });
  return {
    attempted: true,
    prerequisitesReady: exitCode === 0,
    exitCode,
    ...validated,
    persistenceScanClean: Boolean(validated.persistenceScanClean) && !canaryFoundInCapturedLogs,
    capturedLogsClean: !canaryFoundInCapturedLogs,
    tempLogsDeleted: !existsSync(tempDir),
    reason: validated.ok ? undefined : validated.reason ?? 'runtime proof evidence is incomplete or failed',
  };
}
