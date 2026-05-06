import { ArrowLeft, Plus } from 'lucide-react';
import Header from '../layout/Header';

interface MacroDetailHeaderProps {
  canEditMacros: boolean;
  macroKey: string;
  macroName: string;
  onBack: () => void;
  onNewVersion: () => void;
}

export function MacroDetailHeader({
  canEditMacros,
  macroKey,
  macroName,
  onBack,
  onNewVersion,
}: MacroDetailHeaderProps) {
  return (
    <Header
      title={macroName}
      subtitle={`Key: ${macroKey}`}
      actions={
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <button
            onClick={onNewVersion}
            disabled={!canEditMacros}
            className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" /> New Version
          </button>
        </div>
      }
    />
  );
}
