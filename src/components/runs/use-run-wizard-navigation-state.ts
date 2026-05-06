import { useMemo, useState } from 'react';
import {
  canAdvanceRunWizard,
  getNextRunWizardStep,
  getPreviousRunWizardStep,
  getRunWizardSteps,
} from './run-wizard-navigation';
import type { RunWizardInputField } from './RunWizardInputsStep';
import type { WizardStep } from './run-wizard-types';
import type { TargetType } from '../../lib/database.types';

export function useRunWizardNavigationState({
  inputFields,
  inputValues,
  selectedDeviceIds,
  selectedGroupId,
  selectedVersionId,
  targetType,
}: {
  inputFields: RunWizardInputField[];
  inputValues: Record<string, string>;
  selectedDeviceIds: string[];
  selectedGroupId: string;
  selectedVersionId: string;
  targetType: TargetType;
}) {
  const [step, setStep] = useState<WizardStep>('macro');

  const steps = useMemo(() => getRunWizardSteps(inputFields.length), [inputFields.length]);
  const currentIdx = steps.indexOf(step);
  const canNext = canAdvanceRunWizard({
    inputFields,
    inputValues,
    selectedDeviceIds,
    selectedGroupId,
    selectedVersionId,
    step,
    targetType,
  });

  return {
    canNext,
    currentIdx,
    nextStep: () => setStep(getNextRunWizardStep(step, inputFields.length)),
    prevStep: () => setStep(getPreviousRunWizardStep(step, inputFields.length)),
    step,
    steps,
  };
}
