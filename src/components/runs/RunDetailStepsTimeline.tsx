import Badge from '../ui/Badge';
import Spinner from '../ui/Spinner';
import RunStepErrorPanel from './RunStepErrorPanel';
import { buildRunArtifactStepKey } from '../../lib/run-artifacts';
import type { RunStep, RunStepStatus } from '../../lib/database.types';
import { runDetailStepStatusConfig } from './run-detail-status';

interface RunDetailStepsTimelineProps {
  artifactCountsByStepKey: Map<string, number>;
  focusStepId: string | null;
  isRunning: boolean;
  steps: RunStep[] | undefined;
}

export function RunDetailStepsTimeline({
  artifactCountsByStepKey,
  focusStepId,
  isRunning,
  steps,
}: RunDetailStepsTimelineProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Execution Steps</h3>
          <p className="text-xs text-gray-500 mt-0.5">{steps?.length ?? 0} steps recorded</p>
        </div>
        {isRunning && <Spinner size="sm" />}
      </div>
      <div className="divide-y divide-gray-50">
        {!steps?.length ? (
          <p className="px-5 py-10 text-sm text-gray-500 text-center">
            {isRunning ? 'Waiting for steps...' : 'No steps recorded'}
          </p>
        ) : (
          steps.map((step, index) => (
            <RunDetailStepRow
              key={step.id}
              artifactCountsByStepKey={artifactCountsByStepKey}
              focusStepId={focusStepId}
              index={index}
              step={step}
              stepCount={steps.length}
            />
          ))
        )}
      </div>
    </div>
  );
}

function RunDetailStepRow({
  artifactCountsByStepKey,
  focusStepId,
  index,
  step,
  stepCount,
}: {
  artifactCountsByStepKey: Map<string, number>;
  focusStepId: string | null;
  index: number;
  step: RunStep;
  stepCount: number;
}) {
  const ssc = runDetailStepStatusConfig[step.status as RunStepStatus] ?? runDetailStepStatusConfig.PENDING;
  const StepIcon = ssc.icon;
  const [bg, textColor] = ssc.color.split(' ');
  const isActive = step.status === 'RUNNING';
  const artifactCount = artifactCountsByStepKey.get(
    buildRunArtifactStepKey(step.device_id, step.step_id) ?? ''
  ) ?? 0;
  const retryReason = typeof step.output_json?.retryReason === 'string'
    ? step.output_json.retryReason
    : typeof step.error_json?.terminalFailureReason === 'string'
      ? step.error_json.terminalFailureReason
      : null;
  const nextRetryDelayMs = typeof step.output_json?.nextRetryDelayMs === 'number'
    ? step.output_json.nextRetryDelayMs
    : null;

  return (
    <div className={`px-5 py-4 flex items-start gap-4 transition-colors ${
      focusStepId === step.step_id ? 'bg-amber-50 ring-1 ring-inset ring-amber-200' : isActive ? 'bg-sky-50/30' : 'hover:bg-gray-50/50'
    }`}>
      <div className="flex flex-col items-center gap-1 flex-shrink-0">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${bg}`}>
          <StepIcon className={`w-4 h-4 ${textColor} ${isActive ? 'animate-pulse' : ''}`} />
        </div>
        {index < stepCount - 1 && <div className="w-px h-4 bg-gray-200" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-medium text-gray-900">{step.step_id}</span>
          <Badge variant={ssc.variant as 'green'}>{step.status}</Badge>
          <span className="text-[10px] text-gray-400 font-mono">{step.step_type}</span>
          {artifactCount > 0 && (
            <Badge variant="blue">{artifactCount} artifact{artifactCount !== 1 ? 's' : ''}</Badge>
          )}
        </div>
        <RunStepErrorPanel error={step.error_json} compact />
        {(retryReason || nextRetryDelayMs !== null) && (
          <div className="mt-2 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-xs text-amber-800">
            {retryReason && <p>Retry reason: {retryReason}</p>}
            {nextRetryDelayMs !== null && <p>Next retry delay: {nextRetryDelayMs}ms</p>}
          </div>
        )}
        {step.output_json && Object.keys(step.output_json).length > 0 && (
          <pre className="text-[10px] text-gray-500 mt-1 max-w-md truncate font-mono">{JSON.stringify(step.output_json)}</pre>
        )}
      </div>
      <div className="text-right flex-shrink-0 space-y-1">
        <p className="text-[10px] text-gray-400 font-mono">#{step.step_index}</p>
        {step.retry_count > 0 && <Badge variant="yellow">{step.retry_count}x retry</Badge>}
      </div>
    </div>
  );
}
