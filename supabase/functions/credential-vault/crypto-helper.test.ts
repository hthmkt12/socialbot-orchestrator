import { describe, expect, it } from 'vitest';
import {
  encryptCredential,
  deriveServerKey,
  SERVER_PAYLOAD_PREFIX,
  SERVER_KEY_VERSION,
  MIN_SERVER_KEY_LENGTH,
} from './crypto-helper';

// 38 chars, satisfies the 32-char minimum.
const VALID_KEY = 'test-server-credential-key-32-chars-min!!';

describe('credential-vault crypto-helper', () => {
  it('encryptCredential returns payload starting with s3:1:', async () => {
    const result = await encryptCredential('my-secret-password', VALID_KEY);
    expect(
      result.encryptedPayload.startsWith(
        `${SERVER_PAYLOAD_PREFIX}:${SERVER_KEY_VERSION}:`
      )
    ).toBe(true);
    expect(result.keyVersion).toBe(SERVER_KEY_VERSION);
  });

  it('two calls with same plaintext produce different IV/ciphertext', async () => {
    const a = await encryptCredential('same-secret', VALID_KEY);
    const b = await encryptCredential('same-secret', VALID_KEY);
    expect(a.encryptedPayload).not.toBe(b.encryptedPayload);
  });

  it('encryptCredential throws if plaintext is empty', async () => {
    await expect(encryptCredential('', VALID_KEY)).rejects.toThrow();
  });

  it('encryptCredential throws if serverKey is missing', async () => {
    await expect(encryptCredential('secret', '')).rejects.toThrow();
  });

  it('encryptCredential throws if serverKey is shorter than 32 chars', async () => {
    await expect(encryptCredential('secret', 'short-key')).rejects.toThrow();
    expect(MIN_SERVER_KEY_LENGTH).toBe(32);
  });

  it('deriveServerKey returns a valid CryptoKey', async () => {
    const key = await deriveServerKey(VALID_KEY);
    expect(key).toBeInstanceOf(CryptoKey);
    expect(key.type).toBe('secret');
    expect(key.algorithm.name).toBe('AES-GCM');
  });
});
