import type { ReactNode } from 'react';
import type { MacroStep } from '../../contracts/macro';
import { parseBuilderNumber } from './macro-builder-panel-helpers';

interface GuidedStepParamsEditorProps {
  step: MacroStep;
  onChange: (nextStep: MacroStep) => void;
}

export function GuidedStepParamsEditor({ step, onChange }: GuidedStepParamsEditorProps) {
  const updateParam = (key: string, value: string | number | boolean) => {
    onChange({
      ...step,
      params: {
        ...step.params,
        [key]: value,
      },
    });
  };

  const textClassName = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none';

  switch (step.type) {
    case 'launch_app':
      return <Field label="App Name"><input value={String(step.params.appName ?? '')} onChange={(e) => updateParam('appName', e.target.value)} className={textClassName} placeholder="{{appName}}" /></Field>;
    case 'wait':
      return <Field label="Milliseconds"><input type="number" min={0} value={Number(step.params.ms ?? 0)} onChange={(e) => updateParam('ms', parseBuilderNumber(e.target.value))} className={textClassName} /></Field>;
    case 'input_text':
      return <Field label="Text"><input value={String(step.params.text ?? '')} onChange={(e) => updateParam('text', e.target.value)} className={textClassName} placeholder="{{textValue}}" /></Field>;
    case 'tap':
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <CoordinateField label="X" value={Number(step.params.x ?? 0.5)} onChange={(next) => updateParam('x', next)} />
          <CoordinateField label="Y" value={Number(step.params.y ?? 0.5)} onChange={(next) => updateParam('y', next)} />
        </div>
      );
    case 'swipe':
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <CoordinateField label="From X" value={Number(step.params.fromX ?? 0.5)} onChange={(next) => updateParam('fromX', next)} />
          <CoordinateField label="From Y" value={Number(step.params.fromY ?? 0.8)} onChange={(next) => updateParam('fromY', next)} />
          <CoordinateField label="To X" value={Number(step.params.toX ?? 0.5)} onChange={(next) => updateParam('toX', next)} />
          <CoordinateField label="To Y" value={Number(step.params.toY ?? 0.25)} onChange={(next) => updateParam('toY', next)} />
        </div>
      );
    case 'screenshot':
      return (
        <label className="inline-flex items-center gap-2 text-sm text-gray-700 rounded-lg border border-gray-200 px-3 py-2">
          <input type="checkbox" checked={Boolean(step.params.saveToArtifact ?? true)} onChange={(e) => updateParam('saveToArtifact', e.target.checked)} className="rounded border-gray-300 text-sky-600 focus:ring-sky-500" />
          Save screenshot to artifact evidence
        </label>
      );
    case 'approval_checkpoint':
    case 'stop':
      return <Field label="Reason"><input value={String(step.params.reason ?? '')} onChange={(e) => updateParam('reason', e.target.value)} className={textClassName} /></Field>;
    case 'extract_var':
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Source">
            <select value={String(step.params.source ?? 'adb')} onChange={(e) => updateParam('source', e.target.value)} className={textClassName}>
              <option value="adb">ADB Shell</option>
              <option value="ui_tree">UI Tree</option>
            </select>
          </Field>
          <Field label="Variable Name">
            <input value={String(step.params.variableName ?? '')} onChange={(e) => updateParam('variableName', e.target.value)} className={textClassName} placeholder="myVar" />
          </Field>
          {step.params.source === 'adb' && (
            <>
              <Field label="Command">
                <input value={String(step.params.command ?? '')} onChange={(e) => updateParam('command', e.target.value)} className={textClassName} placeholder="dumpsys battery" />
              </Field>
              <Field label="Regex Pattern (Optional)">
                <input value={String(step.params.regex ?? '')} onChange={(e) => updateParam('regex', e.target.value)} className={textClassName} placeholder="level: (\d+)" />
              </Field>
            </>
          )}
        </div>
      );
    case 'conditional':
      return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="Left">
            <input value={String(step.params.left ?? '')} onChange={(e) => updateParam('left', e.target.value)} className={textClassName} placeholder="{{myVar}}" />
          </Field>
          <Field label="Operator">
            <select value={String(step.params.operator ?? 'equals')} onChange={(e) => updateParam('operator', e.target.value)} className={textClassName}>
              <option value="equals">Equals (==)</option>
              <option value="not_equals">Not Equals (!=)</option>
              <option value="contains">Contains</option>
              <option value="starts_with">Starts With</option>
              <option value="ends_with">Ends With</option>
              <option value="gt">Greater Than (&gt;)</option>
              <option value="lt">Less Than (&lt;)</option>
              <option value="exists">Exists</option>
            </select>
          </Field>
          <Field label="Right">
            <input value={String(step.params.right ?? '')} onChange={(e) => updateParam('right', e.target.value)} className={textClassName} placeholder="expected value" />
          </Field>
        </div>
      );
    case 'while_loop':
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Left">
            <input value={String(step.params.left ?? '')} onChange={(e) => updateParam('left', e.target.value)} className={textClassName} placeholder="{{myVar}}" />
          </Field>
          <Field label="Operator">
            <select value={String(step.params.operator ?? 'not_equals')} onChange={(e) => updateParam('operator', e.target.value)} className={textClassName}>
              <option value="equals">Equals (==)</option>
              <option value="not_equals">Not Equals (!=)</option>
              <option value="contains">Contains</option>
              <option value="starts_with">Starts With</option>
              <option value="ends_with">Ends With</option>
              <option value="gt">Greater Than (&gt;)</option>
              <option value="lt">Less Than (&lt;)</option>
              <option value="exists">Exists</option>
            </select>
          </Field>
          <Field label="Right">
            <input value={String(step.params.right ?? '')} onChange={(e) => updateParam('right', e.target.value)} className={textClassName} placeholder="done" />
          </Field>
          <Field label="Max Iterations">
            <input type="number" min={1} value={Number(step.params.maxIterations ?? 10)} onChange={(e) => updateParam('maxIterations', parseBuilderNumber(e.target.value))} className={textClassName} />
          </Field>
        </div>
      );
    case 'get_current_app':
    case 'try_catch':
    default:
      return <p className="text-xs text-gray-500">This step has no required parameters in guided mode. Advanced structure (steps, then, else, catch) requires the JSON editor.</p>;
  }
}

function CoordinateField({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: number) => void;
  value: number;
}) {
  return (
    <Field label={label}>
      <input type="number" min={0} max={1} step="0.01" value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none" />
    </Field>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="space-y-1 block">
      <span className="text-xs font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}
