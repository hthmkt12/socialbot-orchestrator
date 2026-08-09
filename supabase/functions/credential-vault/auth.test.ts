import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Authorization tests for the credential-vault Edge Function.
 *
 * Tests the handler-owned auth contract:
 * - encrypt: real user JWT via auth.getUser() + OPERATOR/ADMIN role
 * - migrate/dry-run: real user JWT via auth.getUser() + ADMIN role
 * - decrypt: exact service-role bearer + X-Credential-Vault-Worker-Token,
 *   plus active run/claim/account binding
 * - Unknown/missing action returns 400
 */

// --- Set up Deno global BEFORE any imports that use it ---
const envStore: Record<string, string | undefined> = {};

// Capture the Deno.serve handler
let serveHandler: (req: Request) => Promise<Response>;

// Install Deno global immediately so the module-level Deno.serve() in index.ts works
const denoStub = {
  serve: vi.fn((handler: (req: Request) => Promise<Response>) => {
    serveHandler = handler;
  }),
  env: {
    get: vi.fn((key: string) => envStore[key]),
  },
};
(globalThis as Record<string, unknown>).Deno = denoStub;

// Mock @supabase/supabase-js — shared mock functions
const mockAuthGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock('npm:@supabase/supabase-js@2.57.4', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockAuthGetUser },
    from: mockFrom,
  })),
}));

// Dynamic import after Deno global is set up
let handlerReady = false;
async function ensureHandler() {
  if (handlerReady) return;
  await import('./index.ts');
  handlerReady = true;
}

// --- Test constants ---
const SERVICE_ROLE_KEY = 'test-service-role-key-for-vault-tests-aaaa';
const WORKER_TOKEN = 'test-worker-token-for-vault-tests-bbbb';
const SERVER_CREDENTIAL_KEY = 'test-server-credential-key-32-chars-min!!';
const ANON_KEY = 'test-anon-key';
const SUPABASE_URL = 'https://test.supabase.co';
const VALID_USER_JWT = 'eyJvalid-user-jwt-for-operator';
const VALID_ADMIN_JWT = 'eyJvalid-user-jwt-for-admin';
const MALFORMED_JWT = 'not.a.valid.jwt';

function setupEnv(overrides: Record<string, string | undefined> = {}) {
  envStore.SUPABASE_URL = SUPABASE_URL;
  envStore.SUPABASE_ANON_KEY = ANON_KEY;
  envStore.SUPABASE_SERVICE_ROLE_KEY = SERVICE_ROLE_KEY;
  envStore.SERVER_CREDENTIAL_KEY = SERVER_CREDENTIAL_KEY;
  envStore.CREDENTIAL_VAULT_WORKER_TOKEN = WORKER_TOKEN;
  envStore.CREDENTIAL_VAULT_ALLOWED_ORIGIN = undefined;
  envStore.LEGACY_PILOT_KEY = undefined;
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) delete envStore[k];
    else envStore[k] = v;
  }
}

function makeRequest(opts: {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...opts.headers,
  };
  return new Request(`${SUPABASE_URL}/functions/v1/credential-vault`, {
    method: opts.method ?? 'POST',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

async function callHandler(opts: {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
}): Promise<{ status: number; json: Record<string, unknown>; headers: Headers }> {
  const req = makeRequest(opts);
  const res = await serveHandler(req);
  const json = await res.json();
  return { status: res.status, json, headers: res.headers };
}

/** Set up auth.getUser to return a user with the given role, plus profile lookup */
function setupAuthUser(role: 'OPERATOR' | 'ADMIN' | 'VIEWER' | null) {
  if (role === null) {
    mockAuthGetUser.mockReturnValueOnce(Promise.resolve({
      data: { user: null },
      error: { message: 'Invalid JWT' },
    }));
    return;
  }
  mockAuthGetUser.mockReturnValueOnce(Promise.resolve({
    data: { user: { id: `user-${role.toLowerCase()}` } },
    error: null,
  }));
  // Profile lookup: from('profiles').select('role').eq('user_id', ...).maybeSingle()
  const maybeSingle = vi.fn().mockResolvedValueOnce({
    data: { role },
    error: null,
  });
  mockFrom.mockReturnValueOnce({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({ maybeSingle }),
    }),
  });
}

/** Set up run + account query chain for decrypt */
function setupRunAndAccount(opts: {
  status?: string;
  claimToken?: string;
  accountId?: string;
  encryptedPassword?: string;
}) {
  const runData = {
    id: 'run-1',
    status: opts.status ?? 'RUNNING',
    execution_claim_token: opts.claimToken ?? 'valid-claim-token',
    input_variables_json: { accountId: opts.accountId ?? 'account-1' },
  };
  const accountData = {
    id: opts.accountId ?? 'account-1',
    encrypted_password: opts.encryptedPassword ?? 's3:1:dGVzdA=:dGVzdA=',
  };

  // First from() call: workflow_runs
  mockFrom.mockReturnValueOnce({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValueOnce({ data: runData, error: null }),
      }),
    }),
  });
  // Second from() call: accounts
  mockFrom.mockReturnValueOnce({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValueOnce({ data: accountData, error: null }),
      }),
    }),
  });
}

