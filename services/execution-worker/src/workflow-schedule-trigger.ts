import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { CronExpressionParser } from 'cron-parser';
import type { WorkerConfig } from './run-claim-coordinator';

interface DueSchedule {
  id: string;
  cron_expression: string;
  timezone?: string;
  target_type: string;
  target_device_id?: string;
  target_group_id?: string;
  macro_version_id: string;
  input_variables?: Record<string, unknown>;
  created_by: string;
  name: string;
  last_run_at?: string | null;
  is_active: boolean;
  next_run_at?: string | null;
}

export function buildScheduleTargetSelector(schedule: Pick<DueSchedule, 'target_type' | 'target_device_id' | 'target_group_id'>) {
  if (schedule.target_type === 'SINGLE_DEVICE') {
    if (!schedule.target_device_id) {
      return { ok: false as const, error: 'Schedule target device is required' };
    }

    return { ok: true as const, selector: { deviceIds: [schedule.target_device_id] } };
  }

  if (schedule.target_type === 'DEVICE_GROUP') {
    if (!schedule.target_group_id) {
      return { ok: false as const, error: 'Schedule target group is required' };
    }

    return { ok: true as const, selector: { groupId: schedule.target_group_id } };
  }

  if (schedule.target_type === 'ALL_DEVICES' || schedule.target_type === 'MULTI_DEVICE') {
    return { ok: true as const, selector: {} };
  }

  return { ok: false as const, error: `Unsupported schedule target type: ${schedule.target_type}` };
}

export function computeScheduleNextRunIso(cronExpression: string, timezone = 'UTC') {
  const interval = CronExpressionParser.parse(cronExpression, { tz: timezone });
  return interval.next().toISOString();
}

export class WorkflowScheduleTrigger {
  private readonly supabase: SupabaseClient;
  private pollInFlight = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(config: WorkerConfig, supabaseClient?: SupabaseClient) {
    this.supabase = supabaseClient ?? createClient(config.supabaseUrl, config.supabaseServiceRoleKey);
  }

  start() {
    console.log('[execution-worker] schedule trigger ready');
    // Check every 30 seconds
    this.timer = setInterval(() => void this.poll(), 30000);
    this.timer.unref();
    void this.poll();
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async poll() {
    if (this.pollInFlight) return;
    this.pollInFlight = true;

    try {
      const nowIso = new Date().toISOString();
      const { data: dueSchedules, error } = await this.supabase
        .from('workflow_schedules')
        .select('*')
        .eq('is_active', true)
        .lte('next_run_at', nowIso);

      if (error || !dueSchedules) {
        if (error) console.error('[execution-worker] failed to load due schedules', error);
        return;
      }

      for (const schedule of dueSchedules) {
        await this.triggerSchedule(schedule, nowIso);
      }

      // Also initialize next_run_at for any newly created schedules where next_run_at is null
      const { data: newSchedules } = await this.supabase
        .from('workflow_schedules')
        .select('*')
        .eq('is_active', true)
        .is('next_run_at', null);

      for (const schedule of newSchedules ?? []) {
        await this.triggerSchedule(schedule, nowIso, true);
      }

    } catch (error) {
      console.error('[execution-worker] schedule trigger loop error', error);
    } finally {
      this.pollInFlight = false;
    }
  }

  private async triggerSchedule(schedule: DueSchedule, nowIso: string, skipRunCreation = false) {
    try {
      let nextRunIso: string | null = null;
      try {
        nextRunIso = computeScheduleNextRunIso(schedule.cron_expression, schedule.timezone || 'UTC');
      } catch (err) {
        console.error(`[execution-worker] invalid cron for schedule ${schedule.id}`, err);
        // Deactivate invalid schedules
        await this.supabase.from('workflow_schedules').update({ is_active: false }).eq('id', schedule.id);
        return;
      }

      // 1. Update next_run_at to prevent double triggering
      const { data: claimedSchedule, error: updateError } = await this.supabase
        .from('workflow_schedules')
        .update({
          next_run_at: nextRunIso,
          last_run_at: skipRunCreation ? schedule.last_run_at : nowIso,
          updated_at: nowIso,
        })
        .eq('id', schedule.id)
        .or(`next_run_at.lte.${nowIso},next_run_at.is.null`)
        .select('id')
        .maybeSingle(); // Concurrency guard

      if (updateError) {
        console.error(`[execution-worker] failed to update next_run_at for schedule ${schedule.id}`, updateError);
        return;
      }

      if (!claimedSchedule) return;

      if (skipRunCreation) return;

      const { data: macroVersion, error: macroVersionError } = await this.supabase
        .from('macro_versions')
        .select('id, status')
        .eq('id', schedule.macro_version_id)
        .maybeSingle();

      if (macroVersionError) {
        console.error(`[execution-worker] failed to verify macro version for schedule ${schedule.id}`, macroVersionError);
        return;
      }
      if (!macroVersion || macroVersion.status !== 'ACTIVE') {
        console.error(`[execution-worker] schedule ${schedule.id} references missing or inactive macro version`);
        return;
      }

      const target = buildScheduleTargetSelector(schedule);
      if (!target.ok) {
        console.error(`[execution-worker] invalid target for schedule ${schedule.id}: ${target.error}`);
        return;
      }

      // 2. Create the workflow run. The worker claim loop performs device execution.
      const { error: runError } = await this.supabase.from('workflow_runs').insert({
        macro_version_id: schedule.macro_version_id,
        target_type: schedule.target_type,
        target_selector_json: target.selector,
        input_variables_json: schedule.input_variables ?? {},
        status: 'QUEUED',
        triggered_by_user_id: schedule.created_by,
        summary_json: { source: 'schedule', scheduleId: schedule.id, scheduleName: schedule.name },
      });

      if (runError) {
        console.error(`[execution-worker] failed to insert run for schedule ${schedule.id}`, runError);
      } else {
        console.log(`[execution-worker] triggered schedule ${schedule.id} (${schedule.name})`);
      }
    } catch (err) {
      console.error(`[execution-worker] error processing schedule ${schedule.id}`, err);
    }
  }
}
