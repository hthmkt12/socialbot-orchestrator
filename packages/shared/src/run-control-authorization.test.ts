import { describe, expect, it } from 'vitest';
import { assertRunControlAuthorized } from './run-control-authorization';

describe('run control authorization', () => {
  it('allows the owning operator', () => {
    expect(() => assertRunControlAuthorized({ userId: 'u1', role: 'OPERATOR', runExists: true, runOwnerId: 'u1' })).not.toThrow();
  });

  it('allows admins to control any existing run', () => {
    expect(() => assertRunControlAuthorized({ userId: 'admin', role: 'ADMIN', runExists: true, runOwnerId: 'u1' })).not.toThrow();
  });

  it.each([
    [{ userId: null, role: 'OPERATOR', runExists: true, runOwnerId: 'u1' }, 401],
    [{ userId: 'u1', role: 'VIEWER', runExists: true, runOwnerId: 'u1' }, 403],
    [{ userId: 'u2', role: 'OPERATOR', runExists: true, runOwnerId: 'u1' }, 403],
    [{ userId: 'u1', role: 'OPERATOR', runExists: false, runOwnerId: null }, 404],
  ] as const)('rejects invalid actor/run state with HTTP %s', (input, status) => {
    try {
      assertRunControlAuthorized(input);
      throw new Error('expected authorization failure');
    } catch (error) {
      expect((error as { status: number }).status).toBe(status);
    }
  });
});
