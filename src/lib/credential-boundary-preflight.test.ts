import { describe, expect, it, vi } from 'vitest';
// @ts-expect-error Plain ESM module executed by Node, no type declarations.
import { checkOptIn, validateEnvPrerequisites, checkBridgeHealth, checkWorkerHealth, checkOnlineDevice, checkVaultEndpoint, checkLogDirs, redactReport, runPreflight, readinessReport } from '../../scripts/credential-boundary-preflight.mjs';

// === Opt-in gate tests ===

describe('checkOptIn', () => {
  it('allows when both flag and env var are present', () => {
    const result = checkOptIn(['--run-real-proof'], { CREDENTIAL_BOUNDARY_ALLOW_REAL_PROOF: 'true' });
    expect(result.allowed).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it('blocks when neither flag nor env var is present', () => {
    const result = checkOptIn([], {});
    expect(result.allowed).toBe(false);
    expect(result.missing).toContain('--run-real-proof CLI flag');
    expect(result.missing).toContain('CREDENTIAL_BOUNDARY_ALLOW_REAL_PROOF=true env var');
  });

  it('blocks when only the CLI flag is present', () => {
    const result = checkOptIn(['--run-real-proof'], {});
    expect(result.allowed).toBe(false);
    expect(result.missing).toContain('CREDENTIAL_BOUNDARY_ALLOW_REAL_PROOF=true env var');
  });

  it('blocks when only the env var is present', () => {
    const result = checkOptIn([], { CREDENTIAL_BOUNDARY_ALLOW_REAL_PROOF: 'true' });
    expect(result.allowed).toBe(false);
    expect(result.missing).toContain('--run-real-proof CLI flag');
  });

  it('does not mutate data — purely validates', () => {
    const args = ['--run-real-proof'];
    const env = { CREDENTIAL_BOUNDARY_ALLOW_REAL_PROOF: 'true' };
    checkOptIn(args, env);
    expect(args).toEqual(['--run-real-proof']);
    expect(env).toEqual({ CREDENTIAL_BOUNDARY_ALLOW_REAL_PROOF: 'true' });
  });
});

// === Env prerequisite tests ===

describe('validateEnvPrerequisites', () => {
  const fullEnv = {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'sbp_key',
    SUPABASE_ANON_KEY: 'anon_key',
    CREDENTIAL_VAULT_WORKER_TOKEN: 'token',
    PROOF_OPERATOR_JWT: 'jwt',
    CREDENTIAL_BOUNDARY_CANARY: 'canary',
    MOBILE_MCP_BRIDGE_URL: 'http://127.0.0.1:4321',
    MOBILE_MCP_BRIDGE_TOKEN: 'bridge_token',
    WORKER_BASE_URL: 'http://127.0.0.1:4310',
  };

  it('passes when all required env vars are present', () => {
    expect(validateEnvPrerequisites(fullEnv)).toEqual({ passed: true, missing: [] });
  });

  it('fails when SUPABASE_URL is missing', () => {
    const result = validateEnvPrerequisites({ ...fullEnv, SUPABASE_URL: undefined });
    expect(result.passed).toBe(false);
    expect(result.missing).toContain('SUPABASE_URL');
  });

  it('fails when CREDENTIAL_BOUNDARY_CANARY is missing', () => {
    const result = validateEnvPrerequisites({ ...fullEnv, CREDENTIAL_BOUNDARY_CANARY: undefined });
    expect(result.passed).toBe(false);
    expect(result.missing).toContain('CREDENTIAL_BOUNDARY_CANARY');
  });

  it('fails when multiple env vars are missing', () => {
    const result = validateEnvPrerequisites({ SUPABASE_URL: 'x' });
    expect(result.passed).toBe(false);
    expect(result.missing.length).toBe(8);
  });

  it('passes with empty string values treated as missing', () => {
    const result = validateEnvPrerequisites({ ...fullEnv, PROOF_OPERATOR_JWT: '' });
    expect(result.passed).toBe(false);
    expect(result.missing).toContain('PROOF_OPERATOR_JWT');
  });
});

// === Bridge health tests ===

describe('checkBridgeHealth', () => {
  it('passes when health endpoint returns 200', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const result = await checkBridgeHealth('http://127.0.0.1:4321', mockFetch);
    expect(result.passed).toBe(true);
    expect(result.status).toBe(200);
  });

  it('fails when health endpoint returns 500', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    const result = await checkBridgeHealth('http://127.0.0.1:4321', mockFetch);
    expect(result.passed).toBe(false);
    expect(result.reason).toContain('500');
  });

  it('fails when bridge URL is not set', async () => {
    const result = await checkBridgeHealth('', vi.fn());
    expect(result.passed).toBe(false);
    expect(result.reason).toContain('not set');
  });

  it('fails when fetch throws (bridge unreachable)', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const result = await checkBridgeHealth('http://127.0.0.1:4321', mockFetch);
    expect(result.passed).toBe(false);
    expect(result.reason).toBe('bridge_unreachable');
  });
});

