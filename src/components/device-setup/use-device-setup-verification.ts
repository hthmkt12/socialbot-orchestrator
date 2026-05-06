import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  type SetupProbeKind,
  type SetupProbeResult,
} from '../../lib/device-setup';
import { useAuthStore } from '../../stores/auth';
import { useUIStore } from '../../stores/ui';
import { buildDeviceSetupDerivedState } from './device-setup-derived-state';
import {
  EMPTY_VERIFICATION,
  fetchDeviceSetupVerification,
  selectAvailableDeviceId,
  type VerificationSnapshot,
} from './device-setup-verification-runtime';
import type { DeviceSetupTab } from './device-setup-shell';
import { useDeviceSetupRuntimeConfig } from './use-device-setup-runtime-config';
import { useDeviceSetupVerificationActions } from './use-device-setup-verification-actions';

export const useDeviceSetupVerification = () => {
  const queryClient = useQueryClient();
  const profile = useAuthStore((s) => s.profile);
  const addToast = useUIStore((s) => s.addToast);
  const [activeTab, setActiveTab] = useState<DeviceSetupTab>('verify');
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [probeLoadingKind, setProbeLoadingKind] = useState<SetupProbeKind | null>(null);
  const [cleanupExpiredLocksLoading, setCleanupExpiredLocksLoading] = useState(false);
  const [probeResults, setProbeResults] = useState<Partial<Record<SetupProbeKind, SetupProbeResult>>>({});
  const [verification, setVerification] = useState<VerificationSnapshot>(EMPTY_VERIFICATION);
  const {
    autoJsScript,
    gatewayBaseUrl,
    gatewayWsUrl,
    mobileMcpBridgeUrl,
    normalizedGatewayBaseUrl,
    normalizedMobileMcpBridgeUrl,
    normalizedWorkerBaseUrl,
    setGatewayBaseUrl,
    setMobileMcpBridgeUrl,
    setWorkerBaseUrl,
    workerBaseUrl,
  } = useDeviceSetupRuntimeConfig();

  const derived = useMemo(
    () => buildDeviceSetupDerivedState({ probeResults, selectedDeviceId, verification }),
    [probeResults, selectedDeviceId, verification]
  );
  const canManageLocks = profile?.role === 'ADMIN' || profile?.role === 'OPERATOR';
  const selectedDeviceLabel = derived.selectedDevice
    ? `${derived.selectedDevice.device.name || derived.selectedDevice.device.model} (${derived.selectedDevice.device.laixi_device_id})`
    : null;
  const activeProbeBackend = verification.worker?.deviceBackend === 'mobile-mcp' ? 'mobile-mcp' as const : 'laixi' as const;

  const runVerification = useCallback(async () => {
    setVerification((current) => ({ ...current, loading: true }));

    const nextVerification = await fetchDeviceSetupVerification({
      gatewayBaseUrl: normalizedGatewayBaseUrl,
      mobileMcpBridgeUrl: normalizedMobileMcpBridgeUrl,
      workerBaseUrl: normalizedWorkerBaseUrl,
    });
    setVerification(nextVerification);

    setSelectedDeviceId((current) => {
      return selectAvailableDeviceId(nextVerification.devices, current);
    });
  }, [normalizedGatewayBaseUrl, normalizedMobileMcpBridgeUrl, normalizedWorkerBaseUrl]);

  useEffect(() => {
    void runVerification();
  }, [runVerification]);

  useEffect(() => {
    setProbeResults({});
  }, [selectedDeviceId]);

  const {
    handleCleanupExpiredLocks,
    handlePrepareReconnect,
    runProbe,
  } = useDeviceSetupVerificationActions({
    activeProbeBackend,
    addToast,
    autoJsScript,
    canManageLocks,
    normalizedGatewayBaseUrl,
    normalizedMobileMcpBridgeUrl,
    profileRole: profile?.role,
    queryClient,
    runVerification,
    selectedDevice: derived.selectedDevice,
    selectedDeviceLabel,
    setActiveTab,
    setCleanupExpiredLocksLoading,
    setProbeLoadingKind,
    setProbeResults,
  });

  return {
    activeProbeBackend,
    activeTab,
    autoJsScript,
    canManageLocks,
    cleanupExpiredLocksLoading,
    ...derived,
    gatewayBaseUrl,
    gatewayWsUrl,
    handleCleanupExpiredLocks,
    handlePrepareReconnect,
    mobileMcpBridgeUrl,
    probeLoadingKind,
    probeResults,
    profileRole: profile?.role,
    runProbe,
    runVerification,
    selectedDeviceId,
    selectedDeviceLabel,
    setActiveTab,
    setGatewayBaseUrl,
    setMobileMcpBridgeUrl,
    setSelectedDeviceId,
    setWorkerBaseUrl,
    verification,
    workerBaseUrl,
  };
};
