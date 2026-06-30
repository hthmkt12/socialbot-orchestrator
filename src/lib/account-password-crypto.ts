/**
 * Client-side AES-GCM encryption for social account passwords.
 *
 * Uses Web Crypto API with a static application-level key. Passwords are
 * encrypted before leaving the browser so they're never stored as plaintext
 * in the database.
 *
 * The encryption key is derived from a static passphrase using PBKDF2.
 * For production, replace ENCRYPTION_PASSPHRASE with a per-user secret
 * or an environment-injected key.
 */

const ENCRYPTION_PASSPHRASE = 'socialbot-account-key-v1';
const PBKDF2_ITERATIONS = 100_000;
const SALT = new TextEncoder().encode('socialbot-salt-v1');

async function deriveKey(): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(ENCRYPTION_PASSPHRASE),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: SALT, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

function toBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function fromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/** Encrypt a plaintext password. Returns `iv:ciphertext` in base64. */
export async function encryptPassword(plaintext: string): Promise<string> {
  const key = await deriveKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  );

  return `${toBase64(iv)}:${toBase64(ciphertext)}`;
}

/** Decrypt a previously encrypted password. */
export async function decryptPassword(encrypted: string): Promise<string> {
  const [ivB64, ctB64] = encrypted.split(':');
  if (!ivB64 || !ctB64) throw new Error('Invalid encrypted password format');

  const key = await deriveKey();
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(ivB64) },
    key,
    fromBase64(ctB64),
  );

  return new TextDecoder().decode(decrypted);
}
