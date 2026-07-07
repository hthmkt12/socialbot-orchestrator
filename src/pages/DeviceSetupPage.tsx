import {
  Cable,
  RefreshCw,
} from 'lucide-react';
import Header from '../components/layout/Header';
import Spinner from '../components/ui/Spinner';
import {
  DeviceSetupHero,
  DeviceSetupTabNav,
} from '../components/device-setup/device-setup-shell';
import {
  DeviceSetupPageTabContent,
} from '../components/device-setup/device-setup-page-tab-content';
import { useDeviceSetupVerification } from '../components/device-setup/use-device-setup-verification';

const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;

export default function DeviceSetupPage() {
  const {
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
    runnableDevices,
    runProbe,
    runVerification,
    selectedDevice,
    selectedDeviceActiveLock,
    selectedDeviceExpiredLock,
    selectedDeviceId,
    selectedDeviceLabel,
    setActiveTab,
    setGatewayBaseUrl,
    setMobileMcpBridgeUrl,
    setSelectedDeviceId,
    setWorkerBaseUrl,
    staleDevices,
    verification,
    workerBaseUrl,
  } = useDeviceSetupVerification();

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-gray-50">
      <Header
        title="Device Setup And Verification"
        subtitle="Operator-first onboarding for gateway, worker, registration, heartbeat freshness, and live probes"
        icon={<Cable className="w-5 h-5 text-sky-500" />}
        actions={
          <button
            onClick={() => void runVerification()}
            disabled={verification.loading}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white text-sm font-medium transition-colors"
          >
            {verification.loading ? <Spinner size="sm" /> : <RefreshCw className="w-4 h-4" />}
            Recheck
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
          <DeviceSetupHero
            checkedAt={verification.checkedAt}
            connectedSessions={verification.gateway?.connectedDevices ?? 0}
            runnableDeviceCount={runnableDevices.length}
            staleDeviceCount={staleDevices.length}
          />

          <DeviceSetupTabNav activeTab={activeTab} onChange={setActiveTab} />

          <DeviceSetupPageTabContent
            activeProbeBackend={activeProbeBackend}
            activeTab={activeTab}
            autoJsScript={autoJsScript}
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
            supabaseAnonKey={SUPABASE_ANON_KEY}
            supabaseUrl={SUPABASE_URL}
            verification={verification}
            workerBaseUrl={workerBaseUrl}
          />
        </div>
      </div>
    </div>
  );
}
