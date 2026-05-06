import type { MacroStep } from '../../contracts/macro';

export function parseBuilderNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function updateStepPolicy(
  step: MacroStep,
  key: 'requiresApproval' | 'timeoutMs' | 'maxRetries',
  value: boolean | number | null
): MacroStep {
  const nextPolicy = { ...(step.policy ?? {}) };

  if (value === null || value === false) {
    delete nextPolicy[key];
  } else {
    nextPolicy[key] = value as never;
  }

  return {
    ...step,
    policy: Object.keys(nextPolicy).length > 0 ? nextPolicy : undefined,
  };
}
