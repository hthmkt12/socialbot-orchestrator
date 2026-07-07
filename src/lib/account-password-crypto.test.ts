import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountPasswordCryptoError, decryptPassword, encryptPassword } from './account-password-crypto';

const TEST_KEY = '0123456789abcdef0123456789abcdef';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('account-password-crypto', () => {
  it('fails closed when the encryption key is missing', async () => {
    vi.stubEnv('VITE_ACCOUNT_PASSWORD_KEY', '');

    await expect(encryptPassword('secret')).rejects.toThrow(AccountPasswordCryptoError);
  });

  it('requires a sufficiently long encryption key', async () => {
    vi.stubEnv('VITE_ACCOUNT_PASSWORD_KEY', 'short');

    await expect(encryptPassword('secret')).rejects.toThrow('at least 32 characters');
  });

  it('round-trips v2 encrypted passwords with the configured key', async () => {
    vi.stubEnv('VITE_ACCOUNT_PASSWORD_KEY', TEST_KEY);

    const encrypted = await encryptPassword('secret-password');

    expect(encrypted.startsWith('v2:')).toBe(true);
    await expect(decryptPassword(encrypted)).resolves.toBe('secret-password');
  });

  it('rejects legacy unversioned encrypted values', async () => {
    vi.stubEnv('VITE_ACCOUNT_PASSWORD_KEY', TEST_KEY);

    await expect(decryptPassword('iv:ciphertext')).rejects.toThrow('Unsupported encrypted password format');
  });
});
