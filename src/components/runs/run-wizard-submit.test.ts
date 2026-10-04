import { describe, expect, it, vi } from 'vitest';
import { submitRunWizard } from './run-wizard-submit';
import type { MacroDefinition } from '../../contracts/macro';
import type { Account, Device, Profile } from '../../lib/database.types';
import type { RunPreflightSummary } from '../../lib/run-preflight';
import * as accountHelpers from '../../lib/account-service-helpers';

vi.mock('../../lib/account-service-helpers', () => ({
  fetchAccount: vi.fn(),
}));

const mockProfile: Profile = {
  id: 'prof-1',
  user_id: 'user-1',
  role: 'OPERATOR',
  email: 'op@example.com',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockDefinition: MacroDefinition = {
  version: 1,
  meta: { key: 'test_macro', name: 'Test Macro' },
  inputs: {},
  target: { mode: 'single_device' },
  execution: { defaultTimeoutMs: 30000, maxRetries: 1, onError: 'stop' },
  steps: [{ id: 'step_1', type: 'wait', params: { ms: 1000 } }],
};

const mockDevice: Device = {
  id: 'dev-1',
  laixi_device_id: 'lx-1',
  name: 'Test Device',
  model: 'Redmi 13C',
  brand: 'Xiaomi',
  android_version: '14',
  screen_width: 720,
  screen_height: 1600,
  status: 'ONLINE',
  last_seen_at: new Date().toISOString(),
  heartbeat_freshness: 'fresh',
  last_error_message: null,
  last_error_at: null,
  metadata_json: {},
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const createMockAccount = (overrides?: Partial<Account>): Account => ({
  id: 'acc-1',
  user_id: 'user-1',
  username: 'pilot_user',
  encrypted_password: 'v2:test',
  platform: 'instagram',
  warm_up_started_at: new Date().toISOString(),
  warm_up_stage: 2,
  daily_action_limit: 10,
  current_action_count: 5,
  last_action_reset_at: new Date().toISOString(),
  is_blocked: false,
  detected_block_reason: null,
  credential_policy_status: 'pilot_client_encrypted',
  credential_key_version: 1,
  credential_rotated_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

const mockPreflightSummary: RunPreflightSummary = {
  declaredTargetType: 'SINGLE_DEVICE',
  blockingIssues: [],
  warnings: [],
  sensitiveStepCount: 0,
  approvalStepCount: 0,
  gates: [],
};

describe('submitRunWizard', () => {
  it('rejects submission when profile is missing', async () => {
    const addToast = vi.fn();
    const createRun = vi.fn();
    const navigate = vi.fn();
    const onClose = vi.fn();

    await submitRunWizard({
      profile: null,
      selectedVersionId: 'ver-1',
      definition: mockDefinition,
      hasBlockingIssues: false,
      preflightSummary: mockPreflightSummary,
      selectedAccountId: '',
      selectedGroupId: '',
      targetType: 'SINGLE_DEVICE',
      dispatchableDevices: [mockDevice],
      inputValues: {},
      addToast,
      createRun,
      navigate,
      onClose,
    });

    expect(addToast).toHaveBeenCalledWith('Sign in again before launching a run', 'error');
    expect(createRun).not.toHaveBeenCalled();
  });

  it('rejects submission when version or definition is missing', async () => {
    const addToast = vi.fn();
    const createRun = vi.fn();
    const navigate = vi.fn();
    const onClose = vi.fn();

    await submitRunWizard({
      profile: mockProfile,
      selectedVersionId: '',
      definition: undefined,
      hasBlockingIssues: false,
      preflightSummary: mockPreflightSummary,
      selectedAccountId: '',
      selectedGroupId: '',
      targetType: 'SINGLE_DEVICE',
      dispatchableDevices: [mockDevice],
      inputValues: {},
      addToast,
      createRun,
      navigate,
      onClose,
    });

    expect(addToast).toHaveBeenCalledWith('Select a valid macro version before launching a run', 'error');
    expect(createRun).not.toHaveBeenCalled();
  });

  it('rejects submission when preflight has blocking issues', async () => {
    const addToast = vi.fn();
    const createRun = vi.fn();
    const navigate = vi.fn();
    const onClose = vi.fn();

    const blockedPreflight: RunPreflightSummary = {
      ...mockPreflightSummary,
      blockingIssues: [
        {
          id: 'dev-offline',
          severity: 'blocking',
          title: 'Target device is offline',
          detail: 'Device must be online',
        },
      ],
    };

    await submitRunWizard({
      profile: mockProfile,
      selectedVersionId: 'ver-1',
      definition: mockDefinition,
      hasBlockingIssues: true,
      preflightSummary: blockedPreflight,
      selectedAccountId: '',
      selectedGroupId: '',
      targetType: 'SINGLE_DEVICE',
      dispatchableDevices: [mockDevice],
      inputValues: {},
      addToast,
      createRun,
      navigate,
      onClose,
    });

    expect(addToast).toHaveBeenCalledWith('Target device is offline', 'error');
    expect(createRun).not.toHaveBeenCalled();
  });

  it('rejects submission when selected account is blocked or exceeded limit', async () => {
    const addToast = vi.fn();
    const createRun = vi.fn();
    const navigate = vi.fn();
    const onClose = vi.fn();

    vi.mocked(accountHelpers.fetchAccount).mockResolvedValueOnce(
      createMockAccount({
        id: 'acc-blocked',
        username: 'blocked_user',
        is_blocked: true,
        detected_block_reason: 'Checkpoint triggered',
      })
    );

    await submitRunWizard({
      profile: mockProfile,
      selectedVersionId: 'ver-1',
      definition: mockDefinition,
      hasBlockingIssues: false,
      preflightSummary: mockPreflightSummary,
      selectedAccountId: 'acc-blocked',
      selectedGroupId: '',
      targetType: 'SINGLE_DEVICE',
      dispatchableDevices: [mockDevice],
      inputValues: {},
      addToast,
      createRun,
      navigate,
      onClose,
    });

    expect(addToast).toHaveBeenCalledWith(
      expect.stringContaining('Selected account cannot run: Account is blocked'),
      'error'
    );
    expect(createRun).not.toHaveBeenCalled();
  });

  it('successfully submits run for valid inputs and navigates to monitor', async () => {
    const addToast = vi.fn();
    const createRun = vi.fn().mockResolvedValueOnce({ id: 'run-999', status: 'PENDING' });
    const navigate = vi.fn();
    const onClose = vi.fn();

    vi.mocked(accountHelpers.fetchAccount).mockResolvedValueOnce(
      createMockAccount({
        id: 'acc-valid',
        username: 'pilot_user',
        warm_up_stage: 3,
        daily_action_limit: 50,
        current_action_count: 5,
        is_blocked: false,
      })
    );

    await submitRunWizard({
      profile: mockProfile,
      selectedVersionId: 'ver-1',
      definition: mockDefinition,
      hasBlockingIssues: false,
      preflightSummary: mockPreflightSummary,
      selectedAccountId: 'acc-valid',
      selectedGroupId: '',
      targetType: 'SINGLE_DEVICE',
      dispatchableDevices: [mockDevice],
      inputValues: { hashtag: 'explore' },
      addToast,
      createRun,
      navigate,
      onClose,
    });

    expect(createRun).toHaveBeenCalledWith({
      macroVersionId: 'ver-1',
      profileId: 'prof-1',
      targetType: 'SINGLE_DEVICE',
      targetSelector: { target_ids: ['dev-1'] },
      inputVariables: {
        hashtag: 'explore',
        accountId: 'acc-valid',
        accountUsername: 'pilot_user',
        accountPlatform: 'instagram',
      },
    });

    expect(addToast).toHaveBeenCalledWith('Run dispatched with status: PENDING', 'info');
    expect(onClose).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/runs/run-999/monitor');
  });
});
