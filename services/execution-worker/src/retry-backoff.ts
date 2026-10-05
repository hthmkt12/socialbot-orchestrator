import { logger } from './logger';

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial delay before first retry in ms (default: 500) */
  initialDelayMs?: number;
  /** Maximum backoff delay in ms (default: 5000) */
  maxDelayMs?: number;
  /** Backoff multiplier (default: 2) */
  backoffFactor?: number;
  /** Operation label for structured logs */
  operation?: string;
  /** Predicate to decide if an error is retryable (default: true for network/5xx) */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
}

export function isRetryableNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    if (error.name === 'AbortError') return true;
    const msg = error.message.toLowerCase();
    return (
      msg.includes('fetch failed') ||
      msg.includes('econnrefused') ||
      msg.includes('econnreset') ||
      msg.includes('etimedout') ||
      msg.includes('socket hang up') ||
      msg.includes('network error')
    );
  }
  return false;
}

/**
 * Execute an async operation with exponential backoff retry.
 */
export async function withExponentialBackoff<T>(
  fn: (attempt: number) => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  const initialDelayMs = options.initialDelayMs ?? 500;
  const maxDelayMs = options.maxDelayMs ?? 5000;
  const backoffFactor = options.backoffFactor ?? 2;
  const operation = options.operation ?? 'device-operation';
  const shouldRetry = options.shouldRetry ?? isRetryableNetworkError;

  let attempt = 0;
  let delayMs = initialDelayMs;

  while (true) {
    attempt++;
    try {
      return await fn(attempt);
    } catch (error) {
      if (attempt > maxRetries || !shouldRetry(error, attempt)) {
        if (attempt > 1) {
          logger.warn(
            { operation, attempt, maxRetries, err: error },
            'operation failed after retries'
          );
        }
        throw error;
      }

      // Add jitter (+/- 20%) to avoid thundering herd
      const jitter = delayMs * (0.8 + Math.random() * 0.4);
      logger.info(
        { operation, attempt, maxRetries, delayMs: Math.round(jitter), err: error },
        'retrying operation after backoff'
      );

      await new Promise((resolve) => setTimeout(resolve, jitter));
      delayMs = Math.min(delayMs * backoffFactor, maxDelayMs);
    }
  }
}
