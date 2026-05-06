import { Plus } from 'lucide-react';
import type { MacroDefinition, MacroStep } from '../../contracts/macro';
import {
  GUIDED_BUILDER_STEPS,
  createGuidedBuilderStep,
  type GuidedBuilderStepType,
} from '../../lib/macro-builder';
import { MacroBuilderStepCard } from './macro-builder-step-card';

interface MacroBuilderStepsSectionProps {
  newStepType: GuidedBuilderStepType;
  value: MacroDefinition;
  onChange: (next: MacroDefinition) => void;
  onNewStepTypeChange: (stepType: GuidedBuilderStepType) => void;
}

export function MacroBuilderStepsSection({
  newStepType,
  value,
  onChange,
  onNewStepTypeChange,
}: MacroBuilderStepsSectionProps) {
  const updateStep = (index: number, updater: (step: MacroStep) => MacroStep) => {
    const nextSteps = value.steps.map((step, stepIndex) => (
      stepIndex === index ? updater(step) : step
    ));
    onChange({ ...value, steps: nextSteps });
  };

  const moveStep = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= value.steps.length) return;
    const nextSteps = [...value.steps];
    const [step] = nextSteps.splice(index, 1);
    nextSteps.splice(nextIndex, 0, step);
    onChange({ ...value, steps: nextSteps });
  };

  const removeStep = (index: number) => {
    onChange({
      ...value,
      steps: value.steps.filter((_, stepIndex) => stepIndex !== index),
    });
  };

  const addStep = () => {
    onChange({
      ...value,
      steps: [...value.steps, createGuidedBuilderStep(newStepType, value.steps)],
    });
  };

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h4 className="text-sm font-semibold text-gray-900">Step Sequence</h4>
          <p className="text-xs text-gray-500 mt-1">Build a flat sequence of common steps. Use Raw JSON when you need branching, grouping, or other advanced structures.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <select value={newStepType} onChange={(e) => onNewStepTypeChange(e.target.value as GuidedBuilderStepType)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none bg-white">
            {GUIDED_BUILDER_STEPS.map((step) => (
              <option key={step.type} value={step.type}>{step.label}</option>
            ))}
          </select>
          <button type="button" onClick={addStep} className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-sky-500 text-sm font-medium text-white hover:bg-sky-600">
            <Plus className="w-4 h-4" />
            Add Step
          </button>
        </div>
      </div>

      {value.steps.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500 text-center">
          No steps yet. Add the first action for this workflow.
        </div>
      ) : (
        <div className="space-y-3">
          {value.steps.map((step, index) => (
            <MacroBuilderStepCard
              key={`${step.id}-${index}`}
              index={index}
              step={step}
              steps={value.steps}
              onMove={moveStep}
              onRemove={removeStep}
              onUpdate={updateStep}
            />
          ))}
        </div>
      )}
    </section>
  );
}
