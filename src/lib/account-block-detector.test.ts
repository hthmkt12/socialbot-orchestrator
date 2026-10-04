import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { detectAccountBlock, handlePotentialBlock } from './account-block-detector';

describe('account-block-detector', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('detectAccountBlock', () => {
    it('detects common social platform block messages', () => {
      expect(detectAccountBlock('Action Blocked: Your account has been temporarily restricted.')).toBe('action blocked');
      expect(detectAccountBlock('Please try again later. We limit how often you can post.')).toBe('try again later');
      expect(detectAccountBlock('We restrict certain activity to protect our community.')).toBe('we restrict certain activity');
      expect(detectAccountBlock('Suspicious activity detected on your account.')).toBe('suspicious activity');
      expect(detectAccountBlock('We detected unusual activity and locked your session.')).toBe('unusual activity');
      expect(detectAccountBlock('Your account compromised. Please change your password.')).toBe('account compromised');
      expect(detectAccountBlock('This account is temporarily blocked.')).toBe('temporarily blocked');
      expect(detectAccountBlock('Post removed due to community guidelines violation.')).toBe('community guidelines');
    });

    it('returns null for normal errors or safe responses', () => {
      expect(detectAccountBlock('')).toBeNull();
      expect(detectAccountBlock('Network timeout connecting to bridge')).toBeNull();
      expect(detectAccountBlock('Device screen off')).toBeNull();
      expect(detectAccountBlock('Element not found on screen')).toBeNull();
    });
  });

  describe('handlePotentialBlock', () => {
    it('returns false when accountId is missing', async () => {
      const mockSupabase = {
        from: vi.fn(),
      };

      const result = await handlePotentialBlock(mockSupabase as unknown as SupabaseClient, undefined, 'Action Blocked');
      expect(result).toBe(false);
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('returns false when error message contains no block indicators', async () => {
      const mockSupabase = {
        from: vi.fn(),
      };

      const result = await handlePotentialBlock(mockSupabase as unknown as SupabaseClient, 'acc-123', 'Adb connection timeout');
      expect(result).toBe(false);
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('updates account in database to is_blocked = true and inserts audit log when block indicator is detected', async () => {
      const updatePayloads: Record<string, unknown>[] = [];
      const auditPayloads: Record<string, unknown>[] = [];

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'accounts') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: 'acc-123', username: 'pilot_user', platform: 'instagram' },
                  }),
                })),
              })),
              update: vi.fn((payload) => {
                updatePayloads.push(payload);
                return {
                  eq: vi.fn((col, val) => {
                    expect(col).toBe('id');
                    expect(val).toBe('acc-123');
                    return Promise.resolve({ error: null });
                  }),
                };
              }),
            };
          }
          if (table === 'audit_logs') {
            return {
              insert: vi.fn((payload) => {
                auditPayloads.push(payload);
                return Promise.resolve({ error: null });
              }),
            };
          }
          throw new Error(`Unexpected table: ${table}`);
        }),
      };

      const result = await handlePotentialBlock(
        mockSupabase as unknown as SupabaseClient,
        'acc-123',
        'Warning: We restrict certain activity to protect our community.'
      );

      expect(result).toBe(true);
      expect(updatePayloads).toHaveLength(1);
      expect(updatePayloads[0]).toMatchObject({
        is_blocked: true,
        detected_block_reason: 'Detected keyword: "we restrict certain activity"',
      });
      expect(updatePayloads[0].updated_at).toBeDefined();

      expect(auditPayloads).toHaveLength(1);
      expect(auditPayloads[0]).toMatchObject({
        action: 'ACCOUNT_QUARANTINED',
        resource_type: 'account',
        resource_id: 'acc-123',
        metadata_json: {
          detected_keyword: 'we restrict certain activity',
          username: 'pilot_user',
          platform: 'instagram',
        },
      });
    });

    it('dispatches outbound webhook alert when webhookUrl is provided', async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'accounts') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: 'acc-999', username: 'alert_target', platform: 'tiktok' },
                  }),
                })),
              })),
              update: vi.fn(() => ({
                eq: vi.fn().mockResolvedValue({ error: null }),
              })),
            };
          }
          if (table === 'audit_logs') {
            return {
              insert: vi.fn().mockResolvedValue({ error: null }),
            };
          }
          throw new Error(`Unexpected table: ${table}`);
        }),
      };

      const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });

      const result = await handlePotentialBlock(
        mockSupabase as unknown as SupabaseClient,
        'acc-999',
        'Suspicious activity detected on your account.',
        {
          webhookUrl: 'https://alerts.example.com/webhook',
          fetchFn: mockFetch as unknown as typeof fetch,
        }
      );

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://alerts.example.com/webhook');
      expect(options.method).toBe('POST');
      const body = JSON.parse(options.body as string);
      expect(body).toMatchObject({
        event: 'ACCOUNT_QUARANTINED',
        accountId: 'acc-999',
        username: 'alert_target',
        platform: 'tiktok',
        detectedReason: 'suspicious activity',
      });
    });

    it('falls back safely if webhook dispatch throws an error', async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'accounts') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: 'acc-err', username: 'user_err', platform: 'instagram' },
                  }),
                })),
              })),
              update: vi.fn(() => ({
                eq: vi.fn().mockResolvedValue({ error: null }),
              })),
            };
          }
          if (table === 'audit_logs') {
            return {
              insert: vi.fn().mockResolvedValue({ error: null }),
            };
          }
          throw new Error(`Unexpected table: ${table}`);
        }),
      };

      const failingFetch = vi.fn().mockRejectedValue(new Error('Network connection refused'));

      const result = await handlePotentialBlock(
        mockSupabase as unknown as SupabaseClient,
        'acc-err',
        'Your account compromised. Please change your password.',
        {
          webhookUrl: 'https://broken.webhook.url/hook',
          fetchFn: failingFetch as unknown as typeof fetch,
        }
      );

      expect(result).toBe(true); // Should not fail overall operation
      expect(failingFetch).toHaveBeenCalledTimes(1);
    });

    it('returns false and logs error when database update fails', async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'accounts') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null }),
                })),
              })),
              update: vi.fn(() => ({
                eq: vi.fn().mockResolvedValue({ error: new Error('DB connection lost') }),
              })),
            };
          }
          return { insert: vi.fn().mockResolvedValue({ error: null }) };
        }),
      };

      const result = await handlePotentialBlock(mockSupabase as unknown as SupabaseClient, 'acc-123', 'action blocked');
      expect(result).toBe(false);
    });
  });
});
