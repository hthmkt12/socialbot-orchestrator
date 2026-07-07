/**
 * Client-side AES-GCM encryption for social account passwords.
 *
 * Uses Web Crypto API with an environment-provided pilot key. Passwords are
 * encrypted before leaving the browser so they're never stored as plaintext in
 * the database. For production use, move this boundary server-side so the
 * encryption key is never shipped to the browser.
 */

const ENCRYPTED_PASSWORD_PREFIX = 'v2';
const PBKDF2_ITERATIONS = 100_000;
const SALT = new TextEncoder().encode('socialbot-account-password-salt-v2');

export class AccountPasswordCryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AccountPasswordCryptoError';
  }
}

function getEncryptionPassphrase(): string {
  const passphrase = import.meta.env.VITE_ACCOUNT_PASSWORD_KEY?.trim();
  if (!passphrase) {
    throw new AccountPasswordCryptoError(
      'Account password encryption key is not configured. Set VITE_ACCOUNT_PASSWORD_KEY before saving social account credentials.'
    );
  }
  if (passphrase.length < 32) {
    throw new AccountPasswordCryptoError('VITE_ACCOUNT_PASSWORD_KEY must be at least 32 characters long.');
  }
  return passphrase;
}

async function deriveKey(): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(getEncryptionPassphrase()),
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

/** Encrypt a plaintext password. Returns `v2:iv:ciphertext` in base64. */
export async function encryptPassword(plaintext: string): Promise<string> {
  const key = await deriveKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  );

  return `${ENCRYPTED_PASSWORD_PREFIX}:${toBase64(iv)}:${toBase64(ciphertext)}`;
}

/** Decrypt a previously encrypted password. */
export async function decryptPassword(encrypted: string): Promise<string> {
  const [version, ivB64, ctB64] = encrypted.split(':');
  if (version !== ENCRYPTED_PASSWORD_PREFIX || !ivB64 || !ctB64) {
    throw new AccountPasswordCryptoError('Unsupported encrypted password format. Re-save the account credential with the current encryption key.');
  }

  const key = await deriveKey();
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(ivB64) },
    key,
    fromBase64(ctB64),
  );

  return new TextDecoder().decode(decrypted);
}
