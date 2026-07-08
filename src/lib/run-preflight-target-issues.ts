import type { MacroDefinition } from '../contracts/macro';
import type { MacroStep } from '../contracts/macro';
import type { TargetType } from './database.types';
import { validateInputField } from './run-preflight-helpers';
import type { BuildRunPreflightSummaryArgs, RunPreflightIssue } from './run-preflight-types';

const INSTAGRAM_PILOT_MACRO_KEY = 'instagram_pilot_open_capture';
const PILOT_DISALLOWED_ACTIONS = new Set(['like', 'follow', 'comment', 'post', 'message', 'share']);
const DEFAULT_MAX_PILOT_TARGET_COUNT = 5;

function collectPilotDisallowedActionIds(steps: MacroStep[]): string[] {
  const ids: string[] = [];
  for (const step of steps) {
    const actionType = step.params?.actionBudgetType ?? step.params?.actionType ?? step.params?.socialAction;
    if (typeof actionType === 'string' && PILOT_DISALLOWED_ACTIONS.has(actionType)) {
      ids.push(step.id);
    }
    if (step.steps) ids.push(...collectPilotDisallowedActionIds(step.steps));
    if (step.then) ids.push(...collectPilotDisallowedActionIds(step.then));
    if (step.else) ids.push(...collectPilotDisallowedActionIds(step.else));
    if (step.catch) ids.push(...collectPilotDisallowedActionIds(step.catch));
  }
  return ids;
}

export function buildTargetPreflightIssues(
  args: BuildRunPreflightSummaryArgs,
  definition: MacroDefinition,
  declaredTargetType: TargetType,
  existingBlockingIssueCount: number
): RunPreflightIssue[] {
  const issues: RunPreflightIssue[] = [];

  if (args.profileRole === 'VIEWER') {
    issues.push({
      id: 'viewer-role-block',
      severity: 'blocking',
      title: 'Viewer role cannot launch runs',
      detail: 'Ask an operator or admin to launch this workflow, or elevate the signed-in account before retrying.',
    });
  }

  if (args.targetType !== declaredTargetType) {
    issues.push({
      id: 'target-mode-mismatch',
      severity: 'blocking',
      title: 'Selected target mode does not match this macro',
      detail: `This macro declares ${declaredTargetType.replace(/_/g, ' ')}, but the wizard is currently set to ${args.targetType.replace(/_/g, ' ')}.`,
    });
  }

  for (const [inputKey, field] of Object.entries(definition.inputs ?? {})) {
    issues.push(...validateInputField(inputKey, field, args.inputValues));
  }

  if (definition.meta.key === INSTAGRAM_PILOT_MACRO_KEY) {
    const disallowedStepIds = collectPilotDisallowedActionIds(definition.steps);
    if (disallowedStepIds.length > 0) {
      issues.push({
        id: 'instagram-pilot-disallowed-action',
        severity: 'blocking',
        title: 'Instagram pilot workflow contains an out-of-scope action',
        detail: `Remove follow/like/comment/post/message/share actions from steps: ${disallowedStepIds.join(', ')}.`,
      });
    }

    if (args.selectedAccount && args.selectedAccount.platform !== 'instagram') {
      issues.push({
        id: 'instagram-pilot-account-platform',
        severity: 'blocking',
        title: 'Instagram pilot workflow requires an Instagram account',
        detail: `${args.selectedAccount.username} is a ${args.selectedAccount.platform} account.`,
      });
    }
  }

  if (args.requiresAccount && !args.selectedAccount) {
    issues.push({
      id: 'account-required',
      severity: 'blocking',
      title: 'Social account is required',
      detail: 'Choose an active social account before dispatching this engagement workflow.',
    });
  }

  if (args.selectedAccount) {
    const account = args.selectedAccount;
    if (account.is_blocked) {
      issues.push({
        id: 'selected-account-blocked',
        severity: 'blocking',
        title: 'Selected account is blocked',
        detail: `${account.username} is blocked and cannot be used for new social engagement runs.`,
      });
    }

    if (account.warm_up_stage <= 1) {
      issues.push({
        id: 'selected-account-warmup-not-started',
        severity: 'blocking',
        title: 'Selected account is not warmed up',
        detail: `${account.username} is still in stage ${account.warm_up_stage}. Start warm-up before dispatching engagement actions.`,
      });
    }

    if (account.current_action_count >= account.daily_action_limit) {
      issues.push({
        id: 'selected-account-daily-limit-exhausted',
        severity: 'blocking',
        title: 'Selected account reached its daily action limit',
        detail: `${account.username} has used ${account.current_action_count}/${account.daily_action_limit} actions today.`,
      });
    }
  }

  if (args.targetType === 'SINGLE_DEVICE' && args.selectedDeviceIds.length !== 1) {
    issues.push({
      id: 'single-device-selection',
      severity: 'blocking',
      title: 'Single-device target requires exactly one device',
      detail: 'Select one device before dispatching a single-device macro.',
    });
  }

  const maxPilotTargetCount = args.maxPilotTargetCount ?? DEFAULT_MAX_PILOT_TARGET_COUNT;
  if (args.targetType !== 'SINGLE_DEVICE' && args.targetDevicesCount > maxPilotTargetCount) {
    issues.push({
      id: 'max-pilot-target-count-exceeded',
      severity: 'blocking',
      title: 'Selected targets exceed the pilot device limit',
      detail: `${args.targetDevicesCount} targets resolved, but this pilot profile allows at most ${maxPilotTargetCount}.`,
      recoveryHint: 'Reduce the selected devices or ask an admin to raise the bounded pilot target limit.',
    });
  }

  if (args.targetType === 'MULTI_DEVICE' && args.selectedDeviceIds.length === 0) {
    issues.push({
      id: 'multi-device-selection',
      severity: 'blocking',
      title: 'No target devices selected',
      detail: 'Choose at least one device before dispatching a multi-device run.',
    });
  }

  if (args.targetType === 'DEVICE_GROUP' && !args.selectedGroupId) {
    issues.push({
      id: 'group-selection',
      severity: 'blocking',
      title: 'No target group selected',
      detail: 'Choose a device group before dispatching this group-targeted run.',
    });
  }

  if (args.targetType === 'DEVICE_GROUP' && args.selectedGroupId && args.groupMemberCount === 0) {
    issues.push({
      id: 'empty-group',
      severity: 'blocking',
      title: 'Selected group has no devices',
      detail: 'Add at least one device to the selected group or choose another target before dispatch.',
    });
  }

  if (args.targetType === 'ALL_DEVICES' && args.totalDevicesCount === 0) {
    issues.push({
      id: 'no-devices-registered',
      severity: 'blocking',
      title: 'No registered devices are available',
      detail: 'Sync or register devices before using the all-devices target mode.',
    });
  }

  if (args.targetDevicesCount === 0 && issues.length + existingBlockingIssueCount === 0) {
    issues.push({
      id: 'no-targets',
      severity: 'blocking',
      title: 'No target devices resolved',
      detail: 'The current target selection does not resolve to any device rows.',
    });
  }

  if (args.targetDevicesCount > 0 && args.runnableDeviceCount === 0) {
    issues.push({
      id: 'no-runnable-targets',
      severity: 'blocking',
      title: 'No runnable target devices are available',
      detail: 'Every resolved target is currently offline or otherwise not runnable under the shared lifecycle policy.',
    });
  }

  if (args.targetDevicesCount > 0 && args.dispatchableDeviceCount === 0 && args.lockedTargetDevicesCount > 0) {
    issues.push({
      id: 'all-runnable-targets-locked',
      severity: 'blocking',
      title: 'All runnable target devices are locked',
      detail: 'Wait for the owning runs to finish or clear expired locks before dispatching this run.',
    });
  }

  return issues;
}

