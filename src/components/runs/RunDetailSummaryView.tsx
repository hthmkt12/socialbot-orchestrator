interface RunDetailSummaryViewProps {
  summary: Record<string, unknown>;
}

export function RunDetailSummaryView({ summary }: RunDetailSummaryViewProps) {
  const total = Number(summary.totalDevices ?? 0);
  const succeeded = Number(summary.succeeded ?? 0);
  const failed = Number(summary.failed ?? 0);
  const cancelled = Number(summary.cancelled ?? 0);

  if (total === 0) {
    return (
      <pre className="text-xs text-gray-700 bg-gray-50 rounded-lg p-4 overflow-auto font-mono">
        {JSON.stringify(summary, null, 2)}
      </pre>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryMetric label="Devices" value={total} valueClassName="text-gray-900" />
        <SummaryMetric label="Succeeded" value={succeeded} valueClassName="text-emerald-600" wrapperClassName="bg-emerald-50" />
        <SummaryMetric label="Failed" value={failed} valueClassName="text-red-600" wrapperClassName="bg-red-50" />
        <SummaryMetric label="Cancelled" value={cancelled} valueClassName="text-gray-500" />
      </div>
      <pre className="text-[10px] text-gray-500 bg-gray-50 rounded-lg p-3 overflow-auto font-mono max-h-48">
        {JSON.stringify(summary, null, 2)}
      </pre>
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
