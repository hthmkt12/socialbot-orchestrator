import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

import { fetchAndDecryptCredential } from './credential-decrypt-client';

/**
 * Minimal mock of the SupabaseClient surface used by the decrypt client.
 * Chaining methods return themselves so `.from().select().eq().maybeSingle()`
 * works as a fluent chain.
 */
function makeSupabaseMock(args: {
  accountData?: { encrypted_password: string } | null;
  accountError?: unknown;
  invokeData?: { plaintext?: string } | null;
  invokeError?: unknown;
}) {
  const fromChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: args.accountData ?? null,
      error: args.accountError ?? null,
    }),
  };

  const supabase = {
    from: vi.fn().mockReturnValue(fromChain),
    functions: {
      invoke: vi.fn().mockResolvedValue({
        data: args.invokeData ?? null,
        error: args.invokeError ?? null,
      }),
    },
  };

  return { supabase, fromChain };
}

describe('credential-decrypt-client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns plaintext on successful decrypt of an s3: payload', async () => {
    const { supabase } = makeSupabaseMock({
      accountData: { encrypted_password: 's3:1:abc:def' },
      invokeData: { plaintext: 'my-secret-password' },
    });

    const result = await fetchAndDecryptCredential(supabase as never, 'account-1');

    expect(result.plaintext).toBe('my-secret-password');
    expect(supabase.from).toHaveBeenCalledWith('accounts');
    expect(supabase.functions.invoke).toHaveBeenCalledWith(
      'credential-vault',
      { body: { action: 'decrypt', encryptedPayload: 's3:1:abc:def' } }
    );
  });

  it('throws safe error when account is not found', async () => {
    const { supabase } = makeSupabaseMock({
      accountData: null,
    });

    await expect(fetchAndDecryptCredential(supabase as never, 'missing-account')).rejects.toThrow(
      'Account credential not found or empty.'
    );
  });

  it('throws safe error when encrypted_password is empty', async () => {
    const { supabase } = makeSupabaseMock({
      accountData: { encrypted_password: '' },
    });

    await expect(fetchAndDecryptCredential(supabase as never, 'account-1')).rejects.toThrow(
      'Account credential not found or empty.'
    );
  });

  it('throws safe error when invoke returns an error', async () => {
    const { supabase } = makeSupabaseMock({
      accountData: { encrypted_password: 's3:1:abc:def' },
      invokeError: { message: 'Decrypt failed.' },
    });

    await expect(fetchAndDecryptCredential(supabase as never, 'account-1')).rejects.toThrow(
      'Credential decrypt failed.'
    );
  });

  it('throws safe error when invoke returns no plaintext field', async () => {
    const { supabase } = makeSupabaseMock({
      accountData: { encrypted_password: 's3:1:abc:def' },
      invokeData: { error: 'Decrypt failed.' },
    });

    await expect(fetchAndDecryptCredential(supabase as never, 'account-1')).rejects.toThrow(
      'Credential decrypt failed.'
    );
  });

  it('throws safe error when DB query returns an error', async () => {
    const { supabase } = makeSupabaseMock({
      accountError: { message: 'DB connection failed' },
    });

    await expect(fetchAndDecryptCredential(supabase as never, 'account-1')).rejects.toThrow(
      'Credential decrypt failed.'
    );
  });

  it('never includes plaintext in error messages', async () => {
    const { supabase } = makeSupabaseMock({
      accountData: { encrypted_password: 's3:1:abc:def' },
      invokeError: { message: 'Decrypt failed with secret-password-leaked' },
    });

    try {
      await fetchAndDecryptCredential(supabase as never, 'account-1');
      expect.fail('Should have thrown');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Error message must be a generic safe message, not contain any invoke detail
      expect(message).toBe('Credential decrypt failed.');
    }
  });
});
