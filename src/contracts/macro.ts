export type StepType =
  | 'wait'
  | 'launch_app'
  | 'input_text'
  | 'tap'
  | 'swipe'
  | 'screenshot'
  | 'get_current_app'
  | 'adb'
  | 'run_autox'
  | 'approval_checkpoint'
  | 'conditional'
  | 'foreach_device'
  | 'group'
  | 'stop'
  | 'ai_task';

export type OnErrorPolicy = 'stop' | 'continue' | 'skip';
export type TargetMode = 'single_device' | 'device_group' | 'multi_device' | 'all_devices';
export type ConditionalOperator = 'equals' | 'not_equals' | 'contains' | 'starts_with' | 'ends_with' | 'gt' | 'lt';

export interface StepPolicy {
  requiresApproval?: boolean;
  timeoutMs?: number;
  maxRetries?: number;
}

export interface MacroStep {
  id: string;
  type: StepType;
  params: Record<string, unknown>;
  policy?: StepPolicy;
  then?: MacroStep[];
  else?: MacroStep[];
  steps?: MacroStep[];
}

export interface MacroInputField {
  type: 'string' | 'number' | 'boolean';
  required?: boolean;
  default?: unknown;
  description?: string;
}

export interface MacroMeta {
  key: string;
  name: string;
  description?: string;
  tags?: string[];
}

export interface MacroExecution {
  defaultTimeoutMs: number;
  maxRetries: number;
  onError: OnErrorPolicy;
}

export interface MacroTarget {
  mode: TargetMode;
}

export interface MacroDefinition {
  version: number;
  meta: MacroMeta;
  inputs: Record<string, MacroInputField>;
  target: MacroTarget;
  execution: MacroExecution;
  steps: MacroStep[];
}

export function validateMacroDefinition(def: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!def || typeof def !== 'object') {
    return { valid: false, errors: ['Definition must be an object'] };
  }

  const d = def as Record<string, unknown>;

  if (d.version !== 1) errors.push('version must be 1');
  if (!d.meta || typeof d.meta !== 'object') errors.push('meta is required');
  if (!d.steps || !Array.isArray(d.steps)) errors.push('steps must be an array');
  if (d.steps && Array.isArray(d.steps) && d.steps.length === 0) errors.push('steps cannot be empty');

  if (d.meta && typeof d.meta === 'object') {
    const meta = d.meta as Record<string, unknown>;
    if (!meta.key || typeof meta.key !== 'string') errors.push('meta.key is required');
    if (!meta.name || typeof meta.name !== 'string') errors.push('meta.name is required');
  }

  if (d.execution && typeof d.execution === 'object') {
    const exec = d.execution as Record<string, unknown>;
    if (exec.defaultTimeoutMs !== undefined && typeof exec.defaultTimeoutMs !== 'number') {
      errors.push('execution.defaultTimeoutMs must be a number');
    }
    if (exec.maxRetries !== undefined && typeof exec.maxRetries !== 'number') {
      errors.push('execution.maxRetries must be a number');
    }
    if (exec.onError !== undefined && !['stop', 'continue', 'skip'].includes(exec.onError as string)) {
      errors.push('execution.onError must be stop, continue, or skip');
    }
  }

  const validStepTypes: StepType[] = [
    'wait', 'launch_app', 'input_text', 'tap', 'swipe', 'screenshot',
    'get_current_app', 'adb', 'run_autox', 'approval_checkpoint',
    'conditional', 'foreach_device', 'group', 'stop', 'ai_task',
  ];

  if (d.steps && Array.isArray(d.steps)) {
    const ids = new Set<string>();
    function validateSteps(steps: unknown[], path: string) {
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i] as Record<string, unknown>;
        const sp = `${path}[${i}]`;
        if (!step.id || typeof step.id !== 'string') errors.push(`${sp}.id is required`);
        if (step.id && ids.has(step.id as string)) errors.push(`${sp}.id "${step.id}" is duplicate`);
        if (step.id) ids.add(step.id as string);
        if (!step.type || !validStepTypes.includes(step.type as StepType)) {
          errors.push(`${sp}.type "${step.type}" is not valid`);
        }
        if (step.then && Array.isArray(step.then)) validateSteps(step.then, `${sp}.then`);
        if (step.else && Array.isArray(step.else)) validateSteps(step.else, `${sp}.else`);
        if (step.steps && Array.isArray(step.steps)) validateSteps(step.steps, `${sp}.steps`);
      }
    }
    validateSteps(d.steps as unknown[], 'steps');
  }

  return { valid: errors.length === 0, errors };
}

export { SAMPLE_MACROS } from './sample-macros';