// === Worker health tests ===

describe('checkWorkerHealth', () => {
  it('passes when health endpoint returns 200', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const result = await checkWorkerHealth('http://127.0.0.1:4310', mockFetch);
    expect(result.passed).toBe(true);
  });

  it('fails when worker URL is not set', async () => {
    const result = await checkWorkerHealth('', vi.fn());
    expect(result.passed).toBe(false);
    expect(result.reason).toContain('not set');
  });

  it('fails when fetch throws (worker unreachable)', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const result = await checkWorkerHealth('http://127.0.0.1:4310', mockFetch);
    expect(result.passed).toBe(false);
    expect(result.reason).toBe('worker_unreachable');
  });
});

// === Online device tests ===

describe('checkOnlineDevice', () => {
  it('passes when at least one ONLINE device exists', async () => {
    const mockClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'dev-1', status: 'ONLINE' }, error: null }),
            }),
          }),
        }),
      }),
    };
    const result = await checkOnlineDevice(mockClient);
    expect(result.passed).toBe(true);
    expect(result.count).toBe(1);
  });

  it('fails when no ONLINE device exists', async () => {
    const mockClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      }),
    };
    const result = await checkOnlineDevice(mockClient);
    expect(result.passed).toBe(false);
    expect(result.reason).toBe('no_online_device');
  });

  it('fails when DB query returns an error', async () => {
    const mockClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: new Error('connection refused') }),
            }),
          }),
        }),
      }),
    };
    const result = await checkOnlineDevice(mockClient);
    expect(result.passed).toBe(false);
    expect(result.reason).toBe('db_query_error');
  });

  it('fails when no supabase client is provided', async () => {
    const result = await checkOnlineDevice(null);
    expect(result.passed).toBe(false);
    expect(result.reason).toBe('no_supabase_client');
  });
});

// === Vault endpoint tests ===

describe('checkVaultEndpoint', () => {
  it('passes when endpoint returns any non-404 response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 400 });
    const result = await checkVaultEndpoint('https://example.supabase.co', 'jwt', mockFetch);
    expect(result.passed).toBe(true);
    expect(result.status).toBe(400);
  });

  it('fails when endpoint returns 404', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    const result = await checkVaultEndpoint('https://example.supabase.co', 'jwt', mockFetch);
    expect(result.passed).toBe(false);
    expect(result.reason).toBe('vault_not_deployed');
  });

  it('fails when supabase URL is missing', async () => {
    const result = await checkVaultEndpoint('', 'jwt', vi.fn());
    expect(result.passed).toBe(false);
    expect(result.reason).toBe('supabase_url_missing');
  });

  it('fails when operator JWT is missing', async () => {
    const result = await checkVaultEndpoint('https://example.supabase.co', '', vi.fn());
    expect(result.passed).toBe(false);
    expect(result.reason).toBe('operator_jwt_missing');
  });

  it('fails when fetch throws (vault unreachable)', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const result = await checkVaultEndpoint('https://example.supabase.co', 'jwt', mockFetch);
    expect(result.passed).toBe(false);
    expect(result.reason).toBe('vault_unreachable');
  });
});

