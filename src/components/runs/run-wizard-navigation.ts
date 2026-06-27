import type { TargetType } from '../../lib/database.types';
import type { WizardStep } from './run-wizard-types';

interface InputFieldForNavigation {
  key: string;
  required?: boolean;
}

export function getRunWizardSteps(inputFieldCount: number, hasAccountStep = false): WizardStep[] {
  const core: WizardStep[] = ['macro', 'target'];
  if (hasAccountStep) core.push('account');
  if (inputFieldCount > 0) core.push('inputs');
  core.push('review');
  return core;
}

export function canAdvanceRunWizard({
  inputFields,
  inputValues,
  selectedAccountId,
  selectedDeviceIds,
  selectedGroupId,
  selectedVersionId,
  step,
  targetType,
}: {
  inputFields: InputFieldForNavigation[];
  inputValues: Record<string, string>;
  selectedAccountId: string;
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
  if (step === 'account') return !!selectedAccountId;
  if (step === 'inputs') {
    return inputFields.filter((field) => field.required).every((field) => inputValues[field.key]);
  }
  return true;
}

function stepsBetween(step: WizardStep, to: WizardStep): WizardStep[] | null {
  const all: WizardStep[] = ['macro', 'target', 'account', 'inputs', 'review'];
  const fromIdx = all.indexOf(step);
  const toIdx = all.indexOf(to);
  if (fromIdx === -1 || toIdx === -1) return null;
  return all.slice(fromIdx, toIdx + 1);
}

export function getNextRunWizardStep(step: WizardStep, inputFieldCount: number, hasAccountStep = false): WizardStep {
  const between = stepsBetween(step, 'review');
  if (!between) return step;
  const idx = between.indexOf(step);
  if (idx === -1 || idx >= between.length - 1) return step;

  // Skip steps not in the current flow
  for (let i = idx + 1; i < between.length; i++) {
    const next = between[i];
    if (next === 'account' && !hasAccountStep) continue;
    if (next === 'inputs' && inputFieldCount === 0) continue;
    return next;
  }
  return 'review';
}

export function getPreviousRunWizardStep(step: WizardStep, inputFieldCount: number, hasAccountStep = false): WizardStep {
  if (step === 'target') return 'macro';
  if (step === 'account') return 'target';
  if (step === 'inputs') {
    if (hasAccountStep) return 'account';
    return 'target';
  }
  if (step === 'review') {
    if (inputFieldCount > 0) return 'inputs';
    if (hasAccountStep) return 'account';
    return 'target';
  }
  return step;
}
