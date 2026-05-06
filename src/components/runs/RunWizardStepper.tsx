import { Check } from 'lucide-react';
import { stepLabels, type WizardStep } from './run-wizard-types';

export function RunWizardStepper({
  currentIdx,
  steps,
}: {
  currentIdx: number;
  steps: WizardStep[];
}) {
  return (
    <div className="flex items-center gap-0">
      {steps.map((step, index) => {
        const isActive = index === currentIdx;
        const isDone = index < currentIdx;
        return (
          <div key={step} className="flex items-center flex-1 last:flex-none">
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                isDone ? 'bg-emerald-500 text-white' :
                isActive ? 'bg-sky-500 text-white' :
                'bg-gray-100 text-gray-400'
              }`}>
                {isDone ? <Check className="w-3.5 h-3.5" /> : index + 1}
              </div>
              <span className={`text-xs font-medium hidden sm:block ${
                isActive ? 'text-gray-900' : isDone ? 'text-emerald-600' : 'text-gray-400'
              }`}>
                {stepLabels[step]}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div className={`flex-1 h-px mx-3 ${isDone ? 'bg-emerald-300' : 'bg-gray-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
