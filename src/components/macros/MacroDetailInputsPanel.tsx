import Badge from '../ui/Badge';
import type { MacroDefinition } from '../../contracts/macro';

interface MacroDetailInputsPanelProps {
  inputs: MacroDefinition['inputs'];
}

export function MacroDetailInputsPanel({ inputs }: MacroDetailInputsPanelProps) {
  const entries = Object.entries(inputs);
  if (entries.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">Input Schema</h3>
        <p className="text-xs text-gray-500 mt-0.5">{entries.length} input{entries.length !== 1 ? 's' : ''}</p>
      </div>
      <div className="p-5 space-y-3">
        {entries.map(([key, field]) => (
          <div key={key} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-gray-900 font-mono">{key}</span>
                {field.required && <Badge variant="red">required</Badge>}
                <Badge variant="gray">{field.type}</Badge>
              </div>
              {field.description && <p className="text-xs text-gray-500">{field.description}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
