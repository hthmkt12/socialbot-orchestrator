import type { ReactNode } from 'react';
import { RunWizardHeader } from './RunWizardHeader';
import type { WizardStep } from './run-wizard-types';

export function RunWizardModalLayout({
  body,
  currentIdx,
  footer,
  onClose,
  steps,
}: {
  body: ReactNode;
  currentIdx: number;
  footer: ReactNode;
  onClose: () => void;
  steps: WizardStep[];
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col">
        <RunWizardHeader currentIdx={currentIdx} onClose={onClose} steps={steps} />
        <div className="flex-1 overflow-y-auto p-6">{body}</div>
        {footer}
      </div>
    </div>
  );
}
