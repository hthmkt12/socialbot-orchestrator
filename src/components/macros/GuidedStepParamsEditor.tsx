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
    case 'get_current_app':
    default:
      return <p className="text-xs text-gray-500">This step has no required parameters in guided mode.</p>;
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
