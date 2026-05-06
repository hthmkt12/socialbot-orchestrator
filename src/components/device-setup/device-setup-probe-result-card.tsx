import Badge from '../ui/Badge';
import type { SetupProbeKind, SetupProbeResult } from '../../lib/device-setup';
import { checkToneBadge, formatTimestamp } from './device-setup-formatters';

export function DeviceSetupProbeResultCard({
  kind,
  result,
}: {
  kind: SetupProbeKind;
  result: SetupProbeResult;
}) {
  const badge = checkToneBadge(result.success ? 'pass' : 'fail');

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">
            {kind === 'current-app' ? 'Current-App Probe' : 'Screenshot Probe'}
          </p>
          <p className="text-[11px] text-gray-500 mt-1">
            Checked at {formatTimestamp(result.checkedAt)}
          </p>
        </div>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>

      {result.error && (
        <p className="text-xs text-red-600 mt-3">{result.error}</p>
      )}

      {result.output && Object.keys(result.output).length > 0 && (
        <pre className="mt-3 rounded-lg bg-white border border-gray-200 p-3 text-[11px] text-gray-700 font-mono overflow-x-auto whitespace-pre-wrap">
          {JSON.stringify(result.output, null, 2)}
        </pre>
      )}

      {result.screenshotBase64 && (
        <div className="mt-3 rounded-xl overflow-hidden border border-gray-200 bg-white">
          <img
            src={`data:image/png;base64,${result.screenshotBase64}`}
            alt="Screenshot probe"
            className="w-full max-h-80 object-contain bg-gray-950"
          />
        </div>
      )}
    </div>
  );
}
