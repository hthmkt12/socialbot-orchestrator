import { Globe, Smartphone, Users } from 'lucide-react';
import type { TargetType } from '../../lib/database.types';

export type WizardStep = 'macro' | 'target' | 'inputs' | 'review';

export const stepLabels: Record<WizardStep, string> = {
  macro: 'Select Macro',
  target: 'Choose Targets',
  inputs: 'Configure Inputs',
  review: 'Review & Execute',
};

export const targetOptions: {
  type: TargetType;
  label: string;
  description: string;
  icon: typeof Smartphone;
}[] = [
  { type: 'SINGLE_DEVICE', label: 'Single Device', description: 'Execute on one specific device', icon: Smartphone },
  { type: 'MULTI_DEVICE', label: 'Multiple Devices', description: 'Select multiple devices', icon: Users },
  { type: 'DEVICE_GROUP', label: 'Device Group', description: 'Run on an entire group', icon: Users },
  { type: 'ALL_DEVICES', label: 'All Devices', description: 'Execute across every registered device', icon: Globe },
];

export function formatTargetTypeLabel(target: TargetType) {
  return target
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
