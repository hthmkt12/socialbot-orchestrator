import { describe, expect, it } from 'vitest';
import type { MacroDefinition } from '../contracts/macro';
import { buildRunPreflightSummary, targetModeToTargetType } from './run-preflight';

const baseDefinition: MacroDefinition = {
  version: 1,
  meta: { key: 'smoke', name: 'Smoke' },
  inputs: { appName: { type: 'string', required: true } },
  target: { mode: 'single_device' },
  execution: { defaultTimeoutMs: 10000, maxRetries: 1, onError: 'stop' },
  steps: [
    { id: 'launch', type: 'launch_app', params: { appName: '{{appName}}' } },
    { id: 'current', type: 'get_current_app', params: {} },
  ],
};

function buildSummary(overrides: Partial<Parameters<typeof buildRunPreflightSummary>[0]> = {}) {
  return buildRunPreflightSummary({
    definition: baseDefinition,
    targetType: 'SINGLE_DEVICE',
    profileRole: 'OPERATOR',
    selectedDeviceIds: ['device-1'],
    selectedGroupId: '',
    targetDevicesCount: 1,
    totalDevicesCount: 1,
    groupMemberCount: 0,
    runnableDeviceCount: 1,
    dispatchableDeviceCount: 1,
    staleDeviceCount: 0,
    lockedTargetDevicesCount: 0,
    expiredLockedTargetDevicesCount: 0,
    inputValues: { appName: 'settings' },
    ...overrides,
  });
}

const activeAccount = {
  id: 'account-1',
  username: 'operator_account',
  platform: 'instagram' as const,
  is_blocked: false,
  daily_action_limit: 100,
  current_action_count: 10,
  warm_up_stage: 3,
};

