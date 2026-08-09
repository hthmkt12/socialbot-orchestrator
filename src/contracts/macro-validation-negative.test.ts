import { describe, expect, it } from 'vitest';
import { validateMacroDefinition } from './macro';

describe('macro validation negative guards', () => {
  it('rejects missing structural sections and invalid target mode', () => {
    const result = validateMacroDefinition({ version: 1, meta: { key: 'x', name: 'x' }, steps: [{ id: 's1', type: 'tap', params: {} }], target: { mode: 'unknown' } });
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining(['inputs must be an object', 'execution is required', 'target.mode is invalid']));
  });

  it('rejects non-positive timeouts, negative retries, and non-object params', () => {
    const result = validateMacroDefinition({ version: 1, meta: { key: 'x', name: 'x' }, inputs: {}, target: { mode: 'single_device' }, execution: { defaultTimeoutMs: 0, maxRetries: -1, onError: 'stop' }, steps: [{ id: 's1', type: 'tap', params: null }] });
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining(['execution.defaultTimeoutMs must be positive', 'execution.maxRetries must be a non-negative integer', 'steps[0].params must be an object']));
  });
});
