import { Check, Code } from 'lucide-react';
import type { MacroDefinition } from '../../contracts/macro';
import type { Device, Macro, MacroVersion, TargetType } from '../../lib/database.types';
import { type DeviceLockSnapshot } from '../../lib/device-locks';
import type { RunPreflightSummary } from '../../lib/run-preflight';
import { ReviewMetric, RunPreflightIssueCard } from './run-wizard-review-primitives';
import {
  RunWizardReviewDeviceList,
  RunWizardReviewInputVariables,
} from './run-wizard-review-detail-sections';
import { formatTargetTypeLabel } from './run-wizard-types';

export function RunWizardReviewSummaryCard({
  declaredTargetType,
  definition,
  deviceLockSnapshot,
  dispatchableDeviceCount,
  inputValues,
  onlineDeviceCount,
  preflightSummary,
  selectedMacro,
  selectedVersion,
  targetDevices,
  targetType,
}: {
  declaredTargetType: TargetType | null;
  definition: MacroDefinition | undefined;
  deviceLockSnapshot: DeviceLockSnapshot;
  dispatchableDeviceCount: number;
  inputValues: Record<string, string>;
  onlineDeviceCount: number;
  preflightSummary: RunPreflightSummary;
  selectedMacro: Macro | undefined;
  selectedVersion: MacroVersion | undefined;
  targetDevices: Device[];
  targetType: TargetType;
}) {
  return (
    <div className="bg-gray-50 rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-3 pb-3 border-b border-gray-200">
        <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center">
          <Code className="w-5 h-5 text-orange-600" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">{selectedMacro?.name}</p>
          <p className="text-xs text-gray-500">v{selectedVersion?.version_number} - {selectedVersion?.status}</p>
        </div>
      </div>

      {definition && (
        <>
          <ReviewMetric label="Steps" value={`${definition.steps.length} step${definition.steps.length !== 1 ? 's' : ''}`} />
          {definition.execution && (
            <>
              <ReviewMetric label="Timeout" value={`${(definition.execution.defaultTimeoutMs / 1000).toFixed(0)}s`} />
              <ReviewMetric label="Max Retries" value={String(definition.execution.maxRetries)} />
              <ReviewMetric label="On Error" value={definition.execution.onError} />
            </>
          )}
        </>
      )}

      <div className="border-t border-gray-200 pt-3 space-y-3">
        {[
          ['Macro Target Mode', declaredTargetType ? formatTargetTypeLabel(declaredTargetType) : 'Unknown'],
          ['Selected Target Mode', formatTargetTypeLabel(targetType)],
          ['Target Devices', `${targetDevices.length} device${targetDevices.length !== 1 ? 's' : ''}`],
          ['Online Devices', `${onlineDeviceCount} of ${targetDevices.length}`],
          ['Dispatch Ready', `${dispatchableDeviceCount} of ${targetDevices.length}`],
          ['Approval Gates', `${preflightSummary.approvalStepCount}`],
          ['Sensitive Steps', `${preflightSummary.sensitiveStepCount}`],
        ].map(([label, value]) => (
          <ReviewMetric key={label} label={label} value={value} />
        ))}
      </div>

      <RunWizardReviewDeviceList
        deviceLockSnapshot={deviceLockSnapshot}
        targetDevices={targetDevices}
      />
      <RunWizardReviewInputVariables inputValues={inputValues} />
    </div>
  );
}

export function RunWizardPreflightPanel({
  hasBlockingIssues,
  preflightSummary,
}: {
  hasBlockingIssues: boolean;
  preflightSummary: RunPreflightSummary;
}) {
  const activeGates = preflightSummary.gates.filter((gate) => gate.status === 'failed');

  if (hasBlockingIssues || activeGates.length > 0) {
    return (
      <div className="space-y-3">
        {activeGates.map((gate) => (
          <RunPreflightIssueCard
            key={gate.key}
            tone={gate.type === 'warning' ? 'amber' : 'red'}
            title={gate.message}
            detail={gate.recoveryHint}
            meta={`${gate.key} · ${gate.type.replace(/_/g, ' ')} · ${gate.status}`}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
      <Check className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-medium text-emerald-800">Preflight passed</p>
        <p className="text-xs text-emerald-600 mt-0.5">
          Targets, inputs, and approval gates are ready for dispatch.
        </p>
      </div>
    </div>
  );
}
