interface RunDetailSummaryViewProps {
  summary: Record<string, unknown>;
}

export function RunDetailSummaryView({ summary }: RunDetailSummaryViewProps) {
  const total = Number(summary.totalDevices ?? 0);
  const succeeded = Number(summary.succeeded ?? 0);
  const failed = Number(summary.failed ?? 0);
  const cancelled = Number(summary.cancelled ?? 0);
  const skipped = Number(summary.skipped ?? summary.partial ?? 0);
  const targetFailurePolicy = typeof summary.targetFailurePolicy === 'string' ? summary.targetFailurePolicy : null;
  const targetFailureDecisions = Array.isArray(summary.targetFailureDecisions)
    ? summary.targetFailureDecisions
    : [];

  if (total === 0) {
    return (
      <pre className="text-xs text-gray-700 bg-gray-50 rounded-lg p-4 overflow-auto font-mono">
        {JSON.stringify(summary, null, 2)}
      </pre>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <SummaryMetric label="Devices" value={total} valueClassName="text-gray-900" />
        <SummaryMetric label="Succeeded" value={succeeded} valueClassName="text-emerald-600" wrapperClassName="bg-emerald-50" />
        <SummaryMetric label="Failed" value={failed} valueClassName="text-red-600" wrapperClassName="bg-red-50" />
        <SummaryMetric label="Cancelled" value={cancelled} valueClassName="text-gray-500" />
        <SummaryMetric label="Skipped" value={skipped} valueClassName="text-amber-600" wrapperClassName="bg-amber-50" />
      </div>
      {(targetFailurePolicy || targetFailureDecisions.length > 0) && (
        <div className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs text-amber-900 space-y-2">
          {targetFailurePolicy && (
            <p className="font-medium">Target failure policy: {targetFailurePolicy.replace(/_/g, ' ')}</p>
          )}
          {targetFailureDecisions.map((decision, index) => (
            <TargetFailureDecisionRow key={index} decision={decision} />
          ))}
        </div>
      )}
      <pre className="text-[10px] text-gray-500 bg-gray-50 rounded-lg p-3 overflow-auto font-mono max-h-48">
        {JSON.stringify(summary, null, 2)}
      </pre>
    </div>
  );
}

function TargetFailureDecisionRow({ decision }: { decision: unknown }) {
  if (!decision || typeof decision !== 'object') return null;
  const value = decision as Record<string, unknown>;
  const failure = value.originalFailure && typeof value.originalFailure === 'object'
    ? value.originalFailure as Record<string, unknown>
    : {};
  return (
    <div className="rounded-md bg-white/70 border border-amber-100 px-3 py-2">
      <p>
        {String(value.deviceName ?? value.deviceId ?? 'Unknown target')}:
        {' '}
        {String(value.action ?? 'target_failed').replace(/_/g, ' ')}
      </p>
      <p className="text-amber-700">
        {String(failure.code ?? 'TARGET_FAILED')} - {String(failure.message ?? 'Target failed')}
      </p>
    </div>
  );
}

function SummaryMetric({
  label,
  value,
  valueClassName,
  wrapperClassName = 'bg-gray-50',
}: {
  label: string;
  value: number;
  valueClassName: string;
  wrapperClassName?: string;
}) {
  return (
    <div className={`text-center p-3 rounded-lg ${wrapperClassName}`}>
      <p className={`text-lg font-bold ${valueClassName}`}>{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}
