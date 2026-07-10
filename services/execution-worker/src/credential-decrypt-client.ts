/**
 * Worker-side credential decrypt client.
 *
 * Decrypts account credentials via the credential-vault Edge Function using
 * service-role auth. Plaintext is held in memory ONLY for the duration of the
 * step that needs it and is never persisted to the database, logs, or artifacts.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface DecryptedCredential {
  plaintext: string;
}

/**
 * Fetch and decrypt an account's encrypted password.
 *
 * @param supabase - Service-role Supabase client
 * @param accountId - The account ID to fetch credentials for
 * @returns The decrypted plaintext password
 * @throws Error with safe message (no plaintext) on failure
 */
export async function fetchAndDecryptCredential(
  supabase: SupabaseClient,
  accountId: string
): Promise<DecryptedCredential> {
  // 1. Read accounts.encrypted_password for the given accountId
  const { data, error } = await supabase
    .from('accounts')
    .select('encrypted_password')
    .eq('id', accountId)
    .maybeSingle();

  if (error) {
    throw new Error('Credential decrypt failed.');
  }

  if (!data) {
    throw new Error('Account credential not found or empty.');
  }

  const encryptedPassword = data.encrypted_password;
  if (!encryptedPassword || typeof encryptedPassword !== 'string' || encryptedPassword.length === 0) {
    throw new Error('Account credential not found or empty.');
  }

  // 2. Call credential-vault Edge Function with action: 'decrypt'
  const { data: invokeData, error: invokeError } = await supabase.functions.invoke<{
    plaintext?: string;
    error?: string;
  }>('credential-vault', {
    body: { action: 'decrypt', encryptedPayload: encryptedPassword },
  });

  if (invokeError) {
    throw new Error('Credential decrypt failed.');
  }

  if (!invokeData || typeof invokeData.plaintext !== 'string' || invokeData.plaintext.length === 0) {
    throw new Error('Credential decrypt failed.');
  }

  return { plaintext: invokeData.plaintext };
}
