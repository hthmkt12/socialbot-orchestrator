import type { QueryClient } from '@tanstack/react-query';
import type { SetupProbeKind, SetupProbeResult } from '../../lib/device-setup';
import type { UserRole } from '../../lib/database.types';
import type { DeviceSetupDeviceRow } from './device-setup-derived-state';
import type { DeviceSetupTab } from './device-setup-shell';
import {
  deleteDeviceLockById,
  deleteExpiredDeviceLocks,
  runDeviceSetupProbe,
} from './device-setup-verification-runtime';

export async function runDeviceSetupProbeFlow(args: {
  activeProbeBackend: 'mobile-mcp' | 'laixi';
  gatewayBaseUrl: string;
  kind: SetupProbeKind;
  mobileMcpBridgeUrl: string;
  runVerification: () => Promise<void>;
  selectedDevice: DeviceSetupDeviceRow | null;
  setProbeLoadingKind: (kind: SetupProbeKind | null) => void;
  setProbeResults: (
    value:
      | Partial<Record<SetupProbeKind, SetupProbeResult>>
      | ((current: Partial<Record<SetupProbeKind, SetupProbeResult>>) => Partial<Record<SetupProbeKind, SetupProbeResult>>)
  ) => void;
}) {
  const {
    activeProbeBackend,
    gatewayBaseUrl,
    kind,
    mobileMcpBridgeUrl,
    runVerification,
    selectedDevice,
    setProbeLoadingKind,
    setProbeResults,
  } = args;

  if (!selectedDevice) {
    return;
  }

  setProbeLoadingKind(kind);
  try {
    const result = await runDeviceSetupProbe({
      activeProbeBackend,
      gatewayBaseUrl,
      kind,
      mobileMcpBridgeUrl,
      selectedDevice: selectedDevice.device,
    });
    setProbeResults((current) => ({ ...current, [kind]: result }));
  } catch (error) {
    setProbeResults((current) => ({
      ...current,
      [kind]: {
        kind,
        success: false,
        checkedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      },
    }));
  } finally {
    setProbeLoadingKind(null);
    void runVerification();
  }
}

export async function prepareDeviceReconnectFlow(args: {
  addToast: (message: string, tone: 'success' | 'error' | 'info', durationMs?: number) => void;
  autoJsScript: string;
  selectedDeviceLabel: string | null;
  setActiveTab: (tab: DeviceSetupTab) => void;
  setProbeResults: (
    value:
      | Partial<Record<SetupProbeKind, SetupProbeResult>>
      | ((current: Partial<Record<SetupProbeKind, SetupProbeResult>>) => Partial<Record<SetupProbeKind, SetupProbeResult>>)
  ) => void;
}) {
  const { addToast, autoJsScript, selectedDeviceLabel, setActiveTab, setProbeResults } = args;

  if (!selectedDeviceLabel) {
    addToast('Select a device before preparing reconnect', 'error');
    return;
  }

  setProbeResults({});
  setActiveTab('guide');

  try {
    await navigator.clipboard.writeText(autoJsScript);
    addToast('Fresh agent bootstrap copied. Re-run it on the device, then return to Verify.', 'success', 5000);
  } catch {
    addToast('Open Guide and copy the latest agent bootstrap before reconnecting the device.', 'info', 5000);
  }
}

export async function cleanupExpiredLocksFlow(args: {
  addToast: (message: string, tone: 'success' | 'error' | 'info', durationMs?: number) => void;
  canManageLocks: boolean;
  profileRole: UserRole | undefined;
  queryClient: QueryClient;
  runVerification: () => Promise<void>;
  setCleanupExpiredLocksLoading: (loading: boolean) => void;
}) {
  const {
    addToast,
    canManageLocks,
    profileRole,
    queryClient,
    runVerification,
    setCleanupExpiredLocksLoading,
  } = args;

  if (!profileRole) {
    addToast('You must be logged in to clean expired locks', 'error');
    return;
  }

  if (!canManageLocks) {
    addToast('Only operators and admins can clean expired locks', 'error');
    return;
  }

  setCleanupExpiredLocksLoading(true);
  try {
    const clearedCount = await deleteExpiredDeviceLocks();
    addToast(
      clearedCount > 0
        ? `Cleared ${clearedCount} expired lock${clearedCount === 1 ? '' : 's'}`
        : 'No expired locks needed cleanup',
      clearedCount > 0 ? 'success' : 'info'
    );
  } catch (error) {
    addToast(error instanceof Error ? error.message : 'Failed to clean expired locks', 'error', 5000);
  } finally {
    setCleanupExpiredLocksLoading(false);
    void queryClient.invalidateQueries({ queryKey: ['device-locks'] });
    void runVerification();
  }
}

export async function forceClearDeviceLockFlow(args: {
  addToast: (message: string, tone: 'success' | 'error' | 'info', durationMs?: number) => void;
  canForceClearLocks: boolean;
  lockId: string;
  profileRole: UserRole | undefined;
  queryClient: QueryClient;
  runVerification: () => Promise<void>;
  setForceClearLockId: (lockId: string | null) => void;
}) {
  const {
    addToast,
    canForceClearLocks,
    lockId,
    profileRole,
    queryClient,
    runVerification,
    setForceClearLockId,
  } = args;

  if (!profileRole) {
    addToast('You must be logged in to clear device locks', 'error');
    return;
  }

  if (!canForceClearLocks) {
    addToast('Only admins can force clear active device locks', 'error');
    return;
  }

  setForceClearLockId(lockId);
  try {
    await deleteDeviceLockById(lockId);
    addToast('Device lock cleared', 'success');
  } catch (error) {
    addToast(error instanceof Error ? error.message : 'Failed to clear device lock', 'error', 5000);
  } finally {
    setForceClearLockId(null);
    void queryClient.invalidateQueries({ queryKey: ['device-locks'] });
    void runVerification();
  }
}
