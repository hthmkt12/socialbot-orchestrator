import { supabase } from './supabase';
import { logAudit } from './audit';
import { canManageSchedules } from './role-access';
import { CronExpressionParser } from 'cron-parser';
import type { TargetType, UserRole, WorkflowSchedule } from './database.types';
import { isMissingSchemaError } from './supabase-errors';

type ScheduleInput = {
  name: string;
  macro_id: string;
  macro_version_id: string;
  target_type: WorkflowSchedule['target_type'];
  target_device_id?: string;
  target_group_id?: string;
  input_variables?: Record<string, unknown>;
  cron_expression: string;
  timezone?: string;
};

const VALID_TARGET_TYPES = new Set<TargetType>(['SINGLE_DEVICE', 'DEVICE_GROUP', 'MULTI_DEVICE', 'ALL_DEVICES']);

function assertValidTimezone(timezone: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
  } catch {
    throw new Error(`Invalid schedule timezone: ${timezone}`);
  }
}

export function validateScheduleInput(input: ScheduleInput) {
  const name = input.name.trim();
  const timezone = (input.timezone || 'UTC').trim();
  const cronExpression = input.cron_expression.trim();

  if (!name) throw new Error('Schedule name is required');
  if (!input.macro_id) throw new Error('Schedule macro is required');
  if (!input.macro_version_id) throw new Error('Schedule macro version is required');
  if (!VALID_TARGET_TYPES.has(input.target_type)) throw new Error('Invalid schedule target type');
  if (input.target_type === 'SINGLE_DEVICE' && !input.target_device_id) {
    throw new Error('Schedule target device is required');
  }
  if (input.target_type === 'DEVICE_GROUP' && !input.target_group_id) {
    throw new Error('Schedule target group is required');
  }

  assertValidTimezone(timezone);
  try {
    CronExpressionParser.parse(cronExpression, { tz: timezone });
  } catch {
    throw new Error('Invalid schedule cron expression');
  }

  return { name, timezone, cronExpression };
}

async function requireScheduleManagerProfile() {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, role')
    .maybeSingle();

  if (error) throw new Error(`Failed to get profile: ${error.message}`);
  if (!data) throw new Error('User profile not found');

  const role = data.role as UserRole | null;
  if (!canManageSchedules(role)) {
    throw new Error('Only operators and admins can manage schedules');
  }

  return { userId: data.user_id as string, role };
}

async function assertActiveMacroVersion(macroVersionId: string, macroId: string) {
  const { data, error } = await supabase
    .from('macro_versions')
    .select('id, macro_id, status')
    .eq('id', macroVersionId)
    .maybeSingle();

  if (error) throw new Error(`Failed to verify macro version: ${error.message}`);
  if (!data) throw new Error('Schedule macro version no longer exists');
  if (data.macro_id !== macroId) throw new Error('Schedule macro version does not belong to macro');
  if (data.status !== 'ACTIVE') throw new Error('Schedule macro version must be active');
}

export async function fetchSchedules() {
  const { data, error } = await supabase
    .from('workflow_schedules')
    .select('*')
    .order('created_at', { ascending: false });

  if (isMissingSchemaError(error)) return [];
  if (error) throw new Error(`Failed to fetch schedules: ${error.message}`);
  return data as WorkflowSchedule[];
}

export async function createSchedule(input: ScheduleInput) {
  const normalized = validateScheduleInput(input);
  const profile = await requireScheduleManagerProfile();
  await assertActiveMacroVersion(input.macro_version_id, input.macro_id);

  const { data, error } = await supabase
    .from('workflow_schedules')
    .insert({
      name: normalized.name,
      macro_id: input.macro_id,
      macro_version_id: input.macro_version_id,
      target_type: input.target_type,
      target_device_id: input.target_device_id ?? null,
      target_group_id: input.target_group_id ?? null,
      input_variables: input.input_variables ?? {},
      cron_expression: normalized.cronExpression,
      timezone: normalized.timezone,
      created_by: profile.userId,
    })
    .select()
    .maybeSingle();

  if (error) throw new Error(`Failed to create schedule: ${error.message}`);
  if (!data) throw new Error('Schedule not created');

  await logAudit('schedule.create', 'schedule', data.id, { name: normalized.name, cron: normalized.cronExpression });
  return data as WorkflowSchedule;
}

export async function updateSchedule(
  id: string,
  updates: Partial<Pick<WorkflowSchedule, 'name' | 'cron_expression' | 'timezone' | 'is_active' | 'input_variables'>>
) {
  await requireScheduleManagerProfile();
  if ('cron_expression' in updates || 'timezone' in updates || 'name' in updates) {
    validateScheduleInput({
      name: updates.name ?? 'Existing schedule',
      macro_id: 'existing-macro',
      macro_version_id: 'existing-version',
      target_type: 'ALL_DEVICES',
      cron_expression: updates.cron_expression ?? '* * * * *',
      timezone: updates.timezone ?? 'UTC',
    });
  }

  const { data, error } = await supabase
    .from('workflow_schedules')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) throw new Error(`Failed to update schedule: ${error.message}`);

  await logAudit('schedule.update', 'schedule', id, updates);
  return data as WorkflowSchedule;
}

export async function deleteSchedule(id: string) {
  await requireScheduleManagerProfile();

  const { error } = await supabase
    .from('workflow_schedules')
    .delete()
    .eq('id', id);

  if (error) throw new Error(`Failed to delete schedule: ${error.message}`);

  await logAudit('schedule.delete', 'schedule', id);
}