export function buildDevicePreflightWarnings(args: BuildRunPreflightSummaryArgs): RunPreflightIssue[] {
  const warnings: RunPreflightIssue[] = [];

  if (args.deviceLocksError) {
    warnings.push({
      id: 'device-lock-visibility-degraded',
      severity: 'warning',
      title: 'Lock visibility is degraded',
      detail: args.deviceLocksError,
    });
  }

  if (args.targetDevicesCount > 0 && args.dispatchableDeviceCount > 0 && args.dispatchableDeviceCount < args.targetDevicesCount) {
    warnings.push({
      id: 'partial-dispatchability',
      severity: 'warning',
      title: 'Not every resolved target is dispatch-ready',
      detail: `${args.dispatchableDeviceCount} of ${args.targetDevicesCount} target devices are currently both runnable and unlocked.`,
    });
  }

  if (args.staleDeviceCount > 0) {
    warnings.push({
      id: 'stale-target-devices',
      severity: 'warning',
      title: 'Some targets have stale heartbeats',
      detail: `${args.staleDeviceCount} target device(s) are still treated as runnable, but their heartbeat freshness has drifted into the stale window.`,
    });
  }

  if (args.lockedTargetDevicesCount > 0 && args.dispatchableDeviceCount > 0) {
    warnings.push({
      id: 'partial-lock-contention',
      severity: 'warning',
      title: 'Some targets are locked by other runs',
      detail: `${args.lockedTargetDevicesCount} target device(s) are currently locked and may not be available until their owning runs complete.`,
    });
  }

  if (args.expiredLockedTargetDevicesCount > 0) {
    warnings.push({
      id: 'expired-lock-history',
      severity: 'warning',
      title: 'Expired lock rows are still visible',
      detail: `${args.expiredLockedTargetDevicesCount} target device(s) show expired lock history. Cleanup keeps future contention signals trustworthy.`,
    });
  }

  return warnings;
}
