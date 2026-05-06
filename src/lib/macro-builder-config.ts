import type { StepType } from '../contracts/macro';
import type { GuidedBuilderStepDefinition, GuidedBuilderStepType } from './macro-builder';

export const GUIDED_BUILDER_STEPS: GuidedBuilderStepDefinition[] = [
  {
    type: 'launch_app',
    label: 'Launch App',
    description: 'Open an Android app by package or alias.',
    defaultParams: { appName: '{{appName}}' },
  },
  {
    type: 'wait',
    label: 'Wait',
    description: 'Pause for a short amount of time.',
    defaultParams: { ms: 1000 },
  },
  {
    type: 'tap',
    label: 'Tap',
    description: 'Tap a normalized screen coordinate.',
    defaultParams: { x: 0.5, y: 0.5 },
  },
  {
    type: 'swipe',
    label: 'Swipe',
    description: 'Swipe between two normalized coordinates.',
    defaultParams: { fromX: 0.5, fromY: 0.8, toX: 0.5, toY: 0.25 },
  },
  {
    type: 'input_text',
    label: 'Input Text',
    description: 'Type text into the focused field.',
    defaultParams: { text: '{{textValue}}' },
  },
  {
    type: 'screenshot',
    label: 'Screenshot',
    description: 'Capture a screenshot and store it as evidence.',
    defaultParams: { saveToArtifact: true },
  },
  {
    type: 'get_current_app',
    label: 'Get Current App',
    description: 'Read the current foreground app information.',
    defaultParams: {},
  },
  {
    type: 'approval_checkpoint',
    label: 'Approval Checkpoint',
    description: 'Pause the run and ask for manual approval.',
    defaultParams: { reason: 'Manual approval required before continuing' },
  },
  {
    type: 'stop',
    label: 'Stop',
    description: 'Stop the run with a human-readable reason.',
    defaultParams: { reason: 'Stopped by workflow rule' },
  },
];

export const GUIDED_STEP_TYPES = new Set<StepType>(GUIDED_BUILDER_STEPS.map((step) => step.type));

export const STEP_ID_PREFIX: Record<GuidedBuilderStepType, string> = {
  launch_app: 'launch',
  wait: 'wait',
  tap: 'tap',
  swipe: 'swipe',
  input_text: 'input',
  screenshot: 'screen',
  get_current_app: 'current',
  approval_checkpoint: 'approval',
  stop: 'stop',
};
