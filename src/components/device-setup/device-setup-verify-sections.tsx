import type { ReactNode } from 'react';
import type { SetupProbeKind, SetupProbeResult } from '../../lib/device-setup';
import { DeviceSetupProbeResultCard } from './device-setup-probe-result-card';

interface RuntimeEndpointInputsProps {
  gatewayBaseUrl: string;
  gatewayWsUrl: string;
  mobileMcpBridgeUrl: string;
  onGatewayBaseUrlChange: (value: string) => void;
  onMobileMcpBridgeUrlChange: (value: string) => void;
  onWorkerBaseUrlChange: (value: string) => void;
  workerBaseUrl: string;
}

function RuntimeEndpointInput({
  detail,
  label,
  onChange,
  value,
}: {
  detail: ReactNode;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1.5">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
      />
      <p className="text-[11px] text-gray-500 mt-1">{detail}</p>
    </div>
  );
}

export function RuntimeEndpointInputs({
  gatewayBaseUrl,
  gatewayWsUrl,
  mobileMcpBridgeUrl,
  onGatewayBaseUrlChange,
  onMobileMcpBridgeUrlChange,
  onWorkerBaseUrlChange,
  workerBaseUrl,
}: RuntimeEndpointInputsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <RuntimeEndpointInput
        label="Gateway HTTP base URL"
        value={gatewayBaseUrl}
        onChange={onGatewayBaseUrlChange}
        detail={<><span>Websocket URL for the agent script: </span><code>{gatewayWsUrl}</code></>}
      />
      <RuntimeEndpointInput
        label="Worker HTTP base URL"
        value={workerBaseUrl}
        onChange={onWorkerBaseUrlChange}
        detail={<><span>Default worker health port is </span><code>4310</code><span>.</span></>}
      />
      <RuntimeEndpointInput
        label="Mobile MCP bridge URL"
        value={mobileMcpBridgeUrl}
        onChange={onMobileMcpBridgeUrlChange}
        detail={<><span>Default bridge health port is </span><code>4321</code><span>.</span></>}
      />
    </div>
  );
}

export function DeviceLiveProbeResults({
  probeResults,
}: {
  probeResults: Partial<Record<SetupProbeKind, SetupProbeResult>>;
}) {
  return (
    <>
      {(['current-app', 'screenshot'] as SetupProbeKind[]).map((kind) => {
        const result = probeResults[kind];
        if (!result) return null;
        return <DeviceSetupProbeResultCard key={kind} kind={kind} result={result} />;
      })}
    </>
  );
}
