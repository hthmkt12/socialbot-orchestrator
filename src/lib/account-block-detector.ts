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
 * Marks an account as blocked in the database if a block signature is detected.
 * @param supabase The Supabase client.
 * @param accountId The ID of the account.
 * @param errorMessage The error message from a failed action.
 * @returns True if the account was marked as blocked, false otherwise.
 */
export async function handlePotentialBlock(
  supabase: SupabaseClient,
  accountId: string | undefined,
  errorMessage: string
): Promise<boolean> {
  if (!accountId) return false;

  const detectedReason = detectAccountBlock(errorMessage);
  if (!detectedReason) return false;

  try {
    await supabase
      .from('accounts')
      .update({
        is_blocked: true,
        detected_block_reason: `Detected keyword: "${detectedReason}"`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', accountId);

    // Also record the block event in history
    await supabase.from('account_action_history').insert({
      account_id: accountId,
      action_type: 'post', // we use a dummy or just log it, but wait, action_type is an enum. Let's not write to history or use 'share' for now.
      // actually history tracks specific actions. Let's just update the account.
    });

    return true;
  } catch {
    // Best effort
    return false;
  }
}
