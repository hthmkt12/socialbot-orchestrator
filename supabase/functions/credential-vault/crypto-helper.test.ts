import { describe, expect, it } from 'vitest';
import {
  encryptCredential,
  deriveServerKey,
  decryptServerCredential,
  decryptLegacyCredential,
  deriveLegacyKey,
  SERVER_PAYLOAD_PREFIX,
  SERVER_KEY_VERSION,
  MIN_SERVER_KEY_LENGTH,
  LEGACY_PAYLOAD_PREFIX,
  LEGACY_SALT,
  LEGACY_PBKDF2_ITERATIONS,
} from './crypto-helper';

// 38 chars, satisfies the 32-char minimum.
const VALID_KEY = '***************************************!!';

/**
 * Replicate the legacy v2: encryption inline (there is no
 * `encryptLegacyCredential` export - we only need decrypt for migration).
 * Uses the same salt and iteration count as src/lib/account-password-crypto.ts.
 */
async function encryptLegacyV2(plaintext: string, legacyKey: string): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(legacyKey),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: LEGACY_SALT, iterations: LEGACY_PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  const toB64 = (buf: ArrayBuffer) =>
    btoa(String.fromCharCode(...new Uint8Array(buf)));
  return `${LEGACY_PAYLOAD_PREFIX}:${toB64(iv.buffer)}:${toB64(ciphertext)}`;
}

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

  it('decryptServerCredential round-trips an encryptCredential payload', async () => {
    const plaintext = 'server-round-trip-secret';
    const { encryptedPayload } = await encryptCredential(plaintext, VALID_KEY);
    const decrypted = await decryptServerCredential(encryptedPayload, VALID_KEY);
    expect(decrypted).toBe(plaintext);
  });

  it('decryptServerCredential throws on invalid format', async () => {
    await expect(decryptServerCredential('not-a-valid-payload', VALID_KEY)).rejects.toThrow();
  });

  it('decryptLegacyCredential round-trips a v2: payload', async () => {
    const plaintext = 'legacy-round-trip-secret';
    const v2Payload = await encryptLegacyV2(plaintext, VALID_KEY);
    expect(v2Payload.startsWith(`${LEGACY_PAYLOAD_PREFIX}:`)).toBe(true);
    const decrypted = await decryptLegacyCredential(v2Payload, VALID_KEY);
    expect(decrypted).toBe(plaintext);
  });

  it('decryptLegacyCredential throws on invalid format', async () => {
    await expect(decryptLegacyCredential('not-a-valid-payload', VALID_KEY)).rejects.toThrow();
  });

  it('decryptLegacyCredential throws on wrong key', async () => {
    const plaintext = 'wrong-key-secret';
    const v2Payload = await encryptLegacyV2(plaintext, VALID_KEY);
    const wrongKey = 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX!!';
    await expect(decryptLegacyCredential(v2Payload, wrongKey)).rejects.toThrow();
  });

  it('deriveLegacyKey returns a valid decrypt-only CryptoKey', async () => {
    const key = await deriveLegacyKey(VALID_KEY);
    expect(key).toBeInstanceOf(CryptoKey);
    expect(key.type).toBe('secret');
    expect(key.algorithm.name).toBe('AES-GCM');
  });

  it('migration round-trip: decrypt v2 then re-encrypt as s3 then decrypt s3', async () => {
    const originalPlaintext = 'migration-round-trip-secret';
    // Encrypt as v2 (simulating an existing pilot payload)
    const v2Payload = await encryptLegacyV2(originalPlaintext, VALID_KEY);
    // Decrypt v2
    const decrypted = await decryptLegacyCredential(v2Payload, VALID_KEY);
    expect(decrypted).toBe(originalPlaintext);
    // Re-encrypt as s3
    const { encryptedPayload: s3Payload } = await encryptCredential(decrypted, VALID_KEY);
    expect(s3Payload.startsWith(`${SERVER_PAYLOAD_PREFIX}:${SERVER_KEY_VERSION}:`)).toBe(true);
    // Decrypt s3 and verify same plaintext
    const redecrypted = await decryptServerCredential(s3Payload, VALID_KEY);
    expect(redecrypted).toBe(originalPlaintext);
  });
});
