import { X } from 'lucide-react';

interface RunDetailFocusBannerProps {
  focusStepId: string;
  onClear: () => void;
}

export function RunDetailFocusBanner({ focusStepId, onClear }: RunDetailFocusBannerProps) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-semibold text-amber-900">Focused step from audit trail</p>
        <p className="text-sm text-amber-800">
          The audit link sent you to evidence for step <span className="font-mono">{focusStepId}</span>.
        </p>
      </div>
      <button onClick={onClear} className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-amber-200 bg-white text-sm font-medium text-amber-800 hover:bg-amber-100">
        <X className="w-4 h-4" />
        Clear Focus
      </button>
    </div>
  );
}
