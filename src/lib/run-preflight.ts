import { validateMacroDefinition } from '../contracts/macro';
import type { TargetMode } from '../contracts/macro';
import type { TargetType } from './database.types';
import { buildLaunchGateResults } from './readiness-gates';
import { targetModeToTargetType as mapTargetModeToTargetType } from './run-preflight-helpers';
import { analyzeRunPreflightSteps } from './run-preflight-step-analysis';
import { buildDevicePreflightWarnings, buildTargetPreflightIssues } from './run-preflight-target-issues';
import type {
  BuildRunPreflightSummaryArgs,
  RunPreflightIssue,
  RunPreflightSummary,
} from './run-preflight-types';

export type { BuildRunPreflightSummaryArgs, RunPreflightIssue, RunPreflightSummary } from './run-preflight-types';

export function targetModeToTargetType(mode: TargetMode): TargetType {
  return mapTargetModeToTargetType(mode);
}

function buildMissingDefinitionSummary(): RunPreflightSummary {
  return {
    declaredTargetType: 'SINGLE_DEVICE',
    blockingIssues: [{
      id: 'missing-definition',
      severity: 'blocking',
      title: 'Macro definition is unavailable',
      detail: 'Choose a macro version with a valid definition before dispatching a run.',
      recoveryHint: 'Select a macro version with a valid definition before dispatching.',
    }],
    warnings: [],
    gates: buildLaunchGateResults({
      blockingIssues: [{
        id: 'missing-definition',
        severity: 'blocking',
        title: 'Macro definition is unavailable',
        detail: 'Choose a macro version with a valid definition before dispatching a run.',
        recoveryHint: 'Select a macro version with a valid definition before dispatching.',
      }],
      warnings: [],
    }),
    sensitiveStepCount: 0,
    approvalStepCount: 0,
  };
}

function buildDefinitionIssues(definition: NonNullable<BuildRunPreflightSummaryArgs['definition']>) {
  const issues: RunPreflightIssue[] = [];
  const definitionValidation = validateMacroDefinition(definition);

  if (!definitionValidation.valid) {
    for (const error of definitionValidation.errors) {
      issues.push({
        id: `definition-${error}`,
        severity: 'blocking',
        title: 'Macro definition is invalid',
        detail: error,
      });
    }
  }

  return issues;
}

export function buildRunPreflightSummary(args: BuildRunPreflightSummaryArgs): RunPreflightSummary {
  if (!args.definition) return buildMissingDefinitionSummary();

  const definition = args.definition;
  const declaredTargetType = targetModeToTargetType(definition.target.mode);
  const blockingIssues = [
    ...buildDefinitionIssues(definition),
  ];

  blockingIssues.push(
    ...buildTargetPreflightIssues(args, definition, declaredTargetType, blockingIssues.length)
  );

  const stepAnalysis = analyzeRunPreflightSteps(definition);
  blockingIssues.push(...stepAnalysis.blockingIssues);

  const warnings = [
    ...buildDevicePreflightWarnings(args),
    ...stepAnalysis.warnings,
  ];

  return {
    declaredTargetType,
    blockingIssues,
    warnings,
    gates: buildLaunchGateResults({ blockingIssues, warnings }),
    sensitiveStepCount: stepAnalysis.sensitiveStepCount,
    approvalStepCount: stepAnalysis.approvalStepCount,
  };
}
