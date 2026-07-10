/**
 * Client-side helper for the credential-vault Supabase Edge Function.
 *
 * Delegates password encryption to the server-side credential vault so the
 * encryption key (`SERVER_CREDENTIAL_KEY`) never ships to the browser. The
 * returned `encryptedPayload` uses the `s3:` prefix and is persisted by the
 * caller via the existing account create/import hooks.
 */

import { supabase } from './supabase';

export interface VaultEncryptResult {
  encryptedPayload: string;
  keyVersion: number;
}

/**
 * Encrypt a plaintext credential via the `credential-vault` Edge Function.
 *
 * The plaintext is sent over HTTPS to the Edge Function, which returns an
 * `s3:`-prefixed encrypted payload. The plaintext is never logged.
 *
 * @param plaintext - The plaintext password to encrypt.
 * @param accountId - Optional account ID for forward-compatibility (unused in Phase B).
 * @returns The encrypted payload and key version.
 */
export async function encryptCredentialViaVault(
  plaintext: string,
  accountId?: string,
): Promise<VaultEncryptResult> {
  const { data, error } = await supabase.functions.invoke('credential-vault', {
    body: { plaintext, accountId },
  });

  if (error) {
    throw new Error(`Credential vault encryption failed: ${error.message}`);
  }

  if (!data?.encryptedPayload) {
    throw new Error('Credential vault returned no encrypted payload');
  }

  return {
    encryptedPayload: data.encryptedPayload as string,
    keyVersion: data.keyVersion ?? 1,
  };
}
