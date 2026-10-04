import { describe, expect, it } from 'vitest';
import {
  canAdvanceRunWizard,
  getNextRunWizardStep,
  getPreviousRunWizardStep,
  getRunWizardSteps,
} from './run-wizard-navigation';

describe('run wizard navigation', () => {
  describe('getRunWizardSteps', () => {
    it('returns core steps [macro, target, review] when no account and no inputs', () => {
      const steps = getRunWizardSteps(0, false);
      expect(steps).toEqual(['macro', 'target', 'review']);
    });

    it('includes account step when hasAccountStep is true', () => {
      const steps = getRunWizardSteps(0, true);
      expect(steps).toEqual(['macro', 'target', 'account', 'review']);
    });

    it('includes inputs step when inputFieldCount > 0', () => {
      const steps = getRunWizardSteps(2, false);
      expect(steps).toEqual(['macro', 'target', 'inputs', 'review']);
    });

    it('includes both account and inputs steps in sequence', () => {
      const steps = getRunWizardSteps(2, true);
      expect(steps).toEqual(['macro', 'target', 'account', 'inputs', 'review']);
    });
  });

  describe('canAdvanceRunWizard', () => {
    it('allows macro advance only when version is selected', () => {
      expect(
        canAdvanceRunWizard({
          step: 'macro',
          selectedVersionId: '',
          selectedDeviceIds: [],
          selectedGroupId: '',
          selectedAccountId: '',
          inputFields: [],
          inputValues: {},
          targetType: 'SINGLE_DEVICE',
        })
      ).toBe(false);

      expect(
        canAdvanceRunWizard({
          step: 'macro',
          selectedVersionId: 'ver-123',
          selectedDeviceIds: [],
          selectedGroupId: '',
          selectedAccountId: '',
          inputFields: [],
          inputValues: {},
          targetType: 'SINGLE_DEVICE',
        })
      ).toBe(true);
    });

    it('validates target selection based on targetType', () => {
      // SINGLE_DEVICE requires at least 1 device
      expect(
        canAdvanceRunWizard({
          step: 'target',
          selectedVersionId: 'ver-123',
          selectedDeviceIds: [],
          selectedGroupId: '',
          selectedAccountId: '',
          inputFields: [],
          inputValues: {},
          targetType: 'SINGLE_DEVICE',
        })
      ).toBe(false);

      expect(
        canAdvanceRunWizard({
          step: 'target',
          selectedVersionId: 'ver-123',
          selectedDeviceIds: ['dev-1'],
          selectedGroupId: '',
          selectedAccountId: '',
          inputFields: [],
          inputValues: {},
          targetType: 'SINGLE_DEVICE',
        })
      ).toBe(true);

      // DEVICE_GROUP requires selectedGroupId
      expect(
        canAdvanceRunWizard({
          step: 'target',
          selectedVersionId: 'ver-123',
          selectedDeviceIds: [],
          selectedGroupId: '',
          selectedAccountId: '',
          inputFields: [],
          inputValues: {},
          targetType: 'DEVICE_GROUP',
        })
      ).toBe(false);

      expect(
        canAdvanceRunWizard({
          step: 'target',
          selectedVersionId: 'ver-123',
          selectedDeviceIds: [],
          selectedGroupId: 'group-1',
          selectedAccountId: '',
          inputFields: [],
          inputValues: {},
          targetType: 'DEVICE_GROUP',
        })
      ).toBe(true);

      // ALL_DEVICES allows advance without specific device selection
      expect(
        canAdvanceRunWizard({
          step: 'target',
          selectedVersionId: 'ver-123',
          selectedDeviceIds: [],
          selectedGroupId: '',
          selectedAccountId: '',
          inputFields: [],
          inputValues: {},
          targetType: 'ALL_DEVICES',
        })
      ).toBe(true);
    });

    it('validates account step requires selectedAccountId', () => {
      expect(
        canAdvanceRunWizard({
          step: 'account',
          selectedVersionId: 'ver-123',
          selectedDeviceIds: ['dev-1'],
          selectedGroupId: '',
          selectedAccountId: '',
          inputFields: [],
          inputValues: {},
          targetType: 'SINGLE_DEVICE',
        })
      ).toBe(false);

      expect(
        canAdvanceRunWizard({
          step: 'account',
          selectedVersionId: 'ver-123',
          selectedDeviceIds: ['dev-1'],
          selectedGroupId: '',
          selectedAccountId: 'acc-1',
          inputFields: [],
          inputValues: {},
          targetType: 'SINGLE_DEVICE',
        })
      ).toBe(true);
    });

    it('validates input step requires all required fields', () => {
      const inputFields = [
        { key: 'hashtag', required: true },
        { key: 'count', required: false },
      ];

      expect(
        canAdvanceRunWizard({
          step: 'inputs',
          selectedVersionId: 'ver-123',
          selectedDeviceIds: ['dev-1'],
          selectedGroupId: '',
          selectedAccountId: 'acc-1',
          inputFields,
          inputValues: {},
          targetType: 'SINGLE_DEVICE',
        })
      ).toBe(false);

      expect(
        canAdvanceRunWizard({
          step: 'inputs',
          selectedVersionId: 'ver-123',
          selectedDeviceIds: ['dev-1'],
          selectedGroupId: '',
          selectedAccountId: 'acc-1',
          inputFields,
          inputValues: { hashtag: 'explore' },
          targetType: 'SINGLE_DEVICE',
        })
      ).toBe(true);
    });

    it('review step can always advance', () => {
      expect(
        canAdvanceRunWizard({
          step: 'review',
          selectedVersionId: 'ver-123',
          selectedDeviceIds: ['dev-1'],
          selectedGroupId: '',
          selectedAccountId: 'acc-1',
          inputFields: [],
          inputValues: {},
          targetType: 'SINGLE_DEVICE',
        })
      ).toBe(true);
    });
  });

  describe('step transitions', () => {
    it('advances forward through enabled steps correctly', () => {
      // With account and inputs
      expect(getNextRunWizardStep('macro', 1, true)).toBe('target');
      expect(getNextRunWizardStep('target', 1, true)).toBe('account');
      expect(getNextRunWizardStep('account', 1, true)).toBe('inputs');
      expect(getNextRunWizardStep('inputs', 1, true)).toBe('review');
      expect(getNextRunWizardStep('review', 1, true)).toBe('review');

      // Without account, with inputs
      expect(getNextRunWizardStep('target', 1, false)).toBe('inputs');

      // Without account, without inputs
      expect(getNextRunWizardStep('target', 0, false)).toBe('review');
    });

    it('moves backward through enabled steps correctly', () => {
      // With account and inputs
      expect(getPreviousRunWizardStep('review', 1, true)).toBe('inputs');
      expect(getPreviousRunWizardStep('inputs', 1, true)).toBe('account');
      expect(getPreviousRunWizardStep('account', 1, true)).toBe('target');
      expect(getPreviousRunWizardStep('target', 1, true)).toBe('macro');
      expect(getPreviousRunWizardStep('macro', 1, true)).toBe('macro');

      // Without account, with inputs
      expect(getPreviousRunWizardStep('inputs', 1, false)).toBe('target');

      // Without account, without inputs
      expect(getPreviousRunWizardStep('review', 0, false)).toBe('target');
    });
  });
});
