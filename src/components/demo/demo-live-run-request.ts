import { requestRunStart } from '../../hooks/useRuns';
import { logAudit } from '../../lib/audit';
import type { Device, Profile } from '../../lib/database.types';
import { getRoleLabel } from '../../lib/role-access';
import { supabase } from '../../lib/supabase';
import { SEEDED_DEMO_MACRO_KEY, type StepState } from './demo-workflow-state';

export async function getSeededDemoMacroVersionId(): Promise<string | null> {
  const { data: existing } = await supabase
    .from('macros')
    .select('id, latest_version_id, macro_versions(id, version_number, status)')
    .eq('key', SEEDED_DEMO_MACRO_KEY)
    .maybeSingle();

  if (existing) {
    if (existing.latest_version_id) return existing.latest_version_id;

    const versions = existing.macro_versions as { id: string; version_number: number; status: string }[] | null;
    const activeVersion = versions
      ?.filter((version) => version.status === 'ACTIVE')
      .sort((a, b) => b.version_number - a.version_number)[0];
    if (activeVersion) return activeVersion.id;
  }

  return null;
}

export async function createAndDispatchDemoRun(args: {
  appName: string;
  canCreateDemoMacros: boolean;
  canLaunchRuns: boolean;
  devices: Device[];
  onActiveRunId: (runId: string) => void;
  profile: Profile | null;
  selectedDeviceId: string;
  updateStep: (id: string, update: Partial<StepState>) => void;
}) {
  const {
    appName,
    canCreateDemoMacros,
    canLaunchRuns,
    devices,
    onActiveRunId,
    profile,
    selectedDeviceId,
    updateStep,
  } = args;

  const device = devices.find((candidate) => candidate.id === selectedDeviceId);
  if (!device || !profile) return null;

  if (!canLaunchRuns) {
    updateStep('launch', {
      status: 'failed',
      output: { error: `${getRoleLabel(profile.role)} role is read-only for run control` },
    });
    return null;
  }

  const macroVersionId = await getSeededDemoMacroVersionId();
  if (!macroVersionId) {
    updateStep('launch', {
      status: 'failed',
      output: {
        error: canCreateDemoMacros
          ? 'Seeded launch_app_and_capture macro not found. Load Samples from Macros first.'
          : 'Seeded launch_app_and_capture macro not found. Ask an operator or admin to load sample macros.',
      },
    });
    return null;
  }

  const { data: run, error: runError } = await supabase
    .from('workflow_runs')
    .insert({
      macro_version_id: macroVersionId,
      triggered_by_user_id: profile.id,
      target_type: 'SINGLE_DEVICE',
      target_selector_json: { deviceIds: [device.id] },
      input_variables_json: { appName },
      status: 'PENDING',
    })
    .select()
    .single();

  if (runError || !run) {
    updateStep('launch', { status: 'failed', output: { error: runError?.message ?? 'Failed to create run' } });
    return null;
  }

  onActiveRunId(run.id);
  await logAudit('run.create', 'workflow_run', run.id, { demo: true });
  const dispatch = await requestRunStart(run.id);
  await logAudit('run.dispatch_requested', 'workflow_run', run.id, {
    demo: true,
    status: dispatch.status,
    outcome: dispatch.outcome,
  });

  return { durationMs: Date.now(), status: dispatch.status };
}
