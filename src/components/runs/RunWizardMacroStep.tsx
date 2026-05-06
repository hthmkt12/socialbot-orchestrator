import { Check, Code } from 'lucide-react';
import type { Macro, MacroVersion } from '../../lib/database.types';
import Badge from '../ui/Badge';

export function RunWizardMacroStep({
  filteredMacros,
  macroSearch,
  onMacroSearchChange,
  onSelectedMacroChange,
  onSelectedVersionChange,
  selectedMacroId,
  selectedVersionId,
  versions,
}: {
  filteredMacros: Macro[];
  macroSearch: string;
  onMacroSearchChange: (value: string) => void;
  onSelectedMacroChange: (macroId: string, latestVersionId: string) => void;
  onSelectedVersionChange: (versionId: string) => void;
  selectedMacroId: string;
  selectedVersionId: string;
  versions: MacroVersion[] | undefined;
}) {
  return (
    <div className="space-y-4">
      <div className="relative">
        <input
          type="text"
          value={macroSearch}
          onChange={(event) => onMacroSearchChange(event.target.value)}
          placeholder="Search macros..."
          className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all"
        />
      </div>
      <div className="space-y-2 max-h-[40vh] overflow-y-auto">
        {filteredMacros.map((macro) => {
          const isSelected = selectedMacroId === macro.id;
          const activeVersion = versions?.find((version) => version.id === macro.latest_version_id);
          const tags = activeVersion?.tags_json ?? [];
          return (
            <button
              key={macro.id}
              onClick={() => onSelectedMacroChange(macro.id, macro.latest_version_id ?? '')}
              className={`w-full text-left p-4 rounded-xl border transition-all ${
                isSelected ? 'border-sky-500 bg-sky-50 shadow-sm' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  isSelected ? 'bg-sky-100' : 'bg-orange-50'
                }`}>
                  <Code className={`w-5 h-5 ${isSelected ? 'text-sky-600' : 'text-orange-600'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900">{macro.name}</p>
                    {isSelected && <Check className="w-4 h-4 text-sky-500" />}
                  </div>
                  <p className="text-xs text-gray-500 font-mono">{macro.key}</p>
                  {macro.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{macro.description}</p>}
                  {tags.length > 0 && (
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="blue">{tag}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </button>
          );
        })}
        {filteredMacros.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-6">No macros found</p>
        )}
      </div>
      {selectedMacroId && versions && versions.length > 1 && (
        <div className="border-t border-gray-100 pt-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Select Version</h4>
          <div className="space-y-1.5">
            {versions.filter((version) => version.status !== 'ARCHIVED').map((version) => (
              <button
                key={version.id}
                onClick={() => onSelectedVersionChange(version.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all flex items-center justify-between ${
                  selectedVersionId === version.id ? 'border-sky-500 bg-sky-50' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">v{version.version_number}</span>
                  <Badge variant={version.status === 'ACTIVE' ? 'green' : 'yellow'}>{version.status}</Badge>
                </div>
                {selectedVersionId === version.id && <Check className="w-4 h-4 text-sky-500" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
