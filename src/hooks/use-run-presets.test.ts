import { describe, expect, it, beforeEach } from 'vitest';
import {
  clearRunPresetsForTesting,
  deleteRunPreset,
  getRunPresetsSnapshot,
  saveRunPreset,
} from './use-run-presets';

describe('useRunPresets storage and sync store logic', () => {
  beforeEach(() => {
    clearRunPresetsForTesting();
  });

  it('starts with empty list of presets', () => {
    expect(getRunPresetsSnapshot()).toEqual([]);
  });

  it('saves new preset and retrieves it in snapshot', () => {
    const saved = saveRunPreset({
      name: 'Instagram Warmup',
      macroId: 'macro-1',
      targetType: 'SINGLE_DEVICE',
      deviceIds: ['device-1'],
      groupId: '',
      accountId: 'acc-1',
      inputValues: { timeout: '30' },
    });

    expect(saved.id).toBeDefined();
    expect(saved.name).toBe('Instagram Warmup');

    const list = getRunPresetsSnapshot();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(saved.id);
    expect(list[0].macroId).toBe('macro-1');
    expect(list[0].inputValues).toEqual({ timeout: '30' });
  });

  it('deletes preset by id', () => {
    const p1 = saveRunPreset({
      name: 'Batch Dispatch A',
      macroId: 'macro-a',
      targetType: 'DEVICE_GROUP',
      deviceIds: [],
      groupId: 'grp-1',
      accountId: '',
      inputValues: {},
    });
    const p2 = saveRunPreset({
      name: 'Batch Dispatch B',
      macroId: 'macro-b',
      targetType: 'SINGLE_DEVICE',
      deviceIds: ['dev-2'],
      groupId: '',
      accountId: '',
      inputValues: {},
    });

    expect(getRunPresetsSnapshot()).toHaveLength(2);

    deleteRunPreset(p1.id);
    const updated = getRunPresetsSnapshot();
    expect(updated).toHaveLength(1);
    expect(updated[0].id).toBe(p2.id);
  });
});
