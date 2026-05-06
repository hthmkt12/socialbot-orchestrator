import type { MacroDefinition } from '../../contracts/macro';
import type { Device, Macro, MacroVersion, TargetType } from '../../lib/database.types';
import type { DeviceLockSnapshot } from '../../lib/device-locks';
import type { RunPreflightSummary } from '../../lib/run-preflight';
import {
  RunWizardPreflightPanel,
  RunWizardReviewSummaryCard,
} from './run-wizard-review-sections';

export function RunWizardReviewStep({
  declaredTargetType,
  definition,
  deviceLockSnapshot,
  dispatchableDeviceCount,
  hasBlockingIssues,
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
  hasBlockingIssues: boolean;
  inputValues: Record<string, string>;
  onlineDeviceCount: number;
  preflightSummary: RunPreflightSummary;
  selectedMacro: Macro | undefined;
  selectedVersion: MacroVersion | undefined;
  targetDevices: Device[];
  targetType: TargetType;
}) {
  return (
    <div className="space-y-5">
      <RunWizardReviewSummaryCard
        declaredTargetType={declaredTargetType}
        definition={definition}
        deviceLockSnapshot={deviceLockSnapshot}
        dispatchableDeviceCount={dispatchableDeviceCount}
        inputValues={inputValues}
        onlineDeviceCount={onlineDeviceCount}
        preflightSummary={preflightSummary}
        selectedMacro={selectedMacro}
        selectedVersion={selectedVersion}
        targetDevices={targetDevices}
        targetType={targetType}
      />
      <RunWizardPreflightPanel hasBlockingIssues={hasBlockingIssues} preflightSummary={preflightSummary} />
    </div>
  );
}