// === Log dir tests ===

describe('checkLogDirs', () => {
  it('passes when both dirs are set and gitignored', () => {
    const gitignore = 'logs/\n.credential-boundary-proof/\n';
    const result = checkLogDirs(
      '/tmp/logs/proof/worker',
      '/tmp/logs/proof/bridge',
      gitignore,
    );
    expect(result.passed).toBe(true);
    expect(result.dirs).toHaveLength(2);
    expect(result.dirs[0].ignored).toBe(true);
    expect(result.dirs[1].ignored).toBe(true);
  });

  it('fails when worker log dir is not set', () => {
    const result = checkLogDirs(null, '/tmp/bridge', 'logs/');
    expect(result.passed).toBe(false);
    expect(result.dirs[0].reason).toBe('not_set');
  });

  it('fails when bridge log dir is not set', () => {
    const result = checkLogDirs('/tmp/worker', null, 'logs/');
    expect(result.passed).toBe(false);
    expect(result.dirs[1].reason).toBe('not_set');
  });

  it('fails when dirs are not covered by gitignore', () => {
    const result = checkLogDirs('/tmp/worker', '/tmp/bridge', '');
    expect(result.passed).toBe(false);
    expect(result.dirs[0].ignored).toBe(false);
    expect(result.dirs[0].reason).toBe('not_gitignored');
  });
});

// === Report redaction tests ===

describe('redactReport', () => {
  it('redacts sensitive keys', () => {
    const report = {
      overallVerdict: 'blocked',
      password: 'secret123',
      token: 'abc-token',
      canary: 'DO_NOT_PERSIST_123',
      safe: { count: 5, status: 'pass' },
    };
    const redacted = redactReport(report);
    expect(redacted.overallVerdict).toBe('blocked');
    expect(redacted.password).toBe('[REDACTED]');
    expect(redacted.token).toBe('[REDACTED]');
    expect(redacted.canary).toBe('[REDACTED]');
    expect(redacted.safe.count).toBe(5);
    expect(redacted.safe.status).toBe('pass');
  });

  it('redacts nested sensitive values in arrays', () => {
    const report = {
      results: [
        { name: 'test', secret_key: 'key123' },
        { name: 'test2', plaintext: 'password' },
      ],
    };
    const redacted = redactReport(report);
    expect(redacted.results[0].secret_key).toBe('[REDACTED]');
    expect(redacted.results[1].plaintext).toBe('[REDACTED]');
    expect(redacted.results[0].name).toBe('test');
  });

  it('preserves non-sensitive values', () => {
    const report = {
      id: 'run-123',
      count: 42,
      passed: true,
      verdict: 'static_verified',
      hash: 'abc123',
    };
    const redacted = redactReport(report);
    expect(redacted).toEqual(report);
  });

  it('redacts encrypted_payload field', () => {
    const report = {
      encrypted_payload: 'v1:some-ciphertext-data',
      status: 'pass',
    };
    const redacted = redactReport(report);
    expect(redacted.encrypted_payload).toBe('[REDACTED]');
    expect(redacted.status).toBe('pass');
  });

  it('handles null and undefined values', () => {
    const report = { password: null, token: undefined, verdict: 'blocked' };
    const redacted = redactReport(report);
    expect(redacted.password).toBe('[REDACTED]');
    expect(redacted.token).toBe('[REDACTED]');
    expect(redacted.verdict).toBe('blocked');
  });
});

// === Full preflight tests ===

