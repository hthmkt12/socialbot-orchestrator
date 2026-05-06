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
