import type { MacroDefinition } from '../../contracts/macro';
import type { Device, Profile, TargetType } from '../../lib/database.types';
import type { RunPreflightSummary } from '../../lib/run-preflight';

export async function submitRunWizard({
  addToast,
  createRun,
  definition,
  dispatchableDevices,
  hasBlockingIssues,
  inputValues,
  navigate,
  onClose,
  preflightSummary,
  profile,
  selectedGroupId,
  selectedVersionId,
  targetType,
}: {
  addToast: (message: string, type?: 'success' | 'error' | 'info', duration?: number) => void;
  createRun: (args: {
    macroVersionId: string;
    profileId: string;
    targetType: TargetType;
    targetSelector: Record<string, unknown>;
    inputVariables: Record<string, unknown>;
  }) => Promise<{ id: string; status: string }>;
  definition: MacroDefinition | undefined;
  dispatchableDevices: Device[];
  hasBlockingIssues: boolean;
  inputValues: Record<string, string>;
  navigate: (path: string) => void;
  onClose: () => void;
  preflightSummary: RunPreflightSummary;
  profile: Profile | null;
  selectedGroupId: string;
  selectedVersionId: string;
  targetType: TargetType;
}) {
  if (!profile) {
    addToast('Sign in again before launching a run', 'error');
    return;
  }
  if (!selectedVersionId || !definition) {
    addToast('Select a valid macro version before launching a run', 'error');
    return;
  }
  if (hasBlockingIssues) {
    addToast(preflightSummary.blockingIssues[0]?.title ?? 'Run preflight failed', 'error');
    return;
  }

  try {
    const result = await createRun({
      macroVersionId: selectedVersionId,
      profileId: profile.id,
      targetType,
      targetSelector: targetType === 'DEVICE_GROUP'
        ? { groupId: selectedGroupId }
        : { deviceIds: dispatchableDevices.map((device) => device.id) },
      inputVariables: inputValues,
    });
    const status = String(result.status);
    const isTerminal = ['COMPLETED', 'FAILED', 'CANCELLED', 'PARTIAL_SUCCESS'].includes(status);

    if (status === 'QUEUED' || status === 'PENDING' || status === 'RUNNING') {
      addToast(`Run dispatched with status: ${status}`, 'info');
    } else if (status === 'COMPLETED') {
      addToast('Run completed successfully', 'success');
    } else {
      addToast(`Run finished with status: ${status}`, 'error');
    }

    onClose();
    navigate(isTerminal ? `/runs/${result.id}` : `/runs/${result.id}/monitor`);
  } catch (error) {
    addToast(error instanceof Error ? error.message : 'Failed to start run', 'error');
  }
}
