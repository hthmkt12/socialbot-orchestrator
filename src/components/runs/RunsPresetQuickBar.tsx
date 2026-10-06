import { useState, useRef, useEffect } from 'react';
import { Bookmark, Play, Trash2, ChevronDown, Sparkles } from 'lucide-react';
import type { RunPreset } from '../../hooks/use-run-presets';
import { formatPresetTargetSummary } from './runs-preset-quick-bar-helpers';

interface RunsPresetQuickBarProps {
  canLaunchRuns: boolean;
  onLaunchPreset: (preset: RunPreset) => void;
  presets: RunPreset[];
  deletePreset: (id: string) => void;
}

export function RunsPresetQuickBar({
  canLaunchRuns,
  onLaunchPreset,
  presets,
  deletePreset,
}: RunsPresetQuickBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (presets.length === 0) return null;

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        disabled={!canLaunchRuns}
        className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Bookmark className="w-4 h-4 text-sky-500" />
        <span>Presets</span>
        <span className="px-1.5 py-0.2 text-xs bg-sky-100 text-sky-700 rounded-full font-semibold">
          {presets.length}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-20 focus:outline-none divide-y divide-gray-50">
          <div className="px-3 py-2 bg-gray-50/50 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-sky-500" /> Quick Replay
            </span>
            <span className="text-xs text-gray-400">{presets.length} saved</span>
          </div>

          <div className="max-h-64 overflow-y-auto divide-y divide-gray-50">
            {presets.map((preset) => (
              <div
                key={preset.id}
                className="flex items-center justify-between px-3 py-2.5 hover:bg-sky-50/40 transition-colors group"
              >
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onLaunchPreset(preset);
                  }}
                  className="flex-1 text-left min-w-0 pr-2"
                >
                  <p className="text-sm font-medium text-gray-800 truncate group-hover:text-sky-600 transition-colors">
                    {preset.name}
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    {formatPresetTargetSummary(preset)}
                  </p>
                </button>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    title="Launch preset in wizard"
                    onClick={() => {
                      setIsOpen(false);
                      onLaunchPreset(preset);
                    }}
                    className="p-1 rounded text-sky-600 hover:bg-sky-100 transition-colors"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                  </button>
                  <button
                    type="button"
                    title="Delete preset"
                    onClick={(e) => {
                      e.stopPropagation();
                      deletePreset(preset.id);
                    }}
                    className="p-1 rounded opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
