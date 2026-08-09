import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { spawn } from 'node:child_process';
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const orchestratorScript = join(rootDir, 'scripts', 'run-credential-boundary-proof.mjs');
const isWindows = process.platform === 'win32';

// Disposable sentinel values — never real credentials.
const SENTINELS = {
  serviceRoleKey: 'SENTINEL_SERVICE_ROLE_KEY_0xDEADBEEF',
  workerToken: 'SENTINEL_WORKER_TOKEN_0xCAFEBABE',
  bridgeToken: 'SENTINEL_BRIDGE_TOKEN_0xBEEFCAFE',
  operatorJwt: 'SENTINEL_OPERATOR_JWT_0xFACEFEED',
  canary: 'SENTINEL_CANARY_0x123456789ABCDEF',
  supabaseUrl: 'https://sentinel-nonexistent.supabase.co',
  anonKey: 'SENTINEL_ANON_KEY_0xABCDEF',
};

// All sentinel values concatenated for leak scanning.
const ALL_SENTINEL_VALUES = Object.values(SENTINELS);

/**
 * Spawn the orchestrator with a fully isolated environment.
 * Prevents developer-local .env from leaking into the test.
 */
function spawnOrchestrator(args: string[], envOverrides: Record<string, string | undefined> = {}): Promise<{
  exitCode: number;
  stdout: string;
  stderr: string;
}> {
  return new Promise((resolvePromise) => {
    // Build a clean env and explicitly suppress the orchestrator's root .env
    // loader so a developer-local credential can never complete the proof.
    const cleanEnv: Record<string, string> = {
      PATH: process.env.PATH ?? '',
      CREDENTIAL_BOUNDARY_SKIP_DOTENV: 'true',
      ...envOverrides,
    };

    // On Windows, we need SystemRoot for node to function.
    if (isWindows) {
      cleanEnv.SystemRoot = process.env.SystemRoot ?? 'C:\\Windows';
      cleanEnv.USERPROFILE = process.env.USERPROFILE ?? '';
      cleanEnv.LOCALAPPDATA = process.env.LOCALAPPDATA ?? '';
      cleanEnv.APPDATA = process.env.APPDATA ?? '';
      cleanEnv.TEMP = process.env.TEMP ?? '';
      cleanEnv.TMP = process.env.TMP ?? '';
    }

    const child = spawn('node', [orchestratorScript, ...args], {
      cwd: rootDir,
      env: cleanEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

    child.on('close', (code) => {
      resolvePromise({
        exitCode: code ?? 1,
        stdout: Buffer.concat(stdoutChunks).toString('utf8'),
        stderr: Buffer.concat(stderrChunks).toString('utf8'),
      });
    });
  });
}

/**
 * Scan a string for any sentinel values that should never appear in output.
 */
function findSentinelLeaks(text: string): string[] {
  const leaks: string[] = [];
  for (const [name, value] of Object.entries(SENTINELS)) {
    if (text.includes(value)) {
      leaks.push(name);
    }
  }
  return leaks;
}

/**
 * Find proof-log directories created by the orchestrator.
 */
function findProofLogDirs(): string[] {
  const logsDir = join(rootDir, 'logs');
  if (!existsSync(logsDir)) return [];
  return readdirSync(logsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('credential-boundary-proof-'))
    .map((entry) => join(logsDir, entry.name));
}

// Track proof log dirs that existed before tests so we don't clean up
// pre-existing ones from prior manual runs.
let preExistingProofLogDirs: string[] = [];

beforeAll(() => {
  preExistingProofLogDirs = findProofLogDirs();
});

afterAll(() => {
  // Clean up any proof-log dirs created during tests (not pre-existing ones).
  const currentDirs = findProofLogDirs();
  for (const dir of currentDirs) {
    if (!preExistingProofLogDirs.includes(dir)) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('orchestrator contract: no opt-in', () => {
  it('exits non-zero with blocked verdict and realProofExecuted=false', async () => {
    const result = await spawnOrchestrator([]);

    expect(result.exitCode).not.toBe(0);

    const parsed = JSON.parse(result.stdout.trim());
    expect(parsed.verdict).toBe('blocked');
    expect(parsed.realProofExecuted).toBe(false);
    expect(parsed.reason).toBe('opt-in required');
  }, 30000);

  it('includes required opt-in labels in the output', async () => {
    const result = await spawnOrchestrator([]);

    const parsed = JSON.parse(result.stdout.trim());
    expect(parsed.optIn).toBeDefined();
    expect(parsed.optIn.allowed).toBe(false);
    expect(parsed.optIn.missing).toContain('--run-real-proof CLI flag');
    expect(parsed.optIn.missing).toContain('CREDENTIAL_BOUNDARY_ALLOW_REAL_PROOF=true env var');
  }, 30000);

  it('never leaks sentinel secret values in stdout or stderr', async () => {
    // Provide sentinel values as env vars to verify they are NOT echoed back.
    const envWithSentinels: Record<string, string> = {
      SUPABASE_URL: SENTINELS.supabaseUrl,
      SUPABASE_SERVICE_ROLE_KEY: SENTINELS.serviceRoleKey,
      SUPABASE_ANON_KEY: SENTINELS.anonKey,
      CREDENTIAL_VAULT_WORKER_TOKEN: SENTINELS.workerToken,
      PROOF_OPERATOR_JWT: SENTINELS.operatorJwt,
      CREDENTIAL_BOUNDARY_CANARY: SENTINELS.canary,
      MOBILE_MCP_BRIDGE_URL: 'http://127.0.0.1:4321',
      MOBILE_MCP_BRIDGE_TOKEN: SENTINELS.bridgeToken,
      WORKER_BASE_URL: 'http://127.0.0.1:4310',
    };

    const result = await spawnOrchestrator([], envWithSentinels);

    const stdoutLeaks = findSentinelLeaks(result.stdout);
    const stderrLeaks = findSentinelLeaks(result.stderr);
    expect(stdoutLeaks).toEqual([]);
    expect(stderrLeaks).toEqual([]);
  }, 30000);

  it('does not leave a proof-log directory behind', async () => {
    const beforeCount = findProofLogDirs().length;
    await spawnOrchestrator([]);
    const afterCount = findProofLogDirs().length;
    // The orchestrator should clean up its temp proof-log dir on the no-opt-in path.
    expect(afterCount).toBe(beforeCount);
  }, 30000);
});

describe('orchestrator contract: missing prerequisites with sentinel env', () => {
  it('readiness lists labels only, never emits values', async () => {
    const envWithSomeSentinels: Record<string, string> = {
      SUPABASE_URL: SENTINELS.supabaseUrl,
      SUPABASE_SERVICE_ROLE_KEY: SENTINELS.serviceRoleKey,
      // Intentionally omit: SUPABASE_ANON_KEY, CREDENTIAL_VAULT_WORKER_TOKEN, etc.
    };

    const result = await spawnOrchestrator([], envWithSomeSentinels);

    const parsed = JSON.parse(result.stdout.trim());
    expect(parsed.readiness).toBeDefined();
    expect(parsed.readiness.ready).toBe(false);

    // Missing labels must be variable NAMES only, never values.
    for (const label of parsed.readiness.missing) {
      expect(typeof label).toBe('string');
      // No sentinel value should appear in any label.
      for (const sentinelValue of ALL_SENTINEL_VALUES) {
        expect(label).not.toContain(sentinelValue);
      }
    }

    // Present labels must also be names only.
    for (const label of parsed.readiness.present) {
      expect(typeof label).toBe('string');
      for (const sentinelValue of ALL_SENTINEL_VALUES) {
        expect(label).not.toContain(sentinelValue);
      }
    }

    // Verify the sentinel values we provided are NOT echoed back anywhere.
    const stdoutLeaks = findSentinelLeaks(result.stdout);
    const stderrLeaks = findSentinelLeaks(result.stderr);
    expect(stdoutLeaks).toEqual([]);
    expect(stderrLeaks).toEqual([]);
  }, 30000);

  it('remains blocked, never static_verified or full_verified', async () => {
    const result = await spawnOrchestrator([], {
      SUPABASE_URL: SENTINELS.supabaseUrl,
      SUPABASE_SERVICE_ROLE_KEY: SENTINELS.serviceRoleKey,
    });

    const parsed = JSON.parse(result.stdout.trim());
    expect(parsed.verdict).toBe('blocked');
    expect(parsed.verdict).not.toBe('static_verified');
    expect(parsed.verdict).not.toBe('full_verified');
    expect(parsed.realProofExecuted).toBe(false);
  }, 30000);
});

describe('orchestrator contract: opt-in with incomplete prerequisites', () => {
  it('fails before service startup or harness invocation', async () => {
    // Provide both opt-ins but omit most core prerequisites.
    // The orchestrator should fail at preflight and never start services.
    const envPartial: Record<string, string> = {
      CREDENTIAL_BOUNDARY_ALLOW_REAL_PROOF: 'true',
      SUPABASE_URL: SENTINELS.supabaseUrl,
      SUPABASE_SERVICE_ROLE_KEY: SENTINELS.serviceRoleKey,
      // Intentionally omit: SUPABASE_ANON_KEY, CREDENTIAL_VAULT_WORKER_TOKEN,
      // PROOF_OPERATOR_JWT, CREDENTIAL_BOUNDARY_CANARY, MOBILE_MCP_BRIDGE_URL,
      // MOBILE_MCP_BRIDGE_TOKEN, WORKER_BASE_URL
    };

    const result = await spawnOrchestrator(['--run-real-proof'], envPartial);

    expect(result.exitCode).not.toBe(0);

    const parsed = JSON.parse(result.stdout.trim());
    expect(parsed.verdict).toBe('blocked');
    expect(parsed.realProofExecuted).toBe(false);
    expect(parsed.reason).toBe('preflight_failed');

    // Preflight should report missing env vars.
    expect(parsed.preflight).toBeDefined();
    expect(parsed.preflight.passed).toBe(false);
    expect(parsed.preflight.failures.length).toBeGreaterThan(0);

    // Some specific missing vars should appear as labels.
    const failures = parsed.preflight.failures.join(' ');
    expect(failures).toContain('SUPABASE_ANON_KEY');
    expect(failures).toContain('CREDENTIAL_VAULT_WORKER_TOKEN');
    expect(failures).toContain('CREDENTIAL_BOUNDARY_CANARY');
  }, 30000);

  it('does not launch child services (no service startup output)', async () => {
    const envPartial: Record<string, string> = {
      CREDENTIAL_BOUNDARY_ALLOW_REAL_PROOF: 'true',
      SUPABASE_URL: SENTINELS.supabaseUrl,
      SUPABASE_SERVICE_ROLE_KEY: SENTINELS.serviceRoleKey,
    };

    const result = await spawnOrchestrator(['--run-real-proof'], envPartial);

    // The orchestrator should NOT print service-start messages because
    // preflight fails before the service-lifecycle section.
    expect(result.stderr).not.toContain('starting');
    expect(result.stderr).not.toContain('healthy');
    expect(result.stderr).not.toContain('mobile-mcp-bridge');
    expect(result.stderr).not.toContain('execution-worker');
  }, 30000);

  it('does not leave a proof-log directory behind', async () => {
    const beforeCount = findProofLogDirs().length;
    await spawnOrchestrator(['--run-real-proof'], {
      CREDENTIAL_BOUNDARY_ALLOW_REAL_PROOF: 'true',
      SUPABASE_URL: SENTINELS.supabaseUrl,
    });
    const afterCount = findProofLogDirs().length;
    expect(afterCount).toBe(beforeCount);
  }, 30000);

  it('never leaks sentinel values even with opt-in and incomplete prerequisites', async () => {
    const envPartial: Record<string, string> = {
      CREDENTIAL_BOUNDARY_ALLOW_REAL_PROOF: 'true',
      SUPABASE_URL: SENTINELS.supabaseUrl,
      SUPABASE_SERVICE_ROLE_KEY: SENTINELS.serviceRoleKey,
      CREDENTIAL_VAULT_WORKER_TOKEN: SENTINELS.workerToken,
      PROOF_OPERATOR_JWT: SENTINELS.operatorJwt,
      CREDENTIAL_BOUNDARY_CANARY: SENTINELS.canary,
      MOBILE_MCP_BRIDGE_TOKEN: SENTINELS.bridgeToken,
    };

    const result = await spawnOrchestrator(['--run-real-proof'], envPartial);

    const stdoutLeaks = findSentinelLeaks(result.stdout);
    const stderrLeaks = findSentinelLeaks(result.stderr);
    expect(stdoutLeaks).toEqual([]);
    expect(stderrLeaks).toEqual([]);
  }, 30000);

  it('blocked verdict is never presented as success', async () => {
    const result = await spawnOrchestrator(['--run-real-proof'], {
      CREDENTIAL_BOUNDARY_ALLOW_REAL_PROOF: 'true',
      SUPABASE_URL: SENTINELS.supabaseUrl,
    });

    const parsed = JSON.parse(result.stdout.trim());
    expect(parsed.verdict).toBe('blocked');
    expect(parsed.verdict).not.toBe('full_verified');
    expect(parsed.verdict).not.toBe('static_verified');
    expect(parsed.realProofExecuted).toBe(false);
    // Exit code must be non-zero for blocked.
    expect(result.exitCode).not.toBe(0);
  }, 30000);
});