describe('run preflight', () => {
  it('maps macro target modes to database target types', () => {
    expect(targetModeToTargetType('single_device')).toBe('SINGLE_DEVICE');
    expect(targetModeToTargetType('device_group')).toBe('DEVICE_GROUP');
    expect(targetModeToTargetType('multi_device')).toBe('MULTI_DEVICE');
    expect(targetModeToTargetType('all_devices')).toBe('ALL_DEVICES');
  });

  it('returns a blocking issue when the definition is missing', () => {
    const summary = buildSummary({ definition: undefined });

    expect(summary.declaredTargetType).toBe('SINGLE_DEVICE');
    expect(summary.blockingIssues.map((issue) => issue.id)).toContain('missing-definition');
    expect(summary.sensitiveStepCount).toBe(0);
    expect(summary.approvalStepCount).toBe(0);
  });

  it('blocks viewer role, missing required inputs, and target mode mismatch', () => {
    const summary = buildSummary({
      inputValues: {},
      profileRole: 'VIEWER',
      targetType: 'MULTI_DEVICE',
    });

    expect(summary.blockingIssues.map((issue) => issue.id)).toEqual(
      expect.arrayContaining(['viewer-role-block', 'input-required-appName', 'target-mode-mismatch'])
    );
    expect(summary.gates).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'launch.viewer-role-block', type: 'launch_blocker', status: 'failed' }),
    ]));
  });

  it('blocks social engagement runs when account selection is missing or unhealthy', () => {
    const missing = buildSummary({ requiresAccount: true, selectedAccount: null });
    expect(missing.blockingIssues.map((issue) => issue.id)).toContain('account-required');

    const blocked = buildSummary({
      requiresAccount: true,
      selectedAccount: { ...activeAccount, is_blocked: true },
    });
    expect(blocked.blockingIssues.map((issue) => issue.id)).toContain('selected-account-blocked');

    const notWarm = buildSummary({
      requiresAccount: true,
      selectedAccount: { ...activeAccount, warm_up_stage: 1 },
    });
    expect(notWarm.blockingIssues.map((issue) => issue.id)).toContain('selected-account-warmup-not-started');

    const exhausted = buildSummary({
      requiresAccount: true,
      selectedAccount: { ...activeAccount, current_action_count: 100, daily_action_limit: 100 },
    });
    expect(exhausted.blockingIssues.map((issue) => issue.id)).toContain('selected-account-daily-limit-exhausted');
  });

  it('blocks an Instagram pilot workflow if it contains disallowed social actions or a non-Instagram account', () => {
    const unsafePilot: MacroDefinition = {
      ...baseDefinition,
      meta: { key: 'instagram_pilot_open_capture', name: 'Instagram Pilot Open Capture' },
      inputs: {},
      steps: [
        { id: 'launch', type: 'launch_app', params: { appName: 'com.instagram.android' } },
        { id: 'tap_like', type: 'tap', params: { x: 0.5, y: 0.5, actionBudgetType: 'like' } },
      ],
    };

    const summary = buildSummary({
      definition: unsafePilot,
      inputValues: {},
      requiresAccount: true,
      selectedAccount: { ...activeAccount, platform: 'tiktok' },
    });

    expect(summary.blockingIssues.map((issue) => issue.id)).toEqual(
      expect.arrayContaining(['instagram-pilot-disallowed-action', 'instagram-pilot-account-platform'])
    );
  });

  it('blocks unresolved input refs and step refs that point forward', () => {
    const definition: MacroDefinition = {
      ...baseDefinition,
      inputs: {},
      steps: [
        { id: 'guard', type: 'conditional', params: { left: '{{steps.current.appPackage}}', operator: 'equals', right: '{{missingInput}}' } },
        { id: 'current', type: 'get_current_app', params: {} },
      ],
    };

    const summary = buildSummary({ definition, inputValues: {} });

    expect(summary.blockingIssues.map((issue) => issue.id)).toEqual(
      expect.arrayContaining([
        'missing-step-ref-guard-steps.current.appPackage',
        'missing-input-ref-guard-missingInput',
      ])
    );
  });

  it('blocks sensitive steps without approval gates and warns for duplicate approval gates', () => {
    const unguarded = buildSummary({
      definition: {
        ...baseDefinition,
        steps: [{ id: 'adb', type: 'adb', params: { command: 'shell input keyevent 3' } }],
      },
    });

    expect(unguarded.sensitiveStepCount).toBe(1);
    expect(unguarded.blockingIssues.map((issue) => issue.id)).toContain('sensitive-step-unguarded-adb');

    const duplicateGated = buildSummary({
      definition: {
        ...baseDefinition,
        steps: [
          { id: 'approval', type: 'approval_checkpoint', params: { reason: 'ADB review' } },
          { id: 'adb', type: 'adb', params: { command: 'shell input keyevent 3' }, policy: { requiresApproval: true } },
        ],
      },
    });

    expect(duplicateGated.sensitiveStepCount).toBe(1);
    expect(duplicateGated.approvalStepCount).toBe(1);
    expect(duplicateGated.warnings.map((issue) => issue.id)).toEqual(
      expect.arrayContaining(['sensitive-steps-present', 'possible-duplicate-approval'])
    );
  });

  it('reports degraded dispatchability and lock visibility as warnings', () => {
    const summary = buildSummary({
      targetDevicesCount: 3,
      runnableDeviceCount: 2,
      dispatchableDeviceCount: 1,
      staleDeviceCount: 1,
      lockedTargetDevicesCount: 1,
      expiredLockedTargetDevicesCount: 1,
      deviceLocksError: 'device_locks query failed',
    });

    expect(summary.warnings.map((issue) => issue.id)).toEqual(
      expect.arrayContaining([
        'device-lock-visibility-degraded',
        'partial-dispatchability',
        'stale-target-devices',
        'partial-lock-contention',
        'expired-lock-history',
      ])
    );
    expect(summary.gates).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'warning.device-lock-visibility-degraded', type: 'warning', status: 'failed' }),
    ]));
  });

  it('blocks Level 3 fleet pilots above the bounded target count', () => {
    const summary = buildSummary({
      targetType: 'MULTI_DEVICE',
      definition: {
        ...baseDefinition,
        target: { mode: 'multi_device' },
      },
      selectedDeviceIds: ['d1', 'd2', 'd3', 'd4', 'd5', 'd6'],
      targetDevicesCount: 6,
      runnableDeviceCount: 6,
      dispatchableDeviceCount: 6,
      maxPilotTargetCount: 5,
    });

    expect(summary.blockingIssues.map((issue) => issue.id)).toContain('max-pilot-target-count-exceeded');
    expect(summary.gates).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'launch.max-pilot-target-count-exceeded', status: 'failed' }),
    ]));
  });
});
