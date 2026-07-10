import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

vi.mock('./supabase', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

import { supabase } from './supabase';
import { encryptCredentialViaVault } from './account-credential-vault-client';

const mockInvoke = vi.mocked(supabase.functions.invoke) as Mock;

describe('account-credential-vault-client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns { encryptedPayload, keyVersion } on success', async () => {
    mockInvoke.mockResolvedValue({
      data: { encryptedPayload: 's3:1:abc123', keyVersion: 1 },
      error: null,
    });

    const result = await encryptCredentialViaVault('my-secret-password');

    expect(result).toEqual({ encryptedPayload: 's3:1:abc123', keyVersion: 1 });
  });

  it('throws when the Edge Function returns an error', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: 'Unauthorized.' },
    });

    await expect(encryptCredentialViaVault('my-secret-password')).rejects.toThrow(
      'Credential vault encryption failed: Unauthorized.',
    );
  });

  it('throws when the response has no encryptedPayload', async () => {
    mockInvoke.mockResolvedValue({
      data: { keyVersion: 1 },
      error: null,
    });

    await expect(encryptCredentialViaVault('my-secret-password')).rejects.toThrow(
      'Credential vault returned no encrypted payload',
    );
  });

  it('passes plaintext and accountId in the request body', async () => {
    mockInvoke.mockResolvedValue({
      data: { encryptedPayload: 's3:1:xyz', keyVersion: 2 },
      error: null,
    });

    await encryptCredentialViaVault('my-secret-password', 'account-42');

    expect(mockInvoke).toHaveBeenCalledWith('credential-vault', {
      body: { plaintext: 'my-secret-password', accountId: 'account-42' },
    });
  });

  it('defaults keyVersion to 1 when not provided in response', async () => {
    mockInvoke.mockResolvedValue({
      data: { encryptedPayload: 's3:1:abc' },
      error: null,
    });

    const result = await encryptCredentialViaVault('pw');

    expect(result.keyVersion).toBe(1);
  });
});
