import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import type { MacroStep, TargetApp } from '../../contracts/macro';
import {
  GUIDED_BUILDER_STEPS,
  createGuidedBuilderStep,
  type GuidedBuilderStepType,
} from '../../lib/macro-builder';
import { parseBuilderNumber, updateStepPolicy } from './macro-builder-panel-helpers';

export function MacroBuilderStepCardHeader({
  index,
  onMove,
  onRemove,
  onUpdate,
  step,
  steps,
}: {
  index: number;
  onMove: (index: number, direction: -1 | 1) => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, updater: (step: MacroStep) => MacroStep) => void;
  step: MacroStep;
  steps: MacroStep[];
}) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 flex-1">
        <label className="space-y-1">
          <span className="text-xs font-medium text-gray-700">Step ID</span>
          <input
            value={step.id}
            onChange={(event) => onUpdate(index, (current) => ({ ...current, id: event.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-sky-500 focus:outline-none"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-gray-700">Step Type</span>
          <select
            value={step.type}
            onChange={(event) => onUpdate(index, (current) => ({
              ...current,
              type: event.target.value as GuidedBuilderStepType,
              params: createGuidedBuilderStep(event.target.value as GuidedBuilderStepType, steps).params,
            }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none bg-white"
          >
            {GUIDED_BUILDER_STEPS.map((supportedStep) => (
              <option key={supportedStep.type} value={supportedStep.type}>{supportedStep.label}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-gray-700">Target App</span>
          <select
            value={step.targetApp ?? ''}
            onChange={(event) => onUpdate(index, (current) => ({
              ...current,
              targetApp: (event.target.value || undefined) as TargetApp | undefined,
            }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none bg-white"
          >
            <option value="">Same / Current</option>
            <option value="instagram">Instagram</option>
            <option value="tiktok">TikTok</option>
            <option value="facebook">Facebook</option>
          </select>
        </label>
      </div>

      <div className="flex items-center gap-2">
        <MacroBuilderIconButton disabled={index === 0} onClick={() => onMove(index, -1)}>
          <ArrowUp className="w-4 h-4" />
        </MacroBuilderIconButton>
        <MacroBuilderIconButton disabled={index === steps.length - 1} onClick={() => onMove(index, 1)}>
          <ArrowDown className="w-4 h-4" />
        </MacroBuilderIconButton>
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export function MacroBuilderStepPolicyControls({
  index,
  onUpdate,
  step,
}: {
  index: number;
  onUpdate: (index: number, updater: (step: MacroStep) => MacroStep) => void;
  step: MacroStep;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <label className="inline-flex items-center gap-2 text-sm text-gray-700 rounded-lg border border-gray-200 px-3 py-2">
        <input
          type="checkbox"
          checked={step.policy?.requiresApproval ?? false}
          onChange={(event) => onUpdate(index, (current) => updateStepPolicy(current, 'requiresApproval', event.target.checked))}
          className="rounded border-gray-300 text-sky-600 focus:ring-sky-500"
        />
        Require Approval
      </label>
      <MacroBuilderStepPolicyNumberField
        label="Step Timeout (ms)"
        value={step.policy?.timeoutMs}
        onChange={(next) => onUpdate(index, (current) => updateStepPolicy(current, 'timeoutMs', next))}
      />
      <MacroBuilderStepPolicyNumberField
        label="Step Retries"
        value={step.policy?.maxRetries}
        onChange={(next) => onUpdate(index, (current) => updateStepPolicy(current, 'maxRetries', next))}
      />
    </div>
  );
}

function MacroBuilderIconButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function MacroBuilderStepPolicyNumberField({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: number | null) => void;
  value: number | undefined;
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs font-medium text-gray-700">{label}</span>
      <input
        type="number"
        min={0}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value ? parseBuilderNumber(event.target.value) : null)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
        placeholder="inherit"
      />
    </label>
  );
}
