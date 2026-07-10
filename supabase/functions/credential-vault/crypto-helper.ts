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

// Legacy v2: constants (must match src/lib/account-password-crypto.ts exactly).
export const LEGACY_PAYLOAD_PREFIX = 'v2';
export const LEGACY_SALT = new TextEncoder().encode(
  'socialbot-account-password-salt-v2'
);
export const LEGACY_PBKDF2_ITERATIONS = 100_000;
export const MIN_LEGACY_KEY_LENGTH = 32;

const PBKDF2_ITERATIONS = 100_000;
const IV_LENGTH = 12;

/**
 * Derive an AES-GCM 256-bit CryptoKey from the server credential passphrase.
 * The derived key supports both encrypt and decrypt (Phase D adds decrypt).
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
    ['encrypt', 'decrypt']
  );
}

/**
 * Derive a legacy v2: AES-GCM 256-bit CryptoKey for decryption only.
 * Uses the pilot salt and iteration count from `src/lib/account-password-crypto.ts`
 * so it can decrypt existing `v2:` payloads during migration.
 */
export async function deriveLegacyKey(legacyKey: string): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(legacyKey),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: LEGACY_SALT, iterations: LEGACY_PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
}

function toBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function fromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
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

/**
 * Decrypt a `v2:` payload using the legacy pilot key.
 * Throws if the payload is not `v2:`-prefixed, the format is invalid, or the
 * key is missing. Never logs plaintext or keys.
 */
export async function decryptLegacyCredential(
  encryptedPayload: string,
  legacyKey: string
): Promise<string> {
  if (!legacyKey || legacyKey.length < MIN_LEGACY_KEY_LENGTH) {
    throw new Error(`legacyKey must be at least ${MIN_LEGACY_KEY_LENGTH} characters long`);
  }

  // Parse "v2:<base64(iv)>:<base64(ciphertext)>"
  const parts = encryptedPayload.split(':');
  if (parts.length !== 3 || parts[0] !== LEGACY_PAYLOAD_PREFIX || !parts[1] || !parts[2]) {
    throw new Error('Invalid legacy payload format. Expected v2:<iv>:<ciphertext>.');
  }

  const iv = fromBase64(parts[1]);
  const ciphertext = fromBase64(parts[2]);

  const key = await deriveLegacyKey(legacyKey);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}

/**
 * Decrypt an `s3:` payload using the server credential key.
 * Throws if the payload is not `s3:`-prefixed, the format is invalid, or the
 * key is missing. Never logs plaintext or keys.
 */
export async function decryptServerCredential(
  encryptedPayload: string,
  serverKey: string
): Promise<string> {
  if (!serverKey || serverKey.length < MIN_SERVER_KEY_LENGTH) {
    throw new Error(`serverKey must be at least ${MIN_SERVER_KEY_LENGTH} characters long`);
  }

  // Parse "s3:<keyVersion>:<base64(iv)>:<base64(ciphertext)>"
  const parts = encryptedPayload.split(':');
  if (
    parts.length !== 4 ||
    parts[0] !== SERVER_PAYLOAD_PREFIX ||
    !parts[2] ||
    !parts[3]
  ) {
    throw new Error('Invalid server payload format. Expected s3:<version>:<iv>:<ciphertext>.');
  }

  const iv = fromBase64(parts[2]);
  const ciphertext = fromBase64(parts[3]);

  const key = await deriveServerKey(serverKey);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}
