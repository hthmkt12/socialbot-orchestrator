import { describe, expect, it } from 'vitest';
import {
  getRetryDelayMs,
  normalizeRetryBackoffPolicy,
  shouldRetryWithBackoff,
} from './retry-backoff-policy';

describe('retry backoff policy', () => {
  it('normalizes invalid policy values into bounded runtime defaults', () => {
    expect(normalizeRetryBackoffPolicy({
      maxRetries: 99,
      baseDelayMs: -10,
      maxDelayMs: 5,
      maxElapsedMs: -1,
    })).toEqual({
      maxRetries: 10,
      baseDelayMs: 0,
      maxDelayMs: 5,
      maxElapsedMs: 0,
    });
  });

  it('calculates capped exponential delays', () => {
    const policy = normalizeRetryBackoffPolicy({
      maxRetries: 4,
      baseDelayMs: 1000,
      maxDelayMs: 2500,
      maxElapsedMs: 10000,
    });

    expect(getRetryDelayMs(policy, 0)).toBe(1000);
    expect(getRetryDelayMs(policy, 1)).toBe(2000);
    expect(getRetryDelayMs(policy, 2)).toBe(2500);
  });

  it('blocks retries beyond max retry count or elapsed budget', () => {
    const policy = normalizeRetryBackoffPolicy({
      maxRetries: 2,
      baseDelayMs: 1000,
      maxDelayMs: 5000,
      maxElapsedMs: 2500,
    });

    expect(shouldRetryWithBackoff({ attempt: 0, elapsedMs: 0, nextDelayMs: 1000, policy })).toBe(true);
    expect(shouldRetryWithBackoff({ attempt: 1, elapsedMs: 2000, nextDelayMs: 1000, policy })).toBe(false);
    expect(shouldRetryWithBackoff({ attempt: 2, elapsedMs: 0, nextDelayMs: 1000, policy })).toBe(false);
  });
});
