import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import Header from '../layout/Header';
import Spinner from '../ui/Spinner';

interface MacroDetailHeaderProps {
  canDeleteMacro: boolean;
  canEditMacros: boolean;
  deletePending: boolean;
  macroKey: string;
  macroName: string;
  onBack: () => void;
  onDelete: () => void;
  onNewVersion: () => void;
}

export function MacroDetailHeader({
  canDeleteMacro,
  canEditMacros,
  deletePending,
  macroKey,
  macroName,
  onBack,
  onDelete,
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
          {canDeleteMacro && (
            <button
              onClick={onDelete}
              disabled={deletePending}
              className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              {deletePending ? <Spinner size="sm" /> : <Trash2 className="w-4 h-4" />}
              Delete
            </button>
          )}
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
