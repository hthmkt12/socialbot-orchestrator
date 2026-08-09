import { describe, expect, it, vi } from 'vitest';
import {
  acquireDeviceLock,
  releaseDeviceLock,
  renewDeviceLock,
} from './worker-device-locks.js';

function createSupabaseMock(existing: unknown = null, insertError: unknown = null) {
  const calls = {
    deletes: [] as unknown[],
    inserts: [] as unknown[],
    updates: [] as unknown[],
  };
  const expiredDelete = {
    lt: vi.fn().mockResolvedValue({ error: null }),
  };
  const existingDelete = {
    eq: vi.fn(),
  };
  existingDelete.eq.mockImplementation((field: string) => {
    if (field === 'device_id') return { eq: existingDelete.eq };
    return Promise.resolve({ error: null });
  });
  const selectQuery = {
    eq: vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({ data: existing, error: null }),
    }),
  };
  const insert = vi.fn((payload: unknown) => {
    calls.inserts.push(payload);
    return Promise.resolve({ error: insertError });
  });
  const update = vi.fn((payload: unknown) => {
    calls.updates.push(payload);
    return {
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    };
  });
  const from = vi.fn((table: string) => {
    if (table !== 'device_locks') throw new Error(`unexpected table ${table}`);
    return {
      delete: vi.fn(() => {
        calls.deletes.push('delete');
        return {
          lt: expiredDelete.lt,
          eq: existingDelete.eq,
        };
      }),
      select: vi.fn(() => selectQuery),
      insert,
      update,
    };
  });

  return {
    supabase: { from } as never,
    calls,
    expiredDelete,
    existingDelete,
    insert,
    update,
  };
}

describe('worker device locks', () => {
  it('rejects an active lock without deleting or inserting ownership', async () => {
    const mock = createSupabaseMock({
      id: 'lock-1',
      workflow_run_id: 'other-run',
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    });

    const result = await acquireDeviceLock(mock.supabase, 'device-1', 'run-1');

    expect(result).toEqual({ acquired: false, reason: 'Device is locked by run other-run' });
    expect(mock.insert).not.toHaveBeenCalled();
    expect(mock.existingDelete.eq).not.toHaveBeenCalled();
  });

  it('deletes expired ownership before inserting replacement ownership', async () => {
    const mock = createSupabaseMock({
      id: 'lock-1',
      workflow_run_id: 'expired-run',
      expires_at: new Date(Date.now() - 60_000).toISOString(),
    });

    const result = await acquireDeviceLock(mock.supabase, 'device-1', 'run-1', 5_000);

    expect(result.acquired).toBe(true);
    expect(mock.existingDelete.eq).toHaveBeenCalledWith('id', 'lock-1');
    expect(mock.insert).toHaveBeenCalledWith(expect.objectContaining({
      device_id: 'device-1',
      workflow_run_id: 'run-1',
      expires_at: expect.any(String),
    }));
  });

  it('treats unique insert conflicts as another run owning the device', async () => {
    const mock = createSupabaseMock(null, { code: '23505', message: 'duplicate key' });

    const result = await acquireDeviceLock(mock.supabase, 'device-1', 'run-1');

    expect(result).toEqual({ acquired: false, reason: 'Device is locked by another run' });
  });

  it('renews only matching device and run ownership', async () => {
    const mock = createSupabaseMock();

    const renewed = await renewDeviceLock(mock.supabase, 'device-1', 'run-1', 5_000);

    expect(renewed).toBe(true);
    expect(mock.update).toHaveBeenCalledWith({ expires_at: expect.any(String) });
    const updateChain = mock.update.mock.results[0]?.value;
    expect(updateChain.eq).toHaveBeenCalledWith('device_id', 'device-1');
    expect(updateChain.eq.mock.results[0]?.value.eq).toHaveBeenCalledWith('workflow_run_id', 'run-1');
  });

  it('releases only matching device and run ownership', async () => {
    const mock = createSupabaseMock();

    await releaseDeviceLock(mock.supabase, 'device-1', 'run-1');

    expect(mock.existingDelete.eq).toHaveBeenCalledWith('device_id', 'device-1');
    expect(mock.existingDelete.eq.mock.results[0]?.value.eq).toHaveBeenCalledWith('workflow_run_id', 'run-1');
  });
});
