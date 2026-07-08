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
const MIN_PASSPHRASE_LENGTH = 32;

export type CredentialPolicyStatus =
  | 'missing_key'
  | 'weak_key'
  | 'pilot_client_encrypted'
  | 'server_managed_required';

export interface CredentialPolicyState {
  status: CredentialPolicyStatus;
  canSavePilotCredential: boolean;
  severity: 'blocking' | 'warning';
  message: string;
}

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
  if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
    throw new AccountPasswordCryptoError(`VITE_ACCOUNT_PASSWORD_KEY must be at least ${MIN_PASSPHRASE_LENGTH} characters long.`);
  }
  return passphrase;
}

export function getCredentialPolicyStatus(): CredentialPolicyState {
  const passphrase = import.meta.env.VITE_ACCOUNT_PASSWORD_KEY?.trim();
  if (!passphrase) {
    return {
      status: 'missing_key',
      canSavePilotCredential: false,
      severity: 'blocking',
      message: 'Account credential encryption key is missing. Set VITE_ACCOUNT_PASSWORD_KEY before saving or importing pilot credentials.',
    };
  }

  if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
    return {
      status: 'weak_key',
      canSavePilotCredential: false,
      severity: 'blocking',
      message: `VITE_ACCOUNT_PASSWORD_KEY must be at least ${MIN_PASSPHRASE_LENGTH} characters before saving or importing pilot credentials.`,
    };
  }

  return {
    status: 'pilot_client_encrypted',
    canSavePilotCredential: true,
    severity: 'warning',
    message: 'Pilot-only browser encryption is active. This is not a production credential vault.',
  };
}

export function assertCredentialPolicyReady(): void {
  const policy = getCredentialPolicyStatus();
  if (!policy.canSavePilotCredential) {
    throw new AccountPasswordCryptoError(policy.message);
  }
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
  assertCredentialPolicyReady();
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
