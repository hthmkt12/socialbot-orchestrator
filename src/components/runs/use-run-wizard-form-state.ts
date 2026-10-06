import { useCallback, useState } from 'react';
import type { TargetType } from '../../lib/database.types';
import type { RunPreset } from '../../hooks/use-run-presets';

export function useRunWizardFormState(initialPreset?: RunPreset | null) {
  const [selectedMacroId, setSelectedMacroId] = useState(initialPreset?.macroId ?? '');
  const [selectedVersionId, setSelectedVersionId] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState(initialPreset?.accountId ?? '');
  const [targetType, setTargetType] = useState<TargetType>(initialPreset?.targetType ?? 'SINGLE_DEVICE');
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>(initialPreset?.deviceIds ?? []);
  const [selectedGroupId, setSelectedGroupId] = useState(initialPreset?.groupId ?? '');
  const [inputValues, setInputValues] = useState<Record<string, string>>(initialPreset?.inputValues ?? {});
  const [macroSearch, setMacroSearch] = useState('');

  const resetTargetSelection = useCallback(() => {
    setSelectedDeviceIds([]);
    setSelectedGroupId('');
  }, []);

  const selectMacro = useCallback((macroId: string, latestVersionId: string) => {
    setSelectedMacroId(macroId);
    setSelectedVersionId(latestVersionId);
  }, []);

  const selectTargetType = useCallback((nextTargetType: TargetType) => {
    setTargetType(nextTargetType);
    resetTargetSelection();
  }, [resetTargetSelection]);

  const selectAccount = useCallback((accountId: string) => {
    setSelectedAccountId(accountId);
  }, []);

  const applyDeclaredTargetType = useCallback((declaredTargetType: TargetType | null) => {
    if (!declaredTargetType || targetType === declaredTargetType) return;
    setTargetType(declaredTargetType);
    resetTargetSelection();
  }, [resetTargetSelection, targetType]);

  const toggleDevice = useCallback((id: string) => {
    if (targetType === 'SINGLE_DEVICE') {
      setSelectedDeviceIds([id]);
      return;
    }

    setSelectedDeviceIds((prev) =>
      prev.includes(id) ? prev.filter((deviceId) => deviceId !== id) : [...prev, id]
    );
  }, [targetType]);

  /** Populate wizard form from a saved preset. */
  const loadFromPreset = useCallback((preset: RunPreset) => {
    setSelectedMacroId(preset.macroId);
    setSelectedVersionId(''); // resolved to latest by data hook
    setTargetType(preset.targetType);
    setSelectedDeviceIds(preset.deviceIds);
    setSelectedGroupId(preset.groupId);
    setSelectedAccountId(preset.accountId);
    setInputValues(preset.inputValues);
    setMacroSearch('');
  }, []);

  return {
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
  };
}
