import type { MacroDefinition, MacroStep } from '../contracts/macro';
import { GUIDED_BUILDER_STEPS, GUIDED_STEP_TYPES, STEP_ID_PREFIX } from './macro-builder-config';
import {
  collectGuidedBuilderCompatibilityReasons,
  createNextGuidedStepId,
  deepClone,
  findGuidedBuilderTemplate,
} from './macro-builder-helpers';

export type GuidedBuilderStepType =
  | 'launch_app'
  | 'wait'
  | 'tap'
  | 'swipe'
  | 'input_text'
  | 'screenshot'
  | 'get_current_app'
  | 'approval_checkpoint'
  | 'stop';

export interface GuidedBuilderCompatibility {
  supported: boolean;
  reasons: string[];
}

export interface GuidedBuilderStepDefinition {
  type: GuidedBuilderStepType;
  label: string;
  description: string;
  defaultParams: Record<string, unknown>;
}

export { GUIDED_BUILDER_STEPS } from './macro-builder-config';

export function createEmptyMacroDefinition(): MacroDefinition {
  return {
    version: 1,
    meta: {
      key: '',
      name: '',
      description: '',
      tags: [],
    },
    inputs: {},
    target: { mode: 'single_device' },
    execution: {
      defaultTimeoutMs: 10000,
      maxRetries: 0,
      onError: 'stop',
    },
    steps: [],
  };
}

export function cloneMacroDefinition(definition: MacroDefinition): MacroDefinition {
  return deepClone(definition);
}

export function createGuidedBuilderStep(
  type: GuidedBuilderStepType,
  existingSteps: MacroStep[]
): MacroStep {
  const candidate = createNextGuidedStepId(type, existingSteps, STEP_ID_PREFIX);
  const template = findGuidedBuilderTemplate(type, GUIDED_BUILDER_STEPS);

  return {
    id: candidate,
    type,
    params: deepClone(template?.defaultParams ?? {}),
  };
}

export function analyzeMacroDefinitionForGuidedBuilder(
  definition: MacroDefinition
): GuidedBuilderCompatibility {
  const reasons = collectGuidedBuilderCompatibilityReasons(definition.steps, GUIDED_STEP_TYPES);

  return {
    supported: reasons.length === 0,
    reasons,
  };
}
