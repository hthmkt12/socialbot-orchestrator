import type { QueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import type { SetupProbeKind, SetupProbeResult } from '../../lib/device-setup';
import type { UserRole } from '../../lib/database.types';
import type { DeviceSetupDeviceRow } from './device-setup-derived-state';
import type { DeviceSetupTab } from './device-setup-shell';
import {
  cleanupExpiredLocksFlow,
  prepareDeviceReconnectFlow,
  runDeviceSetupProbeFlow,
} from './device-setup-action-helpers';

export function useDeviceSetupVerificationActions({
  activeProbeBackend,
  addToast,
  autoJsScript,
  canManageLocks,
  normalizedGatewayBaseUrl,
  normalizedMobileMcpBridgeUrl,
  profileRole,
  queryClient,
  runVerification,
  selectedDevice,
  selectedDeviceLabel,
  setActiveTab,
  setCleanupExpiredLocksLoading,
  setProbeLoadingKind,
  setProbeResults,
}: {
  activeProbeBackend: 'mobile-mcp' | 'laixi';
  addToast: (message: string, tone: 'success' | 'error' | 'info', durationMs?: number) => void;
  autoJsScript: string;
  canManageLocks: boolean;
  normalizedGatewayBaseUrl: string;
  normalizedMobileMcpBridgeUrl: string;
  profileRole: UserRole | undefined;
  queryClient: QueryClient;
  runVerification: () => Promise<void>;
  selectedDevice: DeviceSetupDeviceRow | null;
  selectedDeviceLabel: string | null;
  setActiveTab: (tab: DeviceSetupTab) => void;
  setCleanupExpiredLocksLoading: (loading: boolean) => void;
  setProbeLoadingKind: (kind: SetupProbeKind | null) => void;
  setProbeResults: (
    value:
      | Partial<Record<SetupProbeKind, SetupProbeResult>>
      | ((current: Partial<Record<SetupProbeKind, SetupProbeResult>>) => Partial<Record<SetupProbeKind, SetupProbeResult>>)
  ) => void;
}) {
  const runProbe = useCallback(async (kind: SetupProbeKind) => {
    await runDeviceSetupProbeFlow({
      activeProbeBackend,
      gatewayBaseUrl: normalizedGatewayBaseUrl,
      kind,
      mobileMcpBridgeUrl: normalizedMobileMcpBridgeUrl,
      runVerification,
      selectedDevice,
      setProbeLoadingKind,
      setProbeResults,
    });
  }, [
    activeProbeBackend,
    normalizedGatewayBaseUrl,
    normalizedMobileMcpBridgeUrl,
    runVerification,
    selectedDevice,
    setProbeLoadingKind,
    setProbeResults,
  ]);

  const handlePrepareReconnect = useCallback(async () => {
    await prepareDeviceReconnectFlow({
      addToast,
      autoJsScript,
      selectedDeviceLabel,
      setActiveTab,
      setProbeResults,
    });
  }, [addToast, autoJsScript, selectedDeviceLabel, setActiveTab, setProbeResults]);

  const handleCleanupExpiredLocks = useCallback(async () => {
    await cleanupExpiredLocksFlow({
      addToast,
      canManageLocks,
      profileRole,
      queryClient,
      runVerification,
      setCleanupExpiredLocksLoading,
    });
  }, [
    addToast,
    canManageLocks,
    profileRole,
    queryClient,
    runVerification,
    setCleanupExpiredLocksLoading,
  ]);

  return {
    handleCleanupExpiredLocks,
    handlePrepareReconnect,
    runProbe,
  };
}