describe('runPreflight', () => {
  const fullEnv = {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'sbp_key',
    SUPABASE_ANON_KEY: 'anon_key',
    CREDENTIAL_VAULT_WORKER_TOKEN: 'token',
    PROOF_OPERATOR_JWT: 'jwt',
    CREDENTIAL_BOUNDARY_CANARY: 'canary',
    MOBILE_MCP_BRIDGE_URL: 'http://127.0.0.1:4321',
    MOBILE_MCP_BRIDGE_TOKEN: 'bridge_token',
    WORKER_BASE_URL: 'http://127.0.0.1:4310',
    CREDENTIAL_BOUNDARY_WORKER_LOG_DIR: '/tmp/worker',
    CREDENTIAL_BOUNDARY_BRIDGE_LOG_DIR: '/tmp/bridge',
  };
  const gitignore = 'logs/\n.credential-boundary-proof/\n';

  function mockFetchOk() {
    return vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200 }) // bridge
      .mockResolvedValueOnce({ ok: true, status: 200 }) // worker
      .mockResolvedValueOnce({ ok: false, status: 400 }); // vault (reachable)
  }

  function mockSupabaseWithDevice() {
    return {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'dev-1', status: 'ONLINE' }, error: null }),
            }),
          }),
        }),
      }),
    };
  }

  it('passes when all prerequisites are met', async () => {
    const result = await runPreflight({
      env: fullEnv,
      supabaseClient: mockSupabaseWithDevice(),
      fetchFn: mockFetchOk(),
      gitignoreContent: gitignore,
    });
    expect(result.passed).toBe(true);
    expect(result.failures).toEqual([]);
  });

  it('fails when env prerequisites are missing (skips network checks)', async () => {
    const fetchFn = vi.fn();
    const result = await runPreflight({
      env: { SUPABASE_URL: 'x' },
      supabaseClient: mockSupabaseWithDevice(),
      fetchFn,
      gitignoreContent: gitignore,
    });
    expect(result.passed).toBe(false);
    expect(result.failures.length).toBeGreaterThan(0);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('produces blocked result without mutation when missing prerequisite', async () => {
    const fetchFn = vi.fn();
    const result = await runPreflight({
      env: {},
      supabaseClient: null,
      fetchFn,
      gitignoreContent: gitignore,
    });
    expect(result.passed).toBe(false);
    expect(result.failures).toContain('SUPABASE_URL not set');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('fails when bridge health check fails', async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce({ ok: false, status: 503 });
    const result = await runPreflight({
      env: fullEnv,
      supabaseClient: mockSupabaseWithDevice(),
      fetchFn,
      gitignoreContent: gitignore,
    });
    expect(result.passed).toBe(false);
    expect(result.failures.some((f: string) => f.startsWith('bridge_health'))).toBe(true);
  });

  it('fails when no online device exists', async () => {
    const mockClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      }),
    };
    const result = await runPreflight({
      env: fullEnv,
      supabaseClient: mockClient,
      fetchFn: mockFetchOk(),
      gitignoreContent: gitignore,
    });
    expect(result.passed).toBe(false);
    expect(result.failures.some((f: string) => f.startsWith('online_device'))).toBe(true);
  });

  it('fails when vault endpoint is not deployed (404)', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200 }) // bridge
      .mockResolvedValueOnce({ ok: true, status: 200 }) // worker
      .mockResolvedValueOnce({ ok: false, status: 404 }); // vault not deployed
    const result = await runPreflight({
      env: fullEnv,
      supabaseClient: mockSupabaseWithDevice(),
      fetchFn,
      gitignoreContent: gitignore,
    });
    expect(result.passed).toBe(false);
    expect(result.failures.some((f: string) => f.startsWith('vault_endpoint'))).toBe(true);
  });

  it('fails when log dirs are not gitignored', async () => {
    const result = await runPreflight({
      env: fullEnv,
      supabaseClient: mockSupabaseWithDevice(),
      fetchFn: mockFetchOk(),
      gitignoreContent: '',
    });
    expect(result.passed).toBe(false);
    expect(result.failures.some((f: string) => f.includes('not_gitignored'))).toBe(true);
  });
});

// === Phase 6: Readiness report tests ===

