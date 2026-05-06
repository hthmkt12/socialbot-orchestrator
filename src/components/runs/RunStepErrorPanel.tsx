import { AlertCircle } from 'lucide-react';
import { normalizeRunStepError } from '../../lib/run-step-errors';

interface Props {
  error: Record<string, unknown> | null;
  compact?: boolean;
  showRaw?: boolean;
}

export default function RunStepErrorPanel({
  error,
  compact = false,
  showRaw = false,
}: Props) {
  const normalized = normalizeRunStepError(error);

  if (!normalized) return null;

  if (compact) {
    return (
      <div className="mt-1 rounded-md border border-red-200 bg-red-50 px-2 py-1.5">
        <p className="text-xs font-medium text-red-800">{normalized.title}</p>
        <p className="text-[11px] text-red-700">{normalized.summary}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-3">
      <div className="flex items-start gap-2">
        <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-red-800">{normalized.title}</p>
          <p className="text-xs text-red-700 mt-1">{normalized.detail}</p>
        </div>
      </div>

      {normalized.hint && (
        <div className="rounded-md border border-red-100 bg-white/70 px-3 py-2">
          <p className="text-[11px] font-medium text-red-800">Operator hint</p>
          <p className="text-[11px] text-red-700 mt-1">{normalized.hint}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2 text-[10px] text-red-700">
        <span className="rounded-full bg-white px-2 py-1 font-mono">code: {normalized.code}</span>
        {typeof normalized.attempt === 'number' && (
          <span className="rounded-full bg-white px-2 py-1 font-mono">attempt: {normalized.attempt}</span>
        )}
        {normalized.timestamp && (
          <span className="rounded-full bg-white px-2 py-1 font-mono">at: {normalized.timestamp}</span>
        )}
      </div>

      {showRaw && (
        <div>
          <p className="text-[11px] font-medium text-red-800 mb-2">Raw payload</p>
          <pre className="overflow-x-auto rounded-md border border-red-100 bg-white p-3 text-[10px] text-red-900">
            {JSON.stringify(normalized.raw, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
