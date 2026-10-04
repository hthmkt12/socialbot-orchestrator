import { describe, expect, it, vi } from 'vitest';
import { detectAccountBlock, handlePotentialBlock } from './account-block-detector';

describe('account-block-detector', () => {
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

      const result = await handlePotentialBlock(mockSupabase as any, undefined, 'Action Blocked');
      expect(result).toBe(false);
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('returns false when error message contains no block indicators', async () => {
      const mockSupabase = {
        from: vi.fn(),
      };

      const result = await handlePotentialBlock(mockSupabase as any, 'acc-123', 'Adb connection timeout');
      expect(result).toBe(false);
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('updates account in database to is_blocked = true when block indicator is detected', async () => {
      const updatePayloads: Record<string, unknown>[] = [];
      const mockSupabase = {
        from: vi.fn((table: string) => {
          expect(table).toBe('accounts');
          return {
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
        }),
      };

      const result = await handlePotentialBlock(
        mockSupabase as any,
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
    });

    it('returns false and logs error when database update fails', async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          update: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ error: new Error('DB connection lost') }),
          })),
        })),
      };

      const result = await handlePotentialBlock(mockSupabase as any, 'acc-123', 'action blocked');
      expect(result).toBe(false);
    });
  });
});
