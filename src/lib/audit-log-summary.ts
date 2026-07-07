import type { AuditLog } from './database.types';
import {
  asNumber,
  asString,
  getAuditActionLabel,
  getAuditResourceLabel,
  humanizeToken,
} from './audit-log-insight-helpers';

export function buildAuditSummary(log: AuditLog, metadata: Record<string, unknown>) {
  const stepId = asString(metadata.stepId);
  const targetType = asString(metadata.targetType);
  const status = asString(metadata.status);
  const outcome = asString(metadata.outcome);
  const count = asNumber(metadata.count);
  const reason = asString(metadata.reason);

  switch (log.action) {
    case 'run.create':
      return targetType
        ? `Created a workflow run for target mode ${humanizeToken(targetType)}.`
        : 'Created a new workflow run.';
    case 'run.dispatch_requested':
      return `Requested backend dispatch${status ? ` with status ${humanizeToken(status)}` : ''}${outcome ? ` and outcome ${humanizeToken(outcome)}` : ''}.`;
    case 'run.cancel':
      return `Requested run cancellation${status ? ` with resulting status ${humanizeToken(status)}` : ''}${outcome ? ` and outcome ${humanizeToken(outcome)}` : ''}.`;
    case 'approval.requested':
      return stepId
        ? `Run paused and requested manual review at step ${stepId}.`
        : 'Run paused and requested manual review.';
    case 'approval.approved':
      return 'Reviewer approved the waiting step so the run can resume.';
    case 'approval.rejected':
      return 'Reviewer rejected the waiting step and the run was cancelled.';
    case 'devices.sync':
      return typeof count === 'number'
        ? `Synced ${count} device${count === 1 ? '' : 's'} from the device gateway.`
        : 'Synced devices from the device gateway.';
    case 'macro.create':
      return 'Created a new reusable macro definition.';
    case 'macro_version.create':
      return 'Saved a new macro version draft.';
    case 'macro_version.activate':
      return 'Activated a macro version for future runs.';
    case 'device_group.create':
      return 'Created a new device group.';
    case 'device_group.add_device':
      return 'Added a device to a device group.';
    case 'device_group.remove_device':
      return 'Removed a device from a device group.';
    default:
      return reason ?? `${getAuditActionLabel(log.action)} on ${getAuditResourceLabel(log.resource_type)}.`;
  }
}
