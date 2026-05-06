import type { AuditDomain } from './audit-log-insight-types';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

export function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function humanizeToken(token: string) {
  return token
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function flattenSearchTerms(value: unknown): string[] {
  if (value == null) return [];
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return [String(value)];
  }
  if (Array.isArray(value)) {
    return value.flatMap(flattenSearchTerms);
  }
  if (isRecord(value)) {
    return Object.entries(value).flatMap(([key, nested]) => [key, ...flattenSearchTerms(nested)]);
  }
  return [String(value)];
}

export function getAuditDomain(action: string, resourceType: string): AuditDomain {
  const prefix = action.split('.')[0];
  if (prefix === 'run' || resourceType === 'workflow_run') return 'RUNS';
  if (prefix === 'approval' || resourceType === 'approval') return 'APPROVALS';
  if (prefix === 'macro' || prefix === 'macro_version' || resourceType === 'macro' || resourceType === 'macro_version') return 'MACROS';
  if (prefix === 'devices' || resourceType === 'device') return 'DEVICES';
  if (prefix === 'device_group' || resourceType === 'device_group') return 'DEVICE_GROUPS';
  return 'SYSTEM';
}

export function getAuditDomainLabel(domain: AuditDomain) {
  switch (domain) {
    case 'RUNS':
      return 'Runs';
    case 'APPROVALS':
      return 'Approvals';
    case 'MACROS':
      return 'Macros';
    case 'DEVICES':
      return 'Devices';
    case 'DEVICE_GROUPS':
      return 'Device Groups';
    case 'SYSTEM':
    default:
      return 'System';
  }
}

export function getAuditActionLabel(action: string) {
  const explicitLabels: Record<string, string> = {
    'run.create': 'Run Created',
    'run.dispatch_requested': 'Dispatch Requested',
    'run.cancel': 'Run Cancel Requested',
    'approval.requested': 'Approval Requested',
    'approval.approved': 'Approval Approved',
    'approval.rejected': 'Approval Rejected',
    'macro.create': 'Macro Created',
    'macro_version.create': 'Macro Version Created',
    'macro_version.activate': 'Macro Version Activated',
    'devices.sync': 'Devices Synced',
    'device_group.create': 'Device Group Created',
    'device_group.add_device': 'Device Added To Group',
    'device_group.remove_device': 'Device Removed From Group',
  };

  return explicitLabels[action] ?? action.split('.').map(humanizeToken).join(' ');
}

export function getAuditResourceLabel(resourceType: string) {
  switch (resourceType) {
    case 'workflow_run':
      return 'Workflow Run';
    case 'macro':
      return 'Macro';
    case 'macro_version':
      return 'Macro Version';
    case 'device_group':
      return 'Device Group';
    default:
      return humanizeToken(resourceType);
  }
}
