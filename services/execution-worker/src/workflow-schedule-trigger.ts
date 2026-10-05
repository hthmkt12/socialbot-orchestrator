import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { CronExpressionParser } from 'cron-parser';
import type { WorkerConfig } from './run-claim-coordinator';
import { logger } from './logger';

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

    return {
      ok: true as const,
      selector: {
        target_ids: [schedule.target_device_id],
        deviceIds: [schedule.target_device_id],
      },
    };
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
    logger.info('schedule trigger ready');
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
        if (error) logger.error({ err: error }, 'failed to load due schedules');
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
      logger.error({ err: error }, 'schedule trigger loop error');
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
        logger.error({ scheduleId: schedule.id, err }, 'invalid cron for schedule');
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
        logger.error({ scheduleId: schedule.id, err: updateError }, 'failed to update next_run_at for schedule');
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
        logger.error({ scheduleId: schedule.id, err: macroVersionError }, 'failed to verify macro version for schedule');
        return;
      }
      if (!macroVersion || macroVersion.status !== 'ACTIVE') {
        logger.error({ scheduleId: schedule.id }, 'schedule references missing or inactive macro version');
        return;
      }

      const target = buildScheduleTargetSelector(schedule);
      if (!target.ok) {
        logger.error({ scheduleId: schedule.id, err: target.error }, 'invalid target for schedule');
        return;
      }

      // Resolve profile ID for workflow_runs FK (schedule.created_by references auth.users)
      let triggeredByUserId = schedule.created_by;
      if (triggeredByUserId) {
        const { data: profileByUserId } = await this.supabase
          .from('profiles')
          .select('id')
          .eq('user_id', triggeredByUserId)
          .maybeSingle();
        if (profileByUserId?.id) {
          triggeredByUserId = profileByUserId.id;
        }
      }
      if (!triggeredByUserId) {
        const { data: fallbackProfile } = await this.supabase
          .from('profiles')
          .select('id')
          .limit(1)
          .maybeSingle();
        if (fallbackProfile?.id) {
          triggeredByUserId = fallbackProfile.id;
        }
      }

      // 2. Create the workflow run. The worker claim loop performs device execution.
      const { error: runError } = await this.supabase.from('workflow_runs').insert({
        macro_version_id: schedule.macro_version_id,
        target_type: schedule.target_type,
        target_selector_json: target.selector,
        input_variables_json: schedule.input_variables ?? {},
        status: 'QUEUED',
        triggered_by_user_id: triggeredByUserId,
        summary_json: { source: 'schedule', scheduleId: schedule.id, scheduleName: schedule.name },
      });

      if (runError) {
        logger.error({ scheduleId: schedule.id, err: runError }, 'failed to insert run for schedule');
      } else {
        logger.info({ scheduleId: schedule.id, name: schedule.name }, 'triggered schedule');
      }
    } catch (err) {
      logger.error({ scheduleId: schedule.id, err }, 'error processing schedule');
    }
  }
}
