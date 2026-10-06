import type { RunPreset } from '../../hooks/use-run-presets';

export function formatPresetTargetSummary(preset: RunPreset): string {
  const typeLabel = preset.targetType.replace(/_/g, ' ').toLowerCase();
  const count = preset.deviceIds?.length || (preset.groupId ? 'group' : '0');
  return `${typeLabel} • ${count} targets`;
}

export function filterActivePresets(presets: RunPreset[]): RunPreset[] {
  return presets.filter((p) => p && typeof p.id === 'string' && typeof p.name === 'string');
}
