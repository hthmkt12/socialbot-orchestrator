import type { MacroDefinition } from '../../contracts/macro';
import type { Device, Profile, TargetType } from '../../lib/database.types';
import type { RunPreflightSummary } from '../../lib/run-preflight';
import { fetchAccount } from '../../lib/account-service-helpers';
import { canPerformAction } from '../../lib/account-warmup-engine';

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
  selectedAccountId,
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
  selectedAccountId: string;
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
    // Resolve account info for social engagement runs
    const resolvedInputs: Record<string, unknown> = { ...inputValues };
    if (selectedAccountId) {
      const account = await fetchAccount(selectedAccountId);
      if (account) {
        const actionCheck = canPerformAction(account);
        if (!actionCheck.allowed) {
          addToast(`Selected account cannot run: ${actionCheck.reason}`, 'error');
          return;
        }
        resolvedInputs.accountId = account.id;
        resolvedInputs.accountUsername = account.username;
        resolvedInputs.accountPlatform = account.platform;
      }
    }

    const targetSelector = targetType === 'DEVICE_GROUP'
      ? { groupId: selectedGroupId }
      : targetType === 'SINGLE_DEVICE'
        ? { target_ids: dispatchableDevices.map((device) => device.id) }
        : { deviceIds: dispatchableDevices.map((device) => device.id) };

    const result = await createRun({
      macroVersionId: selectedVersionId,
      profileId: profile.id,
      targetType,
      targetSelector,
      inputVariables: resolvedInputs,
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
