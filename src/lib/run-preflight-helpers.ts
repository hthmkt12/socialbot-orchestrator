import type { MacroInputField, MacroStep, TargetMode } from '../contracts/macro';
import type { TargetType } from './database.types';
import type { RunPreflightIssue } from './run-preflight-types';

const TARGET_MODE_TO_TARGET_TYPE: Record<TargetMode, TargetType> = {
  single_device: 'SINGLE_DEVICE',
  multi_device: 'MULTI_DEVICE',
  device_group: 'DEVICE_GROUP',
  all_devices: 'ALL_DEVICES',
};

export const SENSITIVE_STEP_TYPES = new Set(['adb', 'run_autox']);

export function targetModeToTargetType(mode: TargetMode): TargetType {
  return TARGET_MODE_TO_TARGET_TYPE[mode];
}

export function flattenSteps(steps: MacroStep[]): MacroStep[] {
  const flat: MacroStep[] = [];

  const visit = (items: MacroStep[]) => {
    for (const step of items) {
      flat.push(step);
      if (step.then) visit(step.then);
      if (step.else) visit(step.else);
      if (step.steps) visit(step.steps);
    }
  };

  visit(steps);
  return flat;
}

export function extractTemplateRefs(value: string) {
  return [...value.matchAll(/\{\{([^}]+)\}\}/g)].map((match) => match[1]?.trim()).filter(Boolean) as string[];
}

function isBlank(value: string | undefined) {
  return !value || value.trim().length === 0;
}

export function validateInputField(
  inputKey: string,
  field: MacroInputField,
  inputValues: Record<string, string>
): RunPreflightIssue[] {
  const value = inputValues[inputKey];
  const issues: RunPreflightIssue[] = [];

  if (field.required && isBlank(value)) {
    issues.push({
      id: `input-required-${inputKey}`,
      severity: 'blocking',
      title: `Required input missing: ${inputKey}`,
      detail: `Provide a value for "${inputKey}" before dispatching this run.`,
    });
    return issues;
  }

  if (isBlank(value)) return issues;

  if (field.type === 'number' && !Number.isFinite(Number(value))) {
    issues.push({
      id: `input-number-${inputKey}`,
      severity: 'blocking',
      title: `Invalid number input: ${inputKey}`,
      detail: `"${inputKey}" must be a valid numeric value, but the current input cannot be parsed as a number.`,
    });
  }

  if (field.type === 'boolean' && !['true', 'false'].includes(value.trim().toLowerCase())) {
    issues.push({
      id: `input-boolean-${inputKey}`,
      severity: 'blocking',
      title: `Invalid boolean input: ${inputKey}`,
      detail: `"${inputKey}" must resolve to true or false before this run can start.`,
    });
  }

  return issues;
}
