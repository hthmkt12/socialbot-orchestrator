/**
 * Server-side credential encryption helper for the credential-vault Edge Function.
 *
 * Phase B (encrypt-only):
 *   - Encrypts plaintext credentials with AES-GCM 256-bit using a server-held key.
 *   - No decrypt, no migrate, no rotate in this phase.
 *   - No database writes.
 *   - No plaintext logging. Callers must never log the plaintext or ciphertext.
 *
 * The encryption key (`SERVER_CREDENTIAL_KEY`) is derived via PBKDF2 and never
 * leaves the server. The output payload format is:
 *   `s3:<keyVersion>:<base64(iv)>:<base64(ciphertext)>`
 */

export const SERVER_PAYLOAD_PREFIX = 's3';
export const SERVER_KEY_VERSION = 1;
export const MIN_SERVER_KEY_LENGTH = 32;
export const SERVER_SALT = new TextEncoder().encode(
  'socialbot-server-credential-salt-v1'
);

const PBKDF2_ITERATIONS = 100_000;
const IV_LENGTH = 12;

/**
 * Derive an AES-GCM 256-bit CryptoKey from the server credential passphrase.
 * The derived key can only be used for encryption (Phase B is encrypt-only).
 */
export async function deriveServerKey(serverKey: string): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(serverKey),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: SERVER_SALT, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );
}

function toBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

/**
 * Encrypt a plaintext credential and return an `s3:1:iv:ciphertext` payload.
 * Throws if `plaintext` is empty or `serverKey` is missing/shorter than 32 chars.
 * A fresh random 12-byte IV is generated per call, so identical plaintexts
 * produce distinct ciphertexts.
 */
export async function encryptCredential(
  plaintext: string,
  serverKey: string
): Promise<{ encryptedPayload: string; keyVersion: number }> {
  if (!plaintext || plaintext.length === 0) {
    throw new Error('plaintext must be a non-empty string');
  }
  if (!serverKey || serverKey.length < MIN_SERVER_KEY_LENGTH) {
    throw new Error(`serverKey must be at least ${MIN_SERVER_KEY_LENGTH} characters long`);
  }

  const key = await deriveServerKey(serverKey);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext)
  );

  const encryptedPayload = `${SERVER_PAYLOAD_PREFIX}:${SERVER_KEY_VERSION}:${toBase64(
    iv.buffer
  )}:${toBase64(ciphertext)}`;

  return { encryptedPayload, keyVersion: SERVER_KEY_VERSION };
}
