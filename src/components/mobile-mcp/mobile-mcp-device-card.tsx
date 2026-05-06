import { Camera, CheckCircle2, Circle, MonitorSmartphone, XCircle } from 'lucide-react';
import Badge from '../ui/Badge';
import type { MobileMcpFleetDevice, MobileMcpStepResult } from '../../lib/mobile-mcp-orchestrator';

interface Props {
  device: MobileMcpFleetDevice;
  selected: boolean;
  result?: MobileMcpStepResult;
  onToggle: () => void;
}

function formatJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

export default function MobileMcpDeviceCard({ device, selected, result, onToggle }: Props) {
  const statusVariant = device.status === 'device' ? 'green' : 'yellow';
  const resultIcon = result?.success
    ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
    : result
      ? <XCircle className="w-4 h-4 text-red-500" />
      : <Circle className="w-4 h-4 text-gray-300" />;

  return (
    <div className={`rounded-xl border p-4 bg-white ${selected ? 'border-sky-300 ring-2 ring-sky-100' : 'border-gray-200'}`}>
      <div className="flex items-start justify-between gap-3">
        <button onClick={onToggle} className="flex items-start gap-3 text-left min-w-0">
          <MonitorSmartphone className="w-5 h-5 text-gray-500 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{device.id}</p>
            <p className="text-xs text-gray-500 mt-1">Android serial</p>
          </div>
        </button>
        <Badge variant={statusVariant}>{device.status}</Badge>
      </div>

      {result && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span className="inline-flex items-center gap-1.5">{resultIcon}{result.stepType}</span>
            <span>{new Date(result.checkedAt).toLocaleTimeString()}</span>
          </div>
          {result.error && <p className="text-xs text-red-600">{result.error}</p>}
          {result.screenshotBase64 ? (
            <div className="rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
              <img alt={`Screenshot ${device.id}`} src={`data:image/png;base64,${result.screenshotBase64}`} className="w-full max-h-72 object-contain" />
            </div>
          ) : (
            <pre className="text-[11px] bg-gray-950 text-gray-100 rounded-lg p-3 overflow-auto max-h-40">{formatJson(result.output)}</pre>
          )}
        </div>
      )}

      {!result && (
        <div className="mt-4 flex items-center gap-2 text-xs text-gray-400">
          <Camera className="w-3.5 h-3.5" />
          No probe result yet
        </div>
      )}
    </div>
  );
}
