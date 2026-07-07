import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { cleanupExpiredLocksFlow, forceClearDeviceLockFlow } from './device-setup-action-helpers';
import { deleteDeviceLockById, deleteExpiredDeviceLocks } from './device-setup-verification-runtime';

vi.mock('./device-setup-verification-runtime', () => ({
  deleteDeviceLockById: vi.fn(),
  deleteExpiredDeviceLocks: vi.fn(),
  runDeviceSetupProbe: vi.fn(),
}));

const mockDeleteDeviceLockById = vi.mocked(deleteDeviceLockById) as Mock;
const mockDeleteExpiredDeviceLocks = vi.mocked(deleteExpiredDeviceLocks) as Mock;

function queryClient() {
  return {
    invalidateQueries: vi.fn(),
  };
}

describe('device setup lock cleanup flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('AD-CAN-007 lets admins force clear a visible active device lock', async () => {
    const addToast = vi.fn();
    const runVerification = vi.fn().mockResolvedValue(undefined);
    const setForceClearLockId = vi.fn();
    const client = queryClient();
    mockDeleteDeviceLockById.mockResolvedValue(undefined);

    await forceClearDeviceLockFlow({
      addToast,
      canForceClearLocks: true,
      lockId: 'lock-1',
      profileRole: 'ADMIN',
      queryClient: client as never,
      runVerification,
      setForceClearLockId,
    });

    expect(setForceClearLockId).toHaveBeenNthCalledWith(1, 'lock-1');
    expect(mockDeleteDeviceLockById).toHaveBeenCalledWith('lock-1');
    expect(addToast).toHaveBeenCalledWith('Device lock cleared', 'success');
    expect(setForceClearLockId).toHaveBeenLastCalledWith(null);
    expect(client.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['device-locks'] });
    expect(runVerification).toHaveBeenCalled();
  });

  it('AD-CAN-007 blocks non-admins from force clearing active device locks', async () => {
    const addToast = vi.fn();

    await forceClearDeviceLockFlow({
      addToast,
      canForceClearLocks: false,
      lockId: 'lock-1',
      profileRole: 'OPERATOR',
      queryClient: queryClient() as never,
      runVerification: vi.fn(),
      setForceClearLockId: vi.fn(),
    });

    expect(addToast).toHaveBeenCalledWith('Only admins can force clear active device locks', 'error');
    expect(mockDeleteDeviceLockById).not.toHaveBeenCalled();
  });

  it('OP-CAN-017 lets operators clean only expired locks', async () => {
    const addToast = vi.fn();
    const runVerification = vi.fn().mockResolvedValue(undefined);
    const setCleanupExpiredLocksLoading = vi.fn();
    const client = queryClient();
    mockDeleteExpiredDeviceLocks.mockResolvedValue(2);

    await cleanupExpiredLocksFlow({
      addToast,
      canManageLocks: true,
      profileRole: 'OPERATOR',
      queryClient: client as never,
      runVerification,
      setCleanupExpiredLocksLoading,
    });

    expect(setCleanupExpiredLocksLoading).toHaveBeenNthCalledWith(1, true);
    expect(mockDeleteExpiredDeviceLocks).toHaveBeenCalled();
    expect(addToast).toHaveBeenCalledWith('Cleared 2 expired locks', 'success');
    expect(setCleanupExpiredLocksLoading).toHaveBeenLastCalledWith(false);
    expect(client.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['device-locks'] });
    expect(runVerification).toHaveBeenCalled();
  });
});
