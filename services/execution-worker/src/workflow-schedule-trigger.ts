import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import cronParser from 'cron-parser';
import type { WorkerConfig } from './run-claim-coordinator';

export class WorkflowScheduleTrigger {
  private readonly supabase: SupabaseClient;
  private pollInFlight = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly config: WorkerConfig) {
    this.supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey);
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

  private async triggerSchedule(schedule: any, nowIso: string, skipRunCreation = false) {
    try {
      let nextRunIso: string | null = null;
      try {
        const interval = cronParser.parseExpression(schedule.cron_expression, {
          tz: schedule.timezone || 'UTC',
        });
        nextRunIso = interval.next().toISOString();
      } catch (err) {
        console.error(`[execution-worker] invalid cron for schedule ${schedule.id}`, err);
        // Deactivate invalid schedules
        await this.supabase.from('workflow_schedules').update({ is_active: false }).eq('id', schedule.id);
        return;
      }

      // 1. Update next_run_at to prevent double triggering
      const { error: updateError } = await this.supabase
        .from('workflow_schedules')
        .update({
          next_run_at: nextRunIso,
          last_run_at: skipRunCreation ? schedule.last_run_at : nowIso,
          updated_at: nowIso,
        })
        .eq('id', schedule.id)
        .or(`next_run_at.lte.${nowIso},next_run_at.is.null`); // Concurrency guard

      if (updateError) {
        console.error(`[execution-worker] failed to update next_run_at for schedule ${schedule.id}`, updateError);
        return;
      }

      if (skipRunCreation) return;

      // 2. Create the workflow run
      const selector: Record<string, unknown> = {};
      if (schedule.target_type === 'SINGLE_DEVICE' && schedule.target_device_id) {
        selector.deviceIds = [schedule.target_device_id];
      } else if (schedule.target_type === 'DEVICE_GROUP' && schedule.target_group_id) {
        selector.groupId = schedule.target_group_id;
      }

      const { error: runError } = await this.supabase.from('workflow_runs').insert({
        macro_version_id: schedule.macro_version_id,
        target_type: schedule.target_type,
        target_selector_json: selector,
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
