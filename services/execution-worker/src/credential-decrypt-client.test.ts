import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:crypto', () => ({
  randomUUID: vi.fn(() => 'test-uuid'),
}));

import { fetchAndDecryptCredential, type DecryptClientParams } from './credential-decrypt-client';

const DEFAULT_PARAMS: DecryptClientParams = {
  supabaseUrl: 'https://test.supabase.co',
  supabaseServiceRoleKey: 'test-service-role-key',
  credentialVaultWorkerToken: 'test-worker-token',
};

function makeFetchMock(opts: {
  ok?: boolean;
  status?: number;
  json?: { plaintext?: string; error?: string };
  shouldThrow?: boolean;
}) {
  const mockFetch = vi.fn();
  if (opts.shouldThrow) {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
  } else {
    mockFetch.mockResolvedValueOnce({
      ok: opts.ok ?? true,
      status: opts.status ?? 200,
      json: async () => opts.json ?? { plaintext: 'my-secret-password' },
    });
  }
  return mockFetch;
}

describe('credential-decrypt-client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns plaintext on successful bound decrypt', async () => {
    const mockFetch = makeFetchMock({ json: { plaintext: 'my-secret-password' } });
    vi.stubGlobal('fetch', mockFetch);

    const result = await fetchAndDecryptCredential(
      DEFAULT_PARAMS,
      'run-1',
      'claim-1',
      'account-1'
    );

    expect(result.plaintext).toBe('my-secret-password');

    // Verify the request was sent with correct headers and body
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://test.supabase.co/functions/v1/credential-vault');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer test-service-role-key');
    expect(init.headers['X-Credential-Vault-Worker-Token']).toBe('test-worker-token');
    expect(JSON.parse(init.body)).toEqual({
      action: 'decrypt',
      runId: 'run-1',
      claimToken: 'claim-1',
      accountId: 'account-1',
    });
  });

  it('throws safe error when response is not ok', async () => {
    const mockFetch = makeFetchMock({ ok: false, status: 401 });
    vi.stubGlobal('fetch', mockFetch);

    await expect(
      fetchAndDecryptCredential(DEFAULT_PARAMS, 'run-1', 'claim-1', 'account-1')
    ).rejects.toThrow('Credential decrypt failed.');
  });

  it('throws safe error when response has no plaintext field', async () => {
    const mockFetch = makeFetchMock({ json: { error: 'Invalid request.' } });
    vi.stubGlobal('fetch', mockFetch);

    await expect(
      fetchAndDecryptCredential(DEFAULT_PARAMS, 'run-1', 'claim-1', 'account-1')
    ).rejects.toThrow('Credential decrypt failed.');
  });

  it('throws safe error when plaintext is empty string', async () => {
    const mockFetch = makeFetchMock({ json: { plaintext: '' } });
    vi.stubGlobal('fetch', mockFetch);

    await expect(
      fetchAndDecryptCredential(DEFAULT_PARAMS, 'run-1', 'claim-1', 'account-1')
    ).rejects.toThrow('Credential decrypt failed.');
  });

  it('throws safe error on network failure', async () => {
    const mockFetch = makeFetchMock({ shouldThrow: true });
    vi.stubGlobal('fetch', mockFetch);

    await expect(
      fetchAndDecryptCredential(DEFAULT_PARAMS, 'run-1', 'claim-1', 'account-1')
    ).rejects.toThrow('Credential decrypt failed.');
  });

  it('never includes plaintext in error messages', async () => {
    const mockFetch = makeFetchMock({
      ok: false,
      status: 400,
      json: { error: 'Decrypt failed with leaked-password-in-error' },
    });
    vi.stubGlobal('fetch', mockFetch);

    try {
      await fetchAndDecryptCredential(DEFAULT_PARAMS, 'run-1', 'claim-1', 'account-1');
      expect.fail('Should have thrown');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).toBe('Credential decrypt failed.');
      expect(message).not.toContain('leaked-password');
    }
  });

  it('does not send encryptedPayload in the request body', async () => {
    const mockFetch = makeFetchMock({ json: { plaintext: 'secret' } });
    vi.stubGlobal('fetch', mockFetch);

    await fetchAndDecryptCredential(DEFAULT_PARAMS, 'run-1', 'claim-1', 'account-1');

    const init = mockFetch.mock.calls[0][1];
    const body = JSON.parse(init.body);
    expect(body.encryptedPayload).toBeUndefined();
    expect(body.action).toBe('decrypt');
  });
});
