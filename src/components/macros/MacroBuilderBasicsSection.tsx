import type { MacroDefinition } from '../../contracts/macro';
import { parseBuilderNumber } from './macro-builder-panel-helpers';

interface MacroBuilderBasicsSectionProps {
  value: MacroDefinition;
  onChange: (next: MacroDefinition) => void;
}

export function MacroBuilderBasicsSection({ value, onChange }: MacroBuilderBasicsSectionProps) {
  const updateMeta = (field: 'key' | 'name' | 'description', fieldValue: string) => {
    onChange({
      ...value,
      meta: {
        ...value.meta,
        [field]: fieldValue,
      },
    });
  };

  const updateTags = (tagValue: string) => {
    onChange({
      ...value,
      meta: {
        ...value.meta,
        tags: tagValue
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
      },
    });
  };

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-gray-900">Macro Basics</h4>
        <p className="text-xs text-gray-500 mt-1">Define the macro identity, target mode, and default execution rules.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TextField label="Key" value={value.meta.key} onChange={(next) => updateMeta('key', next)} placeholder="launch_app_and_capture" />
        <TextField label="Name" value={value.meta.name} onChange={(next) => updateMeta('name', next)} placeholder="Launch App And Capture" />
        <label className="space-y-1 md:col-span-2">
          <span className="text-xs font-medium text-gray-700">Description</span>
          <textarea value={value.meta.description ?? ''} onChange={(e) => updateMeta('description', e.target.value)} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none resize-none" placeholder="Short human-readable summary of the workflow." />
        </label>
        <TextField label="Tags" value={(value.meta.tags ?? []).join(', ')} onChange={updateTags} placeholder="demo, screenshot, qa" wide />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <label className="space-y-1">
          <span className="text-xs font-medium text-gray-700">Target Mode</span>
          <select value={value.target.mode} onChange={(e) => onChange({ ...value, target: { mode: e.target.value as MacroDefinition['target']['mode'] } })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none bg-white">
            <option value="single_device">Single Device</option>
            <option value="multi_device">Multi Device</option>
            <option value="device_group">Device Group</option>
            <option value="all_devices">All Devices</option>
          </select>
        </label>
        <NumberField label="Default Timeout (ms)" value={value.execution.defaultTimeoutMs} onChange={(next) => onChange({ ...value, execution: { ...value.execution, defaultTimeoutMs: next } })} />
        <NumberField label="Max Retries" value={value.execution.maxRetries} onChange={(next) => onChange({ ...value, execution: { ...value.execution, maxRetries: next } })} />
        <label className="space-y-1">
          <span className="text-xs font-medium text-gray-700">On Error</span>
          <select value={value.execution.onError} onChange={(e) => onChange({ ...value, execution: { ...value.execution, onError: e.target.value as MacroDefinition['execution']['onError'] } })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none bg-white">
            <option value="stop">Stop</option>
            <option value="continue">Continue</option>
            <option value="skip">Skip</option>
          </select>
        </label>
      </div>
    </section>
  );
}

function TextField({
  label,
  onChange,
  placeholder,
  value,
  wide,
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <label className={`space-y-1 ${wide ? 'md:col-span-2' : ''}`}>
      <span className="text-xs font-medium text-gray-700">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none" placeholder={placeholder} />
    </label>
  );
}

function NumberField({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: number) => void;
  value: number;
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs font-medium text-gray-700">{label}</span>
      <input type="number" min={0} value={value} onChange={(e) => onChange(parseBuilderNumber(e.target.value))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none" />
    </label>
  );
}
