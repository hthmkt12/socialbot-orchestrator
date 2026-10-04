import type { SupabaseClient } from '@supabase/supabase-js';

const BLOCK_KEYWORDS = [
  'action blocked',
  'try again later',
  'we restrict certain activity',
  'suspicious activity',
  'unusual activity',
  'account compromised',
  'temporarily blocked',
  'community guidelines',
];

export interface QuarantineAlertPayload {
  event: 'ACCOUNT_QUARANTINED';
  timestamp: string;
  accountId: string;
  username: string | null;
  platform: string | null;
  detectedReason: string;
  errorExcerpt: string;
}

export interface HandlePotentialBlockOptions {
  webhookUrl?: string;
  fetchFn?: typeof fetch;
}

/**
 * Checks an error message for common platform block indicators.
 * @param errorMessage The error string returned by a failed step.
 * @returns The matched keyword if a block is detected, or null.
 */
export function detectAccountBlock(errorMessage: string): string | null {
  if (!errorMessage) return null;
  const lower = errorMessage.toLowerCase();

  for (const keyword of BLOCK_KEYWORDS) {
    if (lower.includes(keyword)) {
      return keyword;
    }
  }

  return null;
}

/**
 * Marks an account as blocked in the database if a block signature is detected,
 * records an immutable audit log entry in `audit_logs`, and dispatches an
 * outbound quarantine alert webhook if configured.
 *
 * @param supabase The Supabase client.
 * @param accountId The ID of the account.
 * @param errorMessage The error message from a failed action.
 * @param options Optional configuration including custom webhook URL and fetchFn.
 * @returns True if the account was marked as blocked, false otherwise.
 */
export async function handlePotentialBlock(
  supabase: SupabaseClient,
  accountId: string | undefined,
  errorMessage: string,
  options?: HandlePotentialBlockOptions
): Promise<boolean> {
  if (!accountId) return false;

  const detectedReason = detectAccountBlock(errorMessage);
  if (!detectedReason) return false;

  try {
    // 1. Fetch account metadata for audit log and alert payload
    let accountUsername: string | null = null;
    let accountPlatform: string | null = null;
    try {
      const { data: account } = await supabase
        .from('accounts')
        .select('id, username, platform')
        .eq('id', accountId)
        .maybeSingle();

      if (account) {
        accountUsername = account.username ?? null;
        accountPlatform = account.platform ?? null;
      }
    } catch {
      // Best-effort account lookup
    }

    // 2. Mark account blocked in database
    const { error } = await supabase
      .from('accounts')
      .update({
        is_blocked: true,
        detected_block_reason: `Detected keyword: "${detectedReason}"`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', accountId);

    if (error) return false;

    // 3. Persist immutable record in audit_logs table
    try {
      await supabase.from('audit_logs').insert({
        actor_user_id: null,
        action: 'ACCOUNT_QUARANTINED',
        resource_type: 'account',
        resource_id: accountId,
        metadata_json: {
          detected_keyword: detectedReason,
          platform: accountPlatform,
          username: accountUsername,
          error_excerpt: errorMessage.slice(0, 300),
          quarantined_at: new Date().toISOString(),
        },
      });
    } catch {
      // Best effort for audit log: do not fail quarantine if audit insert fails
    }

    // 4. Dispatch outbound notification alert webhook if configured
    const webhookUrl =
      options?.webhookUrl ??
      process.env.ACCOUNT_QUARANTINE_WEBHOOK_URL ??
      process.env.ALERT_WEBHOOK_URL;

    if (webhookUrl) {
      const payload: QuarantineAlertPayload = {
        event: 'ACCOUNT_QUARANTINED',
        timestamp: new Date().toISOString(),
        accountId,
        username: accountUsername,
        platform: accountPlatform,
        detectedReason,
        errorExcerpt: errorMessage.slice(0, 300),
      };

      const customFetch = options?.fetchFn ?? fetch;
      try {
        await customFetch(webhookUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(3000),
        });
      } catch {
        // Best effort: never throw on webhook failure
      }
    }

    return true;
  } catch {
    // Best effort
    return false;
  }
}
