import type { AuditLog } from './database.types';
import {
  asNumber,
  asString,
  humanizeToken,
} from './audit-log-insight-helpers';
import type { AuditHighlight, AuditLink } from './audit-log-insight-types';

export function buildAuditHighlights(metadata: Record<string, unknown>) {
  const highlights: AuditHighlight[] = [];
  const stepId = asString(metadata.stepId);
  const stepType = asString(metadata.stepType);
  const status = asString(metadata.status);
  const outcome = asString(metadata.outcome);
  const targetType = asString(metadata.targetType);
  const count = asNumber(metadata.count);

  if (stepId) {
    highlights.push({ key: 'stepId', label: 'Step', value: stepId, tone: 'blue' });
  }

  if (stepType) {
    highlights.push({ key: 'stepType', label: 'Step Type', value: humanizeToken(stepType), tone: 'gray' });
  }

  if (status) {
    highlights.push({ key: 'status', label: 'Status', value: humanizeToken(status), tone: 'teal' });
  }

  if (outcome) {
    highlights.push({ key: 'outcome', label: 'Outcome', value: humanizeToken(outcome), tone: 'orange' });
  }

  if (targetType) {
    highlights.push({ key: 'targetType', label: 'Target', value: humanizeToken(targetType), tone: 'yellow' });
  }

  if (typeof count === 'number') {
    highlights.push({ key: 'count', label: 'Count', value: String(count), tone: 'gray' });
  }

  return highlights;
}

export function buildAuditRelatedLinks(log: AuditLog, metadata: Record<string, unknown>) {
  const links: AuditLink[] = [];
  const runId =
    (log.resource_type === 'workflow_run' ? log.resource_id : undefined) ??
    asString(metadata.workflowRunId);
  const approvalId =
    (log.resource_type === 'approval' ? log.resource_id : undefined) ??
    asString(metadata.approvalId);
  const macroId =
    (log.resource_type === 'macro' ? log.resource_id : undefined) ??
    asString(metadata.macroId);
  const stepId = asString(metadata.stepId);

  if (runId) {
    links.push({ key: 'run-detail', label: 'Run Detail', to: `/runs/${runId}`, tone: 'blue' });
    links.push({ key: 'run-monitor', label: 'Run Monitor', to: `/runs/${runId}/monitor`, tone: 'teal' });
    if (stepId) {
      links.push({
        key: 'run-evidence',
        label: 'Step Evidence',
        to: `/runs/${runId}?stepId=${encodeURIComponent(stepId)}`,
        tone: 'orange',
      });
    }
  }

  if (approvalId || log.action.startsWith('approval.')) {
    const query = new URLSearchParams();
    if (approvalId) query.set('approvalId', approvalId);
    if (runId) query.set('runId', runId);
    links.push({
      key: 'approval-context',
      label: 'Approval Context',
      to: `/approvals?${query.toString()}`,
      tone: 'yellow',
    });
  }

  if (macroId) {
    links.push({ key: 'macro', label: 'Open Macro', to: `/macros/${macroId}`, tone: 'teal' });
  }

  return links;
}
