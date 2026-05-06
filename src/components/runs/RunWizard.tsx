import { useEffect } from 'react';
import { RunWizardFooter } from './RunWizardFooter';
import { RunWizardModalLayout } from './RunWizardModalLayout';
import { RunWizardStepContent } from './run-wizard-step-content';
import { useRunWizardData } from './use-run-wizard-data';
import { useRunWizardFormState } from './use-run-wizard-form-state';
import { useRunWizardNavigationState } from './use-run-wizard-navigation-state';
import { useRunWizardSubmitAction } from './use-run-wizard-submit-action';
import { useAuthStore } from '../../stores/auth';

interface Props {
  onClose: () => void;
}

export default function RunWizard({ onClose }: Props) {
  const {
    applyDeclaredTargetType,
    inputValues,
    macroSearch,
    selectedDeviceIds,
    selectedGroupId,
    selectedMacroId,
    selectedVersionId,
    selectMacro,
    selectTargetType,
    setInputValues,
    setMacroSearch,
    setSelectedGroupId,
    setSelectedVersionId,
    targetType,
    toggleDevice,
  } = useRunWizardFormState();
  const profileRole = useAuthStore((s) => s.profile?.role);

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
    selectedDeviceIds,
    selectedGroupId,
    selectedMacroId,
    selectedVersionId,
    targetType,
  });
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
    inputFields,
    inputValues,
    selectedDeviceIds,
    selectedGroupId,
    selectedVersionId,
    targetType,
  });

  return (
    <RunWizardModalLayout
      body={(
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
          onSelectedMacroChange={selectMacro}
          onSelectedVersionChange={setSelectedVersionId}
          onTargetTypeChange={selectTargetType}
          onToggleDevice={toggleDevice}
          preflightSummary={preflightSummary}
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
