import type { MacroStep } from './macro';
import type { SocialMacroStep, SocialTarget } from './social-macro-dsl';

export function slugSocialApp(value: string) {
  return value.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase() || 'app';
}

export function buildSocialTargetParams(target?: SocialTarget) {
  return {
    ...(target?.resourceId ? { resourceId: target.resourceId } : {}),
    ...(target?.fallback ? { x: target.fallback.x, y: target.fallback.y } : {}),
    selector: target ? { ...target } : undefined,
  };
}

export function compileSocialStep(step: SocialMacroStep, packageName: string): MacroStep[] {
  if (step.action === 'launch_app') {
    return [{ id: step.id, type: 'launch_app', params: { appName: packageName } }];
  }

  if (step.action === 'wait') {
    return [{ id: step.id, type: 'wait', params: { ms: step.ms ?? 1_000 } }];
  }

  if (step.action === 'screenshot') {
    return [{ id: step.id, type: 'screenshot', params: { saveToArtifact: true } }];
  }

  if (step.action === 'review_gate') {
    return [{ id: step.id, type: 'approval_checkpoint', params: { reason: step.reason ?? 'Review social draft before publish' } }];
  }

  if (step.action === 'verify_foreground_app') {
    return [
      { id: `${step.id}_current`, type: 'get_current_app', params: {} },
      {
        id: step.id,
        type: 'conditional',
        params: {
          left: `{{steps.${step.id}_current.appPackage}}`,
          operator: 'equals',
          right: step.expectedPackage ?? packageName,
        },
        else: [{ id: `${step.id}_stop`, type: 'stop', params: { reason: 'Foreground app mismatch' } }],
      },
    ];
  }

  if (step.action === 'input_text') {
    return [{ id: step.id, type: 'input_text', params: { text: step.value ?? '', ...buildSocialTargetParams(step.target) } }];
  }

  if (step.action === 'tap') {
    return [{ id: step.id, type: 'tap', params: buildSocialTargetParams(step.target) }];
  }

  if (step.action === 'publish') {
    return [
      { id: `${step.id}_approval`, type: 'approval_checkpoint', params: { reason: step.reason ?? 'Approve final publish tap' } },
      { id: step.id, type: 'tap', params: buildSocialTargetParams(step.target), policy: { requiresApproval: true } },
    ];
  }

  return [{
    id: step.id,
    type: 'swipe',
    params: {
      fromX: step.from?.x ?? 0.5,
      fromY: step.from?.y ?? 0.75,
      toX: step.to?.x ?? 0.5,
      toY: step.to?.y ?? 0.35,
    },
  }];
}
