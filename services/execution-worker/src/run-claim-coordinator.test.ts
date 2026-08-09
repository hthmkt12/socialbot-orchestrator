import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));

vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createClient }));

import { getCredentialVaultServiceRoleKey, RunClaimCoordinator, type WorkerConfig } from './run-claim-coordinator';

const config: WorkerConfig = {
  port: 4310,
  pollIntervalMs: 1000,
  leaseTtlMs: 30_000,
  maxActiveClaims: 2,
  instanceId: 'worker-test',
  supabaseUrl: 'http://127.0.0.1:54321',
  supabaseServiceRoleKey: 'synthetic-service-key',
  credentialVaultWorkerToken: 'synthetic-vault-token',
  gatewayBaseUrl: 'http://127.0.0.1:8080',
  mobileMcpBridgeUrl: 'http://127.0.0.1:8765',
  deviceBackend: 'mobile-mcp',
  commandTimeoutMs: 1000,
};

function createQueryChain(result: { data: unknown; error: unknown }) {
  const chain = {
    update: vi.fn(() => chain),
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    lt: vi.fn(() => chain),
    is: vi.fn(() => chain),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  return chain;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('RunClaimCoordinator health snapshot', () => {
  it('uses the dedicated credential boundary key when configured', () => {
    expect(getCredentialVaultServiceRoleKey({
      supabaseServiceRoleKey: 'worker-db-key',
      credentialVaultServiceRoleKey: 'boundary-key',
    })).toBe('boundary-key');
  });

  it('falls back to the worker service key when no dedicated key is configured', () => {
    expect(getCredentialVaultServiceRoleKey({ supabaseServiceRoleKey: 'worker-db-key' })).toBe('worker-db-key');
  });

  it('does not expose active claim tokens', () => {
    const coordinator = new RunClaimCoordinator(config);
    const activeClaims = (coordinator as unknown as {
      activeClaims: Map<string, {
        claimToken: string;
        claimedAt: string;
        leaseExpiresAt: string;
      }>;
    }).activeClaims;

    activeClaims.set('run-1', {
      claimToken: 'claim-token-canary',
      claimedAt: '2026-08-01T00:00:00.000Z',
      leaseExpiresAt: '2026-08-01T00:01:00.000Z',
    });

    const snapshot = coordinator.getHealthSnapshot();

    expect(snapshot.activeClaimCount).toBe(1);
    expect(snapshot.activeClaims).toEqual([{
      runId: 'run-1',
      claimedAt: '2026-08-01T00:00:00.000Z',
      leaseExpiresAt: '2026-08-01T00:01:00.000Z',
    }]);
    expect(JSON.stringify(snapshot)).not.toContain('claim-token-canary');
  });

  it('reclaims an expired queued claim and calls its handler once', async () => {
    const query = createQueryChain({
      data: {
        id: 'run-1',
        status: 'QUEUED',
        target_type: 'MULTI_DEVICE',
        summary_json: {},
        execution_lease_expires_at: '2026-07-31T23:59:00.000Z',
        execution_claim_token: 'old-token',
        created_at: '2026-07-31T23:00:00.000Z',
      },
      error: null,
    });
    const supabase = { from: vi.fn(() => query) };
    const onClaim = vi.fn().mockResolvedValue(undefined);
    mocks.createClient.mockReturnValue(supabase);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const coordinator = new RunClaimCoordinator(config, onClaim);
    await (coordinator as unknown as {
      tryClaimRun: (run: unknown, isReclaim: boolean, nowIso: string) => Promise<void>;
    }).tryClaimRun({
      id: 'run-1',
      status: 'QUEUED',
      target_type: 'MULTI_DEVICE',
      summary_json: {},
      execution_lease_expires_at: '2026-07-31T23:59:00.000Z',
      execution_claim_token: 'old-token',
      created_at: '2026-07-31T23:00:00.000Z',
    }, true, '2026-08-01T00:00:00.000Z');

    expect(query.lt).toHaveBeenCalledWith('execution_lease_expires_at', '2026-08-01T00:00:00.000Z');
    expect(onClaim).toHaveBeenCalledTimes(1);
    expect(onClaim.mock.calls[0]?.[0]).toMatchObject({ runId: 'run-1', targetType: 'MULTI_DEVICE' });
  });

  it('drops mismatched active claims without renewing ownership', async () => {
    const query = createQueryChain({
      data: { status: 'RUNNING', execution_claim_token: 'different-token', summary_json: {} },
      error: null,
    });
    mocks.createClient.mockReturnValue({ from: vi.fn(() => query) });
    const coordinator = new RunClaimCoordinator(config);
    const activeClaims = (coordinator as unknown as { activeClaims: Map<string, unknown> }).activeClaims;
    activeClaims.set('run-1', {
      claimToken: 'owned-token',
      claimedAt: '2026-08-01T00:00:00.000Z',
      leaseExpiresAt: '2026-08-01T00:01:00.000Z',
    });

    await (coordinator as unknown as { renewActiveClaims: () => Promise<void> }).renewActiveClaims();

    expect(query.update).not.toHaveBeenCalled();
    expect(activeClaims.has('run-1')).toBe(false);
  });

  it('does not reclaim an actively leased queued run', async () => {
    const query = createQueryChain({ data: null, error: null });
    mocks.createClient.mockReturnValue({ from: vi.fn(() => query) });
    const onClaim = vi.fn().mockResolvedValue(undefined);
    const coordinator = new RunClaimCoordinator(config, onClaim);

    await (coordinator as unknown as {
      tryClaimRun: (run: unknown, isReclaim: boolean, nowIso: string) => Promise<void>;
    }).tryClaimRun({
      id: 'run-1',
      status: 'QUEUED',
      target_type: 'SINGLE_DEVICE',
      summary_json: {},
      execution_lease_expires_at: '2026-08-01T00:01:00.000Z',
      execution_claim_token: 'active-token',
      created_at: '2026-08-01T00:00:00.000Z',
    }, true, '2026-08-01T00:00:00.000Z');

    expect(query.lt).toHaveBeenCalledWith('execution_lease_expires_at', '2026-08-01T00:00:00.000Z');
    expect(onClaim).not.toHaveBeenCalled();
  });
});
