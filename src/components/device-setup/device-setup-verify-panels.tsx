import Badge from '../ui/Badge';
import type { Device } from '../../lib/database.types';
import type { getDeviceHealthSummary } from '../../lib/device-health';
import type { SetupProbeKind, SetupProbeResult } from '../../lib/device-setup';
import { CheckRow } from './device-setup-cards';
import { type CheckTone } from './device-setup-formatters';
import {
  DeviceLiveProbeActions,
  DeviceLiveProbeSelector,
} from './device-setup-live-probe-controls';
import {
  DeviceLiveProbeResults,
  RuntimeEndpointInputs,
} from './device-setup-verify-sections';

type DeviceHealthSummary = ReturnType<typeof getDeviceHealthSummary>;

interface DeviceSetupChecklistItem {
  title: string;
  tone: CheckTone;
  detail: string;
}

interface DeviceSetupDeviceRow {
  device: Device;
  health: DeviceHealthSummary;
}

export function RuntimeEndpointsPanel({
  checklist,
  gatewayBaseUrl,
  gatewayWsUrl,
  mobileMcpBridgeUrl,
  onGatewayBaseUrlChange,
  onMobileMcpBridgeUrlChange,
  onWorkerBaseUrlChange,
  workerBaseUrl,
}: {
  checklist: DeviceSetupChecklistItem[];
  gatewayBaseUrl: string;
  gatewayWsUrl: string;
  mobileMcpBridgeUrl: string;
  onGatewayBaseUrlChange: (value: string) => void;
  onMobileMcpBridgeUrlChange: (value: string) => void;
  onWorkerBaseUrlChange: (value: string) => void;
  workerBaseUrl: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="text-base font-semibold text-gray-900">Runtime endpoints</h4>
          <p className="text-xs text-gray-500 mt-1">
            Use HTTP origins that the browser can actually reach. For remote HTTPS app origins, proxy the gateway/worker or use same-origin routing.
          </p>
        </div>
        <Badge variant="gray">Live checks</Badge>
      </div>

      <RuntimeEndpointInputs
        gatewayBaseUrl={gatewayBaseUrl}
        gatewayWsUrl={gatewayWsUrl}
        mobileMcpBridgeUrl={mobileMcpBridgeUrl}
        onGatewayBaseUrlChange={onGatewayBaseUrlChange}
        onMobileMcpBridgeUrlChange={onMobileMcpBridgeUrlChange}
        onWorkerBaseUrlChange={onWorkerBaseUrlChange}
        workerBaseUrl={workerBaseUrl}
      />

      <div className="space-y-3">
        {checklist.map((item) => (
          <CheckRow key={item.title} title={item.title} tone={item.tone} detail={item.detail} />
        ))}
      </div>
    </div>
  );
}

export function DeviceLiveProbesPanel({
  activeProbeBackend,
  deviceRows,
  onRunProbe,
  onSelectedDeviceChange,
  probeLoadingKind,
  probeResults,
  selectedDevice,
  selectedDeviceId,
}: {
  activeProbeBackend: 'mobile-mcp' | 'laixi';
  deviceRows: DeviceSetupDeviceRow[];
  onRunProbe: (kind: SetupProbeKind) => void;
  onSelectedDeviceChange: (deviceId: string) => void;
  probeLoadingKind: SetupProbeKind | null;
  probeResults: Partial<Record<SetupProbeKind, SetupProbeResult>>;
  selectedDevice: DeviceSetupDeviceRow | null;
  selectedDeviceId: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="text-base font-semibold text-gray-900">Device live probes</h4>
          <p className="text-xs text-gray-500 mt-1">
            Use these probes to verify that the selected device is really dispatchable through the active worker backend.
          </p>
        </div>
        <Badge variant="blue">{activeProbeBackend === 'mobile-mcp' ? 'Mobile MCP bridge' : 'Gateway dispatch'}</Badge>
      </div>

      <div>
        <DeviceLiveProbeSelector
          deviceRows={deviceRows}
          onSelectedDeviceChange={onSelectedDeviceChange}
          selectedDevice={selectedDevice}
          selectedDeviceId={selectedDeviceId}
        />
      </div>

      <DeviceLiveProbeActions
        onRunProbe={onRunProbe}
        probeLoadingKind={probeLoadingKind}
        selectedDevice={selectedDevice}
      />

      <DeviceLiveProbeResults probeResults={probeResults} />
    </div>
  );
}
