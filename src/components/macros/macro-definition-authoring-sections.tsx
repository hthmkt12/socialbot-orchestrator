interface CompatibilityView {
  supported: boolean;
  reasons: string[];
}

export function MacroDefinitionAuthoringModeToggle({
  mode,
  onChange,
}: {
  mode: 'builder' | 'json';
  onChange: (mode: 'builder' | 'json') => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-gray-100 p-1 w-fit">
      <button
        type="button"
        onClick={() => onChange('builder')}
        className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
          mode === 'builder' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        Guided Builder
      </button>
      <button
        type="button"
        onClick={() => onChange('json')}
        className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
          mode === 'json' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        Raw JSON
      </button>
    </div>
  );
}

export function MacroDefinitionJsonEditor({
  compatibility,
  json,
  onChange,
}: {
  compatibility: CompatibilityView;
  json: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-4">
      {!compatibility.supported && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">Guided Builder unavailable for this definition</p>
          <ul className="mt-2 space-y-1 text-sm text-amber-800">
            {compatibility.reasons.map((reason) => (
              <li key={reason}>- {reason}</li>
            ))}
          </ul>
        </div>
      )}

      <textarea
        value={json}
        onChange={(event) => onChange(event.target.value)}
        rows={22}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none bg-gray-50"
        placeholder="Paste or edit macro JSON..."
        spellCheck={false}
      />
    </div>
  );
}

export function MacroDefinitionValidationErrors({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null;

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
      <p className="text-xs font-semibold text-red-700 mb-1">Validation Errors</p>
      <ul className="text-xs text-red-600 space-y-0.5">
        {errors.map((error) => <li key={error}>- {error}</li>)}
      </ul>
    </div>
  );
}

export function MacroDefinitionAuthoringActions({
  isSubmitting,
  onClose,
  submitLabel,
}: {
  isSubmitting: boolean;
  onClose: () => void;
  submitLabel: string;
}) {
  return (
    <div className="flex justify-end gap-3 pt-2">
      <button
        type="button"
        onClick={onClose}
        className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={isSubmitting}
        className="px-4 py-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
      >
        {submitLabel}
      </button>
    </div>
  );
}
