import { supabase } from './supabase';
import { logAudit } from './audit';
import type { WorkflowSchedule } from './database.types';

export async function fetchSchedules() {
  const { data, error } = await supabase
    .from('workflow_schedules')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch schedules: ${error.message}`);
  return data as WorkflowSchedule[];
}

export async function createSchedule(input: {
  name: string;
  macro_id: string;
  macro_version_id: string;
  target_type: WorkflowSchedule['target_type'];
  target_device_id?: string;
  target_group_id?: string;
  input_variables?: Record<string, unknown>;
  cron_expression: string;
  timezone?: string;
}) {
  const { data: profile } = await supabase.from('profiles').select('user_id').maybeSingle();

  const { data, error } = await supabase
    .from('workflow_schedules')
    .insert({
      name: input.name,
      macro_id: input.macro_id,
      macro_version_id: input.macro_version_id,
      target_type: input.target_type,
      target_device_id: input.target_device_id ?? null,
      target_group_id: input.target_group_id ?? null,
      input_variables: input.input_variables ?? {},
      cron_expression: input.cron_expression,
      timezone: input.timezone ?? 'UTC',
      created_by: profile?.user_id ?? null,
    })
    .select()
    .maybeSingle();

  if (error) throw new Error(`Failed to create schedule: ${error.message}`);
  if (!data) throw new Error('Schedule not created');

  await logAudit('schedule.create', 'schedule', data.id, { name: input.name, cron: input.cron_expression });
  return data as WorkflowSchedule;
}

export async function updateSchedule(
  id: string,
  updates: Partial<Pick<WorkflowSchedule, 'name' | 'cron_expression' | 'timezone' | 'is_active' | 'input_variables'>>
) {
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
  const { error } = await supabase
    .from('workflow_schedules')
    .delete()
    .eq('id', id);

  if (error) throw new Error(`Failed to delete schedule: ${error.message}`);

  await logAudit('schedule.delete', 'schedule', id);
}
