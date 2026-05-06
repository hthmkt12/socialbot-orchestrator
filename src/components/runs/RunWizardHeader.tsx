import { X } from 'lucide-react';
import { RunWizardStepper } from './RunWizardStepper';
import type { WizardStep } from './run-wizard-types';

export function RunWizardHeader({
  currentIdx,
  onClose,
  steps,
}: {
  currentIdx: number;
  onClose: () => void;
  steps: WizardStep[];
}) {
  return (
    <div className="px-6 py-4 border-b border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">New Workflow Run</h3>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>
      <RunWizardStepper currentIdx={currentIdx} steps={steps} />
    </div>
  );
}
