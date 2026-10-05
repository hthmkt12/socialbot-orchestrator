import { useState } from 'react';
import { Bookmark, Trash2, ChevronDown, Save } from 'lucide-react';
import type { RunPreset } from '../../hooks/use-run-presets';
import type { TargetType } from '../../lib/database.types';

interface Props {
  deletePreset: (id: string) => void;
  inputValues: Record<string, string>;
  loadFromPreset: (preset: RunPreset) => void;
  onSavePreset: (preset: Omit<RunPreset, 'id' | 'createdAt'>) => RunPreset;
  presets: RunPreset[];
  selectedAccountId: string;
  selectedDeviceIds: string[];
  selectedGroupId: string;
  selectedMacroId: string;
  showSavePreset: boolean;
  setShowSavePreset: (show: boolean) => void;
  targetType: TargetType;
}

export function RunWizardPresetBar({
  deletePreset,
  inputValues,
  loadFromPreset,
  onSavePreset,
  presets,
  selectedAccountId,
  selectedDeviceIds,
  selectedGroupId,
  selectedMacroId,
  showSavePreset,
  setShowSavePreset,
  targetType,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [presetName, setPresetName] = useState('');

  const handleSave = () => {
    const name = presetName.trim();
    if (!name || !selectedMacroId) return;
    onSavePreset({
      name,
      macroId: selectedMacroId,
      targetType,
      deviceIds: selectedDeviceIds,
      groupId: selectedGroupId,
      accountId: selectedAccountId,
      inputValues,
    });
    setPresetName('');
    setShowSavePreset(false);
  };

  const canSave = selectedMacroId !== '';

  return (
    <div className="mb-4">
      {/* Preset selector row */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors"
        >
          <Bookmark className="w-3.5 h-3.5" />
          Presets ({presets.length})
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
        {canSave && (
          <button
            type="button"
            onClick={() => setShowSavePreset(!showSavePreset)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-sky-200 hover:bg-sky-50 text-sky-600 transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            Save Current
          </button>
        )}
      </div>

      {/* Save preset form */}
      {showSavePreset && (
        <div className="mt-2 flex items-center gap-2">
          <input
            type="text"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            placeholder="Preset name…"
            className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-300"
            autoFocus
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={!presetName.trim()}
            className="px-3 py-1.5 text-sm bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white rounded-lg transition-colors"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setShowSavePreset(false)}
            className="px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Preset list */}
      {expanded && presets.length > 0 && (
        <div className="mt-2 border border-gray-100 rounded-lg divide-y divide-gray-50">
          {presets.map((preset) => (
            <div
              key={preset.id}
              className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 cursor-pointer group"
              onClick={() => {
                loadFromPreset(preset);
                setExpanded(false);
              }}
            >
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-gray-800 truncate block">{preset.name}</span>
                <span className="text-xs text-gray-400">
                  {preset.targetType.replace(/_/g, ' ').toLowerCase()}
                </span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  deletePreset(preset.id);
                }}
                className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 text-red-400 hover:text-red-600 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {expanded && presets.length === 0 && (
        <p className="mt-2 text-xs text-gray-400 italic">
          No presets saved. Configure a run and click &quot;Save Current&quot;.
        </p>
      )}
    </div>
  );
}