/** Set up run query returning null (run not found) */
function setupNoRun() {
  mockFrom.mockReturnValueOnce({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValueOnce({ data: null, error: null }),
      }),
    }),
  });
}

/** Set up dry-run query (accounts LIKE v2:%) */
function setupDryRunQuery(rows: Array<{ id: string }> = []) {
  mockFrom.mockReturnValueOnce({
    select: vi.fn().mockReturnValue({
      like: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValueOnce({ data: rows, error: null }),
      }),
    }),
  });
}

describe('credential-vault authorization', () => {
  beforeEach(async () => {
    // Reset mock state but keep the factory-created implementations
    mockAuthGetUser.mockReset();
    mockFrom.mockReset();
    setupEnv();
    await ensureHandler();
  });

  describe('CORS origin policy', () => {
    it('allows only the configured browser origin', async () => {
      setupEnv({ CREDENTIAL_VAULT_ALLOWED_ORIGIN: 'https://app.example.com' });
      const req = makeRequest({
        method: 'OPTIONS',
        headers: { Origin: 'https://app.example.com' },
      });
      const res = await serveHandler(req);

      expect(res.status).toBe(204);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example.com');
    });

    it('rejects an untrusted browser origin', async () => {
      setupEnv({ CREDENTIAL_VAULT_ALLOWED_ORIGIN: 'https://app.example.com' });
      const result = await callHandler({
        headers: { Origin: 'https://evil.example.com' },
        body: { action: 'encrypt', plaintext: 'test' },
      });

      expect(result.status).toBe(403);
      expect(result.headers.get('Access-Control-Allow-Origin')).not.toBe('*');
      expect(result.headers.get('Access-Control-Allow-Origin')).not.toBe('https://evil.example.com');
    });
  });

  describe('unknown/missing action', () => {
    it('returns 400 for a JSON null body instead of treating it as an internal error', async () => {
      const result = await callHandler({ body: null });
      expect(result.status).toBe(400);
      expect(result.json.error).toBe('Invalid JSON body.');
    });

    it('returns 400 for unknown action', async () => {
      // auth.getUser is called for non-decrypt actions, set it up
      setupAuthUser('OPERATOR');
      const result = await callHandler({
        headers: { Authorization: `Bearer ${VALID_USER_JWT}` },
        body: { action: 'bogus' },
      });
      expect(result.status).toBe(400);
    });

    it('returns 400 for missing action when body has no action field', async () => {
      setupAuthUser('OPERATOR');
      const result = await callHandler({
        headers: { Authorization: `Bearer ${VALID_USER_JWT}` },
        body: { plaintext: 'some-password' },
      });
      expect(result.status).toBe(400);
    });
  });

  describe('no authorization', () => {
    it('returns 401 for missing Authorization header on encrypt', async () => {
      const result = await callHandler({
        body: { action: 'encrypt', plaintext: 'test' },
      });
      expect(result.status).toBe(401);
    });
  });

  describe('malformed user JWT', () => {
    it('returns 401 for a malformed JWT on encrypt', async () => {
      setupAuthUser(null);
      const result = await callHandler({
        headers: { Authorization: `Bearer ${MALFORMED_JWT}` },
        body: { action: 'encrypt', plaintext: 'test' },
      });
      expect(result.status).toBe(401);
    });
  });

  describe('encrypt authorization', () => {
    it('allows OPERATOR to encrypt', async () => {
      setupAuthUser('OPERATOR');
      const result = await callHandler({
        headers: { Authorization: `Bearer ${VALID_USER_JWT}` },
        body: { action: 'encrypt', plaintext: 'my-secret-password' },
      });
      expect(result.status).toBe(200);
      expect(result.json.encryptedPayload).toBeDefined();
    });

    it('allows ADMIN to encrypt', async () => {
      setupAuthUser('ADMIN');
      const result = await callHandler({
        headers: { Authorization: `Bearer ${VALID_ADMIN_JWT}` },
        body: { action: 'encrypt', plaintext: 'my-secret-password' },
      });
      expect(result.status).toBe(200);
      expect(result.json.encryptedPayload).toBeDefined();
    });

    it('rejects VIEWER from encrypting', async () => {
      setupAuthUser('VIEWER');
      const result = await callHandler({
        headers: { Authorization: `Bearer ${VALID_USER_JWT}` },
        body: { action: 'encrypt', plaintext: 'test' },
      });
      expect(result.status).toBe(403);
    });
  });

  describe('decrypt authorization — negative matrix', () => {
    it('rejects ordinary user JWT attempting decrypt', async () => {
      const result = await callHandler({
        headers: { Authorization: `Bearer ${VALID_USER_JWT}` },
        body: { action: 'decrypt', runId: 'run-1', claimToken: 'valid-claim-token', accountId: 'account-1' },
      });
      // User JWT does not match service role key, so worker auth fails
      expect(result.status).toBe(401);
    });

    it('rejects worker token without service bearer', async () => {
      const result = await callHandler({
        headers: { 'X-Credential-Vault-Worker-Token': WORKER_TOKEN },
        body: { action: 'decrypt', runId: 'run-1', claimToken: 'valid-claim-token', accountId: 'account-1' },
      });
      expect(result.status).toBe(401);
    });

    it('rejects service bearer without worker token', async () => {
      const result = await callHandler({
        headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
        body: { action: 'decrypt', runId: 'run-1', claimToken: 'valid-claim-token', accountId: 'account-1' },
      });
      expect(result.status).toBe(401);
    });

    it('rejects wrong worker token with correct service bearer', async () => {
      const result = await callHandler({
        headers: {
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          'X-Credential-Vault-Worker-Token': 'wrong-token',
        },
        body: { action: 'decrypt', runId: 'run-1', claimToken: 'valid-claim-token', accountId: 'account-1' },
      });
      expect(result.status).toBe(401);
    });

    it('rejects wrong service bearer with correct worker token', async () => {
      const result = await callHandler({
        headers: {
          Authorization: 'Bearer wrong-service-key',
          'X-Credential-Vault-Worker-Token': WORKER_TOKEN,
        },
        body: { action: 'decrypt', runId: 'run-1', claimToken: 'valid-claim-token', accountId: 'account-1' },
      });
      expect(result.status).toBe(401);
    });

    it('rejects stale/wrong claim token', async () => {
      setupRunAndAccount({ status: 'RUNNING', claimToken: 'different-claim-token', accountId: 'account-1' });
      const result = await callHandler({
        headers: {
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          'X-Credential-Vault-Worker-Token': WORKER_TOKEN,
        },
        body: { action: 'decrypt', runId: 'run-1', claimToken: 'wrong-claim-token', accountId: 'account-1' },
      });
      expect(result.status).toBe(400);
    });

    it('rejects non-RUNNING run', async () => {
      setupRunAndAccount({ status: 'COMPLETED', claimToken: 'valid-claim-token', accountId: 'account-1' });
      const result = await callHandler({
        headers: {
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          'X-Credential-Vault-Worker-Token': WORKER_TOKEN,
        },
        body: { action: 'decrypt', runId: 'run-1', claimToken: 'valid-claim-token', accountId: 'account-1' },
      });
      expect(result.status).toBe(400);
    });

    it('rejects mismatched accountId', async () => {
      setupRunAndAccount({ status: 'RUNNING', claimToken: 'valid-claim-token', accountId: 'different-account' });
      const result = await callHandler({
        headers: {
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          'X-Credential-Vault-Worker-Token': WORKER_TOKEN,
        },
        body: { action: 'decrypt', runId: 'run-1', claimToken: 'valid-claim-token', accountId: 'account-1' },
      });
      expect(result.status).toBe(400);
    });

    it('rejects when run is not found', async () => {
      setupNoRun();
      const result = await callHandler({
        headers: {
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          'X-Credential-Vault-Worker-Token': WORKER_TOKEN,
        },
        body: { action: 'decrypt', runId: 'nonexistent-run', claimToken: 'any-token', accountId: 'account-1' },
      });
      expect(result.status).toBe(400);
    });
  });

  describe('decrypt — valid bound request', () => {
    it('decrypts when service bearer + worker token + active run + matching claim/account', async () => {
    // Encrypt a real payload so decrypt can succeed
    const { encryptCredential } = await import('./crypto-helper.ts');
    const { encryptedPayload } = await encryptCredential('test-password', SERVER_CREDENTIAL_KEY);
    setupRunAndAccount({
        status: 'RUNNING',
        claimToken: 'valid-claim-token',
        accountId: 'account-1',
        encryptedPassword: encryptedPayload,
      });
      const result = await callHandler({
        headers: {
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          'X-Credential-Vault-Worker-Token': WORKER_TOKEN,
        },
        body: { action: 'decrypt', runId: 'run-1', claimToken: 'valid-claim-token', accountId: 'account-1' },
      });
      expect(result.status).toBe(200);
      expect(result.json.plaintext).toBe('test-password');
    });
  });

  describe('migrate/dry-run authorization', () => {
    it('rejects OPERATOR from dry-run', async () => {
      setupAuthUser('OPERATOR');
      const result = await callHandler({
        headers: { Authorization: `Bearer ${VALID_USER_JWT}` },
        body: { action: 'dry-run' },
      });
      expect(result.status).toBe(403);
    });

    it('allows ADMIN to dry-run', async () => {
      setupAuthUser('ADMIN');
      setupDryRunQuery([]);
      const result = await callHandler({
        headers: { Authorization: `Bearer ${VALID_ADMIN_JWT}` },
        body: { action: 'dry-run' },
      });
      expect(result.status).toBe(200);
    });

    it('rejects OPERATOR from migrate', async () => {
      setupAuthUser('OPERATOR');
      const result = await callHandler({
        headers: { Authorization: `Bearer ${VALID_USER_JWT}` },
        body: { action: 'migrate' },
      });
      expect(result.status).toBe(403);
    });

    it('rejects service-role key as a user JWT for migrate', async () => {
      // auth.getUser with a service-role key should fail
      setupAuthUser(null);
      const result = await callHandler({
        headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
        body: { action: 'migrate' },
      });
      expect(result.status).toBe(401);
    });
  });

  describe('opaque sb_secret_ keys', () => {
    it('does not pass opaque service key to auth.getUser for decrypt', async () => {
      const opaqueKey = 'sb_secret_abc123def456';
      setupEnv({ SUPABASE_SERVICE_ROLE_KEY: opaqueKey });
      // Don't set up auth.getUser — it should never be called for decrypt
      setupNoRun();
      const result = await callHandler({
        headers: {
          Authorization: `Bearer ${opaqueKey}`,
          'X-Credential-Vault-Worker-Token': WORKER_TOKEN,
        },
        body: { action: 'decrypt', runId: 'run-1', claimToken: 'valid-claim-token', accountId: 'account-1' },
      });
      // auth.getUser should never have been called for decrypt
      expect(mockAuthGetUser).not.toHaveBeenCalled();
      // The request fails at run lookup (no run data) but not at auth
      expect(result.status).not.toBe(401);
    });

    it('prefers the dedicated boundary service key over the managed key', async () => {
      const boundaryKey = 'sb_secret_boundary-key-for-vault-tests';
      const { encryptCredential } = await import('./crypto-helper.ts');
      const { encryptedPayload } = await encryptCredential('test-password', SERVER_CREDENTIAL_KEY);
      setupEnv({ CREDENTIAL_BOUNDARY_SERVICE_ROLE_KEY: boundaryKey });
      setupRunAndAccount({
        status: 'RUNNING',
        claimToken: 'valid-claim-token',
        accountId: 'account-1',
        encryptedPassword: encryptedPayload,
      });

      const result = await callHandler({
        headers: {
          Authorization: `Bearer ${boundaryKey}`,
          'X-Credential-Vault-Worker-Token': WORKER_TOKEN,
        },
        body: { action: 'decrypt', runId: 'run-1', claimToken: 'valid-claim-token', accountId: 'account-1' },
      });

      expect(result.status).toBe(200);
      expect(result.json.plaintext).toBe('test-password');
    });
  });
});
