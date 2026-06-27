import type { Device, DeviceGroup, Macro, MacroVersion, TargetType } from '../../lib/database.types';
import type { MacroDefinition } from '../../contracts/macro';
import type { RunPreflightSummary } from '../../lib/run-preflight';
import type { DeviceLockSnapshot } from '../../lib/device-locks';
import type { WizardStep } from './run-wizard-types';
import {
  RunWizardInputsStep,
  type RunWizardInputField,
} from './RunWizardInputsStep';
import { RunWizardAccountStep } from './RunWizardAccountStep';
import { RunWizardMacroStep } from './RunWizardMacroStep';
import { RunWizardReviewStep } from './RunWizardReviewStep';
import { RunWizardTargetStep } from './RunWizardTargetStep';

export function RunWizardStepContent({
  declaredTargetType,
  definition,
  deviceLockSnapshot,
  deviceLocksError,
  devices,
  dispatchableDeviceCount,
  filteredMacros,
  fleetCounts,
  groups,
  hasBlockingIssues,
  inputFields,
  inputValues,
  macroSearch,
  onlineDeviceCount,
  onGroupChange,
  onInputValuesChange,
  onMacroSearchChange,
  onSelectedMacroChange,
  onSelectedVersionChange,
  onTargetTypeChange,
  onToggleDevice,
  onSelectAccount,
  preflightSummary,
  selectedAccountId,
  selectedDeviceIds,
  selectedGroupId,
  selectedMacro,
  selectedMacroId,
  selectedVersion,
  selectedVersionId,
  step,
  targetDevices,
  targetType,
  versions,
}: {
  declaredTargetType: TargetType | null;
  definition: MacroDefinition | undefined;
  deviceLockSnapshot: DeviceLockSnapshot;
  deviceLocksError: Error | string | null | undefined;
  devices: Device[] | undefined;
  dispatchableDeviceCount: number;
  filteredMacros: Macro[];
  fleetCounts: { busy: number; locked: number; offline: number; online: number; stale: number };
  groups: DeviceGroup[] | undefined;
  hasBlockingIssues: boolean;
  inputFields: RunWizardInputField[];
  inputValues: Record<string, string>;
  macroSearch: string;
  onlineDeviceCount: number;
  onGroupChange: (groupId: string) => void;
  onInputValuesChange: (values: Record<string, string>) => void;
  onMacroSearchChange: (value: string) => void;
  onSelectAccount: (accountId: string) => void;
  onSelectedMacroChange: (macroId: string, latestVersionId: string) => void;
  onSelectedVersionChange: (versionId: string) => void;
  onTargetTypeChange: (targetType: TargetType) => void;
  onToggleDevice: (deviceId: string) => void;
  preflightSummary: RunPreflightSummary;
  selectedAccountId: string;
  selectedDeviceIds: string[];
  selectedGroupId: string;
  selectedMacro: Macro | undefined;
  selectedMacroId: string;
  selectedVersion: MacroVersion | undefined;
  selectedVersionId: string;
  step: WizardStep;
  targetDevices: Device[];
  targetType: TargetType;
  versions: MacroVersion[] | undefined;
}) {
  if (step === 'macro') {
    return (
      <RunWizardMacroStep
        filteredMacros={filteredMacros}
        macroSearch={macroSearch}
        onMacroSearchChange={onMacroSearchChange}
        onSelectedMacroChange={onSelectedMacroChange}
        onSelectedVersionChange={onSelectedVersionChange}
        selectedMacroId={selectedMacroId}
        selectedVersionId={selectedVersionId}
        versions={versions}
      />
    );
  }

  if (step === 'target') {
    return (
      <RunWizardTargetStep
        declaredTargetType={declaredTargetType}
        deviceLockSnapshot={deviceLockSnapshot}
        deviceLocksError={deviceLocksError}
        devices={devices}
        fleetCounts={fleetCounts}
        groups={groups}
        onGroupChange={onGroupChange}
        onTargetTypeChange={onTargetTypeChange}
        onToggleDevice={onToggleDevice}
        selectedDeviceIds={selectedDeviceIds}
        selectedGroupId={selectedGroupId}
        targetType={targetType}
      />
    );
  }

  if (step === 'inputs') {
    return (
      <RunWizardInputsStep
        inputFields={inputFields}
        inputValues={inputValues}
        onInputValuesChange={onInputValuesChange}
      />
    );
  }

  if (step === 'account') {
    return (
      <RunWizardAccountStep
        selectedAccountId={selectedAccountId}
        onSelectAccount={onSelectAccount}
      />
    );
  }

  return (
    <RunWizardReviewStep
      declaredTargetType={declaredTargetType}
      definition={definition}
      deviceLockSnapshot={deviceLockSnapshot}
      dispatchableDeviceCount={dispatchableDeviceCount}
      hasBlockingIssues={hasBlockingIssues}
      inputValues={inputValues}
      onlineDeviceCount={onlineDeviceCount}
      preflightSummary={preflightSummary}
      selectedMacro={selectedMacro}
      selectedVersion={selectedVersion}
      targetDevices={targetDevices}
      targetType={targetType}
    />
  );
}
