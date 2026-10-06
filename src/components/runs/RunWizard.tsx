import { useEffect, useState } from 'react';
import { RunWizardFooter } from './RunWizardFooter';
import { RunWizardModalLayout } from './RunWizardModalLayout';
import { RunWizardPresetBar } from './run-wizard-preset-bar';
import { RunWizardStepContent } from './run-wizard-step-content';
import { useRunWizardData } from './use-run-wizard-data';
import { useRunWizardFormState } from './use-run-wizard-form-state';
import { useRunWizardNavigationState } from './use-run-wizard-navigation-state';
import { useRunWizardSubmitAction } from './use-run-wizard-submit-action';
import { useRunPresets, type RunPreset } from '../../hooks/use-run-presets';
import { useAuthStore } from '../../stores/auth';

interface Props {
  onClose: () => void;
  initialPreset?: RunPreset | null;
}

export default function RunWizard({ onClose, initialPreset }: Props) {
  const {
    applyDeclaredTargetType,
    inputValues,
    loadFromPreset,
    macroSearch,
    selectedAccountId,
    selectedDeviceIds,
    selectedGroupId,
    selectedMacroId,
    selectedVersionId,
    selectAccount,
    selectMacro,
    selectTargetType,
    setInputValues,
    setMacroSearch,
    setSelectedGroupId,
    setSelectedVersionId,
    targetType,
    toggleDevice,
  } = useRunWizardFormState(initialPreset);
  const profileRole = useAuthStore((s) => s.profile?.role);
  const { presets, savePreset, deletePreset } = useRunPresets();
  const [showSavePreset, setShowSavePreset] = useState(false);

  const {
    declaredTargetType,
    definition,
    deviceLockSnapshot,
    dispatchableDeviceCount,
    dispatchableDevices,
    filteredMacros,
    fleetCounts,
    inputFields,
    onlineDeviceCount,
    preflightSummary,
    selectedMacro,
    selectedVersion,
    targetDevices,
    devices,
    deviceLocksError,
    groups,
    versions,
  } = useRunWizardData({
    inputValues,
    macroSearch,
    profileRole,
    selectedAccountId,
    selectedDeviceIds,
    selectedGroupId,
    selectedMacroId,
    selectedVersionId,
    targetType,
  });

  const hasAccountStep = !!definition?.antiDetection;

  const {
    handleSubmit,
    isSubmitting,
  } = useRunWizardSubmitAction({
    definition,
    dispatchableDevices,
    hasBlockingIssues: preflightSummary.blockingIssues.length > 0,
    inputValues,
    onClose,
    preflightSummary,
    selectedAccountId,
    selectedGroupId,
    selectedVersionId,
    targetType,
  });

  useEffect(() => {
    applyDeclaredTargetType(declaredTargetType);
  }, [applyDeclaredTargetType, declaredTargetType]);

  const hasBlockingIssues = preflightSummary.blockingIssues.length > 0;
  const {
    canNext,
    currentIdx,
    nextStep,
    prevStep,
    step,
    steps,
  } = useRunWizardNavigationState({
    hasAccountStep,
    inputFields,
    inputValues,
    selectedAccountId,
    selectedDeviceIds,
    selectedGroupId,
    selectedVersionId,
    targetType,
  });

  return (
    <RunWizardModalLayout
      body={(
        <>
          <RunWizardPresetBar
            deletePreset={deletePreset}
            inputValues={inputValues}
            loadFromPreset={loadFromPreset}
            onSavePreset={savePreset}
            presets={presets}
            selectedAccountId={selectedAccountId}
            selectedDeviceIds={selectedDeviceIds}
            selectedGroupId={selectedGroupId}
            selectedMacroId={selectedMacroId}
            showSavePreset={showSavePreset}
            setShowSavePreset={setShowSavePreset}
            targetType={targetType}
          />
          <RunWizardStepContent
          declaredTargetType={declaredTargetType}
          definition={definition}
          deviceLockSnapshot={deviceLockSnapshot}
          deviceLocksError={deviceLocksError}
          devices={devices}
          dispatchableDeviceCount={dispatchableDeviceCount}
          filteredMacros={filteredMacros}
          fleetCounts={fleetCounts}
          groups={groups}
          hasBlockingIssues={hasBlockingIssues}
          inputFields={inputFields}
          inputValues={inputValues}
          macroSearch={macroSearch}
          onlineDeviceCount={onlineDeviceCount}
          onGroupChange={setSelectedGroupId}
          onInputValuesChange={setInputValues}
          onMacroSearchChange={setMacroSearch}
          onSelectAccount={selectAccount}
          onSelectedMacroChange={selectMacro}
          onSelectedVersionChange={setSelectedVersionId}
          onTargetTypeChange={selectTargetType}
          onToggleDevice={toggleDevice}
          preflightSummary={preflightSummary}
          selectedAccountId={selectedAccountId}
          selectedDeviceIds={selectedDeviceIds}
          selectedGroupId={selectedGroupId}
          selectedMacro={selectedMacro}
          selectedMacroId={selectedMacroId}
          selectedVersion={selectedVersion}
          selectedVersionId={selectedVersionId}
          step={step}
          targetDevices={targetDevices}
          targetType={targetType}
          versions={versions}
          />
        </>
      )}
      currentIdx={currentIdx}
      footer={(
        <RunWizardFooter
          canNext={canNext}
          currentIdx={currentIdx}
          hasBlockingIssues={hasBlockingIssues}
          isSubmitting={isSubmitting}
          onBack={prevStep}
          onCancel={onClose}
          onNext={nextStep}
          onSubmit={() => void handleSubmit()}
          step={step}
        />
      )}
      onClose={onClose}
      steps={steps}
    />
  );
}
