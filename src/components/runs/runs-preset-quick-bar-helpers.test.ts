import { describe, expect, it } from 'vitest';
import { formatPresetTargetSummary, filterActivePresets } from './runs-preset-quick-bar-helpers';
import type { RunPreset } from '../../hooks/use-run-presets';

describe('RunsPresetQuickBar helpers', () => {
  it('formats single device preset target summary', () => {
    const preset: RunPreset = {
      id: 'p1',
      name: 'Single Device Warmup',
      macroId: 'm1',
      targetType: 'SINGLE_DEVICE',
      deviceIds: ['dev-1'],
      groupId: '',
      accountId: '',
      inputValues: {},
      createdAt: '2026-10-06T00:00:00Z',
    };
    expect(formatPresetTargetSummary(preset)).toBe('single device • 1 targets');
  });

  it('formats group target summary', () => {
    const preset: RunPreset = {
      id: 'p2',
      name: 'Group Batch',
      macroId: 'm2',
      targetType: 'DEVICE_GROUP',
      deviceIds: [],
      groupId: 'grp-x',
      accountId: '',
      inputValues: {},
      createdAt: '2026-10-06T00:00:00Z',
    };
    expect(formatPresetTargetSummary(preset)).toBe('device group • group targets');
  });

  it('filters active valid presets', () => {
    const valid: RunPreset = {
      id: 'p3',
      name: 'Valid Preset',
      macroId: 'm3',
      targetType: 'ALL_DEVICES',
      deviceIds: [],
      groupId: '',
      accountId: '',
      inputValues: {},
      createdAt: '2026-10-06T00:00:00Z',
    };
    const list = [valid, null as unknown as RunPreset, { id: 123 } as unknown as RunPreset];
    expect(filterActivePresets(list)).toEqual([valid]);
  });
});
