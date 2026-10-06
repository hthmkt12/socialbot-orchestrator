import { describe, expect, it, vi } from 'vitest';
import { isRetryableNetworkError, withExponentialBackoff } from './retry-backoff';

describe('retry-backoff', () => {
  describe('isRetryableNetworkError', () => {
    it('returns true for network error signatures', () => {
      expect(isRetryableNetworkError(new Error('fetch failed'))).toBe(true);
      expect(isRetryableNetworkError(new Error('connect ECONNREFUSED 127.0.0.1:8080'))).toBe(true);
      expect(isRetryableNetworkError(new Error('read ECONNRESET'))).toBe(true);
      expect(isRetryableNetworkError(new Error('connect ETIMEDOUT'))).toBe(true);
      expect(isRetryableNetworkError(new Error('socket hang up'))).toBe(true);
      expect(isRetryableNetworkError(new Error('network error occurred'))).toBe(true);

      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      expect(isRetryableNetworkError(abortError)).toBe(true);
    });

    it('returns false for generic or validation errors', () => {
      expect(isRetryableNetworkError(new Error('Invalid JSON payload'))).toBe(false);
      expect(isRetryableNetworkError(new Error('Device unauthorized'))).toBe(false);
      expect(isRetryableNetworkError(null)).toBe(false);
      expect(isRetryableNetworkError('some string')).toBe(false);
    });
  });

  describe('withExponentialBackoff', () => {
    it('resolves on first successful attempt', async () => {
      const fn = vi.fn().mockResolvedValue('ok');
      const result = await withExponentialBackoff(fn, { maxRetries: 3, initialDelayMs: 10 });
      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('retries on retryable errors and succeeds when transient error clears', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('connect ECONNREFUSED 127.0.0.1:8080'))
        .mockResolvedValueOnce('recovered');

      const result = await withExponentialBackoff(fn, {
        maxRetries: 3,
        initialDelayMs: 10,
        maxDelayMs: 50,
      });

      expect(result).toBe('recovered');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('throws when max retries exceeded', async () => {
      const error = new Error('fetch failed');
      const fn = vi.fn().mockRejectedValue(error);

      await expect(
        withExponentialBackoff(fn, {
          maxRetries: 2,
          initialDelayMs: 10,
          maxDelayMs: 30,
        })
      ).rejects.toThrow('fetch failed');

      // Attempt 1 fails, attempt 2 fails, attempt 3 exceeds maxRetries (2)
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('fails immediately when error is not retryable', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Fatal syntax error'));

      await expect(
        withExponentialBackoff(fn, {
          maxRetries: 3,
          initialDelayMs: 10,
        })
      ).rejects.toThrow('Fatal syntax error');

      expect(fn).toHaveBeenCalledTimes(1);
    });
  });
});