describe('readinessReport', () => {
  const fullEnv = {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'sbp_key',
    SUPABASE_ANON_KEY: 'anon_key',
    CREDENTIAL_VAULT_WORKER_TOKEN: 'token',
    PROOF_OPERATOR_JWT: 'jwt',
    CREDENTIAL_BOUNDARY_CANARY: 'canary',
    MOBILE_MCP_BRIDGE_URL: 'http://127.0.0.1:4321',
    MOBILE_MCP_BRIDGE_TOKEN: 'bridge_token',
    WORKER_BASE_URL: 'http://127.0.0.1:4310',
    CREDENTIAL_BOUNDARY_EXISTING_WORKER_LOG_DIR: '/tmp/existing-worker-logs',
    CREDENTIAL_BOUNDARY_EXISTING_BRIDGE_LOG_DIR: '/tmp/existing-bridge-logs',
  };

  it('reports ready when all core prerequisites are present', () => {
    const result = readinessReport(fullEnv);
    expect(result.ready).toBe(true);
    expect(result.missing).toEqual([]);
    expect(result.present).toContain('SUPABASE_URL');
    expect(result.present).toContain('MOBILE_MCP_BRIDGE_TOKEN');
  });

  it('reports not ready when core prerequisites are missing', () => {
    const result = readinessReport({});
    expect(result.ready).toBe(false);
    expect(result.missing).toContain('SUPABASE_URL');
    expect(result.missing).toContain('CREDENTIAL_BOUNDARY_CANARY');
    expect(result.missing).toContain('MOBILE_MCP_BRIDGE_TOKEN');
  });

  it('lists missing prerequisites as labels only, never values', () => {
    const envWithSomeSecrets = {
      SUPABASE_URL: 'https://secret.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'sbp_super_secret_key_123',
      CREDENTIAL_VAULT_WORKER_TOKEN: 'worker_secret_token',
    };
    const result = readinessReport(envWithSomeSecrets);
    // Missing labels must not contain any secret values
    for (const label of result.missing) {
      expect(label).not.toContain('sbp_');
      expect(label).not.toContain('secret');
      expect(label).not.toContain('token');
      expect(label).not.toContain('key');
    }
    // Present labels must also be just names, not values
    for (const label of result.present) {
      expect(label).not.toContain('sbp_');
      expect(label).not.toContain('secret');
    }
  });

  it('includes optional existing-log-dir vars in the report', () => {
    const result = readinessReport({ ...fullEnv, CREDENTIAL_BOUNDARY_EXISTING_WORKER_LOG_DIR: undefined });
    expect(result.ready).toBe(true); // Core vars are present
    expect(result.missing).toContain('CREDENTIAL_BOUNDARY_EXISTING_WORKER_LOG_DIR');
    expect(result.present).toContain('CREDENTIAL_BOUNDARY_EXISTING_BRIDGE_LOG_DIR');
  });

  it('does not mutate the input env', () => {
    const env = { SUPABASE_URL: 'x' };
    const snapshot = { ...env };
    readinessReport(env);
    expect(env).toEqual(snapshot);
  });
});

// === Phase 6: Readiness output redaction tests ===

describe('readiness output redaction', () => {
  it('redactReport strips all secret values from a readiness result', () => {
    const readinessOutput = {
      ready: false,
      missing: ['SUPABASE_URL', 'CREDENTIAL_BOUNDARY_CANARY'],
      present: ['MOBILE_MCP_BRIDGE_URL'],
      preflight: {
        envPrerequisites: {
          passed: false,
          missing: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
        },
      },
      // Simulate an accidental leak of a secret value in a non-standard field
      leaked_service_key: 'sbp_super_secret_value',
      leaked_canary: 'DO_NOT_PERSIST_PASSWORD_123',
      leaked_token: 'worker-token-abc',
    };
    const redacted = redactReport(readinessOutput);
    // Safe fields preserved
    expect(redacted.ready).toBe(false);
    expect(redacted.missing).toEqual(['SUPABASE_URL', 'CREDENTIAL_BOUNDARY_CANARY']);
    expect(redacted.present).toEqual(['MOBILE_MCP_BRIDGE_URL']);
    // Secret values redacted
    expect(redacted.leaked_service_key).toBe('[REDACTED]');
    expect(redacted.leaked_canary).toBe('[REDACTED]');
    expect(redacted.leaked_token).toBe('[REDACTED]');
  });

  it('redactReport strips secrets from nested preflight checks', () => {
    const output = {
      checks: {
        bridgeHealth: { passed: true, status: 200 },
        envPrerequisites: {
          passed: false,
          missing: ['CREDENTIAL_VAULT_WORKER_TOKEN'],
        },
        vaultEndpoint: { passed: true, status: 400 },
      },
      // Simulate accidental leak
      secret: 'hidden_secret_value',
    };
    const redacted = redactReport(output);
    expect(redacted.checks.bridgeHealth.passed).toBe(true);
    expect(redacted.checks.envPrerequisites.missing).toEqual(['CREDENTIAL_VAULT_WORKER_TOKEN']);
    expect(redacted.checks.vaultEndpoint.status).toBe(400);
    expect(redacted.secret).toBe('[REDACTED]');
  });
});

