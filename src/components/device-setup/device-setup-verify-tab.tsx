import {
  OperatorDiagnosticsPanel,
  RecoveryActionsPanel,
  SelectedDeviceSummaryPanel,
} from './device-setup-diagnostics-panels';
import {
  DeviceLiveProbesPanel,
  RuntimeEndpointsPanel,
} from './device-setup-verify-panels';
import type { DeviceLockSnapshot } from '../../lib/device-setup-diagnostics';
import type { SetupProbeKind, SetupProbeResult } from '../../lib/device-setup';
import type { getDeviceHealthSummary } from '../../lib/device-health';
import type { Device, DeviceLock, UserRole } from '../../lib/database.types';
import type { DeviceSetupDiagnostic } from '../../lib/device-setup-diagnostics';
import type { DeviceSetupChecklistItem } from './device-setup-checklist';
import type { VerificationSnapshot } from './device-setup-verification-runtime';

type DeviceHealthSummary = ReturnType<typeof getDeviceHealthSummary>;

interface DeviceSetupDeviceRow {
  device: Device;
  health: DeviceHealthSummary;
}

export function DeviceSetupVerifyTab({
  activeProbeBackend,
  canManageLocks,
  checklist,
  cleanupExpiredLocksLoading,
  deviceLockSnapshot,
  deviceRows,
  gatewayBaseUrl,
  gatewayWsUrl,
  handleCleanupExpiredLocks,
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
  verification,
  workerBaseUrl,
}: {
  activeProbeBackend: 'mobile-mcp' | 'laixi';
  canManageLocks: boolean;
  checklist: DeviceSetupChecklistItem[];
  cleanupExpiredLocksLoading: boolean;
  deviceLockSnapshot: DeviceLockSnapshot;
  deviceRows: DeviceSetupDeviceRow[];
  gatewayBaseUrl: string;
  gatewayWsUrl: string;
  handleCleanupExpiredLocks: () => Promise<void>;
  handlePrepareReconnect: () => void;
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
  setSelectedDeviceId: (deviceId: string) => void;
  setWorkerBaseUrl: (value: string) => void;
  verification: VerificationSnapshot;
  workerBaseUrl: string;
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr,1fr] gap-6">
        <RuntimeEndpointsPanel
          checklist={checklist}
          gatewayBaseUrl={gatewayBaseUrl}
          gatewayWsUrl={gatewayWsUrl}
          mobileMcpBridgeUrl={mobileMcpBridgeUrl}
          onGatewayBaseUrlChange={setGatewayBaseUrl}
          onMobileMcpBridgeUrlChange={setMobileMcpBridgeUrl}
          onWorkerBaseUrlChange={setWorkerBaseUrl}
          workerBaseUrl={workerBaseUrl}
        />

        <DeviceLiveProbesPanel
          activeProbeBackend={activeProbeBackend}
          deviceRows={deviceRows}
          onRunProbe={(kind) => void runProbe(kind)}
          onSelectedDeviceChange={setSelectedDeviceId}
          probeLoadingKind={probeLoadingKind}
          probeResults={probeResults}
          selectedDevice={selectedDevice}
          selectedDeviceId={selectedDeviceId}
        />
      </div>

      <OperatorDiagnosticsPanel
        activeLockCount={deviceLockSnapshot.activeLocks.length}
        deviceLocksError={verification.deviceLocksError}
        diagnostics={operatorDiagnostics}
        expiredLockCount={deviceLockSnapshot.expiredLocks.length}
      />

      <RecoveryActionsPanel
        canManageLocks={canManageLocks}
        checkedAt={verification.checkedAt}
        cleanupExpiredLocksLoading={cleanupExpiredLocksLoading}
        deviceLocksError={verification.deviceLocksError}
        expiredLockCount={deviceLockSnapshot.expiredLocks.length}
        loading={verification.loading}
        onCleanupExpiredLocks={() => void handleCleanupExpiredLocks()}
        onPrepareReconnect={() => void handlePrepareReconnect()}
        onRecheck={() => void runVerification()}
        profileRole={profileRole}
        selectedDeviceLabel={selectedDeviceLabel}
      />

      <SelectedDeviceSummaryPanel
        activeLock={selectedDeviceActiveLock}
        deviceLocksError={verification.deviceLocksError}
        expiredLock={selectedDeviceExpiredLock}
        selectedDevice={selectedDevice}
      />
    </div>
  );
}
