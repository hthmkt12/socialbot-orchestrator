import { describe, expect, it } from 'vitest';
import {
  OUT_OF_SCOPE_GUARDRAIL_STATUS,
  isOutOfScopeRoute,
} from './out-of-scope-guardrails';

describe('out-of-scope guardrails', () => {
  it('OOS-001/OOS-002/OOS-004 blocks route segments that would imply extra product scope', () => {
    expect(isOutOfScopeRoute('/marketplace/templates')).toBe(true);
    expect(isOutOfScopeRoute('/billing/checkout')).toBe(true);
    expect(isOutOfScopeRoute('/collaboration/macros')).toBe(true);
    expect(isOutOfScopeRoute('/runs')).toBe(false);
  });

  it('OOS-002 blocks billing/payment route segments', () => {
    expect(isOutOfScopeRoute('/billing')).toBe(true);
    expect(isOutOfScopeRoute('/payment/session')).toBe(true);
    expect(isOutOfScopeRoute('/checkout')).toBe(true);
  });

  it('OOS-003 blocks public social graph routes without blocking operational social dashboard', () => {
    expect(isOutOfScopeRoute('/social-graph/followers')).toBe(true);
    expect(isOutOfScopeRoute('/social-network/feed')).toBe(true);
    expect(isOutOfScopeRoute('/social-dashboard')).toBe(false);
  });

  it('OOS-001 through OOS-016 have final traceability status', () => {
    expect(OUT_OF_SCOPE_GUARDRAIL_STATUS.map((entry) => entry.id)).toEqual([
      'OOS-001',
      'OOS-002',
      'OOS-003',
      'OOS-004',
      'OOS-005',
      'OOS-006',
      'OOS-007',
      'OOS-008',
      'OOS-009',
      'OOS-010',
      'OOS-011',
      'OOS-012',
      'OOS-013',
      'OOS-014',
      'OOS-015',
      'OOS-016',
    ]);
  });

  it('has no partial out-of-scope guardrail statuses after final drift cleanup', () => {
    const statuses = OUT_OF_SCOPE_GUARDRAIL_STATUS.map((entry) => String(entry.status));
    expect(statuses).not.toContain('partial');
  });
});
