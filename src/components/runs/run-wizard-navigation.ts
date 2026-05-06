import type { TargetType } from '../../lib/database.types';
import type { WizardStep } from './run-wizard-types';

interface InputFieldForNavigation {
  key: string;
  required?: boolean;
}

export function getRunWizardSteps(inputFieldCount: number): WizardStep[] {
  return ['macro', 'target', ...(inputFieldCount > 0 ? ['inputs' as WizardStep] : []), 'review'];
}

export function canAdvanceRunWizard({
  inputFields,
  inputValues,
  selectedDeviceIds,
  selectedGroupId,
  selectedVersionId,
  step,
  targetType,
}: {
  inputFields: InputFieldForNavigation[];
  inputValues: Record<string, string>;
  selectedDeviceIds: string[];
  selectedGroupId: string;
  selectedVersionId: string;
  step: WizardStep;
  targetType: TargetType;
}) {
  if (step === 'macro') return !!selectedVersionId;
  if (step === 'target') {
    if (targetType === 'SINGLE_DEVICE' || targetType === 'MULTI_DEVICE') return selectedDeviceIds.length > 0;
    if (targetType === 'DEVICE_GROUP') return !!selectedGroupId;
    return true;
  }
  if (step === 'inputs') {
    return inputFields.filter((field) => field.required).every((field) => inputValues[field.key]);
  }
  return true;
}

export function getNextRunWizardStep(step: WizardStep, inputFieldCount: number): WizardStep {
  if (step === 'macro') return 'target';
  if (step === 'target') return inputFieldCount > 0 ? 'inputs' : 'review';
  if (step === 'inputs') return 'review';
  return step;
}

export function getPreviousRunWizardStep(step: WizardStep, inputFieldCount: number): WizardStep {
  if (step === 'target') return 'macro';
  if (step === 'inputs') return 'target';
  if (step === 'review') return inputFieldCount > 0 ? 'inputs' : 'target';
  return step;
}
