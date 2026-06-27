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
  hasAccountStep,
  inputFields,
  inputValues,
  selectedAccountId,
  selectedDeviceIds,
  selectedGroupId,
  selectedVersionId,
  targetType,
}: {
  hasAccountStep: boolean;
  inputFields: RunWizardInputField[];
  inputValues: Record<string, string>;
  selectedAccountId: string;
  selectedDeviceIds: string[];
  selectedGroupId: string;
  selectedVersionId: string;
  targetType: TargetType;
}) {
  const [step, setStep] = useState<WizardStep>('macro');

  const steps = useMemo(
    () => getRunWizardSteps(inputFields.length, hasAccountStep),
    [inputFields.length, hasAccountStep],
  );
  const currentIdx = steps.indexOf(step);
  const canNext = canAdvanceRunWizard({
    inputFields,
    inputValues,
    selectedAccountId,
    selectedDeviceIds,
    selectedGroupId,
    selectedVersionId,
    step,
    targetType,
  });

  return {
    canNext,
    currentIdx,
    nextStep: () => setStep(getNextRunWizardStep(step, inputFields.length, hasAccountStep)),
    prevStep: () => setStep(getPreviousRunWizardStep(step, inputFields.length, hasAccountStep)),
    step,
    steps,
  };
}
