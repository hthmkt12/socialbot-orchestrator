import { formatDistanceToNow } from 'date-fns';
import { ChevronDown, ChevronRight, Smartphone } from 'lucide-react';
import Badge from '../ui/Badge';
import RunStepErrorPanel from './RunStepErrorPanel';
import { RunMonitorStepDetails } from './run-monitor-step-details';
import type { DeviceStatus, RunStep } from './run-monitor-types';
import { RunStatusBadge, RunStepStatusIcon } from './run-monitor-status';

interface RunMonitorDeviceCardProps {
  deviceStatus: DeviceStatus;
  expanded: boolean;
  expandedSteps: Set<string>;
  onToggleDevice: (deviceId: string) => void;
  onToggleStep: (stepId: string) => void;
}

interface RunMonitorStepCardProps {
  expanded: boolean;
  onToggle: () => void;
  step: RunStep;
}

export function RunMonitorDeviceCard({
  deviceStatus,
  expanded,
  expandedSteps,
  onToggleDevice,
  onToggleStep,
}: RunMonitorDeviceCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <button
        onClick={() => onToggleDevice(deviceStatus.device.id)}
        className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-4">
          {expanded ? (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-400" />
          )}
          <Smartphone className="w-5 h-5 text-gray-600" />
          <div className="text-left">
            <h3 className="font-semibold text-gray-900">{deviceStatus.device.name}</h3>
            <p className="text-sm text-gray-500">
              {deviceStatus.device.model} - {deviceStatus.device.laixi_device_id}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-sm text-gray-600">
            <span className="font-medium text-green-600">{deviceStatus.successCount}</span> /{' '}
            <span className="font-medium text-red-600">{deviceStatus.failedCount}</span> /{' '}
            <span className="font-medium text-gray-600">{deviceStatus.pendingCount}</span>
          </div>
          <RunStatusBadge status={deviceStatus.status} />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <div className="space-y-3">
            {deviceStatus.steps.map((step) => (
              <RunMonitorStepCard
                key={step.id}
                expanded={expandedSteps.has(step.id)}
                onToggle={() => onToggleStep(step.id)}
                step={step}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RunMonitorStepCard({ expanded, onToggle, step }: RunMonitorStepCardProps) {
  const retryReason = typeof step.output_json?.retryReason === 'string'
    ? step.output_json.retryReason
    : typeof step.error_json?.terminalFailureReason === 'string'
      ? step.error_json.terminalFailureReason
      : null;
  const nextRetryDelayMs = typeof step.output_json?.nextRetryDelayMs === 'number'
    ? step.output_json.nextRetryDelayMs
    : null;

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <RunStepStatusIcon status={step.status} />
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900">{step.step_id}</span>
              <Badge variant="gray">{step.step_type}</Badge>
              {step.retry_count > 0 && <Badge variant="yellow">Retry {step.retry_count}</Badge>}
            </div>
            {step.started_at && (
              <p className="text-xs text-gray-500 mt-1">
                {formatDistanceToNow(new Date(step.started_at), { addSuffix: true })}
                {step.finished_at && (
                  <>
                    {' - Duration: '}
                    {Math.round(
                      (new Date(step.finished_at).getTime() - new Date(step.started_at).getTime()) / 1000
                    )}
                    s
                  </>
                )}
              </p>
            )}
            <RunStepErrorPanel error={step.error_json} compact />
            {(retryReason || nextRetryDelayMs !== null) && (
              <p className="text-xs text-amber-700 mt-1">
                {retryReason ? `Retry: ${retryReason}` : 'Retry scheduled'}
                {nextRetryDelayMs !== null ? ` (${nextRetryDelayMs}ms)` : ''}
              </p>
            )}
          </div>
        </div>
        {expanded ? (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronRight className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {expanded && <RunMonitorStepDetails step={step} />}
    </div>
  );
}