// === Phase 6: No-opt-in no-mutation tests ===

describe('no-opt-in no-mutation contract', () => {
  it('checkOptIn returns allowed=false without touching env or args', () => {
    const args: string[] = [];
    const env = { CREDENTIAL_BOUNDARY_ALLOW_REAL_PROOF: 'false' };
    const result = checkOptIn(args, env);
    expect(result.allowed).toBe(false);
    expect(args).toEqual([]);
    expect(env).toEqual({ CREDENTIAL_BOUNDARY_ALLOW_REAL_PROOF: 'false' });
  });

  it('runPreflight with empty env does not call fetch (no network mutation)', async () => {
    const fetchFn = vi.fn();
    const result = await runPreflight({
      env: {},
      supabaseClient: null,
      fetchFn,
      gitignoreContent: 'logs/',
    });
    expect(result.passed).toBe(false);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('runPreflight with partial env does not call fetch (no network mutation)', async () => {
    const fetchFn = vi.fn();
    const result = await runPreflight({
      env: { SUPABASE_URL: 'x' },
      supabaseClient: null,
      fetchFn,
      gitignoreContent: 'logs/',
    });
    expect(result.passed).toBe(false);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

// === Phase 6: Blocked verdict is never success ===

describe('blocked verdict is never success', () => {
  it('a blocked manifest is rejected by validateProofManifest', async () => {
    // Import from the existing manifest test module's source
    // @ts-expect-error Plain ESM module executed by Node, no type declarations.
    const { validateProofManifest } = await import('../../scripts/credential-boundary-runtime-proof.mjs');
    const blockedManifest = {
      blocked: true,
      reason: 'preflight_failed',
      authMatrix: [],
      loginRun: { completed: false },
      persistenceScan: { surfaces: {} },
      cleanup: { verified: false },
    };
    const result = validateProofManifest(blockedManifest);
    expect(result.ok).toBe(false);
    expect(result.authMatrixPassed).toBe(false);
    expect(result.cleanupVerified).toBe(false);
  });

  it('redactReport preserves blocked verdict as blocked, never upgrades', () => {
    const report = {
      verdict: 'blocked',
      realProofExecuted: false,
      reason: 'opt-in required',
      password: 'leaked',
    };
    const redacted = redactReport(report);
    expect(redacted.verdict).toBe('blocked');
    expect(redacted.realProofExecuted).toBe(false);
    expect(redacted.reason).toBe('opt-in required');
    expect(redacted.password).toBe('[REDACTED]');
  });

  it('readinessReport never claims ready when core vars are missing', () => {
    const almostReady = {
      SUPABASE_URL: 'https://x.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'key',
      SUPABASE_ANON_KEY: 'anon',
      CREDENTIAL_VAULT_WORKER_TOKEN: 'token',
      PROOF_OPERATOR_JWT: 'jwt',
      // Missing: CREDENTIAL_BOUNDARY_CANARY, MOBILE_MCP_BRIDGE_URL, MOBILE_MCP_BRIDGE_TOKEN, WORKER_BASE_URL
    };
    const result = readinessReport(almostReady);
    expect(result.ready).toBe(false);
  });
});
