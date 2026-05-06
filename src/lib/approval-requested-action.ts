import type { Approval } from './database.types';
import type { ApprovalStepConfig } from './approval-insight-helpers';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function extractReasonTail(reason: string) {
  const separatorIndex = reason.indexOf(':');
  if (separatorIndex === -1) return reason;
  const tail = reason.slice(separatorIndex + 1).trim();
  return tail.length > 0 ? tail : reason;
}

function pickFirstString(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = asString(source[key]);
    if (value) return value;
  }
  return undefined;
}

function buildApprovalMetadata(approval: Approval) {
  return {
    ...(isRecord(approval.payload_json) ? approval.payload_json : {}),
    ...(isRecord(approval.metadata) ? approval.metadata : {}),
  };
}

export function buildApprovalRequestedActionValue(
  approval: Approval,
  config: ApprovalStepConfig
) {
  const metadata = buildApprovalMetadata(approval);
  const directValue = pickFirstString(metadata, [
    'command',
    'scriptName',
    'filePath',
    'scriptPath',
    'packageName',
    'appName',
    'targetLabel',
    'target',
    'description',
  ]);

  if (directValue) return directValue;
  if (config.requestedActionLabel === 'Requested Action') return approval.reason;
  return extractReasonTail(approval.reason);
}
