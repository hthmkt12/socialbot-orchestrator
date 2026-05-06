import { ShieldCheck, Terminal, Wifi } from 'lucide-react';
import Badge from '../ui/Badge';
import { CodeBlock } from './device-setup-cards';

interface EnvironmentReference {
  label: string;
  value: string;
}

interface DeviceSetupGuideSupportPanelsProps {
  autoJsScript: string;
  envReferences: EnvironmentReference[];
}

export function DeviceSetupGuideSupportPanels({
  autoJsScript,
  envReferences,
}: DeviceSetupGuideSupportPanelsProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h4 className="text-base font-semibold text-gray-900">AutoJS agent bootstrap</h4>
            <p className="text-xs text-gray-500 mt-1">
              Regenerated from the current gateway HTTP base URL. If you change the gateway host above, copy a fresh script from here.
            </p>
          </div>
          <Badge variant="blue">Live config</Badge>
        </div>
        <CodeBlock code={autoJsScript} filename="laixi-agent.js" />
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <h4 className="text-base font-semibold text-gray-900">Environment references</h4>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {envReferences.map((item) => (
            <div key={item.label} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{item.label}</p>
              <p className="text-xs text-gray-800 font-mono mt-1 break-all">{item.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DeviceSetupProtocolSupportPanels() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex items-center gap-2 mb-3">
          <Wifi className="w-4 h-4 text-sky-500" />
          <h4 className="text-base font-semibold text-gray-900">Runtime expectations</h4>
        </div>
        <div className="space-y-2 text-sm text-gray-600">
          <p>Heartbeat cadence is expected every <strong>15 seconds</strong>.</p>
          <p>A device becomes <strong>stale</strong> after <strong>45 seconds</strong> without a heartbeat.</p>
          <p>A device becomes <strong>offline</strong> after <strong>120 seconds</strong> without a heartbeat.</p>
          <p>The screenshot probe expects the device to return a `SCREENSHOT` artifact with inline base64.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex items-center gap-2 mb-3">
          <Terminal className="w-4 h-4 text-emerald-500" />
          <h4 className="text-base font-semibold text-gray-900">Recommended local runtime</h4>
        </div>
        <div className="space-y-2 text-sm text-gray-600">
          <p>Gateway: <code>npm run dev:gateway</code></p>
          <p>Worker: <code>npm run dev:worker</code></p>
          <p>Backend smoke: <code>npm run smoke:backend</code></p>
        </div>
      </div>
    </div>
  );
}
