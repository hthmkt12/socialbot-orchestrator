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

import { supabase } from './supabase';
import { createSchedule, validateScheduleInput } from './schedule-service';

const mockFrom = vi.mocked(supabase.from) as Mock;

function mockProfile(role: string) {
  return {
    select: vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({
        data: { user_id: 'user-1', role },
        error: null,
      }),
    }),
  };
}

function mockMacroVersion(data: unknown) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
      }),
    }),
  };
}

function mockScheduleInsert(data: unknown) {
  return {
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
      }),
    }),
  };
}

describe('schedule-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('SCH-ERR-002 rejects invalid cron expressions before saving', () => {
    expect(() => validateScheduleInput({
      name: 'Bad cron',
      macro_id: 'macro-1',
      macro_version_id: 'version-1',
      target_type: 'ALL_DEVICES',
      cron_expression: 'not a cron',
      timezone: 'UTC',
    })).toThrow('Invalid schedule cron expression');
  });

  it('SCH-ERR-002 rejects invalid timezones before saving', () => {
    expect(() => validateScheduleInput({
      name: 'Bad timezone',
      macro_id: 'macro-1',
      macro_version_id: 'version-1',
      target_type: 'ALL_DEVICES',
      cron_expression: '*/5 * * * *',
      timezone: 'Mars/Olympus',
    })).toThrow('Invalid schedule timezone');
  });

  it('SCH-NO-002 blocks viewer role from creating schedules through the service', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return mockProfile('VIEWER');
      return {};
    });

    await expect(createSchedule({
      name: 'Viewer schedule',
      macro_id: 'macro-1',
      macro_version_id: 'version-1',
      target_type: 'ALL_DEVICES',
      cron_expression: '*/5 * * * *',
    })).rejects.toThrow('Only operators and admins can manage schedules');

    expect(mockFrom).not.toHaveBeenCalledWith('workflow_schedules');
  });

  it('SCH-ERR-003 rejects missing macro versions before creating a schedule', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return mockProfile('OPERATOR');
      if (table === 'macro_versions') return mockMacroVersion(null);
      return {};
    });

    await expect(createSchedule({
      name: 'Missing macro',
      macro_id: 'macro-1',
      macro_version_id: 'version-missing',
      target_type: 'ALL_DEVICES',
      cron_expression: '*/5 * * * *',
    })).rejects.toThrow('Schedule macro version no longer exists');

    expect(mockFrom).not.toHaveBeenCalledWith('workflow_schedules');
  });

  it('SCH-CAN-001 validates operator schedules and writes a normalized row', async () => {
    const schedule = { id: 'schedule-1', name: 'Daily run', cron_expression: '*/5 * * * *' };
    const scheduleTable = mockScheduleInsert(schedule);
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return mockProfile('OPERATOR');
      if (table === 'macro_versions') return mockMacroVersion({
        id: 'version-1',
        macro_id: 'macro-1',
        status: 'ACTIVE',
      });
      if (table === 'workflow_schedules') return scheduleTable;
      return {};
    });

    await expect(createSchedule({
      name: '  Daily run  ',
      macro_id: 'macro-1',
      macro_version_id: 'version-1',
      target_type: 'ALL_DEVICES',
      cron_expression: '  */5 * * * *  ',
    })).resolves.toEqual(schedule);

    expect(scheduleTable.insert).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Daily run',
      cron_expression: '*/5 * * * *',
      timezone: 'UTC',
      created_by: 'user-1',
    }));
  });
});
