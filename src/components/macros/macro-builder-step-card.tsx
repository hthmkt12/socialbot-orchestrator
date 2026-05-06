import type { MacroStep } from '../../contracts/macro';
import { GuidedStepParamsEditor } from './GuidedStepParamsEditor';
import {
  MacroBuilderStepCardHeader,
  MacroBuilderStepPolicyControls,
} from './macro-builder-step-card-sections';

export function MacroBuilderStepCard({
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
    <div className="rounded-lg border border-gray-200 p-4 space-y-4">
      <MacroBuilderStepCardHeader
        index={index}
        onMove={onMove}
        onRemove={onRemove}
        onUpdate={onUpdate}
        step={step}
        steps={steps}
      />

      <GuidedStepParamsEditor step={step} onChange={(nextStep) => onUpdate(index, () => nextStep)} />

      <MacroBuilderStepPolicyControls index={index} onUpdate={onUpdate} step={step} />
    </div>
  );
}
