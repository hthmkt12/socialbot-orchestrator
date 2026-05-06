import type { MacroStep } from '../contracts/macro';
import type { GuidedBuilderStepDefinition, GuidedBuilderStepType } from './macro-builder';

export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createNextGuidedStepId(
  type: GuidedBuilderStepType,
  existingSteps: MacroStep[],
  stepIdPrefix: Record<GuidedBuilderStepType, string>
) {
  const existingIds = new Set(existingSteps.map((step) => step.id));
  const prefix = stepIdPrefix[type];
  let counter = 1;
  let candidate = `${prefix}_${counter}`;

  while (existingIds.has(candidate)) {
    counter += 1;
    candidate = `${prefix}_${counter}`;
  }

  return candidate;
}

export function collectGuidedBuilderCompatibilityReasons(
  steps: MacroStep[],
  supportedStepTypes: Set<MacroStep['type']>
) {
  const reasons: string[] = [];

  steps.forEach((step, index) => {
    const currentPath = `steps[${index}]`;

    if (!supportedStepTypes.has(step.type)) {
      reasons.push(`${currentPath} uses unsupported step type "${step.type}"`);
    }

    if (step.then && step.then.length > 0) {
      reasons.push(`${currentPath} contains THEN branch logic`);
    }

    if (step.else && step.else.length > 0) {
      reasons.push(`${currentPath} contains ELSE branch logic`);
    }

    if (step.steps && step.steps.length > 0) {
      reasons.push(`${currentPath} contains nested grouped steps`);
    }
  });

  return reasons;
}

export function findGuidedBuilderTemplate(
  type: GuidedBuilderStepType,
  guidedBuilderSteps: GuidedBuilderStepDefinition[]
) {
  return guidedBuilderSteps.find((step) => step.type === type);
}
