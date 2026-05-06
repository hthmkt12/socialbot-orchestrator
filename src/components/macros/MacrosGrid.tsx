import { Clock, Code, FolderOpen, Search, Tag } from 'lucide-react';
import EmptyState from '../ui/EmptyState';
import Spinner from '../ui/Spinner';
import type { Macro } from '../../lib/database.types';

interface MacrosGridProps {
  filtered: Macro[];
  isLoading: boolean;
  macros: Macro[] | undefined;
  onOpenMacro: (macroId: string) => void;
}

export function MacrosGrid({ filtered, isLoading, macros, onOpenMacro }: MacrosGridProps) {
  if (isLoading) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  }

  if (!macros?.length) {
    return (
      <EmptyState
        icon={<FolderOpen className="w-6 h-6" />}
        title="No macros yet"
        description="Create a macro to define reusable automation workflows."
      />
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="text-center py-16">
        <Search className="w-8 h-8 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500">No macros match your search</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {filtered.map((macro) => (
        <MacroCard key={macro.id} macro={macro} onOpenMacro={onOpenMacro} />
      ))}
    </div>
  );
}

function MacroCard({
  macro,
  onOpenMacro,
}: {
  macro: Macro;
  onOpenMacro: (macroId: string) => void;
}) {
  return (
    <button
      onClick={() => onOpenMacro(macro.id)}
      className="bg-white rounded-xl border border-gray-200 p-5 text-left hover:border-sky-300 hover:shadow-md transition-all group"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center group-hover:bg-orange-100 transition-colors flex-shrink-0">
          <Code className="w-5 h-5 text-orange-600" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-gray-900 truncate">{macro.name}</h3>
          <p className="text-xs text-gray-500 font-mono">{macro.key}</p>
        </div>
      </div>
      <p className="text-xs text-gray-500 line-clamp-2 mb-3 min-h-[2rem]">{macro.description || 'No description'}</p>
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <Tag className="w-3 h-3" />
          <span>{macro.latest_version_id ? 'Active' : 'No version'}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <Clock className="w-3 h-3" />
          <span>{new Date(macro.created_at).toLocaleDateString()}</span>
        </div>
      </div>
    </button>
  );
}
