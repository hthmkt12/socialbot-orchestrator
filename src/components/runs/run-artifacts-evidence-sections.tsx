import Badge from '../ui/Badge';
import { RunArtifactPreviewCard } from './RunArtifactPreviewCard';
import type { RunStep, RunStepStatus } from '../../lib/database.types';
import type { RunArtifactPreview } from '../../lib/run-artifacts';

const stepStatusVariant: Record<RunStepStatus, 'green' | 'red' | 'yellow' | 'gray' | 'blue' | 'orange'> = {
  PENDING: 'gray',
  RUNNING: 'blue',
  SUCCESS: 'green',
  FAILED: 'red',
  SKIPPED: 'gray',
  RETRYING: 'yellow',
  CANCELLED: 'gray',
  WAITING_APPROVAL: 'orange',
};

export function RunArtifactsStepEvidence({
  focusStepId,
  stepEvidence,
}: {
  focusStepId: string | null;
  stepEvidence: Array<{ artifacts: RunArtifactPreview[]; step: RunStep }>;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Evidence By Step</h4>
      </div>
      {stepEvidence.map(({ step, artifacts: stepArtifacts }) => {
        const isFocused = focusStepId === step.step_id;
        return (
          <div
            key={`${step.id}-evidence`}
            className={`rounded-xl border p-4 space-y-3 ${
              isFocused
                ? 'border-amber-300 bg-amber-50/60 shadow-sm'
                : 'border-gray-200 bg-gray-50'
            }`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-gray-900">{step.step_id}</span>
              <Badge variant={stepStatusVariant[step.status]}>{step.status}</Badge>
              <Badge variant="gray">{step.step_type}</Badge>
              <span className="text-[10px] font-mono text-gray-400">device: {step.device_id.slice(0, 8)}</span>
              <span className="text-[10px] text-gray-500">{stepArtifacts.length} artifact{stepArtifacts.length !== 1 ? 's' : ''}</span>
              {isFocused && <Badge variant="orange">Audit Focus</Badge>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {stepArtifacts.map((artifact) => (
                <RunArtifactPreviewCard key={artifact.artifact.id} artifact={artifact} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function RunArtifactsUnlinked({
  artifacts,
}: {
  artifacts: RunArtifactPreview[];
}) {
  if (artifacts.length === 0) return null;

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Unlinked Artifacts</h4>
        <p className="text-xs text-gray-500 mt-1">
          Stored evidence with missing device/step metadata or no current step match by <span className="font-mono">device_id + stepId</span>.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {artifacts.map((artifact) => (
          <RunArtifactPreviewCard key={artifact.artifact.id} artifact={artifact} />
        ))}
      </div>
    </div>
  );
}
