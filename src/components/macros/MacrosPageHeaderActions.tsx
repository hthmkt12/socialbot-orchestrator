import { Code, Plus } from 'lucide-react';

interface MacrosPageHeaderActionsProps {
  canEditMacros: boolean;
  onCreate: () => void;
  onSeed: () => void;
}

export function MacrosPageHeaderActions({
  canEditMacros,
  onCreate,
  onSeed,
}: MacrosPageHeaderActionsProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onSeed}
        disabled={!canEditMacros}
        className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium rounded-lg transition-colors"
      >
        <Code className="w-4 h-4" />
        Load Samples
      </button>
      <button
        onClick={onCreate}
        disabled={!canEditMacros}
        className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
      >
        <Plus className="w-4 h-4" />
        New Macro
      </button>
    </div>
  );
}
