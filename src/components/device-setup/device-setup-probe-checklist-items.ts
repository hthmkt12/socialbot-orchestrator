import type {
  SetupProbeKind,
  SetupProbeResult,
} from '../../lib/device-setup';
import {
  describeProbe,
  getProbeTone,
} from './device-setup-checklist-helpers';
import type { DeviceSetupChecklistItem } from './device-setup-checklist-items';

export function buildDeviceSetupProbeChecklistItems(
  probeResults: Partial<Record<SetupProbeKind, SetupProbeResult>>
): DeviceSetupChecklistItem[] {
  const currentAppTone = getProbeTone(probeResults['current-app']);
  const screenshotTone = getProbeTone(probeResults.screenshot);

  return [
    {
      title: 'Current-app live probe',
      tone: currentAppTone,
      detail: describeProbe(
        probeResults['current-app'],
        'Run the current-app probe on a selected device to verify dispatch and response flow.',
        'Current-app probe passed',
        'Current-app probe failed.'
      ),
    },
    {
      title: 'Screenshot permission probe',
      tone: screenshotTone,
      detail: describeProbe(
        probeResults.screenshot,
        'Run the screenshot probe to verify screen-capture permission and artifact transport.',
        'Screenshot probe passed',
        'Screenshot probe failed.'
      ),
    },
  ];
}
