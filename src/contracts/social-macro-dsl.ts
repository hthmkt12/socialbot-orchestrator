import type { MacroDefinition, MacroInputField } from './macro';
import { compileSocialStep, slugSocialApp } from './social-macro-dsl-helpers';

export type SocialMacroAction =
  | 'launch_app'
  | 'wait'
  | 'tap'
  | 'swipe'
  | 'input_text'
  | 'screenshot'
  | 'verify_foreground_app'
  | 'review_gate'
  | 'publish';

export interface SocialTarget {
  text?: string;
  textContains?: string;
  resourceId?: string;
  description?: string;
  fallback?: { x: number; y: number };
}

export interface SocialMacroStep {
  id: string;
  action: SocialMacroAction;
  target?: SocialTarget;
  value?: string;
  ms?: number;
  from?: { x: number; y: number };
  to?: { x: number; y: number };
  expectedPackage?: string;
  reason?: string;
}

export interface SocialMacroDefinition {
  version: 1;
  meta: { key: string; name: string; description?: string; tags?: string[] };
  app: { packageName: string; displayName?: string };
  safety: { reviewBeforePublish: boolean; allowPublishByDefault: boolean };
  inputs: Record<string, MacroInputField>;
  steps: SocialMacroStep[];
}

export interface CreateSocialDraftPostMacroOptions {
  appPackage: string;
  key?: string;
  name?: string;
  captionInput?: string;
}

export function validateSocialMacroDefinition(def: SocialMacroDefinition) {
  const errors: string[] = [];
  if (def.version !== 1) errors.push('version must be 1');
  if (!def.meta.key) errors.push('meta.key is required');
  if (!def.app.packageName) errors.push('app.packageName is required');
  if (!Array.isArray(def.steps) || def.steps.length === 0) errors.push('steps cannot be empty');
  const hasPublish = def.steps.some((step) => step.action === 'publish');
  if (hasPublish && !def.safety.reviewBeforePublish) errors.push('publish requires safety.reviewBeforePublish');
  if (hasPublish && def.safety.allowPublishByDefault) errors.push('publish must default to blocked');
  return { valid: errors.length === 0, errors };
}

export function createSocialDraftPostMacro(options: CreateSocialDraftPostMacroOptions): SocialMacroDefinition {
  const key = options.key ?? `social_draft_${slugSocialApp(options.appPackage)}`;
  const captionInput = options.captionInput ?? 'caption';
  return {
    version: 1,
    meta: { key, name: options.name ?? `Social Draft ${options.appPackage}`, tags: ['social', 'draft', 'review-gated'] },
    app: { packageName: options.appPackage, displayName: options.appPackage },
    safety: { reviewBeforePublish: true, allowPublishByDefault: false },
    inputs: {
      [captionInput]: { type: 'string', required: true, description: 'Caption or post body' },
    },
    steps: [
      { id: 'launch_app', action: 'launch_app' },
      { id: 'wait_home', action: 'wait', ms: 2_500 },
      { id: 'open_composer', action: 'tap', target: { textContains: 'Post', fallback: { x: 0.5, y: 0.92 } } },
      { id: 'wait_composer', action: 'wait', ms: 1_500 },
      { id: 'enter_caption', action: 'input_text', value: `{{${captionInput}}}`, target: { fallback: { x: 0.5, y: 0.35 } } },
      { id: 'capture_draft', action: 'screenshot' },
      { id: 'review_before_publish', action: 'review_gate' },
      { id: 'publish_post', action: 'publish', target: { text: 'Post', fallback: { x: 0.88, y: 0.08 } } },
    ],
  };
}

export function compileSocialMacroToMacroDefinition(def: SocialMacroDefinition): MacroDefinition {
  return {
    version: 1,
    meta: { ...def.meta, tags: [...(def.meta.tags ?? []), 'social-dsl'] },
    inputs: def.inputs,
    target: { mode: 'single_device' },
    execution: { defaultTimeoutMs: 20_000, maxRetries: 1, onError: 'stop' },
    steps: def.steps.flatMap((step) => compileSocialStep(step, def.app.packageName)),
  };
}

export const SOCIAL_DRAFT_POST_SAMPLE: SocialMacroDefinition = {
  version: 1,
  meta: { key: 'social_draft_post_v1', name: 'Social Draft Post V1', tags: ['social', 'draft', 'review-gated'] },
  app: { packageName: '{{appPackage}}', displayName: 'Social app' },
  safety: { reviewBeforePublish: true, allowPublishByDefault: false },
  inputs: {
    appPackage: { type: 'string', required: true, description: 'Target social app package' },
    caption: { type: 'string', required: true, description: 'Caption or post body' },
  },
  steps: [
    { id: 'launch_app', action: 'launch_app' },
    { id: 'wait_home', action: 'wait', ms: 2_500 },
    { id: 'open_composer', action: 'tap', target: { textContains: 'Post', fallback: { x: 0.5, y: 0.92 } } },
    { id: 'wait_composer', action: 'wait', ms: 1_500 },
    { id: 'enter_caption', action: 'input_text', value: '{{caption}}', target: { fallback: { x: 0.5, y: 0.35 } } },
    { id: 'capture_draft', action: 'screenshot' },
    { id: 'review_before_publish', action: 'review_gate' },
    { id: 'publish_post', action: 'publish', target: { text: 'Post', fallback: { x: 0.88, y: 0.08 } } },
  ],
};
