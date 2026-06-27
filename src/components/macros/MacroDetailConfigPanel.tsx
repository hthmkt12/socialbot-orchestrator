import type { MacroDefinition } from '../../contracts/macro';

interface MacroDetailConfigPanelProps {
  definition: MacroDefinition;
}

export function MacroDetailConfigPanel({ definition }: MacroDetailConfigPanelProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">Execution Configuration</h3>
      </div>
      <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
        <ConfigMetric label="Target Mode" value={definition.target.mode.replace(/_/g, ' ')} />
        <ConfigMetric label="Timeout" value={`${(definition.execution.defaultTimeoutMs / 1000).toFixed(0)}s`} />
        <ConfigMetric label="Max Retries" value={String(definition.execution.maxRetries)} />
        <ConfigMetric label="On Error" value={definition.execution.onError} />
      </div>
      {definition.antiDetection && (
        <>
          <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50">
            <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Anti-Detection Settings</h4>
          </div>
          <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
            <ConfigMetric label="Random Delay" value={definition.antiDetection.randomDelayMs ? `${definition.antiDetection.randomDelayMs[0]}-${definition.antiDetection.randomDelayMs[1]}ms` : 'Disabled'} />
            <ConfigMetric label="Scroll Variance" value={definition.antiDetection.scrollVariance ? 'Enabled' : 'Disabled'} />
            <ConfigMetric label="Tap Jitter" value={definition.antiDetection.tapJitterPx ? `${definition.antiDetection.tapJitterPx}px radius` : 'Disabled'} />
            <ConfigMetric label="Fingerprint" value={definition.antiDetection.deviceFingerprint ? 'Enabled' : 'Disabled'} />
          </div>
        </>
      )}
    </div>
  );
}

function ConfigMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-sm font-medium text-gray-900">{value}</p>
    </div>
  );
}
