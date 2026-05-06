interface ApprovalFocusBannerProps {
  onClear: () => void;
}

export function ApprovalFocusBanner({ onClear }: ApprovalFocusBannerProps) {
  return (
    <div className="mb-5 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-semibold text-sky-900">Focused from audit trail</p>
        <p className="text-sm text-sky-800">
          This view was opened from an audit entry and is showing the related approval context.
        </p>
      </div>
      <button
        onClick={onClear}
        className="inline-flex items-center justify-center px-3 py-2 rounded-lg border border-sky-200 bg-white text-sm font-medium text-sky-700 hover:bg-sky-100"
      >
        Clear Focus
      </button>
    </div>
  );
}
