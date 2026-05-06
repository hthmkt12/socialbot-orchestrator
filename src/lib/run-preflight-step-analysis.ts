import type { MacroDefinition } from '../contracts/macro';
import { extractTemplateRefs, flattenSteps, SENSITIVE_STEP_TYPES } from './run-preflight-helpers';
import type { RunPreflightIssue } from './run-preflight-types';

export interface RunPreflightStepAnalysis {
  blockingIssues: RunPreflightIssue[];
  warnings: RunPreflightIssue[];
  sensitiveStepCount: number;
  approvalStepCount: number;
}

export function analyzeRunPreflightSteps(definition: MacroDefinition): RunPreflightStepAnalysis {
  const blockingIssues: RunPreflightIssue[] = [];
  const warnings: RunPreflightIssue[] = [];
  const declaredInputs = new Set(Object.keys(definition.inputs ?? {}));
  const seenStepIds = new Set<string>();
  let priorApprovalCheckpoints = 0;
  let sensitiveStepCount = 0;
  let approvalStepCount = 0;
  let duplicateApprovalSensitiveCount = 0;

  for (const step of flattenSteps(definition.steps)) {
    if (step.type === 'approval_checkpoint') {
      priorApprovalCheckpoints += 1;
      approvalStepCount += 1;
    }

    for (const value of Object.values(step.params ?? {})) {
      if (typeof value !== 'string') continue;

      for (const ref of extractTemplateRefs(value)) {
        if (ref.startsWith('steps.')) {
          const referencedStepId = ref.split('.')[1];
          if (!referencedStepId || !seenStepIds.has(referencedStepId)) {
            blockingIssues.push({
              id: `missing-step-ref-${step.id}-${ref}`,
              severity: 'blocking',
              title: `Step reference cannot be resolved: ${step.id}`,
              detail: `Step "${step.id}" references "${ref}", but that earlier step output is not available in the macro order.`,
            });
          }
          continue;
        }

        if (!declaredInputs.has(ref)) {
          blockingIssues.push({
            id: `missing-input-ref-${step.id}-${ref}`,
            severity: 'blocking',
            title: `Input reference cannot be resolved: ${step.id}`,
            detail: `Step "${step.id}" references input "${ref}", but that input is not declared in the macro definition.`,
          });
        }
      }
    }

    if (SENSITIVE_STEP_TYPES.has(step.type)) {
      sensitiveStepCount += 1;
      const hasApprovalGate = step.policy?.requiresApproval || priorApprovalCheckpoints > 0;
      if (!hasApprovalGate) {
        blockingIssues.push({
          id: `sensitive-step-unguarded-${step.id}`,
          severity: 'blocking',
          title: `Sensitive step is not approval-gated: ${step.id}`,
          detail: `Step "${step.id}" uses ${step.type} but has no visible approval gate before execution.`,
        });
      }
      if (step.policy?.requiresApproval && priorApprovalCheckpoints > 0) {
        duplicateApprovalSensitiveCount += 1;
      }
    }

    seenStepIds.add(step.id);
  }

  if (sensitiveStepCount > 0) {
    warnings.push({
      id: 'sensitive-steps-present',
      severity: 'warning',
      title: 'Sensitive steps will require extra operational care',
      detail: `This macro contains ${sensitiveStepCount} sensitive step(s) and ${approvalStepCount} explicit approval checkpoint(s).`,
    });
  }

  if (duplicateApprovalSensitiveCount > 0) {
    warnings.push({
      id: 'possible-duplicate-approval',
      severity: 'warning',
      title: 'Macro may prompt for approval more than once',
      detail: `${duplicateApprovalSensitiveCount} sensitive step(s) appear after an approval checkpoint and also declare step-level approval gating.`,
    });
  }

  return { approvalStepCount, blockingIssues, sensitiveStepCount, warnings };
}
