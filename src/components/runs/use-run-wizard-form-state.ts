import { useCallback, useState } from 'react';
import type { TargetType } from '../../lib/database.types';

export function useRunWizardFormState() {
  const [selectedMacroId, setSelectedMacroId] = useState('');
  const [selectedVersionId, setSelectedVersionId] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [targetType, setTargetType] = useState<TargetType>('SINGLE_DEVICE');
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
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

  return {
    applyDeclaredTargetType,
    inputValues,
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
