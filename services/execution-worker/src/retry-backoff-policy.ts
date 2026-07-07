export interface RetryBackoffPolicy {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  maxElapsedMs: number;
}

export const DEFAULT_RETRY_BACKOFF_POLICY: RetryBackoffPolicy = {
  maxRetries: 0,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  maxElapsedMs: 120000,
};

export function normalizeRetryBackoffPolicy(input: Partial<RetryBackoffPolicy> = {}): RetryBackoffPolicy {
  const maxRetries = Math.max(0, Math.min(10, Math.floor(input.maxRetries ?? DEFAULT_RETRY_BACKOFF_POLICY.maxRetries)));
  const baseDelayMs = Math.max(0, Math.floor(input.baseDelayMs ?? DEFAULT_RETRY_BACKOFF_POLICY.baseDelayMs));
  const maxDelayMs = Math.max(baseDelayMs, Math.floor(input.maxDelayMs ?? DEFAULT_RETRY_BACKOFF_POLICY.maxDelayMs));
  const maxElapsedMs = Math.max(0, Math.floor(input.maxElapsedMs ?? DEFAULT_RETRY_BACKOFF_POLICY.maxElapsedMs));

  return {
    maxRetries,
    baseDelayMs,
    maxDelayMs,
    maxElapsedMs,
  };
}

export function getRetryDelayMs(policy: RetryBackoffPolicy, attempt: number) {
  if (attempt < 0 || policy.baseDelayMs <= 0) return 0;
  return Math.min(policy.maxDelayMs, policy.baseDelayMs * Math.pow(2, attempt));
}

export function shouldRetryWithBackoff(args: {
  attempt: number;
  elapsedMs: number;
  nextDelayMs: number;
  policy: RetryBackoffPolicy;
}) {
  if (args.attempt >= args.policy.maxRetries) return false;
  if (args.policy.maxElapsedMs === 0) return false;
  return args.elapsedMs + args.nextDelayMs <= args.policy.maxElapsedMs;
}
