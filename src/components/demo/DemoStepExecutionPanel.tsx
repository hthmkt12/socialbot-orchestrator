import { AlertTriangle, ArrowRight, CheckCircle2, Code, Loader2, XCircle } from 'lucide-react';
import Badge from '../ui/Badge';
import { stepIcons, type StepState } from './demo-workflow-state';

export function DemoStepExecutionPanel({
  displaySteps,
  lastRunStatus,
  progress,
  statusBadgeVariant,
  totalDuration,
}: {
  displaySteps: StepState[];
  lastRunStatus: string | null;
  progress: number;
  statusBadgeVariant: 'green' | 'red' | 'orange' | 'gray' | 'blue';
  totalDuration: number;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Step Execution</h3>
        {(lastRunStatus || totalDuration > 0) && (
          <div className="flex items-center gap-2">
            <Badge variant={statusBadgeVariant}>
              {lastRunStatus ?? 'RUNNING'}
            </Badge>
            <span className="text-xs text-gray-400">{(totalDuration / 1000).toFixed(1)}s total</span>
          </div>
        )}
      </div>

      <div className="h-2 bg-gray-100 rounded-full mb-6 overflow-hidden">
        <div
          className="h-full bg-emerald-500 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="space-y-3">
        {displaySteps.map((step, index) => (
          <DemoStepRow
            key={step.id}
            isLast={index === displaySteps.length - 1}
            step={step}
          />
        ))}
      </div>
    </div>
  );
}

function DemoStepRow({
  isLast,
  step,
}: {
  isLast: boolean;
  step: StepState;
}) {
  const StepIcon = stepIcons[step.type] ?? Code;
  const isWaitingApproval = step.status === 'waiting_approval';
  const isFailed = step.status === 'failed' || step.status === 'cancelled';

  return (
    <div>
      <div className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
        step.status === 'running' || step.status === 'queued' ? 'border-sky-300 bg-sky-50 shadow-sm' :
        step.status === 'success' ? 'border-emerald-200 bg-emerald-50/30' :
        isWaitingApproval ? 'border-amber-200 bg-amber-50/50' :
        isFailed ? 'border-red-200 bg-red-50/30' :
        'border-gray-200'
      }`}>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
          step.status === 'running' || step.status === 'queued' ? 'bg-sky-100' :
          step.status === 'success' ? 'bg-emerald-100' :
          isWaitingApproval ? 'bg-amber-100' :
          isFailed ? 'bg-red-100' :
          'bg-gray-100'
        }`}>
          {step.status === 'running' || step.status === 'queued' ? (
            <Loader2 className="w-4 h-4 text-sky-500 animate-spin" />
          ) : step.status === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          ) : isFailed ? (
            <XCircle className="w-4 h-4 text-red-500" />
          ) : isWaitingApproval ? (
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          ) : (
            <StepIcon className="w-4 h-4 text-gray-400" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900">{step.label}</span>
            <span className="text-[10px] font-mono text-gray-400">{step.id}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500">{step.type}</span>
            {step.artifactCount ? <Badge variant="blue">{step.artifactCount} artifact{step.artifactCount !== 1 ? 's' : ''}</Badge> : null}
            {step.approvalStatus ? <Badge variant={step.approvalStatus === 'PENDING' ? 'orange' : 'gray'}>{step.approvalStatus} approval</Badge> : null}
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {step.durationMs != null && (
            <span className="text-xs text-gray-400 font-mono">{step.durationMs}ms</span>
          )}
          <Badge
            variant={
              step.status === 'running' ? 'blue' :
              step.status === 'success' ? 'green' :
              isWaitingApproval ? 'orange' :
              isFailed ? 'red' :
              step.status === 'queued' ? 'blue' : 'gray'
            }
          >
            {(step.status === 'running' || step.status === 'queued') && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
            {step.status}
          </Badge>
        </div>
      </div>

      {step.output && (
        <div className="ml-13 mt-1 px-4 py-2 bg-gray-50 rounded-lg">
          <pre className="text-[10px] text-gray-600 font-mono whitespace-pre-wrap">
            {JSON.stringify(step.output, null, 2)}
          </pre>
        </div>
      )}

      {!isLast && (
        <div className="flex justify-center py-1">
          <ArrowRight className="w-3.5 h-3.5 text-gray-300 rotate-90" />
        </div>
      )}
    </div>
  );
}
