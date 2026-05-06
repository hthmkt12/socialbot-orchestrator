import { Globe } from 'lucide-react';
import type { Device, TargetType } from '../../lib/database.types';
import { formatTargetTypeLabel } from './run-wizard-types';

interface FleetCounts {
  online: number;
  offline: number;
  busy: number;
  stale: number;
  locked: number;
}

export function RunWizardTargetContractNotice({
  declaredTargetType,
}: {
  declaredTargetType: TargetType | null;
}) {
  if (!declaredTargetType) {
    return null;
  }

  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
      <p className="text-sm font-medium text-sky-800">
        Macro target contract: {formatTargetTypeLabel(declaredTargetType)}
      </p>
      <p className="text-xs text-sky-700 mt-1">
        Target selection stays aligned with the macro definition to prevent invalid dispatch.
      </p>
    </div>
  );
}

export function RunWizardAllDevicesSummary({
  devices,
  fleetCounts,
  targetType,
}: {
  devices: Device[] | undefined;
  fleetCounts: FleetCounts;
  targetType: TargetType;
}) {
  if (targetType !== 'ALL_DEVICES' || !devices) {
    return null;
  }

  return (
    <div className="bg-gray-50 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Globe className="w-4 h-4 text-sky-500" />
        <span className="text-sm font-medium text-gray-700">All {devices.length} registered devices will be targeted</span>
      </div>
      <p className="text-xs text-gray-500">
        {fleetCounts.online} online, {fleetCounts.offline} offline, {fleetCounts.busy} busy, {fleetCounts.stale} stale heartbeat, {fleetCounts.locked} locked
      </p>
    </div>
  );
}
