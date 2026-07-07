import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

vi.mock('./supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock('./audit', () => ({
  logAudit: vi.fn(),
}));

vi.mock('./admin-governance', () => ({
  deleteAdminResource: vi.fn(),
}));

import { deleteAdminResource } from './admin-governance';
import { logAudit } from './audit';
import {
  createExecutionProfile,
  deleteExecutionProfile,
  fetchExecutionProfiles,
  updateExecutionProfile,
  type ExecutionProfileInput,
} from './execution-profile-service';
import { supabase } from './supabase';

const mockFrom = vi.mocked(supabase.from) as Mock;
const mockLogAudit = vi.mocked(logAudit) as Mock;
const mockDeleteAdminResource = vi.mocked(deleteAdminResource) as Mock;

const validInput: ExecutionProfileInput = {
  name: '  Conservative Android  ',
  description: '  Safe runtime defaults  ',
  concurrency_per_device: 1,
  default_timeout_ms: 10000,
  max_retries: 2,
  retry_base_delay_ms: 1000,
  retry_max_delay_ms: 30000,
  retry_max_elapsed_ms: 120000,
  target_failure_policy: 'skip_failed_target',
  require_approval_for_adb: true,
  require_approval_for_autox: true,
};

function profileRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'profile-1',
    name: 'Conservative Android',
    description: 'Safe runtime defaults',
    concurrency_per_device: 1,
    default_timeout_ms: 10000,
    max_retries: 2,
    retry_base_delay_ms: 1000,
    retry_max_delay_ms: 30000,
    retry_max_elapsed_ms: 120000,
    target_failure_policy: 'skip_failed_target',
    require_approval_for_adb: true,
    require_approval_for_autox: true,
    created_at: '2026-07-07T00:00:00.000Z',
    updated_at: '2026-07-07T00:00:00.000Z',
    ...overrides,
  };
}

describe('execution profile service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('AD-CAN-005 fetches execution profiles ordered by name', async () => {
    const order = vi.fn().mockResolvedValue({
      data: [profileRow()],
      error: null,
    });
    const select = vi.fn().mockReturnValue({ order });
    mockFrom.mockReturnValue({ select });

    await expect(fetchExecutionProfiles()).resolves.toEqual([profileRow()]);
    expect(mockFrom).toHaveBeenCalledWith('execution_profiles');
    expect(select).toHaveBeenCalledWith('*');
    expect(order).toHaveBeenCalledWith('name', { ascending: true });
  });

  it('AD-CAN-005 creates an execution profile with normalized input and audit log', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: profileRow(),
      error: null,
    });
    const select = vi.fn().mockReturnValue({ maybeSingle });
    const insert = vi.fn().mockReturnValue({ select });
    mockFrom.mockReturnValue({ insert });

    await expect(createExecutionProfile(validInput)).resolves.toMatchObject({
      id: 'profile-1',
      name: 'Conservative Android',
      description: 'Safe runtime defaults',
    });

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Conservative Android',
      description: 'Safe runtime defaults',
      concurrency_per_device: 1,
      default_timeout_ms: 10000,
      max_retries: 2,
      retry_base_delay_ms: 1000,
      retry_max_delay_ms: 30000,
      retry_max_elapsed_ms: 120000,
      target_failure_policy: 'skip_failed_target',
    }));
    expect(mockLogAudit).toHaveBeenCalledWith(
      'execution_profile.create',
      'execution_profile',
      'profile-1',
      { name: 'Conservative Android' }
    );
  });

  it('AD-CAN-005 updates an execution profile and writes an audit log', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: profileRow({ max_retries: 3 }),
      error: null,
    });
    const select = vi.fn().mockReturnValue({ maybeSingle });
    const eq = vi.fn().mockReturnValue({ select });
    const update = vi.fn().mockReturnValue({ eq });
    mockFrom.mockReturnValue({ update });

    await expect(updateExecutionProfile('profile-1', { ...validInput, max_retries: 3 })).resolves.toMatchObject({
      id: 'profile-1',
      max_retries: 3,
    });

    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Conservative Android',
      description: 'Safe runtime defaults',
      max_retries: 3,
      updated_at: expect.any(String),
    }));
    expect(eq).toHaveBeenCalledWith('id', 'profile-1');
    expect(mockLogAudit).toHaveBeenCalledWith(
      'execution_profile.update',
      'execution_profile',
      'profile-1',
      { name: 'Conservative Android' }
    );
  });

  it('AD-CAN-005 delegates deletion to admin-only resource deletion', async () => {
    mockDeleteAdminResource.mockResolvedValue(undefined);

    await expect(deleteExecutionProfile('profile-1')).resolves.toBeUndefined();
    expect(mockDeleteAdminResource).toHaveBeenCalledWith('execution_profile', 'profile-1');
  });

  it('AD-ERR-001 rejects invalid execution profile settings before writing', async () => {
    await expect(createExecutionProfile({ ...validInput, name: '   ' })).rejects.toThrow('Execution profile name is required');
    await expect(createExecutionProfile({ ...validInput, concurrency_per_device: 0 })).rejects.toThrow('Concurrency per device must be at least 1');
    await expect(createExecutionProfile({ ...validInput, default_timeout_ms: 500 })).rejects.toThrow('Default timeout must be at least 1000ms');
    await expect(createExecutionProfile({ ...validInput, max_retries: -1 })).rejects.toThrow('Max retries must be 0 or greater');
    await expect(createExecutionProfile({ ...validInput, max_retries: 11 })).rejects.toThrow('Max retries must be 10 or less');
    await expect(createExecutionProfile({ ...validInput, retry_base_delay_ms: -1 })).rejects.toThrow('Retry base delay must be 0 or greater');
    await expect(createExecutionProfile({ ...validInput, retry_base_delay_ms: 2000, retry_max_delay_ms: 1000 })).rejects.toThrow('Retry max delay must be greater than or equal to base delay');
    await expect(createExecutionProfile({ ...validInput, retry_max_elapsed_ms: -1 })).rejects.toThrow('Retry max elapsed must be 0 or greater');
    await expect(createExecutionProfile({ ...validInput, retry_max_elapsed_ms: 3_600_001 })).rejects.toThrow('Retry max elapsed must be 3600000ms or less');
    await expect(createExecutionProfile({ ...validInput, target_failure_policy: 'rotate_backup' as never })).rejects.toThrow('Target failure policy must be fail_fast or skip_failed_target');
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
