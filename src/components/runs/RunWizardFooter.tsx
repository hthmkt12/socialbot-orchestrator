import { ChevronRight, Play } from 'lucide-react';
import Spinner from '../ui/Spinner';
import type { WizardStep } from './run-wizard-types';

export function RunWizardFooter({
  canNext,
  currentIdx,
  hasBlockingIssues,
  isSubmitting,
  onBack,
  onCancel,
  onNext,
  onSubmit,
  step,
}: {
  canNext: boolean;
  currentIdx: number;
  hasBlockingIssues: boolean;
  isSubmitting: boolean;
  onBack: () => void;
  onCancel: () => void;
  onNext: () => void;
  onSubmit: () => void;
  step: WizardStep;
}) {
  return (
    <div className="border-t border-gray-100 px-6 py-4 flex items-center justify-between">
      <button
        onClick={currentIdx === 0 ? onCancel : onBack}
        className="px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors font-medium"
      >
        {currentIdx === 0 ? 'Cancel' : 'Back'}
      </button>
      {step === 'review' ? (
        <button
          onClick={onSubmit}
          disabled={isSubmitting || hasBlockingIssues}
          className="flex items-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
        >
          {isSubmitting ? <Spinner size="sm" /> : <Play className="w-4 h-4" />}
          Execute Run
        </button>
      ) : (
        <button
          onClick={onNext}
          disabled={!canNext}
          className="flex items-center gap-2 px-5 py-2.5 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          Next <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
