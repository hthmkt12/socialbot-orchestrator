import { Plus, Trash2 } from 'lucide-react';
import type { MacroDefinition, MacroInputField } from '../../contracts/macro';

interface MacroBuilderInputsSectionProps {
  inputEntries: [string, MacroInputField][];
  value: MacroDefinition;
  onChange: (next: MacroDefinition) => void;
}

export function MacroBuilderInputsSection({
  inputEntries,
  value,
  onChange,
}: MacroBuilderInputsSectionProps) {
  const updateInput = (currentKey: string, nextKey: string, patch: Partial<MacroInputField>) => {
    const nextInputs = { ...value.inputs };
    const current = nextInputs[currentKey] ?? { type: 'string' as const };
    delete nextInputs[currentKey];
    nextInputs[nextKey] = { ...current, ...patch };
    onChange({ ...value, inputs: nextInputs });
  };

  const removeInput = (key: string) => {
    const nextInputs = { ...value.inputs };
    delete nextInputs[key];
    onChange({ ...value, inputs: nextInputs });
  };

  const addInput = () => {
    const candidate = `input_${inputEntries.length + 1}`;
    onChange({
      ...value,
      inputs: {
        ...value.inputs,
        [candidate]: {
          type: 'string',
          required: false,
          description: '',
        },
      },
    });
  };

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-gray-900">Inputs</h4>
          <p className="text-xs text-gray-500 mt-1">Optional runtime inputs that your steps can reference with variables like <span className="font-mono">{'{{appName}}'}</span>.</p>
        </div>
        <button type="button" onClick={addInput} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50">
          <Plus className="w-4 h-4" />
          Add Input
        </button>
      </div>

      {inputEntries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500 text-center">
          No inputs yet. Add one if the workflow should accept runtime values.
        </div>
      ) : (
        <div className="space-y-3">
          {inputEntries.map(([key, field]) => (
            <InputRow
              key={key}
              field={field}
              inputKey={key}
              onRemove={() => removeInput(key)}
              onUpdate={(nextKey, patch) => updateInput(key, nextKey, patch)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function InputRow({
  field,
  inputKey,
  onRemove,
  onUpdate,
}: {
  field: MacroInputField;
  inputKey: string;
  onRemove: () => void;
  onUpdate: (nextKey: string, patch: Partial<MacroInputField>) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[1.2fr_0.7fr_auto] gap-3 rounded-lg border border-gray-200 p-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="space-y-1">
          <span className="text-xs font-medium text-gray-700">Input Key</span>
          <input value={inputKey} onChange={(e) => onUpdate(e.target.value, {})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none font-mono" />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-gray-700">Type</span>
          <select value={field.type} onChange={(e) => onUpdate(inputKey, { type: e.target.value as MacroInputField['type'] })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none bg-white">
            <option value="string">String</option>
            <option value="number">Number</option>
            <option value="boolean">Boolean</option>
          </select>
        </label>
        <label className="space-y-1 md:col-span-2">
          <span className="text-xs font-medium text-gray-700">Description</span>
          <input value={field.description ?? ''} onChange={(e) => onUpdate(inputKey, { description: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none" />
        </label>
      </div>

      <label className="inline-flex items-center gap-2 text-sm text-gray-700 md:justify-center">
        <input type="checkbox" checked={field.required ?? false} onChange={(e) => onUpdate(inputKey, { required: e.target.checked })} className="rounded border-gray-300 text-sky-600 focus:ring-sky-500" />
        Required
      </label>

      <button type="button" onClick={onRemove} className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-red-200 bg-red-50 text-sm font-medium text-red-700 hover:bg-red-100">
        <Trash2 className="w-4 h-4" />
        Remove
      </button>
    </div>
  );
}
