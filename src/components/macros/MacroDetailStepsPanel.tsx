import type { MacroStep } from '../../contracts/macro';
import { MacroDetailStepList } from './MacroDetailStepList';

interface MacroDetailStepsPanelProps {
  steps: MacroStep[];
}

export function MacroDetailStepsPanel({ steps }: MacroDetailStepsPanelProps) {
  if (steps.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">Workflow Steps</h3>
        <p className="text-xs text-gray-500 mt-0.5">{steps.length} steps in active version</p>
      </div>
      <div className="p-5">
        <MacroDetailStepList steps={steps} depth={0} />
      </div>
    </div>
  );
}
