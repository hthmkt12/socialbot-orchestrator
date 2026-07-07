import type { DeviceLock, UserRole } from '../../lib/database.types';
import type { DeviceSetupChecklistItem } from './device-setup-checklist';
import type { DeviceSetupDeviceRow } from './device-setup-derived-state';
import type {
  DeviceLockSnapshot,
  DeviceSetupDiagnostic,
} from '../../lib/device-setup-diagnostics';
import type { SetupProbeKind, SetupProbeResult } from '../../lib/device-setup';
import type { VerificationSnapshot } from './device-setup-verification-runtime';
import type { DeviceSetupTab } from './device-setup-shell';
import {
  DeviceSetupGuideTab,
  DeviceSetupProtocolTab,
  DeviceSetupTroubleshootTab,
} from './device-setup-static-tabs';
import { DeviceSetupVerifyTab } from './device-setup-verify-tab';

export function DeviceSetupPageTabContent({
  activeProbeBackend,
  activeTab,
  autoJsScript,
  canForceClearLocks,
  canManageLocks,
  checklist,
  cleanupExpiredLocksLoading,
  deviceLockSnapshot,
  deviceRows,
  forceClearLockId,
  gatewayBaseUrl,
  gatewayWsUrl,
  handleCleanupExpiredLocks,
  handleForceClearDeviceLock,
  handlePrepareReconnect,
  mobileMcpBridgeUrl,
  operatorDiagnostics,
  probeLoadingKind,
  probeResults,
  profileRole,
  runProbe,
  runVerification,
  selectedDevice,
  selectedDeviceActiveLock,
  selectedDeviceExpiredLock,
  selectedDeviceId,
  selectedDeviceLabel,
  setGatewayBaseUrl,
  setMobileMcpBridgeUrl,
  setSelectedDeviceId,
  setWorkerBaseUrl,
  supabaseAnonKey,
  supabaseUrl,
  verification,
  workerBaseUrl,
}: {
  activeProbeBackend: 'mobile-mcp' | 'laixi';
  activeTab: DeviceSetupTab;
  autoJsScript: string;
  canForceClearLocks: boolean;
  canManageLocks: boolean;
  checklist: DeviceSetupChecklistItem[];
  cleanupExpiredLocksLoading: boolean;
  deviceLockSnapshot: DeviceLockSnapshot;
  deviceRows: DeviceSetupDeviceRow[];
  forceClearLockId: string | null;
  gatewayBaseUrl: string;
  gatewayWsUrl: string;
  handleCleanupExpiredLocks: () => Promise<void>;
  handleForceClearDeviceLock: (lockId: string) => Promise<void>;
  handlePrepareReconnect: () => Promise<void>;
  mobileMcpBridgeUrl: string;
  operatorDiagnostics: DeviceSetupDiagnostic[];
  probeLoadingKind: SetupProbeKind | null;
  probeResults: Partial<Record<SetupProbeKind, SetupProbeResult>>;
  profileRole: UserRole | undefined;
  runProbe: (kind: SetupProbeKind) => Promise<void>;
  runVerification: () => Promise<void>;
  selectedDevice: DeviceSetupDeviceRow | null;
  selectedDeviceActiveLock: DeviceLock | null;
  selectedDeviceExpiredLock: DeviceLock | null;
  selectedDeviceId: string;
  selectedDeviceLabel: string | null;
  setGatewayBaseUrl: (value: string) => void;
  setMobileMcpBridgeUrl: (value: string) => void;
  setSelectedDeviceId: (value: string) => void;
  setWorkerBaseUrl: (value: string) => void;
  supabaseAnonKey: string | undefined;
  supabaseUrl: string | undefined;
  verification: VerificationSnapshot;
  workerBaseUrl: string;
}) {
  if (activeTab === 'verify') {
    return (
      <DeviceSetupVerifyTab
        activeProbeBackend={activeProbeBackend}
        canForceClearLocks={canForceClearLocks}
        canManageLocks={canManageLocks}
        checklist={checklist}
        cleanupExpiredLocksLoading={cleanupExpiredLocksLoading}
        deviceLockSnapshot={deviceLockSnapshot}
        deviceRows={deviceRows}
        forceClearLockId={forceClearLockId}
        gatewayBaseUrl={gatewayBaseUrl}
        gatewayWsUrl={gatewayWsUrl}
        handleCleanupExpiredLocks={handleCleanupExpiredLocks}
        handleForceClearDeviceLock={handleForceClearDeviceLock}
        handlePrepareReconnect={handlePrepareReconnect}
        mobileMcpBridgeUrl={mobileMcpBridgeUrl}
        operatorDiagnostics={operatorDiagnostics}
        probeLoadingKind={probeLoadingKind}
        probeResults={probeResults}
        profileRole={profileRole}
        runProbe={runProbe}
        runVerification={runVerification}
        selectedDevice={selectedDevice}
        selectedDeviceActiveLock={selectedDeviceActiveLock}
        selectedDeviceExpiredLock={selectedDeviceExpiredLock}
        selectedDeviceId={selectedDeviceId}
        selectedDeviceLabel={selectedDeviceLabel}
        setGatewayBaseUrl={setGatewayBaseUrl}
        setMobileMcpBridgeUrl={setMobileMcpBridgeUrl}
        setSelectedDeviceId={setSelectedDeviceId}
        setWorkerBaseUrl={setWorkerBaseUrl}
        verification={verification}
        workerBaseUrl={workerBaseUrl}
      />
    );
  }

  if (activeTab === 'guide') {
    return (
      <DeviceSetupGuideTab
        autoJsScript={autoJsScript}
        gatewayWsUrl={gatewayWsUrl}
        supabaseAnonKey={supabaseAnonKey}
        supabaseUrl={supabaseUrl}
      />
    );
  }

  if (activeTab === 'protocol') {
    return <DeviceSetupProtocolTab />;
  }

  return <DeviceSetupTroubleshootTab />;
}
