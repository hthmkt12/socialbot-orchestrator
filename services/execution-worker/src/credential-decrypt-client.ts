/**
 * Worker-side credential decrypt client.
 *
 * Calls the credential-vault Edge Function to decrypt the account credential
 * bound to an active, owned run. The worker sends { runId, claimToken, accountId }
 * plus the internal worker token header. The Edge Function loads the encrypted
 * password from the DB internally — the worker never passes ciphertext.
 *
 * Plaintext is held in memory ONLY for the duration of the step that needs it
 * and is never persisted to the database, logs, or artifacts.
 */

export interface DecryptedCredential {
  plaintext: string;
}

export interface DecryptClientParams {
  /** Supabase project URL */
  supabaseUrl: string;
  /** Service role key (sent as Authorization bearer) */
  supabaseServiceRoleKey: string;
  /** Internal worker token (sent as X-Credential-Vault-Worker-Token header) */
  credentialVaultWorkerToken: string;
}

/**
 * Fetch and decrypt an account's encrypted password via the credential-vault
 * Edge Function. The function verifies run binding internally.
 *
 * @param params - Connection and auth parameters
 * @param runId - The workflow run ID that owns the credential
 * @param claimToken - The run's execution claim token
 * @param accountId - The account ID bound to the run's input_variables_json
 * @returns The decrypted plaintext password
 * @throws Error with safe message (no plaintext) on failure
 */
export async function fetchAndDecryptCredential(
  params: DecryptClientParams,
  runId: string,
  claimToken: string,
  accountId: string
): Promise<DecryptedCredential> {
  const url = `${params.supabaseUrl}/functions/v1/credential-vault`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${params.supabaseServiceRoleKey}`,
        'X-Credential-Vault-Worker-Token': params.credentialVaultWorkerToken,
      },
      body: JSON.stringify({
        action: 'decrypt',
        runId,
        claimToken,
        accountId,
      }),
    });
  } catch {
    throw new Error('Credential decrypt failed.');
  }

  if (!response.ok) {
    throw new Error('Credential decrypt failed.');
  }

  const data = (await response.json()) as { plaintext?: string; error?: string };

  if (!data || typeof data.plaintext !== 'string' || data.plaintext.length === 0) {
    throw new Error('Credential decrypt failed.');
  }

  return { plaintext: data.plaintext };
}
