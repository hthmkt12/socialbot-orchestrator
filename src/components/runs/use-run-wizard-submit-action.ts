import { useNavigate } from 'react-router-dom';
import { submitRunWizard } from './run-wizard-submit';
import { useCreateRun } from '../../hooks/useRuns';
import { useAuthStore } from '../../stores/auth';
import { useUIStore } from '../../stores/ui';
import type { MacroDefinition } from '../../contracts/macro';
import type { Device, TargetType } from '../../lib/database.types';
import type { RunPreflightSummary } from '../../lib/run-preflight';

interface UseRunWizardSubmitActionArgs {
  definition: MacroDefinition | undefined;
  dispatchableDevices: Device[];
  hasBlockingIssues: boolean;
  inputValues: Record<string, string>;
  onClose: () => void;
  preflightSummary: RunPreflightSummary;
  selectedGroupId: string;
  selectedVersionId: string;
  targetType: TargetType;
}

export function useRunWizardSubmitAction({
  definition,
  dispatchableDevices,
  hasBlockingIssues,
  inputValues,
  onClose,
  preflightSummary,
  selectedGroupId,
  selectedVersionId,
  targetType,
}: UseRunWizardSubmitActionArgs) {
  const createRun = useCreateRun();
  const profile = useAuthStore((s) => s.profile);
  const addToast = useUIStore((s) => s.addToast);
  const navigate = useNavigate();

  const handleSubmit = async () => {
    await submitRunWizard({
      addToast,
      createRun: createRun.mutateAsync,
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
    });
  };

  return {
    handleSubmit,
    isSubmitting: createRun.isPending,
  };
}
